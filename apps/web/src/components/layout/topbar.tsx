"use client";
import { Bell, LogOut, Moon, Search, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface SearchHit { id: string; label: string; sub: string; type: "Student" | "Teacher"; href: string }
interface Announcement { id: string; title: string; body: string; pinned: boolean; createdAt: string }
interface Me { fullName?: string; email: string; role: string }

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

function initials(name?: string, email?: string) {
  if (name) return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  return (email?.[0] ?? "?").toUpperCase();
}

export function Topbar() {
  const router = useRouter();
  const [dark, setDark] = useState(false);
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);

  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useClickOutside(() => setSearchOpen(false));

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(() => {
      Promise.all([
        api<{ items: { id: string; firstName: string; lastName: string; admissionNo: string }[] }>(`/students?q=${encodeURIComponent(q)}`).catch(() => ({ items: [] })),
        api<{ id: string; fullName: string; email: string }[]>(`/teachers?q=${encodeURIComponent(q)}`).catch(() => []),
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
  }, [q]);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useClickOutside(() => setNotifOpen(false));
  useEffect(() => { api<Announcement[]>("/announcements").then(setAnnouncements).catch(() => setAnnouncements([])); }, []);

  const [me, setMe] = useState<Me | null>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useClickOutside(() => setAvatarOpen(false));
  useEffect(() => { api<Me>("/auth/me").then(setMe).catch(() => setMe(null)); }, []);

  function signOut() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-slate-200/70 dark:border-white/5 bg-white/70 dark:bg-night/70 backdrop-blur px-4 md:px-8">
      <div ref={searchRef} className="relative flex-1 max-w-md">
        <label className="relative block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search students, teachers…"
            aria-label="Universal search"
            className="h-10 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 pl-9 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>
        {searchOpen && q.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-12 z-20 max-h-80 overflow-y-auto rounded-xl border border-slate-100 bg-white shadow-lift dark:border-white/10 dark:bg-[#16213A]">
            {hits.length === 0 && <p className="p-4 text-sm text-slate-500">No matches.</p>}
            {hits.map((h) => (
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
        <button aria-label="Toggle theme" onClick={() => setDark(!dark)}
          className="grid h-10 w-10 place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div ref={notifRef} className="relative">
          <button aria-label="Notifications" onClick={() => setNotifOpen((o) => !o)}
            className="relative grid h-10 w-10 place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
            <Bell size={18} />
            {announcements.length > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger" />}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-12 z-20 w-80 max-h-96 overflow-y-auto rounded-xl border border-slate-100 bg-white shadow-lift dark:border-white/10 dark:bg-[#16213A]">
              <p className="border-b border-slate-100 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400 dark:border-white/10">Announcements</p>
              {announcements.length === 0 && <p className="p-4 text-sm text-slate-500">Nothing new.</p>}
              {announcements.map((a) => (
                <div key={a.id} className="border-b border-slate-50 px-4 py-3 last:border-0 dark:border-white/5">
                  <p className="text-sm font-medium text-night dark:text-white">{a.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{a.body}</p>
                </div>
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
              <button onClick={signOut}
                className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger/10">
                <LogOut size={15} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
