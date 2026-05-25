import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  FaCheckCircle, FaEnvelope, FaEye, FaEyeSlash,
  FaGoogle, FaLock, FaShieldAlt, FaTimes, FaTimesCircle, FaUser,
} from "react-icons/fa";
import { useAuth } from "../lib/AuthContext";
import { AUTH_TOKEN_KEY, checkPasswordStrength, fetchJson, resolveError } from "../lib/api";
import type { AuthMode, SessionUser } from "../lib/types";

type Props = { initialMode: AuthMode };

/* ── Password strength bar ───────────────────────────────────── */
function PasswordStrengthBar({ password }: { password: string }) {
  if (!password) return null;
  const { score, strength, missing } = checkPasswordStrength(password);

  const colorMap: Record<string, string> = {
    "weak":        "#ef4444",
    "fair":        "#f97316",
    "strong":      "#22c55e",
    "very-strong": "#16a34a",
  };
  const labelMap: Record<string, string> = {
    "weak":        "Weak",
    "fair":        "Fair",
    "strong":      "Strong",
    "very-strong": "Very strong ✓",
  };

  return (
    <div className="pw-strength-wrap">
      <div className="pw-strength-bar-track">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="pw-strength-segment"
            style={{ background: i <= score ? colorMap[strength] : "var(--slate-200)" }}
          />
        ))}
      </div>
      <span className="pw-strength-label" style={{ color: colorMap[strength] }}>
        {labelMap[strength]}
      </span>
      {missing.length > 0 && (
        <ul className="pw-strength-hints">
          {missing.map((m) => (
            <li key={m}><FaTimesCircle /> Add {m}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Main modal ──────────────────────────────────────────────── */
export default function AuthModal({ initialMode }: Props) {
  const { closeAuth, setUser, config } = useAuth();
  const [mode, setMode]               = useState<AuthMode>(initialMode);
  const [name, setName]               = useState("");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [otp, setOtp]                 = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPass, setShowPass]       = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [error, setError]             = useState("");
  const [info, setInfo]               = useState("");
  const [loading, setLoading]         = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeAuth(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [closeAuth]);

  function switchMode(next: AuthMode) {
    setMode(next);
    setError("");
    setInfo("");
  }

  /* ── Send OTP ──────────────────────────────────────────────── */
  async function requestOtp(purpose: "login" | "reset") {
    if (!email.trim()) { setError("Enter your email address first."); return; }
    setError(""); setLoading(true);
    try {
      const result = await fetchJson<{ message?: string }>("/api/auth/otp/request", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim().toLowerCase(), purpose }),
      });
      setInfo(result.message ?? "OTP sent — check your inbox.");
      switchMode(purpose === "login" ? "otpLogin" : "otpReset");
    } catch (err) {
      setError(resolveError(err, "OTP service is unavailable right now."));
    } finally {
      setLoading(false);
    }
  }

  /* ── Google login ──────────────────────────────────────────── */
  const handleGoogleLogin = useCallback(async () => {
    if (!config.googleLoginEnabled || !config.googleClientId) {
      setError(
        "Google login is not available yet — the backend server needs to be deployed. " +
        "Please use email + password or OTP login instead."
      );
      return;
    }
    setError(""); setLoading(true);
    try {
      await loadGisScript();
      window.google!.accounts.id.initialize({
        client_id: config.googleClientId,
        callback: async ({ credential }) => {
          try {
            const result = await fetchJson<{ token?: string; user?: SessionUser; message?: string }>(
              "/api/auth/google",
              {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ credential }),
              }
            );
            if (!result.token || !result.user) throw new Error(result.message ?? "Google sign-in failed.");
            window.localStorage.setItem(AUTH_TOKEN_KEY, result.token);
            setUser(result.user);
            closeAuth();
          } catch (err) {
            setError(resolveError(err, "Google sign-in failed."));
          } finally {
            setLoading(false);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      window.google!.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          setError(
            "Google popup was blocked by your browser. " +
            "Allow third-party cookies in Settings, or use email / OTP login."
          );
          setLoading(false);
        }
      });
    } catch (err) {
      setError(resolveError(err, "Failed to load Google sign-in."));
      setLoading(false);
    }
  }, [config.googleLoginEnabled, config.googleClientId, closeAuth, setUser]);

  /* ── Password validation (requires 4 of 5 rules) ──────────── */
  function validatePassword(pw: string): string | null {
    const { missing } = checkPasswordStrength(pw);
    // Require length, uppercase, lowercase, number — symbol is optional
    const required = missing.filter((m) => !m.includes("symbol"));
    if (required.length > 0) {
      return `Password must include: ${required.join(", ")}.`;
    }
    return null;
  }

  /* ── Form submit ───────────────────────────────────────────── */
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(""); setInfo(""); setLoading(true);

    const trimEmail = email.trim().toLowerCase();
    const trimName  = name.trim();

    try {
      /* ─ Sign up ─ */
      if (mode === "signup") {
        if (!trimName)  { setError("Please enter your full name.");    setLoading(false); return; }
        if (!trimEmail) { setError("Please enter your email address."); setLoading(false); return; }
        const pwError = validatePassword(password);
        if (pwError)    { setError(pwError);                            setLoading(false); return; }

        const result = await fetchJson<{ token?: string; user?: SessionUser; message?: string }>("/api/auth/signup", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ name: trimName, email: trimEmail, password }),
        });
        if (!result.token || !result.user) throw new Error(result.message ?? "Unable to create your account.");
        window.localStorage.setItem(AUTH_TOKEN_KEY, result.token);
        setUser(result.user);
        closeAuth();

      /* ─ Log in ─ */
      } else if (mode === "login") {
        if (!trimEmail || !password) {
          setError("Enter your email and password to continue.");
          setLoading(false); return;
        }
        const result = await fetchJson<{ token?: string; user?: SessionUser; message?: string }>("/api/auth/login", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ email: trimEmail, password }),
        });
        if (!result.token || !result.user) throw new Error(result.message ?? "Invalid credentials.");
        window.localStorage.setItem(AUTH_TOKEN_KEY, result.token);
        setUser(result.user);
        closeAuth();

      /* ─ Forgot password ─ */
      } else if (mode === "forgot") {
        await requestOtp("reset");

      /* ─ OTP login ─ */
      } else if (mode === "otpLogin") {
        if (!otp.trim()) { setError("Enter the 6-digit OTP from your email."); setLoading(false); return; }
        const result = await fetchJson<{ token?: string; user?: SessionUser; message?: string }>("/api/auth/otp/verify", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ email: trimEmail, code: otp.trim(), purpose: "login" }),
        });
        if (!result.token || !result.user) throw new Error(result.message ?? "Unable to verify OTP.");
        window.localStorage.setItem(AUTH_TOKEN_KEY, result.token);
        setUser(result.user);
        closeAuth();

      /* ─ OTP password reset ─ */
      } else if (mode === "otpReset") {
        const pwError = validatePassword(newPassword);
        if (pwError) { setError(pwError); setLoading(false); return; }
        const result = await fetchJson<{ message?: string }>("/api/auth/otp/verify", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ email: trimEmail, code: otp.trim(), purpose: "reset", newPassword }),
        });
        setInfo(result.message ?? "Password updated — you can now sign in.");
        switchMode("login");
      }
    } catch (err) {
      setError(resolveError(err));
    } finally {
      setLoading(false);
    }
  }

  const titleMap: Record<AuthMode, string> = {
    login:    "Welcome back",
    signup:   "Create your account",
    forgot:   "Reset your password",
    otpLogin: "Sign in with OTP",
    otpReset: "Set new password",
  };

  const isEmailPassMode = mode === "login" || mode === "signup";

  return (
    <div
      className="auth-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-title"
      onClick={(e) => { if (e.target === e.currentTarget) closeAuth(); }}
    >
      <div className="auth-panel">

        {/* ── Left hero panel ─────────────────────────────── */}
        <div className="auth-panel-hero">
          <div className="auth-hero-logo">
            <img src="/logo.png" alt="PDF Solution" />
          </div>
          <h2 className="auth-hero-title">PDF Solution</h2>
          <p className="auth-hero-sub">Secure access to your PDF workspace</p>
          <div className="auth-features">
            <div className="auth-feature"><FaLock />       <span>End-to-end secure auth</span></div>
            <div className="auth-feature"><FaShieldAlt />  <span>OTP + Password login</span></div>
            <div className="auth-feature"><FaEnvelope />   <span>Dashboard &amp; plan management</span></div>
            <div className="auth-feature"><FaCheckCircle /><span>Files stay on your device</span></div>
          </div>
        </div>

        {/* ── Right form panel ────────────────────────────── */}
        <div className="auth-panel-form">
          <button type="button" className="auth-close-btn" onClick={closeAuth} aria-label="Close">
            <FaTimes />
          </button>

          {/* Mode tabs */}
          <div className="auth-mode-tabs">
            <button type="button" className={mode === "login"    ? "active" : ""} onClick={() => switchMode("login")}>Login</button>
            <button type="button" className={mode === "signup"   ? "active" : ""} onClick={() => switchMode("signup")}>Sign Up</button>
            <button type="button" className={mode === "otpLogin" ? "active" : ""} onClick={() => switchMode("otpLogin")}>OTP</button>
            <button type="button" className={(mode === "forgot" || mode === "otpReset") ? "active" : ""} onClick={() => switchMode("forgot")}>Reset</button>
          </div>

          <h3 id="auth-title" className="auth-form-title">{titleMap[mode]}</h3>

          {/* Social login buttons — only on email/pass modes */}
          {isEmailPassMode && (
            <>
              <div className="auth-providers">
                <button type="button" className="btn btn-provider" onClick={() => void handleGoogleLogin()} disabled={loading}>
                  <FaGoogle /> Continue with Google
                </button>
                <button type="button" className="btn btn-provider" onClick={() => void requestOtp("login")} disabled={loading}>
                  <FaEnvelope /> Login with OTP
                </button>
              </div>
              <div className="auth-divider"><span>or use email &amp; password</span></div>
            </>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="auth-form" noValidate>

            {/* Full name — signup only */}
            {mode === "signup" && (
              <div className="form-field">
                <label htmlFor="auth-name">Full Name</label>
                <div className="input-icon-wrap">
                  <FaUser className="input-icon" />
                  <input id="auth-name" type="text" value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name" autoComplete="name" required />
                </div>
              </div>
            )}

            {/* Email */}
            {mode !== "otpReset" && (
              <div className="form-field">
                <label htmlFor="auth-email">Email Address</label>
                <div className="input-icon-wrap">
                  <FaEnvelope className="input-icon" />
                  <input id="auth-email" type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com" autoComplete="email" required />
                </div>
              </div>
            )}

            {/* Password — login / signup */}
            {isEmailPassMode && (
              <div className="form-field">
                <label htmlFor="auth-password">Password</label>
                <div className="input-icon-wrap">
                  <FaLock className="input-icon" />
                  <input
                    id="auth-password"
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "signup" ? "Min 8 chars, A–Z, a–z, 0–9" : "Your password"}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    required
                  />
                  <button type="button" className="input-icon-btn" onClick={() => setShowPass((p) => !p)} aria-label="Toggle password visibility">
                    {showPass ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
                {/* Strength meter shown only during signup */}
                {mode === "signup" && <PasswordStrengthBar password={password} />}
              </div>
            )}

            {/* OTP code */}
            {(mode === "otpLogin" || mode === "otpReset") && (
              <div className="form-field">
                <label htmlFor="auth-otp">OTP Code</label>
                <input id="auth-otp" type="text" value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="6-digit code from your email"
                  maxLength={6} inputMode="numeric" autoComplete="one-time-code" required />
              </div>
            )}

            {/* New password — reset flow */}
            {mode === "otpReset" && (
              <div className="form-field">
                <label htmlFor="auth-newpass">New Password</label>
                <div className="input-icon-wrap">
                  <FaLock className="input-icon" />
                  <input
                    id="auth-newpass"
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 chars, A–Z, a–z, 0–9"
                    autoComplete="new-password"
                    required
                  />
                  <button type="button" className="input-icon-btn" onClick={() => setShowNew((p) => !p)} aria-label="Toggle visibility">
                    {showNew ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
                <PasswordStrengthBar password={newPassword} />
              </div>
            )}

            {/* Forgot hint */}
            {mode === "forgot" && (
              <p className="auth-info-hint">
                Enter your email above then click "Send Reset OTP" — we'll email you a 6-digit code.
              </p>
            )}

            {/* Error / info */}
            {error && <p className="auth-error" role="alert">{error}</p>}
            {info  && <p className="auth-info"  role="status">{info}</p>}

            {/* Submit */}
            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading
                ? "Please wait…"
                : mode === "login"    ? "Sign In"
                : mode === "signup"   ? "Create Account"
                : mode === "otpLogin" ? "Verify OTP & Sign In"
                : mode === "otpReset" ? "Reset Password"
                : "Send Reset OTP"}
            </button>
          </form>

          {/* Footer links */}
          <div className="auth-footer-links">
            {mode === "login" && (
              <>
                <button type="button" className="link-btn" onClick={() => switchMode("forgot")}>Forgot password?</button>
                <button type="button" className="link-btn" onClick={() => switchMode("signup")}>No account? Create one free →</button>
              </>
            )}
            {mode === "signup" && (
              <button type="button" className="link-btn" onClick={() => switchMode("login")}>Already have an account? Sign in</button>
            )}
            {(mode === "otpLogin" || mode === "otpReset") && (
              <button type="button" className="link-btn" onClick={() => switchMode("login")}>← Back to email login</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Google Identity Services script loader ──────────────────── */
function loadGisScript(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.getElementById("google-gis-script");
    if (existing) {
      existing.addEventListener("load",  () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Identity Services.")));
      return;
    }
    const script   = document.createElement("script");
    script.id      = "google-gis-script";
    script.src     = "https://accounts.google.com/gsi/client";
    script.async   = true;
    script.defer   = true;
    script.onload  = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services."));
    document.head.appendChild(script);
  });
}
