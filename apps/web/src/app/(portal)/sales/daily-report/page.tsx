"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, Field, inputCls } from "@/components/ui/modal";
import { Me, fmtDate } from "../sales-shared";

const MANAGE_ROLES = ["SUPER_ADMIN", "ORG_ADMIN", "SALES_MANAGER"];

interface TodayReport {
  tasksPlanned: number; tasksCompleted: number; calls: number; visits: number; meetings: number;
  demos: number; followUps: number; newLeads: number; proposals: number;
  report: {
    id: string; status: "DRAFT" | "SUBMITTED" | "REVIEWED";
    achievements: string | null; majorOpportunities: string | null; challenges: string | null;
    supportRequired: string | null; tomorrowPriorities: string | null; tomorrowPlan: string | null;
    managerComments: string | null;
  } | null;
}
interface ReportRow {
  id: string; reportDate: string; status: "DRAFT" | "SUBMITTED" | "REVIEWED";
  user: { fullName: string }; achievements: string | null; challenges: string | null; managerComments: string | null;
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2 text-center dark:bg-white/5">
      <p className="font-display text-lg font-semibold text-night dark:text-white">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}

function ReviewModal({ row, onClose, onSaved }: { row: ReportRow; onClose: () => void; onSaved: () => void }) {
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api(`/sales/daily-reports/${row.id}/review`, { method: "PATCH", body: JSON.stringify({ managerComments: comments.trim() }) });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save review");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Review — ${row.user.fullName}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {row.achievements && <div><p className="text-xs text-slate-400">Achievements</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{row.achievements}</p></div>}
        {row.challenges && <div><p className="text-xs text-slate-400">Challenges</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{row.challenges}</p></div>}
        <Field id="rv-comments" label="Manager comments">
          <textarea id="rv-comments" required rows={3} className={`${inputCls} h-auto py-3`} value={comments} onChange={(e) => setComments(e.target.value)} />
        </Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Mark reviewed"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function DailyReportPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [today, setToday] = useState<TodayReport | null>(null);
  const [form, setForm] = useState({ achievements: "", majorOpportunities: "", challenges: "", supportRequired: "", tomorrowPriorities: "", tomorrowPlan: "" });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [teamReports, setTeamReports] = useState<ReportRow[]>([]);
  const [reviewing, setReviewing] = useState<ReportRow | null>(null);

  const isManager = !!me && MANAGE_ROLES.includes(me.role);

  const loadToday = useCallback(() => {
    api<TodayReport>("/sales/daily-reports/today").then((r) => {
      setToday(r);
      if (r.report) {
        setForm({
          achievements: r.report.achievements ?? "", majorOpportunities: r.report.majorOpportunities ?? "",
          challenges: r.report.challenges ?? "", supportRequired: r.report.supportRequired ?? "",
          tomorrowPriorities: r.report.tomorrowPriorities ?? "", tomorrowPlan: r.report.tomorrowPlan ?? "",
        });
      }
    }).catch(() => {});
  }, []);

  useEffect(() => { api<Me>("/auth/me").then(setMe).catch(() => {}); }, []);
  useEffect(loadToday, [loadToday]);
  useEffect(() => { if (isManager) api<ReportRow[]>("/sales/daily-reports").then(setTeamReports).catch(() => {}); }, [isManager]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  async function save() {
    setBusy(true);
    try {
      await api("/sales/daily-reports/today", { method: "POST", body: JSON.stringify(form) });
      setToast("Draft saved");
      loadToday();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function submitReport() {
    if (!today?.report) return;
    setBusy(true);
    try {
      await api(`/sales/daily-reports/${today.report.id}/submit`, { method: "POST" });
      setToast("Report submitted");
      loadToday();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  }

  const submitted = today?.report?.status === "SUBMITTED" || today?.report?.status === "REVIEWED";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Sales Team</p>
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Daily Report</h1>
      </div>

      {today && (
        <Card className="p-6">
          <h2 className="mb-3 font-display text-base font-semibold text-night dark:text-white">Today, auto-computed from your logged activities</h2>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
            <StatPill label="Planned" value={today.tasksPlanned} />
            <StatPill label="Completed" value={today.tasksCompleted} />
            <StatPill label="Calls" value={today.calls} />
            <StatPill label="Visits" value={today.visits} />
            <StatPill label="Meetings" value={today.meetings} />
            <StatPill label="Demos" value={today.demos} />
            <StatPill label="New Leads" value={today.newLeads} />
            <StatPill label="Proposals" value={today.proposals} />
          </div>
        </Card>
      )}

      <Card className="space-y-4 p-6">
        <fieldset disabled={submitted} className="space-y-4">
          <Field id="dr-ach" label="Achievements">
            <textarea id="dr-ach" rows={2} className={`${inputCls} h-auto py-3`} value={form.achievements} onChange={(e) => setForm({ ...form, achievements: e.target.value })} />
          </Field>
          <Field id="dr-opp" label="Major opportunities" optional>
            <textarea id="dr-opp" rows={2} className={`${inputCls} h-auto py-3`} value={form.majorOpportunities} onChange={(e) => setForm({ ...form, majorOpportunities: e.target.value })} />
          </Field>
          <Field id="dr-chal" label="Challenges" optional>
            <textarea id="dr-chal" rows={2} className={`${inputCls} h-auto py-3`} value={form.challenges} onChange={(e) => setForm({ ...form, challenges: e.target.value })} />
          </Field>
          <Field id="dr-support" label="Support required" optional>
            <textarea id="dr-support" rows={2} className={`${inputCls} h-auto py-3`} value={form.supportRequired} onChange={(e) => setForm({ ...form, supportRequired: e.target.value })} />
          </Field>
          <Field id="dr-priorities" label="Tomorrow's priorities" optional>
            <textarea id="dr-priorities" rows={2} className={`${inputCls} h-auto py-3`} value={form.tomorrowPriorities} onChange={(e) => setForm({ ...form, tomorrowPriorities: e.target.value })} />
          </Field>
          <Field id="dr-plan" label="Tomorrow's plan" optional>
            <textarea id="dr-plan" rows={2} className={`${inputCls} h-auto py-3`} value={form.tomorrowPlan} onChange={(e) => setForm({ ...form, tomorrowPlan: e.target.value })} />
          </Field>
        </fieldset>
        {today?.report?.managerComments && (
          <p className="rounded-xl bg-primary/5 px-4 py-3 text-sm text-primary">Manager: {today.report.managerComments}</p>
        )}
        {submitted ? (
          <p className="text-sm text-success">Submitted for {fmtDate(new Date().toISOString())} — awaiting manager review.</p>
        ) : (
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save draft"}</Button>
            <Button onClick={submitReport} disabled={busy || !today?.report}>Submit</Button>
          </div>
        )}
      </Card>

      {isManager && (
        <Card className="p-0 overflow-hidden">
          <h2 className="p-6 pb-0 font-display text-base font-semibold text-night dark:text-white">Team daily reports</h2>
          {teamReports.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No reports yet.</p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <th className="px-4 py-3 font-medium">Salesperson</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {teamReports.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                    <td className="px-4 py-3 font-medium text-night dark:text-white">{r.user.fullName}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(r.reportDate)}</td>
                    <td className="px-4 py-3 text-slate-500">{r.status}</td>
                    <td className="px-4 py-3 text-right">
                      {r.status === "SUBMITTED" && <Button variant="ghost" className="h-8 px-3 text-xs" onClick={() => setReviewing(r)}>Review</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {reviewing && (
        <ReviewModal row={reviewing} onClose={() => setReviewing(null)} onSaved={() => {
          setToast("Review saved"); setReviewing(null);
          api<ReportRow[]>("/sales/daily-reports").then(setTeamReports).catch(() => {});
        }} />
      )}
      {toast && <div role="status" className="fixed bottom-6 right-6 z-50 rounded-xl bg-night px-4 py-3 text-sm text-white shadow-lift">{toast}</div>}
    </div>
  );
}
