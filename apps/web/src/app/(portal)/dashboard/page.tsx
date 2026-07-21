"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, GraduationCap, HeartHandshake, Megaphone, ShieldCheck, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { api } from "@/lib/api";

interface Me { fullName?: string; tenantName?: string; role: string }
interface Announcement { id: string; title: string; body: string; pinned: boolean; createdAt: string }
interface FeesSummary { collected: number; outstanding: number }
interface AttendanceToday { total: number; present: number; percentage: number | null }

const QUICK_ACCESS = [
  { label: "Students", href: "/students", icon: GraduationCap },
  { label: "Teachers", href: "/teachers", icon: Users },
  { label: "Parents", href: "/parents", icon: HeartHandshake },
  { label: "Users", href: "/users", icon: ShieldCheck },
  { label: "Academic", href: "/academic/class", icon: BookOpen },
  { label: "Announcements", href: "/announcement/notice", icon: Megaphone },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const [me, setMe] = useState<Me | null>(null);
  const [students, setStudents] = useState<number | null>(null);
  const [teachers, setTeachers] = useState<number | null>(null);
  const [parents, setParents] = useState<number | null>(null);
  const [fees, setFees] = useState<FeesSummary | null>(null);
  const [attendance, setAttendance] = useState<AttendanceToday | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    api<Me>("/auth/me").then(setMe).catch(() => setMe(null));
    api<Announcement[]>("/announcements").then(setAnnouncements).catch(() => setAnnouncements([]));
    api<{ total: number }>("/students").then((r) => setStudents(r.total)).catch(() => {});
    api<unknown[]>("/teachers").then((r) => setTeachers(r.length)).catch(() => {});
    api<unknown[]>("/parents").then((r) => setParents(r.length)).catch(() => {});
    api<FeesSummary>("/fees/summary").then(setFees).catch(() => {});
    api<AttendanceToday>("/attendance/today").then(setAttendance).catch(() => {});
  }, []);

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">
          {greeting()}{me?.fullName ? `, ${me.fullName.split(" ")[0]}` : ""}
        </h1>
        <p className="text-sm text-slate-500">{today}{me?.tenantName ? ` · ${me.tenantName}` : ""}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {students !== null && <StatCard label="Students" value={students.toLocaleString("en-IN")} />}
        {teachers !== null && <StatCard label="Teachers" value={teachers.toLocaleString("en-IN")} />}
        {parents !== null && <StatCard label="Parents" value={parents.toLocaleString("en-IN")} />}
        {fees ? (
          <StatCard label="Fees collected" value={`₹${Number(fees.collected).toLocaleString("en-IN")}`} />
        ) : attendance ? (
          <StatCard label="Attendance today" value={attendance.percentage !== null ? `${attendance.percentage}%` : "No records yet"} />
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="font-display font-semibold text-night dark:text-white">Quick Access</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {QUICK_ACCESS.map((q) => (
              <Link key={q.href} href={q.href}
                className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 dark:border-white/10 p-4 text-center transition-colors hover:bg-surface dark:hover:bg-white/5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <q.icon size={18} />
                </span>
                <span className="text-xs font-medium text-night dark:text-white">{q.label}</span>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-display font-semibold text-night dark:text-white">Announcements</h2>
          {announcements.length === 0 && <p className="mt-4 text-sm text-slate-500">Nothing posted yet.</p>}
          <ul className="mt-4 space-y-4">
            {announcements.slice(0, 5).map((a) => (
              <li key={a.id} className="border-l-2 border-accent pl-3">
                <p className="text-sm font-medium text-night dark:text-white">{a.title}</p>
                <p className="text-xs text-slate-400">
                  {a.pinned ? "Pinned · " : ""}{new Date(a.createdAt).toLocaleDateString("en-IN")}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
