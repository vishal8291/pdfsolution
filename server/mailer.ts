import nodemailer from "nodemailer";
import { randomBytes } from "node:crypto";
import { hashSecret } from "./security.js";
import { otpCollection } from "./db.js";

const mailer = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587),
      secure: String(process.env.SMTP_SECURE ?? "false").toLowerCase() === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    }) : null;
export const isMailerReady = () => Boolean(mailer);
export async function sendOtpEmail(email: string, code: string, purpose: "login" | "reset") {
  if (!mailer) throw new Error("OTP email not configured. Add SMTP credentials to .env.");
  const subject = purpose === "login" ? "Your PDF Solution login OTP" : "Your PDF Solution password reset OTP";
  const heading = purpose === "login" ? "Use this OTP to sign in" : "Use this OTP to reset your password";
  await mailer.sendMail({
    from: process.env.SMTP_FROM, to: email, subject,
    html: `<div style="font-family:Arial,sans-serif"><h2>${heading}</h2><p>Your OTP:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>Expires in 10 minutes.</p></div>`,
  });
}
export async function storeOtp(email: string, purpose: "login" | "reset") {
  const code = `${Math.floor(100_000 + Math.random() * 900_000)}`;
  await otpCollection.deleteMany({ email, purpose });
  await otpCollection.insertOne({
    id: randomBytes(12).toString("hex"), email, codeHash: hashSecret(code), purpose,
    expiresAt: new Date(Date.now() + 10 * 60 * 1_000), createdAt: new Date(),
  });
  return code;
}
