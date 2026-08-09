"use client";
import { Bell, KeyRound, LogOut, Menu, MessageSquare, Mic, MicOff, Moon, Search, Sun, UserCog, WifiOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, NOTIFICATIONS_CHANGED_EVENT, setActiveGrantToken, clearActiveGrantToken } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { flattenPages, Role } from "@/lib/nav-config";
import { Modal, Field, inputCls } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

interface SearchHit { id: string; label: string; sub: string; type: "Student" | "Teacher" | "Page"; href: string }

interface SpeechRecognitionAlternative { transcript: string }
interface SpeechRecognitionResultLike { [index: number]: SpeechRecognitionAlternative; length: number }
interface SpeechRecognitionResultListLike { [index: number]: SpeechRecognitionResultLike; length: number }
interface SpeechRecognitionEventLike extends Event { results: SpeechRecognitionResultListLike }
interface SpeechRecognitionErrorEventLike extends Event { error: string }
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}
interface Announcement { id: string; title: string; body: string; pinned: boolean; createdAt: string; isRead: boolean }
interface InboxMessage {
  id: string; body: string; createdAt: string; readAt?: string | null;
  sender?: { fullName: string; role: string };
  section?: { name: string; class: { name: string } } | null;
}
interface GrantRow {
  id: string; role: string; designation: string | null; isPrimary: boolean;
  tenant: { name: string }; school: { id: string; name: string } | null;
}
interface Me { fullName?: string; email: string; role: string; activeGrantId?: string; grants?: GrantRow[] }

function roleLabel(role: string) {
  return role.toLowerCase().split("_").map((w) => w[0]!.toUpperCase() + w.slice(1)).join(" ");
}

// Mirrors GET /teachers' @Roles() guard — skips the request entirely for
// roles that would always get a 403 (e.g. TEACHER, PARENT, STUDENT).
const TEACHER_DIRECTORY_ROLES = new Set(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "COORDINATOR", "HR"]);

function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onOutside]);
  return ref;
}

function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  return online;
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

function initials(name?: string, email?: string) {
  if (name) return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  return (email?.[0] ?? "?").toUpperCase();
}

/** Self-service password change for the signed-in user, any role — backed
 * directly by Supabase Auth's own session, same call the recovery-link flow
 * uses, so it works identically for admission-number logins (synthetic
 * email) as for a normal email/password account. */
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError("Passwords don't match"); return; }
    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw new Error(updateError.message);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Change password" onClose={onClose}>
      {done ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Password updated.</p>
          <div className="flex justify-end"><Button onClick={onClose}>Done</Button></div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field id="cp-pw" label="New password">
            <input id="cp-pw" type="password" required minLength={8} value={password}
              onChange={(e) => setPassword(e.target.value)} className={inputCls} />
          </Field>
          <Field id="cp-pw2" label="Confirm new password">
            <input id="cp-pw2" type="password" required minLength={8} value={confirm}
              onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
          </Field>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Updating…" : "Update password"}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/** Lists the caller's own UserAccess grants and lets them pick which one is
 * active for this tab. A full page reload after switching is deliberate --
 * role affects the sidebar, dashboard variant, and every page's own role
 * checks app-wide, so reloading is the simplest way to guarantee nothing
 * stays stale rather than plumbing a global "current role" refresh. */
function SwitchContextModal({ grants, activeGrantId, onClose }: {
  grants: GrantRow[]; activeGrantId?: string; onClose: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function switchTo(grantId: string) {
    if (grantId === activeGrantId) { onClose(); return; }
    setBusyId(grantId);
    setError(null);
    try {
      const { token } = await api<{ token: string }>("/auth/switch-context", { method: "POST", body: JSON.stringify({ grantId }) });
      setActiveGrantToken(token);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch");
      setBusyId(null);
    }
  }

  return (
    <Modal title="Switch role / school" onClose={onClose}>
      <div className="space-y-2">
        {grants.map((g) => (
          <button
            key={g.id}
            onClick={() => switchTo(g.id)}
            disabled={busyId !== null}
            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors disabled:opacity-50 ${
              g.id === activeGrantId
                ? "border-primary bg-primary/5"
                : "border-slate-200 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
            }`}
          >
            <span>
              <span className="block font-medium text-night dark:text-white">
                {roleLabel(g.role)}{g.designation && ` · ${g.designation}`}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">{g.school?.name ?? `${g.tenant.name} (all schools)`}</span>
            </span>
            {g.id === activeGrantId && <span className="shrink-0 text-xs font-medium text-primary">Active</span>}
            {busyId === g.id && <span className="shrink-0 text-xs text-slate-400">Switching…</span>}
          </button>
        ))}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  );
}

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [dark, setDark] = useState(false);
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);
  const online = useOnlineStatus();

  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => { api<Me>("/auth/me").then(setMe).catch(() => setMe(null)); }, []);

  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useClickOutside(() => setSearchOpen(false));

  const pages = useMemo(() => flattenPages((me?.role as Role | undefined) ?? null), [me?.role]);
  const pageHits = useMemo((): SearchHit[] => {
    const query = q.trim().toLowerCase();
    if (query.length < 2) return [];
    return pages
      .filter((p) => p.label.toLowerCase().includes(query))
      .slice(0, 5)
      .map((p): SearchHit => ({ id: p.href, label: p.label, sub: "", type: "Page", href: p.href }));
  }, [q, pages]);

  const canSearchTeachers = !!me && TEACHER_DIRECTORY_ROLES.has(me.role);

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(() => {
      Promise.all([
        api<{ items: { id: string; firstName: string; lastName: string; admissionNo: string }[] }>(`/students?q=${encodeURIComponent(q)}&activeOnly=true`).catch(() => ({ items: [] })),
        canSearchTeachers
          ? api<{ id: string; fullName: string; email: string }[]>(`/teachers?q=${encodeURIComponent(q)}&activeOnly=true`).catch(() => [])
          : Promise.resolve([]),
      ]).then(([students, teachers]) => {
        setHits([
          ...students.items.slice(0, 5).map((s): SearchHit => ({
            id: s.id, label: `${s.firstName} ${s.lastName}`, sub: s.admissionNo, type: "Student", href: `/students?q=${encodeURIComponent(q)}`,
          })),
          ...teachers.slice(0, 5).map((t): SearchHit => ({
            id: t.id, label: t.fullName, sub: t.email, type: "Teacher", href: `/teachers?q=${encodeURIComponent(q)}`,
          })),
        ]);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [q, canSearchTeachers]);

  const [voiceListening, setVoiceListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Starts false to match the server-rendered HTML (window is unavailable
  // there); flips after mount once we can actually check the browser.
  const [voiceSupported, setVoiceSupported] = useState(false);
  useEffect(() => { setVoiceSupported(getSpeechRecognitionCtor() !== null); }, []);

  function startVoiceSearch() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      setQ(transcript);
      setSearchOpen(true);
    };
    recognition.onerror = () => setVoiceListening(false);
    recognition.onend = () => setVoiceListening(false);
    recognitionRef.current = recognition;
    setVoiceListening(true);
    recognition.start();
  }

  function stopVoiceSearch() {
    recognitionRef.current?.stop();
    setVoiceListening(false);
  }

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [unreadMessages, setUnreadMessages] = useState<InboxMessage[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useClickOutside(() => setNotifOpen(false));

  function reloadNotifications() {
    api<Announcement[]>("/announcements").then(setAnnouncements).catch(() => setAnnouncements([]));
    api<InboxMessage[]>("/messages/inbox").then((r) => setUnreadMessages(r.filter((m) => !m.readAt))).catch(() => setUnreadMessages([]));
  }
  useEffect(() => { reloadNotifications(); }, []);
  // Route changes elsewhere (e.g. reading messages on /message directly) can
  // change the unread count without the bell's own click handlers running.
  useEffect(() => { reloadNotifications(); }, [pathname]);
  // Poll so a badge for something new (a message someone just sent) shows up
  // even if the user never navigates away from the page they're on.
  useEffect(() => {
    const id = setInterval(reloadNotifications, 45_000);
    return () => clearInterval(id);
  }, []);
  // A message/announcement can also be marked read without a route change
  // (e.g. the "View" action on /message, while staying on that page) — that
  // dispatches this event so the bell drops it immediately instead of
  // waiting for the next poll.
  useEffect(() => {
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, reloadNotifications);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, reloadNotifications);
  }, []);

  const unreadAnnouncements = announcements.filter((a) => !a.isRead);
  const unreadCount = unreadMessages.length + unreadAnnouncements.length;

  async function openMessage(m: InboxMessage) {
    setUnreadMessages((prev) => prev.filter((x) => x.id !== m.id));
    setNotifOpen(false);
    router.push("/message");
    if (!m.readAt) await api(`/messages/${m.id}/read`, { method: "PATCH" }).catch(() => {});
  }

  async function openAnnouncement(a: Announcement) {
    setAnnouncements((prev) => prev.map((x) => (x.id === a.id ? { ...x, isRead: true } : x)));
    setNotifOpen(false);
    router.push("/announcement/notice");
    if (!a.isRead) await api(`/announcements/${a.id}/read`, { method: "PATCH" }).catch(() => {});
  }

  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useClickOutside(() => setAvatarOpen(false));
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const hasMultipleGrants = (me?.grants?.length ?? 0) > 1;

  async function signOut() {
    clearActiveGrantToken();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-slate-200/70 dark:border-white/5 bg-white/70 dark:bg-night/70 backdrop-blur px-4 md:px-8">
      <button
        aria-label="Open menu"
        onClick={onMenuClick}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10 md:hidden"
      >
        <Menu size={20} />
      </button>
      <div ref={searchRef} className="relative flex-1 max-w-md">
        <label className="relative block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search students, teachers, pages…"
            aria-label="Universal search"
            className="h-10 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 pl-9 pr-10 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          {voiceSupported && (
            <button
              type="button"
              aria-label={voiceListening ? "Stop voice search" : "Search by voice"}
              onClick={() => (voiceListening ? stopVoiceSearch() : startVoiceSearch())}
              className={`absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-lg ${
                voiceListening ? "animate-pulse text-danger" : "text-slate-400 hover:text-accent"
              }`}
            >
              {voiceListening ? <MicOff size={15} /> : <Mic size={15} />}
            </button>
          )}
        </label>
        {searchOpen && q.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-12 z-20 max-h-80 overflow-y-auto rounded-xl border border-slate-100 bg-white shadow-lift dark:border-white/10 dark:bg-[#16213A]">
            {pageHits.length === 0 && hits.length === 0 && <p className="p-4 text-sm text-slate-500">No matches.</p>}
            {[...pageHits, ...hits].map((h) => (
              <button
                key={`${h.type}-${h.id}`}
                onClick={() => { router.push(h.href); setSearchOpen(false); setQ(""); }}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface dark:hover:bg-white/5"
              >
                <span>
                  <span className="font-medium text-night dark:text-white">{h.label}</span>
                  <span className="ml-2 text-slate-400">{h.sub}</span>
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-white/10">{h.type}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {!online && (
          <span
            role="status"
            aria-live="polite"
            className="flex items-center gap-1.5 rounded-full bg-danger/10 px-2.5 py-1.5 text-xs font-medium text-danger"
          >
            <WifiOff size={13} />
            Offline
          </span>
        )}

        <button aria-label="Toggle theme" onClick={() => setDark(!dark)}
          className="grid h-10 w-10 place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div ref={notifRef} className="relative">
          <button aria-label="Notifications" onClick={() => setNotifOpen((o) => !o)}
            className="relative grid h-10 w-10 place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-12 z-20 w-80 max-h-96 overflow-y-auto rounded-xl border border-slate-100 bg-white shadow-lift dark:border-white/10 dark:bg-[#16213A]">
              <p className="border-b border-slate-100 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400 dark:border-white/10">Messages</p>
              {unreadMessages.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">No unread messages.</p>}
              {unreadMessages.map((m) => (
                <button key={m.id} onClick={() => openMessage(m)}
                  className="flex w-full items-start gap-2.5 border-b border-slate-50 px-4 py-3 text-left last:border-0 hover:bg-surface dark:border-white/5 dark:hover:bg-white/5">
                  <MessageSquare size={14} className="mt-0.5 shrink-0 text-accent" />
                  <span>
                    <span className="block text-sm font-medium text-night dark:text-white">
                      {m.section ? `${m.section.class.name} · ${m.section.name}` : m.sender?.fullName ?? "Unknown"}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500">{m.body}</span>
                  </span>
                </button>
              ))}

              <p className="border-b border-t border-slate-100 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400 dark:border-white/10">Announcements</p>
              {unreadAnnouncements.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">Nothing new.</p>}
              {unreadAnnouncements.map((a) => (
                <button key={a.id} onClick={() => openAnnouncement(a)}
                  className="block w-full border-b border-slate-50 px-4 py-3 text-left last:border-0 hover:bg-surface dark:border-white/5 dark:hover:bg-white/5">
                  <p className="text-sm font-medium text-night dark:text-white">{a.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{a.body}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div ref={avatarRef} className="relative ml-1">
          <button aria-label="Account menu" onClick={() => setAvatarOpen((o) => !o)}
            className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-semibold text-white">
            {initials(me?.fullName, me?.email)}
          </button>
          {avatarOpen && (
            <div className="absolute right-0 top-12 z-20 w-56 rounded-xl border border-slate-100 bg-white p-1.5 shadow-lift dark:border-white/10 dark:bg-[#16213A]">
              {me && (
                <div className="border-b border-slate-50 px-3 py-2.5 dark:border-white/5">
                  <p className="truncate text-sm font-medium text-night dark:text-white">{me.fullName ?? me.email}</p>
                  <p className="truncate text-xs text-slate-400">{me.email}</p>
                </div>
              )}
              {hasMultipleGrants && (
                <button onClick={() => { setSwitchOpen(true); setAvatarOpen(false); }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-night hover:bg-black/5 dark:text-white dark:hover:bg-white/10">
                  <UserCog size={15} /> Switch role / school
                </button>
              )}
              <button onClick={() => { setChangePwOpen(true); setAvatarOpen(false); }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-night hover:bg-black/5 dark:text-white dark:hover:bg-white/10">
                <KeyRound size={15} /> Change password
              </button>
              <button onClick={signOut}
                className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger/10">
                <LogOut size={15} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {changePwOpen && <ChangePasswordModal onClose={() => setChangePwOpen(false)} />}
      {switchOpen && me?.grants && (
        <SwitchContextModal grants={me.grants} activeGrantId={me.activeGrantId} onClose={() => setSwitchOpen(false)} />
      )}
    </header>
  );
}
