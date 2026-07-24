"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import {
  Home, User, Users, UserCheck, Shield, Book, CalendarCheck2, ClipboardList, Percent,
  MessageSquare, Image as ImageIcon, Mail, Monitor, Wallet, Box, Package, LogOut, Heart,
  Library, Bus, Building2, HandHeart, IndianRupee, Megaphone, BarChart3, FilePlus2,
  IdCard, Settings2, Globe, Settings, UtensilsCrossed,
} from "lucide-react";
import { NAV, NavGroup, Role } from "@/lib/nav-config";
import { api } from "@/lib/api";

function visibleTo(role: Role | null, roles?: Role[], hiddenFrom?: Role[]) {
  if (!roles && !hiddenFrom) return true;
  if (role === null) return false;
  if (roles && !roles.includes(role)) return false;
  if (hiddenFrom && hiddenFrom.includes(role)) return false;
  return true;
}

/** Drops role-gated groups/children the current user can't see. Nothing
 * renders until the role is known, so admin-only items never flash. */
function filterNav(nav: NavGroup[], role: Role | null): NavGroup[] {
  return nav
    .filter((g) => visibleTo(role, g.roles, g.hiddenFrom))
    .map((g) => (g.children ? { ...g, children: g.children.filter((c) => visibleTo(role, c.roles, c.hiddenFrom)) } : g))
    .filter((g) => !g.children || g.children.length > 0);
}

const ICONS: Record<string, LucideIcon> = {
  home: Home, user: User, users: Users, "user-check": UserCheck, shield: Shield, book: Book,
  "calendar-check": CalendarCheck2, clipboard: ClipboardList, percent: Percent, message: MessageSquare,
  image: ImageIcon, mail: Mail, monitor: Monitor, wallet: Wallet, box: Box, package: Package,
  "log-out": LogOut, heart: Heart, library: Library, bus: Bus, building: Building2,
  "hand-heart": HandHeart, rupee: IndianRupee, megaphone: Megaphone, chart: BarChart3,
  "file-plus": FilePlus2, "id-card": IdCard, "settings-2": Settings2, globe: Globe, settings: Settings,
  utensils: UtensilsCrossed,
};

function Group({ group, path }: { group: NavGroup; path: string }) {
  const Icon = ICONS[group.icon] ?? Home;
  const childActive = group.children?.some((c) => path.startsWith(c.href)) ?? false;
  const [open, setOpen] = useState(childActive);

  if (!group.children) {
    const active = group.href ? path.startsWith(group.href) : false;
    return (
      <Link
        href={group.href!}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] transition-colors
          ${active ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"}`}
      >
        <Icon size={17} strokeWidth={1.8} />
        {group.label}
      </Link>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] transition-colors
          ${childActive ? "text-white" : ""} hover:bg-white/5 hover:text-white`}
      >
        <Icon size={17} strokeWidth={1.8} />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronRight size={14} className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="ml-[22px] border-l border-white/10 py-1 pl-3">
            {group.children.map((c) => {
              const active = path.startsWith(c.href);
              return (
                <Link
                  key={c.href}
                  href={c.href}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors
                    ${active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
                >
                  {c.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const path = usePathname();
  const [role, setRole] = useState<Role | null>(null);
  useEffect(() => {
    api<{ role: Role }>("/auth/me").then((r) => setRole(r.role)).catch(() => {});
  }, []);
  const nav = filterNav(NAV, role);

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col bg-sidebar text-slate-300">
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-5">
        <img
          src="/creaspark-logo.png"
          alt="Creaspark logo"
          className="h-[34px] w-[34px] rounded-[9px] bg-white object-cover p-0.5"
        />
        <span className="font-display text-[15px] font-semibold tracking-wide text-white">
          Creaspark<span className="align-super text-[10px] text-accent">™</span>
        </span>
      </div>
      <nav
        aria-label="Main"
        className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,.15)_transparent]"
      >
        {nav.map((g) => <Group key={g.label} group={g} path={path} />)}
      </nav>
      <p className="shrink-0 px-6 py-4 text-xs text-slate-500">Creaspark Demo School · 2026–27</p>
    </aside>
  );
}
