// ── Authentication routes ─────────────────────────────────────
// POST /api/auth/signup
// POST /api/auth/login
// POST /api/auth/google
// POST /api/auth/otp/request
// POST /api/auth/otp/verify
// GET  /api/auth/me
// POST /api/auth/logout

import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { OAuth2Client } from "google-auth-library";
import { MongoServerError } from "mongodb";
import {
  sanitize, isValidEmail, isStrongPassword,
  hashSecret, verifySecret, readBody, sendJson,
  checkLockout, recordFailedAttempt, clearAttempts,
} from "../security.js";
import {
  createSession, deleteSession, getAuthenticatedUser,
  createDefaultPreferences, toSessionUser,
} from "../session.js";
import { usersCollection, otpCollection } from "../db.js";
import { isMailerReady, sendOtpEmail, storeOtp } from "../mailer.js";
import type { StoredUser } from "../types.js";

const googleClientId = process.env.GOOGLE_CLIENT_ID ?? "";
const googleClient   = googleClientId ? new OAuth2Client(googleClientId) : null;

// ── Helpers ───────────────────────────────────────────────────

function buildPasswordUser(name: string, email: string, password: string): StoredUser {
  const now = new Date();
  return {
    id: randomBytes(12).toString("hex"),
    name, email,
    passwordHash: hashSecret(password),
    plan: "free",
    authProviders: { password: true, google: false },
    preferences: createDefaultPreferences(),
    createdAt: now,
    updatedAt: now,
  };
}

async function upsertGoogleUser(payload: { name: string; email: string; picture?: string }) {
  const existing = await usersCollection.findOne({ email: payload.email });
  const now      = new Date();
  if (existing) {
    const next: StoredUser = {
      ...existing,
      name:      existing.name || payload.name,
      avatarUrl: existing.avatarUrl || payload.picture,
      plan:      existing.plan ?? "free",
      authProviders: { password: existing.authProviders?.password ?? false, google: true },
      preferences: existing.preferences ?? createDefaultPreferences(),
      updatedAt: now,
    };
    await usersCollection.updateOne({ id: existing.id }, { $set: next });
    return next;
  }
  const next: StoredUser = {
    id: randomBytes(12).toString("hex"),
    name: payload.name, email: payload.email, avatarUrl: payload.picture,
    plan: "free",
    authProviders: { password: false, google: true },
    preferences: createDefaultPreferences(),
    createdAt: now, updatedAt: now,
  };
  await usersCollection.insertOne(next);
  return next;
}

// ── Route handlers ────────────────────────────────────────────

export async function handleSignup(req: IncomingMessage, res: ServerResponse) {
  const body     = (await readBody(req)) as { name?: string; email?: string; password?: string };
  const name     = sanitize(body.name?.trim() ?? "");
  const email    = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  if (!name)                        return sendJson(res, 400, { message: "Please provide your full name." }, req);
  if (!isValidEmail(email))         return sendJson(res, 400, { message: "Please provide a valid email address." }, req);
  if (!isStrongPassword(password))  return sendJson(res, 400, { message: "Password must be at least 8 characters with a letter and a number." }, req);

  const user = buildPasswordUser(name, email, password);
  try {
    await usersCollection.insertOne(user);
  } catch (err) {
    if (err instanceof MongoServerError && err.code === 11000) {
      return sendJson(res, 409, { message: "An account with this email already exists." }, req);
    }
    throw err;
  }
  sendJson(res, 201, createSession(user), req);
}

export async function handleLogin(req: IncomingMessage, res: ServerResponse) {
  const body     = (await readBody(req)) as { email?: string; password?: string };
  const email    = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  if (!isValidEmail(email)) return sendJson(res, 400, { message: "Please provide a valid email address." }, req);

  const lockout = checkLockout(email);
  if (lockout.locked) return sendJson(res, 429, { message: `Too many failed attempts. Retry in ${lockout.retryAfterSecs}s.` }, req);

  const user = await usersCollection.findOne({ email });
  if (!user?.passwordHash || !verifySecret(password, user.passwordHash)) {
    recordFailedAttempt(email);
    return sendJson(res, 401, { message: "Invalid email or password." }, req);
  }
  clearAttempts(email);
  sendJson(res, 200, createSession(user), req);
}

export async function handleGoogleAuth(req: IncomingMessage, res: ServerResponse) {
  if (!googleClient) return sendJson(res, 503, { message: "Google login is not configured on this server." }, req);
  const body       = (await readBody(req)) as { credential?: string };
  const credential = body.credential?.trim() ?? "";
  if (!credential) return sendJson(res, 400, { message: "Missing Google credential." }, req);

  const ticket  = await googleClient.verifyIdToken({ idToken: credential, audience: googleClientId });
  const payload = ticket.getPayload();
  if (!payload?.email || !payload.name) return sendJson(res, 400, { message: "Unable to verify your Google account." }, req);

  const user = await upsertGoogleUser({ name: payload.name, email: payload.email, picture: payload.picture });
  sendJson(res, 200, createSession(user), req);
}

export async function handleOtpRequest(req: IncomingMessage, res: ServerResponse) {
  if (!isMailerReady()) return sendJson(res, 503, { message: "OTP email is not configured on this server." }, req);
  const body    = (await readBody(req)) as { email?: string; purpose?: "login" | "reset" };
  const email   = body.email?.trim().toLowerCase() ?? "";
  const purpose = body.purpose === "reset" ? "reset" : "login";
  if (!email) return sendJson(res, 400, { message: "Please provide your email address." }, req);

  const user = await usersCollection.findOne({ email });
  if (!user)  return sendJson(res, 404, { message: "No account found for that email." }, req);

  const code = await storeOtp(email, purpose);
  await sendOtpEmail(email, code, purpose);
  sendJson(res, 200, {
    message: purpose === "login" ? "OTP sent to your email." : "Password reset OTP sent to your email.",
  }, req);
}

export async function handleOtpVerify(req: IncomingMessage, res: ServerResponse) {
  const body        = (await readBody(req)) as { email?: string; code?: string; purpose?: "login" | "reset"; newPassword?: string };
  const email       = body.email?.trim().toLowerCase() ?? "";
  const code        = body.code?.trim() ?? "";
  const purpose     = body.purpose === "reset" ? "reset" : "login";
  const newPassword = body.newPassword ?? "";

  if (!email || !code) return sendJson(res, 400, { message: "Email and OTP code are required." }, req);

  const lockout = checkLockout(email);
  if (lockout.locked) return sendJson(res, 429, { message: `Too many failed attempts. Retry in ${lockout.retryAfterSecs}s.` }, req);

  const otpRecord = await otpCollection.findOne({ email, purpose });
  if (!otpRecord || otpRecord.expiresAt.getTime() < Date.now() || !verifySecret(code, otpRecord.codeHash)) {
    recordFailedAttempt(email);
    return sendJson(res, 401, { message: "Invalid or expired OTP code." }, req);
  }

  clearAttempts(email);
  const user = await usersCollection.findOne({ email });
  if (!user) return sendJson(res, 404, { message: "No account found for that email." }, req);
  await otpCollection.deleteMany({ email, purpose });

  if (purpose === "reset") {
    if (!isStrongPassword(newPassword)) return sendJson(res, 400, { message: "New password must be at least 8 characters with a letter and a number." }, req);
    await usersCollection.updateOne({ id: user.id }, {
      $set: {
        passwordHash: hashSecret(newPassword),
        authProviders: { ...(user.authProviders ?? { google: false }), password: true },
        updatedAt: new Date(),
      },
    });
    return sendJson(res, 200, { message: "Password updated. You can now log in." }, req);
  }
  sendJson(res, 200, createSession(user), req);
}

export async function handleMe(req: IncomingMessage, res: ServerResponse) {
  const auth = getAuthenticatedUser(req);
  if (!auth) return sendJson(res, 401, { message: "Unauthorized." }, req);
  sendJson(res, 200, { user: auth.user }, req);
}

export async function handleLogout(req: IncomingMessage, res: ServerResponse) {
  const auth = getAuthenticatedUser(req);
  if (auth) deleteSession(auth.token);
  sendJson(res, 200, { success: true }, req);
}
