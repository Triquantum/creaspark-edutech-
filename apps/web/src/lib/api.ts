import { supabase } from "./supabase";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** skipAuthRedirect: opts out of the 401 -> /login redirect, for calls (like
 * the admission-number password check) where a 401 means "wrong password",
 * not "your session expired". */
export async function api<T>(path: string, init?: RequestInit & { skipAuthRedirect?: boolean }): Promise<T> {
  const { skipAuthRedirect, ...requestInit } = init ?? {};
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${BASE}/api/v1${path}`, {
    ...requestInit,
    headers: {
      "Content-Type": "application/json",
      ...(session && { Authorization: `Bearer ${session.access_token}` }),
      ...requestInit.headers,
    },
  });
  if (res.status === 401 && !skipAuthRedirect && typeof window !== "undefined") {
    window.location.href = "/login";
  }
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? res.statusText);
  return res.json();
}

export const auth = {
  /** Creates the school + its admin identity in Supabase; sign in separately via supabase.auth.signInWithPassword. */
  registerSchool: (body: {
    schoolName: string; schoolCode: string; adminFullName: string; adminEmail: string; adminPassword: string;
  }) =>
    api<{ tenant: { id: string; slug: string; name: string } }>(
      "/auth/register-school",
      { method: "POST", body: JSON.stringify(body) },
    ),
};
