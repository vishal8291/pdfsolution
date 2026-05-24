/**
 * useUsageLimit — tracks daily PDF-processing quota
 *
 * Free users: 3 PDFs per day (resets at midnight local time)
 *   - Guest (not logged in): stored in localStorage
 *   - Logged-in free user: localStorage + server-side counter
 * Pro/Team users: unlimited (null limit)
 */

import { useCallback, useEffect, useState } from "react";
import { authHeaders, fetchJson } from "./api";
import { useAuth } from "./AuthContext";

export const FREE_DAILY_LIMIT = 3;

const LS_KEY = "pdf_usage";

type LocalRecord = { dateKey: string; count: number };

function todayKey() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function getLocal(): LocalRecord {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { dateKey: todayKey(), count: 0 };
    const parsed: LocalRecord = JSON.parse(raw);
    if (parsed.dateKey !== todayKey()) return { dateKey: todayKey(), count: 0 };
    return parsed;
  } catch {
    return { dateKey: todayKey(), count: 0 };
  }
}

function setLocal(count: number) {
  localStorage.setItem(LS_KEY, JSON.stringify({ dateKey: todayKey(), count }));
}

export type UsageState = {
  used: number;
  limit: number | null;   // null = unlimited (Pro/Team)
  loading: boolean;
  isPro: boolean;
  canProcess: boolean;    // false when free user has hit limit
  increment: () => Promise<boolean>; // returns true if allowed
  refresh: () => void;
};

export function useUsageLimit(): UsageState {
  const { user } = useAuth();
  const isPro = user?.plan === "pro" || user?.plan === "team";

  const [used, setUsed]       = useState(0);
  const [loading, setLoading] = useState(true);

  // Load usage on mount and when user changes
  const refresh = useCallback(() => {
    if (isPro) { setUsed(0); setLoading(false); return; }

    if (user) {
      // Logged-in free user — fetch server count
      setLoading(true);
      fetchJson<{ count: number; limit: number | null }>("/api/usage/status", {
        headers: authHeaders(),
      })
        .then((res) => { setUsed(res.count); })
        .catch(() => { setUsed(getLocal().count); })
        .finally(() => setLoading(false));
    } else {
      // Guest — use localStorage
      setUsed(getLocal().count);
      setLoading(false);
    }
  }, [user, isPro]);

  useEffect(() => { refresh(); }, [refresh]);

  /**
   * Call before running a tool. Returns true if the user may proceed.
   * Increments counter server-side (logged-in) or in localStorage (guest).
   */
  const increment = useCallback(async (): Promise<boolean> => {
    if (isPro) return true;

    // Pre-check local count before hitting server
    const local = getLocal();
    if (!user && local.count >= FREE_DAILY_LIMIT) return false;

    if (user) {
      try {
        const res = await fetchJson<{ ok?: boolean; limitReached?: boolean; count: number }>(
          "/api/usage/track",
          { method: "POST", headers: authHeaders() }
        );
        if (res.limitReached) { setUsed(res.count); return false; }
        setUsed(res.count);
        // Also update local mirror
        setLocal(res.count);
        return true;
      } catch (err: unknown) {
        // If server says 429, block
        if (err instanceof Error && err.message.includes("429")) return false;
        // Network error — fall back to local
        if (local.count >= FREE_DAILY_LIMIT) return false;
        const next = local.count + 1;
        setLocal(next);
        setUsed(next);
        return true;
      }
    } else {
      // Guest — localStorage only
      if (local.count >= FREE_DAILY_LIMIT) return false;
      const next = local.count + 1;
      setLocal(next);
      setUsed(next);
      return true;
    }
  }, [user, isPro]);

  return {
    used,
    limit: isPro ? null : FREE_DAILY_LIMIT,
    loading,
    isPro,
    canProcess: isPro || used < FREE_DAILY_LIMIT,
    increment,
    refresh,
  };
}
