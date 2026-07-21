/**
 * Typed API client. Tenant is sent as an X-Tenant header (resolved
 * from subdomain in production, from localStorage in local dev).
 */
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function tenantSlug(): string {
  if (typeof window === "undefined") return "demo";
  const sub = window.location.hostname.split(".")[0];
  if (sub && sub !== "localhost" && sub !== "www") return sub;
  return localStorage.getItem("tenant") ?? "demo";
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  const res = await fetch(`${BASE}/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Tenant": tenantSlug(),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...init?.headers,
    },
  });
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
  }
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? res.statusText);
  return res.json();
}

export const auth = {
  login: (email: string, password: string) =>
    api<{ accessToken: string; refreshToken: string; user: { fullName: string; role: string } }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
    ),
};
