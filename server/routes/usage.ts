import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson } from "../security.js";
import { usageCollection } from "../db.js";
import { getAuthenticatedUser } from "../session.js";
import { FREE_DAILY_LIMIT } from "./app.js";

function todayKey() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

/** GET /api/usage/status — return today's usage for the caller */
export async function handleUsageStatus(req: IncomingMessage, res: ServerResponse) {
  const auth = getAuthenticatedUser(req);
  const dateKey = todayKey();

  if (!auth) {
    // Guest: frontend tracks locally; return limit only
    sendJson(res, 200, { count: 0, limit: FREE_DAILY_LIMIT, plan: "free", isGuest: true }, req);
    return;
  }

  const isPro = auth.user.plan === "pro" || auth.user.plan === "team";
  const record = await usageCollection.findOne({ userId: auth.user.id, dateKey });

  sendJson(res, 200, {
    count: record?.count ?? 0,
    limit: isPro ? null : FREE_DAILY_LIMIT,
    plan: auth.user.plan,
    isGuest: false,
  }, req);
}

/** POST /api/usage/track — increment logged-in user's daily PDF count */
export async function handleUsageTrack(req: IncomingMessage, res: ServerResponse) {
  const auth = getAuthenticatedUser(req);

  if (!auth) {
    // Guests are tracked client-side; nothing to do on server
    sendJson(res, 200, { ok: true }, req);
    return;
  }

  const isPro = auth.user.plan === "pro" || auth.user.plan === "team";
  if (isPro) {
    sendJson(res, 200, { ok: true, unlimited: true }, req);
    return;
  }

  const dateKey = todayKey();
  const record = await usageCollection.findOneAndUpdate(
    { userId: auth.user.id, dateKey },
    {
      $inc: { count: 1 },
      $set: { updatedAt: new Date() },
      $setOnInsert: { userId: auth.user.id, dateKey },
    },
    { upsert: true, returnDocument: "after" }
  );

  const count = record?.count ?? 1;

  if (count > FREE_DAILY_LIMIT) {
    sendJson(res, 429, {
      message: `Daily limit of ${FREE_DAILY_LIMIT} PDFs reached. Upgrade to Pro for unlimited access.`,
      limitReached: true,
      limit: FREE_DAILY_LIMIT,
      count,
    }, req);
    return;
  }

  sendJson(res, 200, { ok: true, count, limit: FREE_DAILY_LIMIT }, req);
}
