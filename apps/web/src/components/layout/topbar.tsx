"use client";
import { Bell, Moon, Search, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function Topbar() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-slate-200/70 dark:border-white/5 bg-white/70 dark:bg-night/70 backdrop-blur px-4 md:px-8">
      <label className="relative flex-1 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          placeholder="Search students, invoices, classes…"
          aria-label="Universal search"
          className="h-10 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 pl-9 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </label>
      <div className="ml-auto flex items-center gap-2">
        <button aria-label="Toggle theme" onClick={() => setDark(!dark)}
          className="grid h-10 w-10 place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button aria-label="Notifications" className="relative grid h-10 w-10 place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
          <Bell size={18} />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger" />
        </button>
        <div className="ml-1 grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-semibold text-white">AV</div>
      </div>
    </header>
  );
}
