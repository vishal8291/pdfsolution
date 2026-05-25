export const AUTH_TOKEN_KEY = "pdfsolution-auth-token";

export function getToken(): string | null {
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);

  // Read as text first — Vercel/nginx can return plain-text "Not Found" for
  // unknown /api/* paths when the backend isn't deployed yet.
  const text = await response.text();
  let payload: T & { message?: string };
  try {
    payload = JSON.parse(text) as T & { message?: string };
  } catch {
    // Response was not JSON — backend is offline or not yet deployed
    throw new Error(
      response.status === 404
        ? "The server is not reachable yet. Core PDF tools still work — account features need the backend deployed."
        : `Server error (${response.status}). Please try again later.`
    );
  }

  if (!response.ok) {
    throw new Error((payload as { message?: string }).message ?? `Request failed (${response.status})`);
  }
  return payload;
}

export function resolveError(error: unknown, fallback = "Something went wrong."): string {
  if (error instanceof TypeError) return "Cannot connect to the server. All PDF tools still work offline — only account/billing features need the server.";
  if (error instanceof Error) return error.message;
  return fallback;
}

/* Password strength — used in AuthModal and on server */
export type PasswordStrength = "weak" | "fair" | "strong" | "very-strong";

export function checkPasswordStrength(pw: string): {
  score: number;           // 0–4
  strength: PasswordStrength;
  missing: string[];       // human-readable list of what's missing
} {
  const checks = [
    { ok: pw.length >= 8,           msg: "at least 8 characters" },
    { ok: /[A-Z]/.test(pw),         msg: "an uppercase letter (A–Z)" },
    { ok: /[a-z]/.test(pw),         msg: "a lowercase letter (a–z)" },
    { ok: /[0-9]/.test(pw),         msg: "a number (0–9)" },
    { ok: /[^A-Za-z0-9]/.test(pw),  msg: "a symbol (!@#$%…)" },
  ];
  const passed = checks.filter((c) => c.ok);
  const missing = checks.filter((c) => !c.ok).map((c) => c.msg);
  const score = passed.length;                             // 0–5
  const strength: PasswordStrength =
    score <= 2 ? "weak" :
    score === 3 ? "fair" :
    score === 4 ? "strong" : "very-strong";
  return { score, strength, missing };
}

export async function loadRazorpayScript(): Promise<boolean> {
  if (window.Razorpay) return true;
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export const CONTACT_EMAIL = "vishaltiwari101999@gmail.com";
export const CONTACT_PHONE = "8291569470";
export const CONTACT_ADDRESS = "A-305 Green View, Prernanagar, Babhai, Borivali West, Mumbai 400092";
export const GITHUB_LINK = "https://github.com/vishal8291/vishal8291";
export const LINKEDIN_LINK = "https://www.linkedin.com/in/vishal-tiwari-158a5216b";
export const INSTAGRAM_LINK = "https://www.instagram.com/vishal.buildss/";
