// ── Billing routes (Razorpay) ─────────────────────────────────
// POST /api/billing/create-checkout-session
// POST /api/billing/verify-payment
// POST /api/billing/day-pass
// POST /api/billing/day-pass/verify

import { randomBytes, createHmac } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import Razorpay from "razorpay";
import { readBody, sendJson } from "../security.js";
import { getAuthenticatedUser, toSessionUser, refreshSession } from "../session.js";
import { usersCollection, subscriptionsCollection } from "../db.js";

const razorpayKeyId     = process.env.RAZORPAY_KEY_ID      ?? "";
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET   ?? "";
const AMOUNT_PRO        = Number(process.env.RAZORPAY_PLAN_AMOUNT_PRO  ?? 19900);  // ₹199
const AMOUNT_TEAM       = Number(process.env.RAZORPAY_PLAN_AMOUNT_TEAM ?? 49900);  // ₹499
const AMOUNT_DAYPASS    = 2900;   // ₹29 — fixed, never changes
const DAY_PASS_MS       = 24 * 60 * 60 * 1_000;

const razorpay =
  razorpayKeyId && razorpayKeySecret
    ? new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret })
    : null;

export async function handleCreateCheckout(req: IncomingMessage, res: ServerResponse) {
  const auth = getAuthenticatedUser(req);
  if (!auth)     return sendJson(res, 401, { message: "Please log in before starting a subscription." }, req);
  if (!razorpay) return sendJson(res, 503, { message: "Billing is not configured on this server." }, req);

  const body   = (await readBody(req)) as { planId?: "pro" | "team" };
  const planId = body.planId === "team" ? "team" : "pro";
  const amount = planId === "team" ? AMOUNT_TEAM : AMOUNT_PRO;

  const order = await razorpay.orders.create({
    amount,
    currency: "INR",
    receipt: ("r-" + auth.user.id + "-" + Date.now()).slice(-40),
    notes: { userId: auth.user.id, email: auth.user.email, planId },
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
    prefill: { name: auth.user.name, email: auth.user.email, contact: auth.user.phone ?? "" },
    notes: { planId, userId: auth.user.id },
  }, req);
}

export async function handleVerifyPayment(req: IncomingMessage, res: ServerResponse) {
  const auth = getAuthenticatedUser(req);
  if (!auth)                          return sendJson(res, 401, { message: "Please log in to verify your payment." }, req);
  if (!razorpay || !razorpayKeySecret) return sendJson(res, 503, { message: "Billing not configured." }, req);

  const body = (await readBody(req)) as {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
    planId?: string;
  };
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } = body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return sendJson(res, 400, { message: "Missing payment verification fields." }, req);
  }

  // Verify Razorpay HMAC signature
  const expectedSig = createHmac("sha256", razorpayKeySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSig !== razorpay_signature) {
    return sendJson(res, 400, { message: "Payment verification failed — invalid signature." }, req);
  }

  const plan: "pro" | "team" = planId === "team" ? "team" : "pro";
  await Promise.all([
    subscriptionsCollection.updateOne(
      { razorpayOrderId: razorpay_order_id },
      { $set: { status: "active", razorpayPaymentId: razorpay_payment_id, updatedAt: new Date() } },
    ),
    usersCollection.updateOne({ id: auth.user.id }, { $set: { plan, updatedAt: new Date() } }),
  ]);

  const updatedUser = await usersCollection.findOne({ id: auth.user.id });
  if (updatedUser) {
    const sessionUser = toSessionUser(updatedUser);
    refreshSession(auth.token, sessionUser);
    return sendJson(res, 200, { success: true, user: sessionUser, message: `Upgraded to ${plan} plan!` }, req);
  }
  sendJson(res, 200, { success: true, message: "Payment verified." }, req);
}

// ── Day Pass ──────────────────────────────────────────────────

export async function handleCreateDayPass(req: IncomingMessage, res: ServerResponse) {
  const auth = getAuthenticatedUser(req);
  if (!auth)     return sendJson(res, 401, { message: "Please log in to purchase a Day Pass." }, req);
  if (!razorpay) return sendJson(res, 503, { message: "Billing is not configured on this server." }, req);

  const order = await razorpay.orders.create({
    amount: AMOUNT_DAYPASS,
    currency: "INR",
    receipt: ("dp-" + auth.user.id + "-" + Date.now()).slice(-40),
    notes: { userId: auth.user.id, email: auth.user.email, planId: "daypass" },
  });

  await subscriptionsCollection.insertOne({
    id: randomBytes(12).toString("hex"),
    userId: auth.user.id,
    email: auth.user.email,
    plan: "daypass",
    status: "pending",
    provider: "razorpay",
    razorpayOrderId: order.id,
    expiresAt: new Date(Date.now() + DAY_PASS_MS),
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
    description: "Day Pass — 24-hour unlimited access",
    prefill: { name: auth.user.name, email: auth.user.email, contact: auth.user.phone ?? "" },
    notes: { planId: "daypass", userId: auth.user.id },
  }, req);
}

export async function handleVerifyDayPass(req: IncomingMessage, res: ServerResponse) {
  const auth = getAuthenticatedUser(req);
  if (!auth)                          return sendJson(res, 401, { message: "Please log in to verify your payment." }, req);
  if (!razorpay || !razorpayKeySecret) return sendJson(res, 503, { message: "Billing not configured." }, req);

  const body = (await readBody(req)) as {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return sendJson(res, 400, { message: "Missing payment verification fields." }, req);
  }

  // Verify Razorpay HMAC signature
  const expectedSig = createHmac("sha256", razorpayKeySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSig !== razorpay_signature) {
    return sendJson(res, 400, { message: "Payment verification failed — invalid signature." }, req);
  }

  const dayPassExpiresAt = new Date(Date.now() + DAY_PASS_MS);

  await Promise.all([
    subscriptionsCollection.updateOne(
      { razorpayOrderId: razorpay_order_id },
      { $set: { status: "active", razorpayPaymentId: razorpay_payment_id, expiresAt: dayPassExpiresAt, updatedAt: new Date() } },
    ),
    usersCollection.updateOne(
      { id: auth.user.id },
      { $set: { dayPassExpiresAt, updatedAt: new Date() } },
    ),
  ]);

  const updatedUser = await usersCollection.findOne({ id: auth.user.id });
  if (updatedUser) {
    const sessionUser = toSessionUser(updatedUser);
    refreshSession(auth.token, sessionUser);
    return sendJson(res, 200, {
      success: true,
      user: sessionUser,
      message: "Day Pass activated! You have 24 hours of unlimited access.",
    }, req);
  }
  sendJson(res, 200, { success: true, message: "Day Pass payment verified." }, req);
}
