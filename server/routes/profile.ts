// ── Profile + Dashboard routes ────────────────────────────────
// GET  /api/profile
// PUT  /api/profile
// GET  /api/dashboard

import type { IncomingMessage, ServerResponse } from "node:http";
import { sanitize, isValidAvatarUrl, readBody, sendJson } from "../security.js";
import { getAuthenticatedUser, toSessionUser, refreshSession } from "../session.js";
import { usersCollection, supportTicketsCollection, contactMessagesCollection, subscriptionsCollection } from "../db.js";
import type { UserPreferences } from "../types.js";

export async function handleGetProfile(req: IncomingMessage, res: ServerResponse) {
  const auth = getAuthenticatedUser(req);
  if (!auth) return sendJson(res, 401, { message: "Unauthorized." }, req);

  const user = await usersCollection.findOne({ id: auth.user.id });
  if (!user) return sendJson(res, 404, { message: "Profile not found." }, req);
  sendJson(res, 200, { profile: toSessionUser(user) }, req);
}

export async function handleUpdateProfile(req: IncomingMessage, res: ServerResponse) {
  const auth = getAuthenticatedUser(req);
  if (!auth) return sendJson(res, 401, { message: "Unauthorized." }, req);

  const user = await usersCollection.findOne({ id: auth.user.id });
  if (!user) return sendJson(res, 404, { message: "Profile not found." }, req);

  const body = (await readBody(req)) as {
    name?: string; phone?: string; company?: string;
    avatarUrl?: string; preferences?: Partial<UserPreferences>;
  };

  const rawAvatarUrl = body.avatarUrl?.trim() ?? "";
  if (rawAvatarUrl && !isValidAvatarUrl(rawAvatarUrl)) {
    return sendJson(res, 400, { message: "Avatar URL must be a valid HTTPS link." }, req);
  }

  const updated = {
    ...user,
    name:      sanitize(body.name?.trim() ?? "") || user.name,
    phone:     sanitize(body.phone?.trim() ?? ""),
    company:   sanitize(body.company?.trim() ?? ""),
    avatarUrl: rawAvatarUrl,
    preferences: {
      ...user.preferences,
      ...(typeof body.preferences?.marketingEmails === "boolean" && { marketingEmails: body.preferences.marketingEmails }),
      ...(typeof body.preferences?.productUpdates  === "boolean" && { productUpdates:  body.preferences.productUpdates  }),
      ...(typeof body.preferences?.darkMode        === "boolean" && { darkMode:        body.preferences.darkMode        }),
    },
    updatedAt: new Date(),
  };

  await usersCollection.updateOne({ id: user.id }, { $set: updated });
  const sessionUser = toSessionUser(updated);
  refreshSession(auth.token, sessionUser);
  sendJson(res, 200, { user: sessionUser, message: "Profile updated successfully." }, req);
}

export async function handleDashboard(req: IncomingMessage, res: ServerResponse) {
  const auth = getAuthenticatedUser(req);
  if (!auth) return sendJson(res, 401, { message: "Unauthorized." }, req);

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
        currentPlan:   subscription?.plan ?? auth.user.plan,
        billingStatus: subscription?.status ?? "free",
      },
    },
  }, req);
}
