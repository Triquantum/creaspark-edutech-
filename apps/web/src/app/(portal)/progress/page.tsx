"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";

interface Me { role: string }
interface Child { id: string; firstName: string; lastName: string }

interface SubjectProgress {
  subjectId: string; subjectName: string; averagePercentage: number; grade: string; trend: "up" | "down" | "flat";
  recent: { examName: string; marks: number; maxMarks: number; percentage: number; grade: string }[];
}
interface ExamProgress { overall: { averagePercentage: number; grade: string } | null; subjects: SubjectProgress[] }

interface AttendanceMonthly {
  summary: { total: number; present: number; absent: number; late: number; percentage: number };
  monthlyComparison: { month: string; label: string; percentage: number; rating: string }[];
  daily: { date: string; status: string; note?: string | null }[];
  insight: string;
}

interface FeeItem { label: string; amount: string | number }
interface FeePlan { items: FeeItem[] }
interface Payment { id: string; amount: string | number; mode: string; paidAt: string; reference?: string | null }
interface Invoice {
  id: string; invoiceNo: string; amount: string | number; discount: string | number; fine: string | number;
  dueDate: string; status: string; plan: FeePlan | null; payments: Payment[];
}
interface MyFees {
  totalDue: string | number;
  nextDue: { invoiceNo: string; dueDate: string; amount: string | number } | null;
  invoices: Invoice[];
  payments: (Payment & { invoiceNo: string })[];
}

const STATUS_TONE: Record<string, string> = {
  PRESENT: "text-success", ABSENT: "text-danger", LATE: "text-warning", HALF_DAY: "text-warning", LEAVE: "text-slate-400",
};

function TrendIcon({ trend }: { trend: "up" | "down" | "flat" }) {
  if (trend === "up") return <TrendingUp size={14} className="text-success" />;
  if (trend === "down") return <TrendingDown size={14} className="text-danger" />;
  return <Minus size={14} className="text-slate-400" />;
}

function AcademicTab({ studentId }: { studentId: string }) {
  const [data, setData] = useState<ExamProgress | null>(null);
  useEffect(() => { api<ExamProgress>(`/exams/progress?studentId=${studentId}`).then(setData).catch(() => setData(null)); }, [studentId]);
  if (!data) return null;

  return (
    <div className="space-y-5">
      <StatCard
        label="Overall Average"
        value={data.overall ? `${data.overall.grade} · ${data.overall.averagePercentage}%` : "No results yet"}
      />
      {data.subjects.length === 0 && (
        <Card><p className="text-sm text-slate-500">No exam results recorded yet.</p></Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {data.subjects.map((s) => (
          <Card key={s.subjectId}>
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-night dark:text-white">{s.subjectName}</h3>
              <span className="flex items-center gap-1 text-sm font-semibold text-night dark:text-white">
                {s.grade} <TrendIcon trend={s.trend} />
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">{s.averagePercentage}% average</p>
            <ul className="mt-3 space-y-1.5">
              {s.recent.map((r, i) => (
                <li key={i} className="flex items-center justify-between text-xs text-slate-500">
                  <span>{r.examName}</span>
                  <span className="font-medium text-night dark:text-white">{r.marks}/{r.maxMarks} ({r.percentage}%)</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AttendanceTab({ studentId }: { studentId: string }) {
  const [data, setData] = useState<AttendanceMonthly | null>(null);
  useEffect(() => { api<AttendanceMonthly>(`/attendance/student/monthly?studentId=${studentId}`).then(setData).catch(() => setData(null)); }, [studentId]);
  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-4">
        <StatCard label="This Month" value={`${data.summary.percentage}%`} />
        <StatCard label="Present" value={String(data.summary.present)} />
        <StatCard label="Absent" value={String(data.summary.absent)} />
        <StatCard label="Late" value={String(data.summary.late)} />
      </div>

      <Card className="bg-primary/5">
        <p className="text-sm text-night dark:text-white">{data.insight}</p>
      </Card>

      <Card>
        <h3 className="font-display font-semibold text-night dark:text-white">Monthly Comparison</h3>
        <ul className="mt-4 space-y-2">
          {data.monthlyComparison.map((m) => (
            <li key={m.month} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-xs text-slate-500">{m.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface dark:bg-white/10">
                <div className="h-full rounded-full bg-accent" style={{ width: `${m.percentage}%` }} />
              </div>
              <span className="w-24 shrink-0 text-right text-xs text-slate-500">{m.percentage}% · {m.rating}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h3 className="font-display font-semibold text-night dark:text-white">Daily Records</h3>
        {data.daily.length === 0 && <p className="mt-3 text-sm text-slate-500">No records this month.</p>}
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/10">
          {data.daily.map((d, i) => (
            <li key={i} className="flex items-center justify-between py-2 text-sm">
              <span className="text-night dark:text-white">{new Date(d.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
              <span className={`font-medium ${STATUS_TONE[d.status] ?? ""}`}>{d.status}</span>
              {d.note && <span className="text-xs text-slate-400">{d.note}</span>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function FeesTab({ studentId }: { studentId: string }) {
  const [data, setData] = useState<MyFees | null>(null);
  useEffect(() => { api<MyFees>(`/fees/my?studentId=${studentId}`).then(setData).catch(() => setData(null)); }, [studentId]);
  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <StatCard label="Total Due" value={`₹${Number(data.totalDue).toLocaleString("en-IN")}`} />
        <StatCard
          label="Next Due"
          value={data.nextDue ? `₹${Number(data.nextDue.amount).toLocaleString("en-IN")}` : "Nothing due"}
          delta={data.nextDue ? new Date(data.nextDue.dueDate).toLocaleDateString("en-IN") : undefined}
        />
      </div>

      <Card>
        <h3 className="font-display font-semibold text-night dark:text-white">Fee Breakdown</h3>
        {data.invoices.length === 0 && <p className="mt-3 text-sm text-slate-500">No invoices yet.</p>}
        <ul className="mt-3 space-y-4">
          {data.invoices.map((inv) => (
            <li key={inv.id} className="rounded-xl border border-slate-100 p-4 dark:border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-night dark:text-white">{inv.invoiceNo}</span>
                <span className="text-xs font-medium uppercase text-accent">{inv.status}</span>
              </div>
              {inv.plan?.items && inv.plan.items.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {inv.plan.items.map((it, i) => (
                    <li key={i} className="flex justify-between text-xs text-slate-500">
                      <span>{it.label}</span><span>₹{Number(it.amount).toLocaleString("en-IN")}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-slate-400">Due {new Date(inv.dueDate).toLocaleDateString("en-IN")}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h3 className="font-display font-semibold text-night dark:text-white">Payment History</h3>
        {data.payments.length === 0 && <p className="mt-3 text-sm text-slate-500">No payments recorded yet.</p>}
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/10">
          {data.payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-night dark:text-white">{p.invoiceNo} · {p.mode}</span>
              <span className="text-slate-500">₹{Number(p.amount).toLocaleString("en-IN")} · {new Date(p.paidAt).toLocaleDateString("en-IN")}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

const TABS = [
  { key: "academic", label: "Academic" },
  { key: "attendance", label: "Attendance" },
  { key: "fees", label: "Fees" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function ProgressContent() {
  const searchParams = useSearchParams();
  const [me, setMe] = useState<Me | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>((searchParams.get("tab") as TabKey) ?? "academic");

  useEffect(() => { api<Me>("/auth/me").then(setMe).catch(() => setMe(null)); }, []);
  useEffect(() => {
    if (!me || (me.role !== "STUDENT" && me.role !== "PARENT")) return;
    api<Child[]>("/students/mine").then((r) => { setChildren(r); setStudentId(r[0]?.id ?? null); }).catch(() => setChildren([]));
  }, [me]);

  if (me && me.role !== "STUDENT" && me.role !== "PARENT") {
    return <Card><p className="text-sm text-slate-500">This page is only available to student and parent accounts.</p></Card>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">My Progress</h1>
          <p className="text-sm text-slate-500">Academic results, attendance, and fees.</p>
        </div>
        {children.length > 1 && (
          <select
            value={studentId ?? ""}
            onChange={(e) => setStudentId(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/5"
          >
            {children.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
          </select>
        )}
      </div>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors
              ${tab === t.key ? "bg-primary text-white" : "bg-surface text-slate-500 dark:bg-white/5"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {!studentId && <Card><p className="text-sm text-slate-500">No linked student profile found.</p></Card>}
      {studentId && tab === "academic" && <AcademicTab studentId={studentId} />}
      {studentId && tab === "attendance" && <AttendanceTab studentId={studentId} />}
      {studentId && tab === "fees" && <FeesTab studentId={studentId} />}
    </div>
  );
}

export default function ProgressPage() {
  return (
    <Suspense fallback={null}>
      <ProgressContent />
    </Suspense>
  );
}
