"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen, CalendarCheck2, GraduationCap, HeartHandshake, MessageSquare,
  Megaphone, School, ShieldCheck, Users, Wallet, type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Calendar } from "@/components/ui/calendar";
import { api } from "@/lib/api";

interface Me { fullName?: string; tenantName?: string; role: string }
interface Announcement { id: string; title: string; body: string; pinned: boolean; createdAt: string }
interface FeesSummary { collected: number; outstanding: number }
interface AttendanceToday { total: number; present: number; percentage: number | null }
interface MonthlyAttendance { summary: { percentage: number; total: number } }
interface MyFees { totalDue: string | number; nextDue: { dueDate: string; amount: string | number } | null }
interface ProgressOverall { overall: { averagePercentage: number; grade: string } | null }
interface SchoolSummary {
  id: string; name: string; slug: string; plan: string; status: string; createdAt: string;
  students: number; teachers: number; parents: number;
}
interface PlatformSummary {
  totalSchools: number; totalStudents: number; totalTeachers: number; totalParents: number;
  schools: SchoolSummary[];
}

type QuickTile = { label: string; href: string; icon: LucideIcon };

const ADMIN_QUICK: QuickTile[] = [
  { label: "Students", href: "/students", icon: GraduationCap },
  { label: "Teachers", href: "/teachers", icon: Users },
  { label: "Parents", href: "/parents", icon: HeartHandshake },
  { label: "Users", href: "/users", icon: ShieldCheck },
  { label: "Academic", href: "/academic/class", icon: BookOpen },
  { label: "Announcements", href: "/announcement/notice", icon: Megaphone },
];

const TEACHER_QUICK: QuickTile[] = [
  { label: "Take Attendance", href: "/attendance/student-attendance", icon: CalendarCheck2 },
  { label: "Students", href: "/students", icon: GraduationCap },
  { label: "Message", href: "/message", icon: MessageSquare },
  { label: "Notices", href: "/announcement/notice", icon: Megaphone },
];

const SELF_QUICK: QuickTile[] = [
  { label: "My Progress", href: "/progress", icon: GraduationCap },
  { label: "My Fees", href: "/progress?tab=fees", icon: Wallet },
  { label: "Message", href: "/message", icon: MessageSquare },
  { label: "Notices", href: "/announcement/notice", icon: Megaphone },
];

const STAFF_ROLES = new Set([
  "SUPER_ADMIN", "ORG_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL",
  "COORDINATOR", "ACCOUNTANT", "RECEPTION", "HR",
]);

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function QuickAccess({ tiles }: { tiles: QuickTile[] }) {
  return (
    <Card>
      <h2 className="font-display font-semibold text-night dark:text-white">Quick Access</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((q) => (
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
  );
}

function PlatformOverview({ data }: { data: PlatformSummary }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Schools Registered" value={data.totalSchools.toLocaleString("en-IN")} />
        <StatCard label="Total Students" value={data.totalStudents.toLocaleString("en-IN")} />
        <StatCard label="Total Teachers" value={data.totalTeachers.toLocaleString("en-IN")} />
        <StatCard label="Total Parents" value={data.totalParents.toLocaleString("en-IN")} />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 p-4 dark:border-white/5">
          <School size={16} className="text-primary" />
          <h2 className="font-display font-semibold text-night dark:text-white">Registered Schools</h2>
        </div>
        {data.schools.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No schools registered yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">School</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Students</th>
                <th className="px-4 py-3 text-right font-medium">Teachers</th>
                <th className="px-4 py-3 text-right font-medium">Parents</th>
                <th className="px-4 py-3 font-medium">Registered</th>
              </tr>
            </thead>
            <tbody>
              {data.schools.map((s) => (
                <tr key={s.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                  <td className="px-4 py-3 font-medium text-night dark:text-white">{s.name}</td>
                  <td className="px-4 py-3 text-slate-500">{s.plan}</td>
                  <td className="px-4 py-3 text-slate-500">{s.status}</td>
                  <td className="px-4 py-3 text-right text-night dark:text-white">{s.students}</td>
                  <td className="px-4 py-3 text-right text-night dark:text-white">{s.teachers}</td>
                  <td className="px-4 py-3 text-right text-night dark:text-white">{s.parents}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(s.createdAt).toLocaleDateString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function NoticesCard({ announcements }: { announcements: Announcement[] }) {
  return (
    <Card>
      <h2 className="font-display font-semibold text-night dark:text-white">Latest Notices</h2>
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
  );
}

export default function Dashboard() {
  const [me, setMe] = useState<Me | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  // Admin/staff stats
  const [students, setStudents] = useState<number | null>(null);
  const [teachers, setTeachers] = useState<number | null>(null);
  const [parents, setParents] = useState<number | null>(null);
  const [fees, setFees] = useState<FeesSummary | null>(null);
  const [attendance, setAttendance] = useState<AttendanceToday | null>(null);

  // Self-service (student/parent) stats
  const [myAttendance, setMyAttendance] = useState<MonthlyAttendance | null>(null);
  const [myFees, setMyFees] = useState<MyFees | null>(null);
  const [myProgress, setMyProgress] = useState<ProgressOverall | null>(null);

  // Super admin platform-wide stats
  const [platform, setPlatform] = useState<PlatformSummary | null>(null);

  useEffect(() => {
    api<Me>("/auth/me").then(setMe).catch(() => setMe(null));
    api<Announcement[]>("/announcements").then(setAnnouncements).catch(() => setAnnouncements([]));
  }, []);

  useEffect(() => {
    if (!me) return;
    const isTeacher = me.role === "TEACHER";
    const isSelf = me.role === "STUDENT" || me.role === "PARENT";
    const isStaff = STAFF_ROLES.has(me.role);

    if (isStaff) {
      api<{ total: number }>("/students").then((r) => setStudents(r.total)).catch(() => {});
      api<unknown[]>("/teachers").then((r) => setTeachers(r.length)).catch(() => {});
      api<unknown[]>("/parents").then((r) => setParents(r.length)).catch(() => {});
      api<FeesSummary>("/fees/summary").then(setFees).catch(() => {});
    }
    if (isStaff || isTeacher) {
      api<AttendanceToday>("/attendance/today").then(setAttendance).catch(() => {});
    }
    if (isSelf) {
      api<MonthlyAttendance>("/attendance/student/monthly").then(setMyAttendance).catch(() => {});
      api<MyFees>("/fees/my").then(setMyFees).catch(() => {});
      api<ProgressOverall>("/exams/progress").then(setMyProgress).catch(() => {});
    }
    if (me.role === "SUPER_ADMIN") {
      api<PlatformSummary>("/platform/summary").then(setPlatform).catch(() => {});
    }
  }, [me]);

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const isTeacher = me?.role === "TEACHER";
  const isSelf = me?.role === "STUDENT" || me?.role === "PARENT";
  const quickTiles = isTeacher ? TEACHER_QUICK : isSelf ? SELF_QUICK : ADMIN_QUICK;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">
          {greeting()}{me?.fullName ? `, ${me.fullName.split(" ")[0]}` : ""}
        </h1>
        <p className="text-sm text-slate-500">{today}{me?.tenantName ? ` · ${me.tenantName}` : ""}</p>
      </div>

      {me?.role === "SUPER_ADMIN" && platform && <PlatformOverview data={platform} />}

      {!isTeacher && !isSelf && (
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
      )}

      {isTeacher && (
        <div className="grid gap-5 sm:grid-cols-3">
          {attendance && (
            <>
              <StatCard label="Present Today" value={attendance.present.toLocaleString("en-IN")} />
              <StatCard label="Absent Today" value={(attendance.total - attendance.present).toLocaleString("en-IN")} />
              <StatCard label="Attendance Rate" value={attendance.percentage !== null ? `${attendance.percentage}%` : "—"} />
            </>
          )}
        </div>
      )}

      {isSelf && (
        <div className="grid gap-5 sm:grid-cols-3">
          <StatCard
            label="Attendance This Month"
            value={myAttendance ? `${myAttendance.summary.percentage}%` : "—"}
          />
          <StatCard
            label="Overall Grade"
            value={myProgress?.overall ? `${myProgress.overall.grade} (${myProgress.overall.averagePercentage}%)` : "No results yet"}
          />
          <StatCard
            label="Fees Due"
            value={myFees ? `₹${Number(myFees.totalDue).toLocaleString("en-IN")}` : "—"}
            delta={myFees?.nextDue ? `Next: ${new Date(myFees.nextDue.dueDate).toLocaleDateString("en-IN")}` : undefined}
          />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <QuickAccess tiles={quickTiles} />
        <NoticesCard announcements={announcements} />
      </div>

      <Calendar />
    </div>
  );
}
