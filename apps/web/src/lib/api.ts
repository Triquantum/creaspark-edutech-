import { supabase } from "./supabase";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Dispatched whenever a message/announcement is marked read from somewhere
 * other than the Topbar's own bell dropdown (e.g. the dedicated /message
 * page), so the bell's unread badge/list can drop it immediately instead of
 * waiting for the next route change or poll. */
export const NOTIFICATIONS_CHANGED_EVENT = "educore:notifications-changed";
export function notifyNotificationsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

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

/** Same auth header as api(), but for binary responses (e.g. a PDF report)
 * that api()'s always-res.json() can't handle. */
export async function apiBlob(path: string, init?: RequestInit): Promise<Blob> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${BASE}/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session && { Authorization: `Bearer ${session.access_token}` }),
      ...init?.headers,
    },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? res.statusText);
  return res.blob();
}

export const auth = {
  /** Creates the school + its admin identity in Supabase; sign in separately via supabase.auth.signInWithPassword. */
  registerSchool: (body: {
    schoolName: string; schoolCode: string; adminFullName: string; adminEmail: string; adminPassword: string;
    institutionType?: "SCHOOL" | "COLLEGE" | "INSTITUTE" | "CENTRE" | "COMPANY"; logoUrl?: string;
  }) =>
    api<{ tenant: { id: string; slug: string; name: string } }>(
      "/auth/register-school",
      { method: "POST", body: JSON.stringify(body) },
    ),
};
