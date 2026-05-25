import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AUTH_TOKEN_KEY, clearToken, fetchJson, setToken } from "./api";
import type { AppConfig, SessionUser, SubscriptionPlan } from "./types";

// ── Hardcoded fallback plans ──────────────────────────────────
// Pricing page ALWAYS works — even when backend is offline.
// Keep this in sync with server/routes/app.ts → publicPlans.
const FALLBACK_PLANS: SubscriptionPlan[] = [
  {
    id: "free",
    title: "Starter",
    priceLabel: "₹0",
    interval: "Forever free",
    description: "Perfect for occasional PDF tasks — no credit card needed.",
    features: [
      "3 PDFs per day",
      "Merge, split, compress & rotate",
      "PDF to JPG & Image to PDF",
      "Extract text & add page numbers",
      "100% browser-based (no uploads)",
    ],
    cta: "Get Started Free",
  },
  {
    id: "pro",
    title: "Professional",
    priceLabel: "₹199",
    interval: "per month",
    description: "For freelancers and power users — unlimited everything.",
    features: [
      "Unlimited PDFs per day",
      "All 12 tools including OCR",
      "Bulk processing & ZIP download",
      "Zero ads — clean experience",
      "Priority email support",
      "Cancel anytime",
    ],
    cta: "Upgrade to Pro — ₹199/mo",
  },
  {
    id: "team",
    title: "Business",
    priceLabel: "₹499",
    interval: "per month",
    description: "For teams managing high-volume document workflows.",
    features: [
      "Everything in Professional",
      "Team billing & shared dashboard",
      "High-volume batch processing",
      "Dedicated support with SLA",
      "Early access to new tools",
    ],
    cta: "Start Business Plan",
  },
];

type AuthContextValue = {
  user: SessionUser | null;
  config: AppConfig;
  plans: SubscriptionPlan[];
  authOpen: boolean;
  openAuth: (mode?: import("./types").AuthMode) => void;
  closeAuth: () => void;
  setUser: (user: SessionUser | null) => void;
  logout: () => Promise<void>;
  refreshPlans: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Apply or remove the dark class on <html> — called from multiple places
function applyDarkMode(enabled: boolean) {
  document.documentElement.classList.toggle("dark", enabled);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [config, setConfig] = useState<AppConfig>({ googleLoginEnabled: false, googleClientId: "", otpEnabled: false, billingEnabled: false });
  // Start with fallback plans — pricing page is never empty
  const [plans, setPlans] = useState<SubscriptionPlan[]>(FALLBACK_PLANS);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<import("./types").AuthMode>("login");

  // Apply dark mode whenever user preferences change (including after session restore)
  useEffect(() => {
    applyDarkMode(user?.preferences?.darkMode ?? false);
  }, [user?.preferences?.darkMode]);

  useEffect(() => {
    const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) return;
    fetchJson<{ user: SessionUser }>("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((payload) => setUser(payload.user))
      .catch(() => clearToken());
  }, []);

  useEffect(() => {
    fetchJson<AppConfig>("/api/app/config").then(setConfig).catch(() => undefined);
    fetchJson<{ plans: SubscriptionPlan[] }>("/api/subscriptions/plans")
      .then((payload) => setPlans(payload.plans))
      .catch(() => undefined);
  }, []);

  const openAuth = useCallback((mode: import("./types").AuthMode = "login") => {
    setPendingMode(mode);
    setAuthOpen(true);
  }, []);

  const closeAuth = useCallback(() => setAuthOpen(false), []);

  const logout = useCallback(async () => {
    const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      await fetch("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined);
    }
    clearToken();
    setUser(null);
    applyDarkMode(false); // reset dark mode on logout
  }, []);

  const refreshPlans = useCallback(async () => {
    const payload = await fetchJson<{ plans: SubscriptionPlan[] }>("/api/subscriptions/plans");
    setPlans(payload.plans);
  }, []);

  return (
    <AuthContext.Provider value={{ user, config, plans, authOpen, openAuth, closeAuth, setUser, logout, refreshPlans }}>
      {children}
      {authOpen ? <AuthModalLazy initialMode={pendingMode} /> : null}
    </AuthContext.Provider>
  );
}

// Lazy import to avoid circular deps — actual modal lives in components/AuthModal
function AuthModalLazy({ initialMode }: { initialMode: import("./types").AuthMode }) {
  const [Modal, setModal] = useState<React.ComponentType<{ initialMode: import("./types").AuthMode }> | null>(null);

  useEffect(() => {
    import("../components/AuthModal").then((mod) => setModal(() => mod.default));
  }, []);

  if (!Modal) return null;
  return <Modal initialMode={initialMode} />;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
