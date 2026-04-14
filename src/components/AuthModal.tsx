import { FormEvent, useCallback, useState } from "react";
import { FaEnvelope, FaEye, FaEyeSlash, FaGoogle, FaLock, FaShieldAlt, FaTimes, FaUser } from "react-icons/fa";
import { useAuth } from "../lib/AuthContext";
import { AUTH_TOKEN_KEY, fetchJson, resolveError } from "../lib/api";
import type { AuthMode, SessionUser } from "../lib/types";

type Props = { initialMode: AuthMode };

export default function AuthModal({ initialMode }: Props) {
  const { closeAuth, setUser, config } = useAuth();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  function switchMode(next: AuthMode) {
    setMode(next);
    setError("");
    setInfo("");
  }

  async function requestOtp(purpose: "login" | "reset") {
    if (!email.trim()) { setError("Enter your email address first."); return; }
    setError(""); setLoading(true);
    try {
      const result = await fetchJson<{ message?: string }>("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), purpose }),
      });
      setInfo(result.message ?? "OTP sent to your email.");
      switchMode(purpose === "login" ? "otpLogin" : "otpReset");
    } catch (err) {
      setError(resolveError(err, "OTP service is unavailable."));
    } finally {
      setLoading(false);
    }
  }

  const handleGoogleLogin = useCallback(async () => {
    if (!config.googleLoginEnabled || !config.googleClientId) {
      setError("Google login requires GOOGLE_CLIENT_ID to be configured on the server.");
      return;
    }

    setError(""); setLoading(true);

    try {
      // Load Google Identity Services script if not already present
      await loadGisScript();

      window.google!.accounts.id.initialize({
        client_id: config.googleClientId,
        callback: async ({ credential }) => {
          try {
            const result = await fetchJson<{ token?: string; user?: SessionUser; message?: string }>(
              "/api/auth/google",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ credential }),
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
          // Prompt was blocked (e.g. third-party cookies disabled) — tell the user
          setError("Google sign-in popup was blocked by your browser. Try allowing third-party cookies or use password/OTP login.");
          setLoading(false);
        }
      });
    } catch (err) {
      setError(resolveError(err, "Failed to load Google sign-in."));
      setLoading(false);
    }
  }, [config.googleLoginEnabled, config.googleClientId, closeAuth, setUser]);

  function loadGisScript(): Promise<void> {
    if (window.google?.accounts) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.getElementById("google-gis-script");
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("Failed to load Google Identity Services.")));
        return;
      }
      const script = document.createElement("script");
      script.id = "google-gis-script";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Google Identity Services."));
      document.head.appendChild(script);
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(""); setInfo(""); setLoading(true);

    const trimEmail = email.trim().toLowerCase();
    const trimName = name.trim();

    try {
      if (mode === "signup") {
        if (!trimName || !trimEmail || password.length < 6) {
          setError("Provide your name, email, and a password of at least 6 characters.");
          return;
        }
        const result = await fetchJson<{ token?: string; user?: SessionUser; message?: string }>("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimName, email: trimEmail, password }),
        });
        if (!result.token || !result.user) throw new Error(result.message ?? "Unable to create your account.");
        window.localStorage.setItem(AUTH_TOKEN_KEY, result.token);
        setUser(result.user);
        closeAuth();

      } else if (mode === "login") {
        if (!trimEmail || password.length < 6) {
          setError("Enter your email and password to continue.");
          return;
        }
        const result = await fetchJson<{ token?: string; user?: SessionUser; message?: string }>("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimEmail, password }),
        });
        if (!result.token || !result.user) throw new Error(result.message ?? "Invalid credentials.");
        window.localStorage.setItem(AUTH_TOKEN_KEY, result.token);
        setUser(result.user);
        closeAuth();

      } else if (mode === "forgot") {
        await requestOtp("reset");

      } else if (mode === "otpLogin") {
        const result = await fetchJson<{ token?: string; user?: SessionUser; message?: string }>("/api/auth/otp/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimEmail, code: otp.trim(), purpose: "login" }),
        });
        if (!result.token || !result.user) throw new Error(result.message ?? "Unable to verify OTP.");
        window.localStorage.setItem(AUTH_TOKEN_KEY, result.token);
        setUser(result.user);
        closeAuth();

      } else if (mode === "otpReset") {
        if (newPassword.length < 6) { setError("New password must be at least 6 characters."); return; }
        const result = await fetchJson<{ message?: string }>("/api/auth/otp/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimEmail, code: otp.trim(), purpose: "reset", newPassword }),
        });
        setInfo(result.message ?? "Password updated. You can now log in.");
        switchMode("login");
      }
    } catch (err) {
      setError(resolveError(err, "Auth server is not available right now."));
    } finally {
      setLoading(false);
    }
  }

  const titleMap: Record<AuthMode, string> = {
    login: "Welcome back",
    signup: "Create your account",
    forgot: "Reset your password",
    otpLogin: "Sign in with OTP",
    otpReset: "Set new password",
  };

  return (
    <div className="auth-overlay" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <div className="auth-panel">
        <div className="auth-panel-hero">
          <div className="auth-hero-logo">
            <img src="/logo.png" alt="PDF Solution" />
          </div>
          <h2 className="auth-hero-title">PDF Solution</h2>
          <p className="auth-hero-sub">Secure access to your PDF workspace</p>
          <div className="auth-features">
            <div className="auth-feature"><FaLock /><span>End-to-end secure auth</span></div>
            <div className="auth-feature"><FaShieldAlt /><span>OTP + Password + Google</span></div>
            <div className="auth-feature"><FaEnvelope /><span>Access dashboard &amp; plans</span></div>
          </div>
        </div>

        <div className="auth-panel-form">
          <button type="button" className="auth-close-btn" onClick={closeAuth} aria-label="Close"><FaTimes /></button>

          <div className="auth-mode-tabs">
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>Login</button>
            <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => switchMode("signup")}>Sign Up</button>
            <button type="button" className={mode === "otpLogin" ? "active" : ""} onClick={() => switchMode("otpLogin")}>OTP</button>
            <button type="button" className={mode === "forgot" || mode === "otpReset" ? "active" : ""} onClick={() => switchMode("forgot")}>Reset</button>
          </div>

          <h3 id="auth-title" className="auth-form-title">{titleMap[mode]}</h3>

          <div className="auth-providers">
            <button type="button" className="btn btn-provider" onClick={() => void handleGoogleLogin()} disabled={loading}>
              <FaGoogle /> Continue with Google
            </button>
            <button type="button" className="btn btn-provider" onClick={() => void requestOtp(mode === "forgot" || mode === "otpReset" ? "reset" : "login")} disabled={loading}>
              <FaEnvelope /> {mode === "forgot" || mode === "otpReset" ? "Send Reset OTP" : "Send Login OTP"}
            </button>
          </div>

          {(mode === "login" || mode === "signup") && (
            <div className="auth-divider"><span>or continue with email</span></div>
          )}

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {mode === "signup" && (
              <div className="form-field">
                <label htmlFor="auth-name">Full Name</label>
                <div className="input-icon-wrap">
                  <FaUser className="input-icon" />
                  <input id="auth-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" autoComplete="name" required />
                </div>
              </div>
            )}

            {mode !== "otpReset" && (
              <div className="form-field">
                <label htmlFor="auth-email">Email Address</label>
                <div className="input-icon-wrap">
                  <FaEnvelope className="input-icon" />
                  <input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
                </div>
              </div>
            )}

            {(mode === "login" || mode === "signup") && (
              <div className="form-field">
                <label htmlFor="auth-password">Password</label>
                <div className="input-icon-wrap">
                  <FaLock className="input-icon" />
                  <input id="auth-password" type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "signup" ? "At least 6 characters" : "Your password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} required />
                  <button type="button" className="input-icon-btn" onClick={() => setShowPass((p) => !p)} aria-label="Toggle password visibility">
                    {showPass ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>
            )}

            {(mode === "otpLogin" || mode === "otpReset") && (
              <div className="form-field">
                <label htmlFor="auth-otp">OTP Code</label>
                <input id="auth-otp" type="text" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit code from email" maxLength={6} inputMode="numeric" required />
              </div>
            )}

            {mode === "otpReset" && (
              <div className="form-field">
                <label htmlFor="auth-newpass">New Password</label>
                <div className="input-icon-wrap">
                  <FaLock className="input-icon" />
                  <input id="auth-newpass" type={showPass ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" required />
                  <button type="button" className="input-icon-btn" onClick={() => setShowPass((p) => !p)} aria-label="Toggle visibility">
                    {showPass ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>
            )}

            {error && <p className="auth-error" role="alert">{error}</p>}
            {info && <p className="auth-info" role="status">{info}</p>}

            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? "Please wait…" : mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : mode === "otpLogin" ? "Verify & Sign In" : mode === "otpReset" ? "Reset Password" : "Send Reset OTP"}
            </button>
          </form>

          <div className="auth-footer-links">
            {mode === "login" && (
              <>
                <button type="button" className="link-btn" onClick={() => switchMode("forgot")}>Forgot password?</button>
                <button type="button" className="link-btn" onClick={() => switchMode("signup")}>New here? Create account</button>
              </>
            )}
            {mode === "signup" && (
              <button type="button" className="link-btn" onClick={() => switchMode("login")}>Already have an account? Sign in</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
