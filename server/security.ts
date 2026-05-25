import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { gzipSync } from "node:zlib";
import type { IncomingMessage, ServerResponse } from "node:http";

const appBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:5173";
export const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS ?? appBaseUrl).split(",").map(o => o.trim()).filter(Boolean),
);
export function getCorsOrigin(req: IncomingMessage): string {
  const origin = req.headers["origin"] ?? "";
  return ALLOWED_ORIGINS.has(origin) ? origin : (ALLOWED_ORIGINS.values().next().value as string);
}

const RATE_WINDOW_MS = 60_000;
const globalWindows = new Map<string, { start: number; count: number }>();
const authWindows   = new Map<string, { start: number; count: number }>();
function checkLimit(map: Map<string, { start: number; count: number }>, ip: string, max: number) {
  const now = Date.now(); const entry = map.get(ip);
  if (!entry || now - entry.start > RATE_WINDOW_MS) { map.set(ip, { start: now, count: 1 }); return false; }
  entry.count += 1; return entry.count > max;
}
export const isRateLimited     = (ip: string) => checkLimit(globalWindows, ip, 60);
export const isAuthRateLimited = (ip: string) => checkLimit(authWindows, ip, 20);
setInterval(() => {
  const cutoff = Date.now() - RATE_WINDOW_MS;
  for (const [k,v] of globalWindows) if (v.start < cutoff) globalWindows.delete(k);
  for (const [k,v] of authWindows)   if (v.start < cutoff) authWindows.delete(k);
}, 5 * 60_000).unref();

const LOGIN_MAX_ATTEMPTS = 5; const LOGIN_LOCKOUT_MS = 15 * 60_000;
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
export function checkLockout(email: string) {
  const entry = loginAttempts.get(email); if (!entry) return { locked: false };
  if (entry.lockedUntil > Date.now()) return { locked: true, retryAfterSecs: Math.ceil((entry.lockedUntil - Date.now()) / 1_000) };
  return { locked: false };
}
export function recordFailedAttempt(email: string) {
  const entry = loginAttempts.get(email) ?? { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= LOGIN_MAX_ATTEMPTS) { entry.lockedUntil = Date.now() + LOGIN_LOCKOUT_MS; entry.count = 0; }
  loginAttempts.set(email, entry);
}
export function clearAttempts(email: string) { loginAttempts.delete(email); }
setInterval(() => {
  const now = Date.now();
  for (const [e, v] of loginAttempts) if (v.lockedUntil < now && v.count === 0) loginAttempts.delete(e);
}, 60 * 60_000).unref();

export function sanitize(str: string) {
  return str.replace(/<[^>]*>/g, "").replace(/[&"'`]/g, c =>
    c==="&"?"&amp;":c==='"'?"&quot;":c==="'"?"&#x27;":"&#x60;").trim();
}
export const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
/**
 * Password rules (must pass all 4):
 *  ✓ At least 8 characters
 *  ✓ At least one uppercase letter (A–Z)
 *  ✓ At least one lowercase letter (a–z)
 *  ✓ At least one digit (0–9)
 * Symbol is encouraged (shown in strength meter) but not enforced server-side.
 */
export function isStrongPassword(p: string): { ok: boolean; reason?: string } {
  if (p.length < 8)          return { ok: false, reason: "Password must be at least 8 characters." };
  if (!/[A-Z]/.test(p))      return { ok: false, reason: "Password must contain at least one uppercase letter (A–Z)." };
  if (!/[a-z]/.test(p))      return { ok: false, reason: "Password must contain at least one lowercase letter (a–z)." };
  if (!/[0-9]/.test(p))      return { ok: false, reason: "Password must contain at least one number (0–9)." };
  return { ok: true };
}
export function isValidAvatarUrl(url: string) {
  if (!url) return true;
  try { const p = new URL(url); return p.protocol === "https:" && !p.hostname.includes("localhost"); } catch { return false; }
}
export function hashSecret(secret: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(secret, salt, 64).toString("hex");
}
export function verifySecret(secret: string, stored: string) {
  const [salt, existing] = stored.split(":");
  if (!salt || !existing) return false;
  const derived = scryptSync(secret, salt, 64); const eb = Buffer.from(existing, "hex");
  if (eb.length !== derived.length) return false;
  return timingSafeEqual(eb, derived);
}
export function getClientIp(req: IncomingMessage) {
  return (req.headers["x-forwarded-for"] as string|undefined)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";
}
export function getBearerToken(req: IncomingMessage) {
  const h = req.headers.authorization; return h?.startsWith("Bearer ") ? h.slice(7) : null;
}
export async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const MAX = 100 * 1024; const chunks: Buffer[] = []; let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.byteLength;
    if (total > MAX) { req.resume(); throw Object.assign(new Error("Request body too large."), { statusCode: 413 }); }
    chunks.push(buf);
  }
  if (!chunks.length) return {};
  try { const p: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8")); if (p && typeof p === "object" && !Array.isArray(p)) return p as Record<string,unknown>; } catch {}
  return {};
}
export function sendJson(res: ServerResponse, status: number, payload: unknown, req?: IncomingMessage, opts?: { cacheSeconds?: number }) {
  const origin = req ? getCorsOrigin(req) : (ALLOWED_ORIGINS.values().next().value as string);
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  const ae = req?.headers["accept-encoding"] ?? "";
  const useGzip = body.byteLength > 512 && ae.includes("gzip");
  const rb = useGzip ? gzipSync(body) : body;
  const h: Record<string,string> = {
    "Content-Type": "application/json; charset=utf-8", "Content-Length": String(rb.byteLength),
    "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS", "Access-Control-Allow-Credentials": "true",
    "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload", "X-XSS-Protection": "0",
    "Content-Security-Policy": [
      "default-src 'self'","script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://accounts.google.com",
      "style-src 'self' 'unsafe-inline'","img-src 'self' data: https:",
      "connect-src 'self' https://checkout.razorpay.com https://accounts.google.com",
      "frame-src https://checkout.razorpay.com https://accounts.google.com",
      "object-src 'none'","base-uri 'self'","form-action 'self'",
    ].join("; "),
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  };
  if (useGzip) h["Content-Encoding"] = "gzip";
  h["Cache-Control"] = opts?.cacheSeconds ? `public, max-age=${opts.cacheSeconds}, stale-while-revalidate=60` : "no-store";
  res.writeHead(status, h); res.end(rb);
}
