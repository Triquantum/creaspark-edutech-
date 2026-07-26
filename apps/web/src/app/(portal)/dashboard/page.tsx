"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen, Cake, CalendarCheck2, ClipboardList, GraduationCap, HeartHandshake, MessageSquare,
  Megaphone, School, ShieldCheck, Users, Wallet, type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Calendar } from "@/components/ui/calendar";
import { api } from "@/lib/api";
import { InstitutionsTable } from "@/components/platform/institutions-table";

interface Me { id: string; fullName?: string; tenantName?: string; role: string }
interface TeacherAssignmentRow {
  id: string;
  teacher: { id: string };
  subject: { id: string; name: string };
  section: { id: string; name: string; class: { id: string; name: string } };
}
interface Announcement { id: string; title: string; body: string; pinned: boolean; createdAt: string }
interface BirthdayStudent {
  id: string; firstName: string; lastName: string; photoUrl: string | null; age: number;
  section: { id: string; name: string; class: { name: string } } | null;
  school: { name: string } | null;
}
interface FeesSummary { collected: number; outstanding: number }
interface AttendanceToday { total: number; present: number; percentage: number | null }
interface MonthlyAttendance { summary: { percentage: number; total: number } }
interface MyFees { totalDue: string | number; nextDue: { dueDate: string; amount: string | number } | null }
interface ProgressOverall { overall: { averagePercentage: number; grade: string } | null }
interface SchoolSummary {
  id: string; name: string; institutionType: string; slug: string; plan: string; status: string; createdAt: string;
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

const SUPER_ADMIN_QUICK: QuickTile[] = [
  { label: "Register School", href: "/admin/register-school", icon: School },
  ...ADMIN_QUICK,
];

const TEACHER_QUICK: QuickTile[] = [
  { label: "Take Attendance", href: "/attendance/student-attendance", icon: CalendarCheck2 },
  { label: "Portion Tracker", href: "/portion", icon: ClipboardList },
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

// Matches the @Roles list on GET /students/birthdays/today — anyone outside
// this set would just get a 403, so don't bother fetching for them.
const BIRTHDAY_ROLES = new Set(["SUPER_ADMIN", "ORG_ADMIN", "SCHOOL_ADMIN", "TEACHER"]);

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
        <StatCard label="Schools Registered" value={data.totalSchools.toLocaleString("en-IN")} href="/admin/registered-schools" />
        <StatCard label="Total Students" value={data.totalStudents.toLocaleString("en-IN")} href="/admin/people?tab=Students" />
        <StatCard label="Total Teachers" value={data.totalTeachers.toLocaleString("en-IN")} href="/admin/people?tab=Teachers" />
        <StatCard label="Total Parents" value={data.totalParents.toLocaleString("en-IN")} href="/admin/people?tab=Parents" />
      </div>

      <InstitutionsTable
        title="Registered Schools" icon={School}
        typeFilter={(t) => t === "SCHOOL"}
        emptyMessage="No schools registered yet."
      />
    </div>
  );
}

function MyClassesCard({ assignments }: { assignments: TeacherAssignmentRow[] }) {
  const bySection = new Map<string, { className: string; sectionName: string; subjects: string[] }>();
  for (const a of assignments) {
    const entry = bySection.get(a.section.id) ?? { className: a.section.class.name, sectionName: a.section.name, subjects: [] };
    entry.subjects.push(a.subject.name);
    bySection.set(a.section.id, entry);
  }
  const classes = Array.from(bySection.values());

  return (
    <Card>
      <h2 className="font-display font-semibold text-night dark:text-white">My Assigned Classes</h2>
      {classes.length === 0 && <p className="mt-4 text-sm text-slate-500">No classes assigned yet — check with your school admin.</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {classes.map((c) => (
          <div key={`${c.className}-${c.sectionName}`} className="rounded-xl border border-slate-100 dark:border-white/10 p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <BookOpen size={16} />
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium text-night dark:text-white">{c.className} · {c.sectionName}</p>
                <p className="truncate text-xs text-slate-400">{c.subjects.join(", ")}</p>
              </div>
            </div>
            <Link href="/attendance/student-attendance" className="mt-3 inline-block text-xs font-medium text-primary hover:underline">
              Manage Class →
            </Link>
          </div>
        ))}
      </div>
    </Card>
  );
}

function BirthdaysCard({ students }: { students: BirthdayStudent[] }) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Cake size={18} className="text-primary" />
        <h2 className="font-display font-semibold text-night dark:text-white">Today&apos;s Birthdays</h2>
      </div>
      {students.length === 0 && <p className="mt-4 text-sm text-slate-500">No birthdays today.</p>}
      <ul className="mt-4 space-y-3">
        {students.map((s) => (
          <li key={s.id} className="flex items-center gap-3">
            {s.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.photoUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {s.firstName[0]}{s.lastName[0]}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-night dark:text-white">
                {s.firstName} {s.lastName} <span className="text-xs font-normal text-slate-400">turns {s.age}</span>
              </p>
              <p className="truncate text-xs text-slate-400">
                {s.section ? `${s.section.class.name} · ${s.section.name}` : s.school?.name ?? ""}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
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

  // Teacher's own assigned classes
  const [myAssignments, setMyAssignments] = useState<TeacherAssignmentRow[]>([]);

  // Today's birthdays (Super Admin / Org Admin / School Admin / Teacher)
  const [birthdays, setBirthdays] = useState<BirthdayStudent[]>([]);

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
    if (isTeacher) {
      api<TeacherAssignmentRow[]>("/teacher-assignments")
        .then((rows) => setMyAssignments(rows.filter((r) => r.teacher.id === me.id)))
        .catch(() => setMyAssignments([]));
    }
    if (isSelf) {
      api<MonthlyAttendance>("/attendance/student/monthly").then(setMyAttendance).catch(() => {});
      api<MyFees>("/fees/my").then(setMyFees).catch(() => {});
      api<ProgressOverall>("/exams/progress").then(setMyProgress).catch(() => {});
    }
    if (me.role === "SUPER_ADMIN") {
      loadPlatform();
    }
    if (BIRTHDAY_ROLES.has(me.role)) {
      api<BirthdayStudent[]>("/students/birthdays/today").then(setBirthdays).catch(() => setBirthdays([]));
    }
  }, [me]);

  function loadPlatform() {
    api<PlatformSummary>("/platform/summary").then(setPlatform).catch(() => {});
  }

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const isTeacher = me?.role === "TEACHER";
  const isSelf = me?.role === "STUDENT" || me?.role === "PARENT";
  const quickTiles = isTeacher ? TEACHER_QUICK : isSelf ? SELF_QUICK
    : me?.role === "SUPER_ADMIN" ? SUPER_ADMIN_QUICK : ADMIN_QUICK;

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

      {isTeacher && <MyClassesCard assignments={myAssignments} />}

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
        {me && BIRTHDAY_ROLES.has(me.role) && <BirthdaysCard students={birthdays} />}
      </div>

      <Calendar />
    </div>
  );
}
