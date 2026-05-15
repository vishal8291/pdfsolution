import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson } from "../security.js";
import { usersCollection } from "../db.js";
import type { PublicPlan } from "../types.js";

export const publicPlans: PublicPlan[] = [
  { id: "free",  title: "Starter",      priceLabel: "Rs 0",    interval: "Forever free", description: "For trying core PDF tools with light usage.", features: ["Merge, split, compress, and extract","Basic support form access","Browser-based workflows"], cta: "Current entry plan" },
  { id: "pro",   title: "Professional", priceLabel: "Rs 499",  interval: "per month",    description: "For freelancers and power users.", features: ["Priority processing","Account dashboard and history","Premium conversions and support"], cta: "Upgrade to Pro" },
  { id: "team",  title: "Business",     priceLabel: "Rs 1499", interval: "per month",    description: "For teams managing shared document workflows.", features: ["Team-oriented billing","High-volume processing","Faster support response"], cta: "Start Business plan" },
];

export async function handleAppConfig(req: IncomingMessage, res: ServerResponse) {
  sendJson(res, 200, {
    googleLoginEnabled: Boolean(process.env.GOOGLE_CLIENT_ID),
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
    otpEnabled: Boolean(process.env.SMTP_HOST),
    billingEnabled: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
  }, req, { cacheSeconds: 300 });
}
export async function handleHealth(req: IncomingMessage, res: ServerResponse) {
  await usersCollection.findOne({}, { projection: { _id: 1 }, maxTimeMS: 3_000 });
  sendJson(res, 200, { status: "ok", uptime: Math.round(process.uptime()), memoryMb: Math.round(process.memoryUsage().heapUsed / 1_048_576), timestamp: new Date().toISOString() }, req, { cacheSeconds: 0 });
}
export async function handlePlans(req: IncomingMessage, res: ServerResponse) {
  sendJson(res, 200, { plans: publicPlans }, req, { cacheSeconds: 600 });
}
