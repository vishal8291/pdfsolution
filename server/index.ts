import "dotenv/config";
import { createServer } from "node:http";
import { log } from "./logger.js";
import { connectToDatabase } from "./db.js";
import { sendJson, isRateLimited, isAuthRateLimited, getCorsOrigin, ALLOWED_ORIGINS } from "./security.js";

// Routes
import { handleAppConfig, handleHealth, handlePlans } from "./routes/app.js";
import { handleSignup, handleLogin, handleGoogleAuth, handleOtpRequest, handleOtpVerify, handleMe, handleLogout } from "./routes/auth.js";
import { handleGetProfile, handleUpdateProfile, handleDashboard } from "./routes/profile.js";
import { handleContact, handleSupport } from "./routes/contact.js";
import { handleCreateCheckout, handleVerifyPayment } from "./routes/billing.js";
import { handleUsageStatus, handleUsageTrack } from "./routes/usage.js";

const port = Number(process.env.PORT ?? 3001);

// ── HTTP server ───────────────────────────────────────────────

const server = createServer(async (req, res) => {
  if (!req.url) { sendJson(res, 404, { message: "Not found." }, req); return; }

  // CORS pre-flight
  if (req.method === "OPTIONS") {
    const origin = getCorsOrigin(req);
    res.writeHead(204, {
      "Access-Control-Allow-Origin":      origin,
      "Access-Control-Allow-Headers":     "Content-Type, Authorization",
      "Access-Control-Allow-Methods":     "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age":           "86400",
    });
    res.end();
    return;
  }

  // Global rate limit
  const clientIp = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
    ?? req.socket.remoteAddress ?? "unknown";
  if (isRateLimited(clientIp)) {
    sendJson(res, 429, { message: "Too many requests. Please slow down." }, req); return;
  }
  if (req.url.startsWith("/api/auth") && isAuthRateLimited(clientIp)) {
    sendJson(res, 429, { message: "Too many authentication attempts. Please wait a minute." }, req); return;
  }

  try {
    const { method, url } = req;

    // ── App ───────────────────────────────────────────────────
    if (method === "GET"  && url === "/api/health")               return await handleHealth(req, res);
    if (method === "GET"  && url === "/api/app/config")           return await handleAppConfig(req, res);
    if (method === "GET"  && url === "/api/subscriptions/plans")  return await handlePlans(req, res);

    // ── Auth ──────────────────────────────────────────────────
    if (method === "POST" && url === "/api/auth/signup")          return await handleSignup(req, res);
    if (method === "POST" && url === "/api/auth/login")           return await handleLogin(req, res);
    if (method === "POST" && url === "/api/auth/google")          return await handleGoogleAuth(req, res);
    if (method === "POST" && url === "/api/auth/otp/request")     return await handleOtpRequest(req, res);
    if (method === "POST" && url === "/api/auth/otp/verify")      return await handleOtpVerify(req, res);
    if (method === "GET"  && url === "/api/auth/me")              return await handleMe(req, res);
    if (method === "POST" && url === "/api/auth/logout")          return await handleLogout(req, res);

    // ── Profile & Dashboard ───────────────────────────────────
    if (method === "GET"  && url === "/api/profile")              return await handleGetProfile(req, res);
    if (method === "PUT"  && url === "/api/profile")              return await handleUpdateProfile(req, res);
    if (method === "GET"  && url === "/api/dashboard")            return await handleDashboard(req, res);

    // ── Contact & Support ─────────────────────────────────────
    if (method === "POST" && url === "/api/contact")              return await handleContact(req, res);
    if (method === "POST" && url === "/api/support")              return await handleSupport(req, res);

    // ── Billing ───────────────────────────────────────────────
    if (method === "POST" && url === "/api/billing/create-checkout-session") return await handleCreateCheckout(req, res);
    if (method === "POST" && url === "/api/billing/verify-payment")          return await handleVerifyPayment(req, res);

    // ── Usage tracking ────────────────────────────────────────
    if (method === "GET"  && url === "/api/usage/status") return await handleUsageStatus(req, res);
    if (method === "POST" && url === "/api/usage/track")  return await handleUsageTrack(req, res);

    sendJson(res, 404, { message: "Not found." }, req);
  } catch (error) {
    log.error("Request error", { method: req.method, url: req.url, err: String(error) });
    const message    = error instanceof Error ? error.message : "Server error.";
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    sendJson(res, statusCode, { message }, req);
  }
});

server.timeout          = 30_000;
server.keepAliveTimeout = 61_000;

// ── Graceful shutdown ─────────────────────────────────────────

function gracefulShutdown(signal: string) {
  log.info("Graceful shutdown started", { signal });
  server.close(() => { log.info("HTTP server closed."); process.exit(0); });
  setTimeout(() => { log.error("Forced shutdown after timeout."); process.exit(1); }, 10_000).unref();
}
process.on("SIGINT",  () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("uncaughtException",  (err) => log.error("uncaughtException",  { err: String(err), stack: err.stack }));
process.on("unhandledRejection", (reason) => log.error("unhandledRejection", { reason: String(reason) }));

// ── Start ─────────────────────────────────────────────────────

async function startServer() {
  await connectToDatabase();
  server.listen(port, () => log.info("Server ready", { port, env: process.env.NODE_ENV ?? "development" }));
  server.on("error", (err) => {
    if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
      log.error(`Port ${port} already in use`); process.exit(1);
    }
  });
}

startServer().catch((err) => { log.error("Failed to start server", { err: String(err) }); process.exit(1); });
