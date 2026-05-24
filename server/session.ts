import { randomBytes } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { getBearerToken } from "./security.js";
import type { StoredUser, SessionUser, SessionEntry, UserPreferences } from "./types.js";

const SESSION_TTL_MS = 24 * 60 * 60 * 1_000;
const sessions = new Map<string, SessionEntry>();
setInterval(() => { const now = Date.now(); for (const [t,e] of sessions) if (e.expiresAt < now) sessions.delete(t); }, 30 * 60_000).unref();

export function createDefaultPreferences(): UserPreferences {
  return { marketingEmails: false, productUpdates: true, darkMode: false };
}
export function toSessionUser(user: StoredUser): SessionUser {
  return { id: user.id, name: user.name ?? "", email: user.email ?? "",
    phone: user.phone, company: user.company, avatarUrl: user.avatarUrl,
    plan: user.plan ?? "free", preferences: user.preferences ?? createDefaultPreferences() };
}
export function createSession(user: StoredUser) {
  const token = randomBytes(24).toString("hex");
  const sessionUser = toSessionUser(user);
  sessions.set(token, { user: sessionUser, expiresAt: Date.now() + SESSION_TTL_MS });
  return { token, user: sessionUser };
}
export function refreshSession(token: string, user: SessionUser) {
  sessions.set(token, { user, expiresAt: Date.now() + SESSION_TTL_MS });
}
export function deleteSession(token: string) { sessions.delete(token); }
export function getAuthenticatedUser(req: IncomingMessage) {
  const token = getBearerToken(req); if (!token) return null;
  const entry = sessions.get(token); if (!entry) return null;
  if (entry.expiresAt < Date.now()) { sessions.delete(token); return null; }
  return { token, user: entry.user };
}
