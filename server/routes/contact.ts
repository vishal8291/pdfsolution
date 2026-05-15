// ── Contact + Support routes ──────────────────────────────────
// POST /api/contact
// POST /api/support

import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { sanitize, isValidEmail, readBody, sendJson } from "../security.js";
import { getAuthenticatedUser } from "../session.js";
import { contactMessagesCollection, supportTicketsCollection } from "../db.js";

export async function handleContact(req: IncomingMessage, res: ServerResponse) {
  const body    = (await readBody(req)) as { name?: string; email?: string; message?: string };
  const name    = sanitize(body.name?.trim() ?? "");
  const email   = body.email?.trim().toLowerCase() ?? "";
  const message = sanitize(body.message?.trim() ?? "").slice(0, 5_000);

  if (!name || !isValidEmail(email) || !message) {
    return sendJson(res, 400, { message: "Please provide your name, a valid email, and a message." }, req);
  }
  if (message.length < 10) {
    return sendJson(res, 400, { message: "Please enter a more detailed message (at least 10 characters)." }, req);
  }

  await contactMessagesCollection.insertOne({
    id: randomBytes(12).toString("hex"),
    name, email, message,
    createdAt: new Date(),
  });

  sendJson(res, 201, { success: true, message: "Thanks! Your message has been received." }, req);
}

export async function handleSupport(req: IncomingMessage, res: ServerResponse) {
  const body    = (await readBody(req)) as { name?: string; email?: string; subject?: string; message?: string };
  const name    = sanitize(body.name?.trim() ?? "");
  const email   = body.email?.trim().toLowerCase() ?? "";
  const subject = sanitize(body.subject?.trim() ?? "General support request").slice(0, 200);
  const message = sanitize(body.message?.trim() ?? "").slice(0, 5_000);

  if (!name || !isValidEmail(email) || !message) {
    return sendJson(res, 400, { message: "Please provide your name, a valid email, and a support message." }, req);
  }

  const auth = getAuthenticatedUser(req);
  await supportTicketsCollection.insertOne({
    id: randomBytes(12).toString("hex"),
    userId: auth?.user.id,
    name, email, subject, message,
    status: "open",
    createdAt: new Date(),
  });

  sendJson(res, 201, { success: true, message: "Support request submitted successfully." }, req);
}
