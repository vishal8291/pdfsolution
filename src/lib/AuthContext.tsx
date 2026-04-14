import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AUTH_TOKEN_KEY, clearToken, fetchJson, setToken } from "./api";
import type { AppConfig, SessionUser, SubscriptionPlan } from "./types";

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
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
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
