import "dotenv/config";
import { createServer } from "node:http";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { gzipSync } from "node:zlib";
import { OAuth2Client } from "google-auth-library";
import { MongoClient, MongoServerError, type Collection } from "mongodb";
import nodemailer from "nodemailer";
import Razorpay from "razorpay";

// ── Structured logger ─────────────────────────────────────────
// Outputs JSON lines in production (easy to pipe into Datadog/Papertrail/Logtail)
// or readable text in development.
const IS_PROD = process.env.NODE_ENV === "production";
const log = {
  info:  (msg: string, meta?: Record<string, unknown>) => writeLog("INFO",  msg, meta),
  warn:  (msg: string, meta?: Record<string, unknown>) => writeLog("WARN",  msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => writeLog("ERROR", msg, meta),
};

function writeLog(level: string, msg: string, meta?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  if (IS_PROD) {
    // JSON-lines format for log aggregation services
    process.stdout.write(JSON.stringify({ ts, level, msg, ...meta }) + "\n");
  } else {
    const prefix = level === "ERROR" ? "\x1b[31m" : level === "WARN" ? "\x1b[33m" : "\x1b[36m";
    const metaStr = meta ? " " + JSON.stringify(meta) : "";
    console.log(`${prefix}[${level}]\x1b[0m ${ts} ${msg}${metaStr}`);
  }
}

type UserPreferences = {
  marketingEmails: boolean;
  productUpdates: boolean;
  darkMode: boolean;
};

type StoredUser = {
  _id?: string;
  id: string;
  name: string;
  email: string;
  passwordHash?: string;
  phone?: string;
  company?: string;
  avatarUrl?: string;
  plan: "free" | "pro" | "team";
  authProviders: {
    password: boolean;
    google: boolean;
  };
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
};

type ContactMessage = {
  _id?: string;
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: Date;
};

type SupportTicket = {
  _id?: string;
  id: string;
  userId?: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved";
  createdAt: Date;
};

type OtpRecord = {
  _id?: string;
  id: string;
  email: string;
  codeHash: string;
  purpose: "login" | "reset";
  expiresAt: Date;
  createdAt: Date;
};

type SubscriptionRecord = {
  _id?: string;
  id: string;
  userId: string;
  email: string;
  plan: "pro" | "team";
  status: "pending" | "active" | "cancelled";
  provider: "razorpay";
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  createdAt: Date;
  updatedAt: Date;
};

type SessionUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  avatarUrl?: string;
  plan: "free" | "pro" | "team";
  preferences: UserPreferences;
};

type PublicPlan = {
  id: "free" | "pro" | "team";
  title: string;
  priceLabel: string;
  interval: string;
  description: string;
  features: string[];
  cta: string;
};

const mongoUri = process.env.MONGODB_URI ?? "";
const databaseName = process.env.MONGODB_DB_NAME ?? process.env.MONGODB_DB ?? "pdfsolution";
const port = Number(process.env.PORT ?? process.env.AUTH_PORT ?? 3001);
const appBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:5173";
const googleClientId = process.env.GOOGLE_CLIENT_ID ?? "";
const razorpayKeyId = process.env.RAZORPAY_KEY_ID ?? "";
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
const razorpayPlanAmountPro = Number(process.env.RAZORPAY_PLAN_AMOUNT_PRO ?? 49900);
const razorpayPlanAmountTeam = Number(process.env.RAZORPAY_PLAN_AMOUNT_TEAM ?? 149900);
const smtpHost = process.env.SMTP_HOST ?? "";
const smtpPort = Number(process.env.SMTP_PORT ?? 587);
const smtpSecure = String(process.env.SMTP_SECURE ?? "false").toLowerCase() === "true";
const smtpUser = process.env.SMTP_USER ?? "";
const smtpPass = process.env.SMTP_PASS ?? "";
const smtpFrom = (process.env.SMTP_FROM ?? process.env.SMTP_FROM_EMAIL ?? "").trim();

const SESSION_TTL_MS = 24 * 60 * 60 * 1_000; // 24 hours
type SessionEntry = { user: SessionUser; expiresAt: number };
const sessions = new Map<string, SessionEntry>();

// Purge expired sessions every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of sessions) {
    if (entry.expiresAt < now) sessions.delete(token);
  }
}, 30 * 60_000).unref();

// ── Login attempt lockout (per email) ────────────────────────
// 5 wrong password/OTP attempts → 15-minute cooldown
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS   = 15 * 60_000; // 15 min
type LockEntry = { count: number; lockedUntil: number };
const loginAttempts = new Map<string, LockEntry>();

function checkLockout(email: string): { locked: boolean; retryAfterSecs?: number } {
  const entry = loginAttempts.get(email);
  if (!entry) return { locked: false };
  if (entry.lockedUntil > Date.now()) {
    const retryAfterSecs = Math.ceil((entry.lockedUntil - Date.now()) / 1_000);
    return { locked: true, retryAfterSecs };
  }
  return { locked: false };
}

function recordFailedAttempt(email: string): void {
  const entry = loginAttempts.get(email) ?? { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= LOGIN_MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
    entry.count = 0; // reset counter so next window starts fresh after lockout
  }
  loginAttempts.set(email, entry);
}

function clearAttempts(email: string): void {
  loginAttempts.delete(email);
}

// Purge old lockout entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [email, entry] of loginAttempts) {
    if (entry.lockedUntil < now && entry.count === 0) loginAttempts.delete(email);
  }
}, 60 * 60_000).unref();

// ── Input helpers ─────────────────────────────────────────────
// Strip HTML tags and dangerous characters from user-supplied text.
function sanitize(str: string): string {
  return str.replace(/<[^>]*>/g, "").replace(/[&"'`]/g, (c) =>
    c === "&" ? "&amp;" : c === '"' ? "&quot;" : c === "'" ? "&#x27;" : "&#x60;"
  ).trim();
}

// Basic email format check
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

// Avatar URL must be a reachable HTTPS URL (no data: URIs, no localhost)
function isValidAvatarUrl(url: string): boolean {
  if (!url) return true; // empty is fine — clears avatar
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.hostname.includes("localhost");
  } catch {
    return false;
  }
}

// Password strength: ≥8 chars, at least 1 letter and 1 number
function isStrongPassword(pw: string): boolean {
  return pw.length >= 8 && /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw);
}

const publicPlans: PublicPlan[] = [
  {
    id: "free",
    title: "Starter",
    priceLabel: "Rs 0",
    interval: "Forever free",
    description: "For trying core PDF tools with light usage.",
    features: ["Merge, split, compress, and extract", "Basic support form access", "Browser-based workflows"],
    cta: "Current entry plan",
  },
  {
    id: "pro",
    title: "Professional",
    priceLabel: "Rs 499",
    interval: "per month",
    description: "For freelancers and power users who need premium flows.",
    features: ["Priority processing", "Account dashboard and history", "Premium conversions and support"],
    cta: "Upgrade to Pro",
  },
  {
    id: "team",
    title: "Business",
    priceLabel: "Rs 1499",
    interval: "per month",
    description: "For teams managing shared document workflows.",
    features: ["Team-oriented billing", "High-volume processing", "Faster support response"],
    cta: "Start Business plan",
  },
];

let usersCollection: Collection<StoredUser>;
let contactMessagesCollection: Collection<ContactMessage>;
let supportTicketsCollection: Collection<SupportTicket>;
let otpCollection: Collection<OtpRecord>;
let subscriptionsCollection: Collection<SubscriptionRecord>;

const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null;
const razorpay = razorpayKeyId && razorpayKeySecret
  ? new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    })
  : null;
const mailer = smtpHost && smtpUser && smtpPass && smtpFrom
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    })
  : null;

// ----- Security helpers -----

const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS ?? appBaseUrl)
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
);

function getCorsOrigin(req: import("node:http").IncomingMessage): string {
  const origin = req.headers["origin"] ?? "";
  return ALLOWED_ORIGINS.has(origin) ? origin : (ALLOWED_ORIGINS.values().next().value as string);
}

// Simple in-memory rate limiter (IP → window start + count)
const rateLimitWindows = new Map<string, { start: number; count: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60; // requests per window per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitWindows.get(ip);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW_MS) {
    rateLimitWindows.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

// Stricter limit for auth endpoints (20 req / min)
const authRateLimitWindows = new Map<string, { start: number; count: number }>();
const AUTH_RATE_LIMIT_MAX = 20;

function isAuthRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = authRateLimitWindows.get(ip);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW_MS) {
    authRateLimitWindows.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > AUTH_RATE_LIMIT_MAX;
}

// Periodically clear old entries to avoid memory leaks
setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  for (const [key, val] of rateLimitWindows) {
    if (val.start < cutoff) rateLimitWindows.delete(key);
  }
  for (const [key, val] of authRateLimitWindows) {
    if (val.start < cutoff) authRateLimitWindows.delete(key);
  }
}, 5 * 60_000).unref();

function sendJson(
  res: import("node:http").ServerResponse,
  statusCode: number,
  payload: unknown,
  req?: import("node:http").IncomingMessage,
  opts?: { cacheSeconds?: number },
) {
  const origin = req ? getCorsOrigin(req) : (ALLOWED_ORIGINS.values().next().value as string);
  const body = Buffer.from(JSON.stringify(payload), "utf8");

  // Gzip if client supports it and payload > 512 bytes
  const acceptEncoding = req?.headers["accept-encoding"] ?? "";
  const useGzip = body.byteLength > 512 && acceptEncoding.includes("gzip");
  const responseBody = useGzip ? gzipSync(body) : body;

  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": String(responseBody.byteLength),
    // ── CORS ─────────────────────────────────────────────────
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    // ── Security headers ──────────────────────────────────────
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-XSS-Protection": "0",   // CSP supersedes this; "1" can introduce vulnerabilities
    // Content-Security-Policy: lock down what can execute in the browser
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://accounts.google.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self' https://checkout.razorpay.com https://accounts.google.com",
      "frame-src https://checkout.razorpay.com https://accounts.google.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
    // Disable browser features the app does not use
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  };

  if (useGzip) headers["Content-Encoding"] = "gzip";
  if (opts?.cacheSeconds) {
    headers["Cache-Control"] = `public, max-age=${opts.cacheSeconds}, stale-while-revalidate=60`;
  } else {
    headers["Cache-Control"] = "no-store";
  }

  res.writeHead(statusCode, headers);
  res.end(responseBody);
}

async function readBody(req: import("node:http").IncomingMessage): Promise<Record<string, unknown>> {
  const MAX_BODY_BYTES = 100 * 1024; // 100 KB — prevents request-body DoS
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buf.byteLength;
    if (totalBytes > MAX_BODY_BYTES) {
      req.resume(); // drain remaining data
      throw Object.assign(new Error("Request body too large (max 100 KB)."), { statusCode: 413 });
    }
    chunks.push(buf);
  }

  if (chunks.length === 0) return {};

  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // malformed JSON — treat as empty body
  }
  return {};
}

function hashSecret(secret: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(secret, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifySecret(secret: string, storedHash: string) {
  const [salt, existing] = storedHash.split(":");
  if (!salt || !existing) {
    return false;
  }

  const derived = scryptSync(secret, salt, 64);
  const existingBuffer = Buffer.from(existing, "hex");
  if (existingBuffer.length !== derived.length) {
    return false;
  }

  return timingSafeEqual(existingBuffer, derived);
}

function getToken(req: import("node:http").IncomingMessage) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  return header.slice(7);
}

function toSessionUser(user: StoredUser): SessionUser {
  return {
    id: user.id,
    name: user.name ?? "",
    email: user.email ?? "",
    phone: user.phone,
    company: user.company,
    avatarUrl: user.avatarUrl,
    plan: user.plan ?? "free",
    // Back-fill for users created before preferences were introduced
    preferences: user.preferences ?? createDefaultPreferences(),
  };
}

function createSession(user: StoredUser) {
  const token = randomBytes(24).toString("hex");
  const sessionUser = toSessionUser(user);
  sessions.set(token, { user: sessionUser, expiresAt: Date.now() + SESSION_TTL_MS });
  return { token, user: sessionUser };
}

function refreshSession(token: string, sessionUser: SessionUser) {
  sessions.set(token, { user: sessionUser, expiresAt: Date.now() + SESSION_TTL_MS });
}

function getAuthenticatedUser(req: import("node:http").IncomingMessage) {
  const token = getToken(req);
  if (!token) return null;

  const entry = sessions.get(token);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    sessions.delete(token); // expired — force re-login
    return null;
  }
  return { token, user: entry.user };
}

function createDefaultPreferences(): UserPreferences {
  return {
    marketingEmails: false,
    productUpdates: true,
    darkMode: false,
  };
}

function createPasswordUser(name: string, email: string, password: string): StoredUser {
  const now = new Date();
  return {
    id: randomBytes(12).toString("hex"),
    name,
    email,
    passwordHash: hashSecret(password),
    plan: "free",
    authProviders: {
      password: true,
      google: false,
    },
    preferences: createDefaultPreferences(),
    createdAt: now,
    updatedAt: now,
  };
}

async function connectToDatabase() {
  if (!mongoUri) {
    throw new Error("Missing MONGODB_URI. Add it to your .env file before starting the server.");
  }

  const isDev = process.env.NODE_ENV !== "production";
  const client = new MongoClient(mongoUri, {
    // Fix for Windows + Node.js 18+ OpenSSL 3.x TLS session-ticket bug with Atlas
    tls: true,
    tlsAllowInvalidCertificates: isDev,
    // Connection pool hygiene — recycle idle connections before Atlas drops them
    maxPoolSize: 10,
    minPoolSize: 0,
    maxIdleTimeMS: 15_000,
    serverSelectionTimeoutMS: 30_000,
    connectTimeoutMS: 30_000,
    socketTimeoutMS: 45_000,
  });
  await client.connect();

  const db = client.db(databaseName);
  usersCollection = db.collection<StoredUser>("users");
  contactMessagesCollection = db.collection<ContactMessage>("contactMessages");
  supportTicketsCollection = db.collection<SupportTicket>("supportTickets");
  otpCollection = db.collection<OtpRecord>("otpCodes");
  subscriptionsCollection = db.collection<SubscriptionRecord>("subscriptions");

  await usersCollection.createIndex({ email: 1 }, { unique: true });
  await contactMessagesCollection.createIndex({ createdAt: -1 });
  await supportTicketsCollection.createIndex({ createdAt: -1 });
  await otpCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await subscriptionsCollection.createIndex({ userId: 1, createdAt: -1 });

  log.info(`Connected to MongoDB`, { db: databaseName });
}

async function sendOtpEmail(email: string, code: string, purpose: "login" | "reset") {
  if (!mailer) {
    throw new Error("OTP email delivery is not configured yet. Add SMTP credentials to the server .env file.");
  }

  const subject = purpose === "login" ? "Your PDF Solution login OTP" : "Your PDF Solution password reset OTP";
  const heading = purpose === "login" ? "Use this OTP to sign in" : "Use this OTP to reset your password";

  await mailer.sendMail({
    from: smtpFrom,
    to: email,
    subject,
    html: `<div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6"><h2>${heading}</h2><p>Your one-time password is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes.</p></div>`,
  });
}

async function storeOtp(email: string, purpose: "login" | "reset") {
  const code = `${Math.floor(100000 + Math.random() * 900000)}`;
  await otpCollection.deleteMany({ email, purpose });
  await otpCollection.insertOne({
    id: randomBytes(12).toString("hex"),
    email,
    codeHash: hashSecret(code),
    purpose,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    createdAt: new Date(),
  });
  return code;
}

async function createOrMergeGoogleUser(payload: { name: string; email: string; picture?: string }) {
  const existing = await usersCollection.findOne({ email: payload.email });
  const now = new Date();

  if (existing) {
    const nextUser: StoredUser = {
      ...existing,
      name: existing.name || payload.name,
      avatarUrl: existing.avatarUrl || payload.picture,
      plan: existing.plan ?? "free",
      authProviders: {
        password: existing.authProviders?.password ?? false,
        google: true,
      },
      // Back-fill missing fields for users created before these were added
      preferences: existing.preferences ?? createDefaultPreferences(),
      updatedAt: now,
    };
    await usersCollection.updateOne({ id: existing.id }, { $set: nextUser });
    return nextUser;
  }

  const nextUser: StoredUser = {
    id: randomBytes(12).toString("hex"),
    name: payload.name,
    email: payload.email,
    avatarUrl: payload.picture,
    plan: "free",
    authProviders: {
      password: false,
      google: true,
    },
    preferences: createDefaultPreferences(),
    createdAt: now,
    updatedAt: now,
  };

  await usersCollection.insertOne(nextUser);
  return nextUser;
}

const server = createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 404, { message: "Not found." }, req);
    return;
  }

  // Handle CORS pre-flight for all routes
  if (req.method === "OPTIONS") {
    const origin = getCorsOrigin(req);
    res.writeHead(204, {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "86400",
    });
    res.end();
    return;
  }

  // Global rate limit
  const clientIp = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";
  if (isRateLimited(clientIp)) {
    sendJson(res, 429, { message: "Too many requests. Please slow down." }, req);
    return;
  }

  // Stricter limit for auth routes
  const isAuthRoute = req.url.startsWith("/api/auth");
  if (isAuthRoute && isAuthRateLimited(clientIp)) {
    sendJson(res, 429, { message: "Too many authentication attempts. Please wait a minute." }, req);
    return;
  }

  try {
    // ── Health check — used by PM2, load balancers, and uptime monitors ──────
    if (req.method === "GET" && req.url === "/api/health") {
      const memMb = Math.round(process.memoryUsage().heapUsed / 1_048_576);
      const uptimeSec = Math.round(process.uptime());
      // Quick DB ping — if it throws, the 500 handler catches it and monitoring alerts
      await usersCollection.findOne({}, { projection: { _id: 1 }, maxTimeMS: 3_000 });
      sendJson(res, 200, {
        status: "ok",
        uptime: uptimeSec,
        memoryMb: memMb,
        timestamp: new Date().toISOString(),
      }, req, { cacheSeconds: 0 });
      return;
    }

    if (req.method === "GET" && req.url === "/api/app/config") {
      // Cache for 5 minutes — config rarely changes
      sendJson(res, 200, {
        googleLoginEnabled: Boolean(googleClientId),
        googleClientId: googleClientId,   // public — safe to expose
        otpEnabled: Boolean(mailer),
        billingEnabled: Boolean(razorpay && razorpayKeyId),
      }, req, { cacheSeconds: 300 });
      return;
    }

    if (req.method === "GET" && req.url === "/api/subscriptions/plans") {
      // Cache for 10 minutes — plan list is stable
      sendJson(res, 200, { plans: publicPlans }, req, { cacheSeconds: 600 });
      return;
    }

    if (req.method === "POST" && req.url === "/api/auth/signup") {
      const body = (await readBody(req)) as { name?: string; email?: string; password?: string };
      const name = sanitize(body.name?.trim() ?? "");
      const email = body.email?.trim().toLowerCase() ?? "";
      const password = body.password ?? "";

      if (!name) {
        sendJson(res, 400, { message: "Please provide your full name." }, req);
        return;
      }
      if (!isValidEmail(email)) {
        sendJson(res, 400, { message: "Please provide a valid email address." }, req);
        return;
      }
      if (!isStrongPassword(password)) {
        sendJson(res, 400, { message: "Password must be at least 8 characters and contain a letter and a number." }, req);
        return;
      }

      const nextUser = createPasswordUser(name, email, password);

      try {
        await usersCollection.insertOne(nextUser);
      } catch (error) {
        if (error instanceof MongoServerError && error.code === 11000) {
          sendJson(res, 409, { message: "An account with this email already exists." }, req);
          return;
        }
        throw error;
      }

      sendJson(res, 201, createSession(nextUser), req);
      return;
    }

    if (req.method === "POST" && req.url === "/api/auth/login") {
      const body = (await readBody(req)) as { email?: string; password?: string };
      const email = body.email?.trim().toLowerCase() ?? "";
      const password = body.password ?? "";

      if (!isValidEmail(email)) {
        sendJson(res, 400, { message: "Please provide a valid email address." }, req);
        return;
      }

      // Check lockout before hitting the database
      const lockout = checkLockout(email);
      if (lockout.locked) {
        sendJson(res, 429, { message: `Too many failed attempts. Try again in ${lockout.retryAfterSecs} seconds.` }, req);
        return;
      }

      const matchedUser = await usersCollection.findOne({ email });

      if (!matchedUser?.passwordHash || !verifySecret(password, matchedUser.passwordHash)) {
        recordFailedAttempt(email);
        // Generic message — don't reveal whether the email exists
        sendJson(res, 401, { message: "Invalid email or password." }, req);
        return;
      }

      clearAttempts(email); // successful login resets the counter
      sendJson(res, 200, createSession(matchedUser), req);
      return;
    }

    if (req.method === "POST" && req.url === "/api/auth/google") {
      if (!googleClient) {
        sendJson(res, 503, { message: "Google login is not configured yet. Add GOOGLE_CLIENT_ID to the server environment." }, req);
        return;
      }

      const body = (await readBody(req)) as { credential?: string };
      const credential = body.credential?.trim() ?? "";
      if (!credential) {
        sendJson(res, 400, { message: "Missing Google credential." }, req);
        return;
      }

      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: googleClientId,
      });
      const payload = ticket.getPayload();
      if (!payload?.email || !payload.name) {
        sendJson(res, 400, { message: "Unable to verify your Google account." }, req);
        return;
      }

      const user = await createOrMergeGoogleUser({
        name: payload.name,
        email: payload.email,
        picture: payload.picture,
      });

      sendJson(res, 200, createSession(user), req);
      return;
    }

    if (req.method === "POST" && req.url === "/api/auth/otp/request") {
      const body = (await readBody(req)) as { email?: string; purpose?: "login" | "reset" };
      const email = body.email?.trim().toLowerCase() ?? "";
      const purpose = body.purpose === "reset" ? "reset" : "login";
      if (!email) {
        sendJson(res, 400, { message: "Please provide your email address." }, req);
        return;
      }

      const matchedUser = await usersCollection.findOne({ email });
      if (!matchedUser) {
        sendJson(res, 404, { message: "No account was found for that email address." }, req);
        return;
      }

      const code = await storeOtp(email, purpose);
      await sendOtpEmail(email, code, purpose);
      sendJson(res, 200, { message: purpose === "login" ? "OTP sent to your email address." : "Password reset OTP sent to your email address." }, req);
      return;
    }

    if (req.method === "POST" && req.url === "/api/auth/otp/verify") {
      const body = (await readBody(req)) as { email?: string; code?: string; purpose?: "login" | "reset"; newPassword?: string };
      const email = body.email?.trim().toLowerCase() ?? "";
      const code = body.code?.trim() ?? "";
      const purpose = body.purpose === "reset" ? "reset" : "login";
      const newPassword = body.newPassword ?? "";

      if (!email || !code) {
        sendJson(res, 400, { message: "Email and OTP code are required." }, req);
        return;
      }

      // OTP brute-force: check lockout per email
      const lockout = checkLockout(email);
      if (lockout.locked) {
        sendJson(res, 429, { message: `Too many failed attempts. Try again in ${lockout.retryAfterSecs} seconds.` }, req);
        return;
      }

      const otpRecord = await otpCollection.findOne({ email, purpose });
      if (!otpRecord || otpRecord.expiresAt.getTime() < Date.now() || !verifySecret(code, otpRecord.codeHash)) {
        recordFailedAttempt(email);
        sendJson(res, 401, { message: "Invalid or expired OTP code." }, req);
        return;
      }

      clearAttempts(email);
      const matchedUser = await usersCollection.findOne({ email });
      if (!matchedUser) {
        sendJson(res, 404, { message: "No account was found for that email address." }, req);
        return;
      }

      await otpCollection.deleteMany({ email, purpose });

      if (purpose === "reset") {
        if (!isStrongPassword(newPassword)) {
          sendJson(res, 400, { message: "New password must be at least 8 characters and contain a letter and a number." }, req);
          return;
        }

        const updatedUser: StoredUser = {
          ...matchedUser,
          passwordHash: hashSecret(newPassword),
          authProviders: {
            ...(matchedUser.authProviders ?? { google: false }),
            password: true,
          },
          updatedAt: new Date(),
        };
        await usersCollection.updateOne({ id: matchedUser.id }, { $set: updatedUser });
        sendJson(res, 200, { message: "Password updated successfully. You can now log in." }, req);
        return;
      }

      sendJson(res, 200, createSession(matchedUser), req);
      return;
    }

    if (req.method === "GET" && req.url === "/api/auth/me") {
      const auth = getAuthenticatedUser(req);
      if (!auth) {
        sendJson(res, 401, { message: "Unauthorized." }, req);
        return;
      }

      sendJson(res, 200, { user: auth.user }, req);
      return;
    }

    if (req.method === "POST" && req.url === "/api/auth/logout") {
      const token = getToken(req);
      if (token) {
        sessions.delete(token);
      }
      sendJson(res, 200, { success: true }, req);
      return;
    }

    if (req.method === "GET" && req.url === "/api/profile") {
      const auth = getAuthenticatedUser(req);
      if (!auth) {
        sendJson(res, 401, { message: "Unauthorized." }, req);
        return;
      }

      const user = await usersCollection.findOne({ id: auth.user.id });
      if (!user) {
        sendJson(res, 404, { message: "Profile not found." }, req);
        return;
      }

      sendJson(res, 200, { profile: toSessionUser(user) }, req);
      return;
    }

    if (req.method === "PUT" && req.url === "/api/profile") {
      const auth = getAuthenticatedUser(req);
      if (!auth) {
        sendJson(res, 401, { message: "Unauthorized." }, req);
        return;
      }

      const user = await usersCollection.findOne({ id: auth.user.id });
      if (!user) {
        sendJson(res, 404, { message: "Profile not found." }, req);
        return;
      }

      const body = (await readBody(req)) as {
        name?: string;
        phone?: string;
        company?: string;
        avatarUrl?: string;
        preferences?: Partial<UserPreferences>;
      };

      const rawAvatarUrl = body.avatarUrl?.trim() ?? "";
      if (rawAvatarUrl && !isValidAvatarUrl(rawAvatarUrl)) {
        sendJson(res, 400, { message: "Avatar URL must be a valid HTTPS link." }, req);
        return;
      }

      // Sanitize free-text fields to strip HTML/script injection attempts
      const updatedUser: StoredUser = {
        ...user,
        name: sanitize(body.name?.trim() ?? "") || user.name,
        phone: sanitize(body.phone?.trim() ?? ""),
        company: sanitize(body.company?.trim() ?? ""),
        avatarUrl: rawAvatarUrl,
        preferences: {
          ...user.preferences,
          // Only accept known boolean preference keys
          marketingEmails: typeof body.preferences?.marketingEmails === "boolean" ? body.preferences.marketingEmails : user.preferences.marketingEmails,
          productUpdates: typeof body.preferences?.productUpdates === "boolean" ? body.preferences.productUpdates : user.preferences.productUpdates,
          darkMode: typeof body.preferences?.darkMode === "boolean" ? body.preferences.darkMode : user.preferences.darkMode,
        },
        updatedAt: new Date(),
      };

      await usersCollection.updateOne({ id: user.id }, { $set: updatedUser });
      const sessionUser = toSessionUser(updatedUser);
      refreshSession(auth.token, sessionUser);
      sendJson(res, 200, { user: sessionUser, message: "Profile updated successfully." }, req);
      return;
    }

    if (req.method === "GET" && req.url === "/api/dashboard") {
      const auth = getAuthenticatedUser(req);
      if (!auth) {
        sendJson(res, 401, { message: "Unauthorized." }, req);
        return;
      }

      const [supportCount, contactCount, subscription] = await Promise.all([
        supportTicketsCollection.countDocuments({ userId: auth.user.id }),
        contactMessagesCollection.countDocuments({ email: auth.user.email }),
        subscriptionsCollection.find({ userId: auth.user.id }).sort({ createdAt: -1 }).limit(1).next(),
      ]);

      sendJson(res, 200, {
        dashboard: {
          user: auth.user,
          stats: {
            supportTickets: supportCount,
            contactMessages: contactCount,
            currentPlan: subscription?.plan ?? auth.user.plan,
            billingStatus: subscription?.status ?? "free",
          },
        },
      }, req);
      return;
    }

    if (req.method === "POST" && req.url === "/api/support") {
      const body = (await readBody(req)) as { name?: string; email?: string; subject?: string; message?: string };
      const name    = sanitize(body.name?.trim() ?? "");
      const email   = body.email?.trim().toLowerCase() ?? "";
      const subject = sanitize(body.subject?.trim() ?? "General support request").slice(0, 200);
      const message = sanitize(body.message?.trim() ?? "").slice(0, 5_000);

      if (!name || !isValidEmail(email) || !message) {
        sendJson(res, 400, { message: "Please provide your name, a valid email, and a support message." }, req);
        return;
      }

      const auth = getAuthenticatedUser(req);
      await supportTicketsCollection.insertOne({
        id: randomBytes(12).toString("hex"),
        userId: auth?.user.id,
        name,
        email,
        subject,
        message,
        status: "open",
        createdAt: new Date(),
      });

      sendJson(res, 201, { success: true, message: "Support request submitted successfully." }, req);
      return;
    }

    if (req.method === "POST" && req.url === "/api/contact") {
      const body = (await readBody(req)) as { name?: string; email?: string; message?: string };
      const name    = sanitize(body.name?.trim() ?? "");
      const email   = body.email?.trim().toLowerCase() ?? "";
      const message = sanitize(body.message?.trim() ?? "").slice(0, 5_000);

      if (!name || !isValidEmail(email) || !message) {
        sendJson(res, 400, { message: "Please provide your name, a valid email, and a message." }, req);
        return;
      }

      if (message.length < 10) {
        sendJson(res, 400, { message: "Please enter a more detailed message (at least 10 characters)." }, req);
        return;
      }

      await contactMessagesCollection.insertOne({
        id: randomBytes(12).toString("hex"),
        name,
        email,
        message,
        createdAt: new Date(),
      });

      sendJson(res, 201, {
        success: true,
        message: "Thanks, your message has been saved. Vishal will be able to review it from the database.",
      });
      return;
    }

    if (req.method === "POST" && req.url === "/api/billing/create-checkout-session") {
      const auth = getAuthenticatedUser(req);
      if (!auth) {
        sendJson(res, 401, { message: "Please log in before starting a subscription." }, req);
        return;
      }

      if (!razorpay) {
        sendJson(res, 503, { message: "Razorpay billing is not configured yet. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the server environment." }, req);
        return;
      }

      const body = (await readBody(req)) as { planId?: "pro" | "team" };
      const planId = body.planId === "team" ? "team" : "pro";
      const amount = planId === "team" ? razorpayPlanAmountTeam : razorpayPlanAmountPro;

      const order = await razorpay.orders.create({
        amount,
        currency: "INR",
        receipt: ("r-" + auth.user.id + "-" + Date.now()).slice(-40),
        notes: {
          userId: auth.user.id,
          email: auth.user.email,
          planId,
          billingType: "subscription_like_monthly",
        },
      });

      await subscriptionsCollection.insertOne({
        id: randomBytes(12).toString("hex"),
        userId: auth.user.id,
        email: auth.user.email,
        plan: planId,
        status: "pending",
        provider: "razorpay",
        razorpayOrderId: order.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      sendJson(res, 200, {
        provider: "razorpay",
        keyId: razorpayKeyId,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        name: "PDF Solution",
        description: planId === "team" ? "Business Plan Subscription" : "Professional Plan Subscription",
        prefill: {
          name: auth.user.name,
          email: auth.user.email,
          contact: auth.user.phone ?? "",
        },
        notes: {
          planId,
          userId: auth.user.id,
        },
      });
      return;
    }

    // Razorpay payment verification — called by frontend after checkout success
    if (req.method === "POST" && req.url === "/api/billing/verify-payment") {
      const auth = getAuthenticatedUser(req);
      if (!auth) {
        sendJson(res, 401, { message: "Please log in to verify your payment." }, req);
        return;
      }

      if (!razorpay || !razorpayKeySecret) {
        sendJson(res, 503, { message: "Billing not configured." }, req);
        return;
      }

      const body = (await readBody(req)) as {
        razorpay_order_id?: string;
        razorpay_payment_id?: string;
        razorpay_signature?: string;
        planId?: string;
      };

      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } = body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        sendJson(res, 400, { message: "Missing payment verification fields." }, req);
        return;
      }

      // Verify Razorpay HMAC signature
      const { createHmac } = await import("node:crypto");
      const expectedSig = createHmac("sha256", razorpayKeySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      if (expectedSig !== razorpay_signature) {
        sendJson(res, 400, { message: "Payment verification failed — invalid signature." }, req);
        return;
      }

      // Upgrade user plan and mark subscription active
      const plan: "pro" | "team" = planId === "team" ? "team" : "pro";
      await Promise.all([
        subscriptionsCollection.updateOne(
          { razorpayOrderId: razorpay_order_id },
          { $set: { status: "active", razorpayPaymentId: razorpay_payment_id, updatedAt: new Date() } },
        ),
        usersCollection.updateOne(
          { id: auth.user.id },
          { $set: { plan, updatedAt: new Date() } },
        ),
      ]);

      const updatedUser = await usersCollection.findOne({ id: auth.user.id });
      if (updatedUser) {
        const sessionUser = toSessionUser(updatedUser);
        refreshSession(auth.token, sessionUser);
        sendJson(res, 200, { success: true, user: sessionUser, message: `Upgraded to ${plan} plan successfully!` }, req);
      } else {
        sendJson(res, 200, { success: true, message: "Payment verified." }, req);
      }
      return;
    }

    sendJson(res, 404, { message: "Not found." }, req);
  } catch (error) {
    log.error("Request error", { method: req.method, url: req.url, err: String(error) });
    const message = error instanceof Error ? error.message : "Server error.";
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    sendJson(res, statusCode, { message }, req);
  }
});

// ── Request timeout — close hung connections after 30 s ──────────────────────
server.timeout = 30_000;
server.keepAliveTimeout = 61_000; // slightly above any load-balancer default

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function gracefulShutdown(signal: string) {
  log.info(`Graceful shutdown started`, { signal });
  server.close(() => {
    log.info("HTTP server closed. Exiting.");
    process.exit(0);
  });
  // Force-exit if shutdown takes more than 10 s
  setTimeout(() => {
    log.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGINT",  () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// ── Crash prevention — keep the process alive on unhandled errors ─────────────
process.on("uncaughtException", (error) => {
  log.error("uncaughtException — server kept alive", { err: String(error), stack: error.stack });
});

process.on("unhandledRejection", (reason) => {
  log.error("unhandledRejection — server kept alive", { reason: String(reason) });
});

// ── Start ─────────────────────────────────────────────────────────────────────
async function startServer() {
  await connectToDatabase();
  server.listen(port, () => {
    log.info(`Server ready`, { port, env: process.env.NODE_ENV ?? "development" });
  });

  server.on("error", (error) => {
    if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") {
      log.error(`Port ${port} already in use`, { port });
      process.exit(1);
    }
  });
}

startServer().catch((error) => {
  log.error("Failed to start server", { err: String(error) });
  process.exit(1);
});
