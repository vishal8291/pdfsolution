import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson } from "../security.js";
import { usersCollection } from "../db.js";
import type { PublicPlan } from "../types.js";

export const FREE_DAILY_LIMIT = 3;

export const publicPlans: PublicPlan[] = [
  {
    id: "free", title: "Starter", priceLabel: "₹0", interval: "Forever free",
    description: "Perfect for occasional PDF tasks — no credit card needed.",
    features: [`${FREE_DAILY_LIMIT} PDFs per day`, "Merge, split, compress & rotate", "PDF to JPG & Image to PDF", "Extract text & add page numbers", "100% browser-based (no uploads)"],
    cta: "Get Started Free",
  },
  {
    id: "pro", title: "Professional", priceLabel: "₹199", interval: "per month",
    description: "For freelancers and power users — unlimited everything.",
    features: ["Unlimited PDFs per day", "All 12 tools including OCR", "Bulk processing & ZIP download", "Priority email support", "Dashboard & usage history", "Cancel anytime"],
    cta: "Upgrade to Pro — ₹199/mo",
  },
  {
    id: "team", title: "Business", priceLabel: "₹499", interval: "per month",
    description: "For teams managing high-volume document workflows.",
    features: ["Everything in Professional", "Team billing & shared dashboard", "High-volume batch processing", "Dedicated support with SLA", "Early access to new tools"],
    cta: "Start Business Plan",
  },
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
