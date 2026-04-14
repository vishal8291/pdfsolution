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
  const payload = (await response.json()) as T & { message?: string };
  if (!response.ok) {
    throw new Error((payload as { message?: string }).message ?? `Request failed (${response.status})`);
  }
  return payload;
}

export function resolveError(error: unknown, fallback = "Something went wrong."): string {
  if (error instanceof TypeError) return "Service is not available right now. Make sure the server is running.";
  if (error instanceof Error) return error.message;
  return fallback;
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
