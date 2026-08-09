"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Modal, Field, inputCls } from "@/components/ui/modal";

export interface Me { id: string; role: string; fullName?: string }
export interface SchoolOpt { id: string; name: string }

export type ActivityType =
  | "CALL" | "SCHOOL_VISIT" | "CUSTOMER_VISIT" | "MEETING" | "ONLINE_MEETING" | "PRODUCT_DEMO"
  | "EMAIL" | "MESSAGE" | "FOLLOW_UP" | "LEAD_CREATION" | "PROPOSAL" | "QUOTATION" | "NEGOTIATION"
  | "DELIVERY" | "TRAINING_DEMO" | "OTHER";
export type Priority = "LOW" | "MEDIUM" | "HIGH";
export type ActivityStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export const ACTIVITY_TYPES: ActivityType[] = [
  "CALL", "SCHOOL_VISIT", "CUSTOMER_VISIT", "MEETING", "ONLINE_MEETING", "PRODUCT_DEMO",
  "EMAIL", "MESSAGE", "FOLLOW_UP", "LEAD_CREATION", "PROPOSAL", "QUOTATION", "NEGOTIATION",
  "DELIVERY", "TRAINING_DEMO", "OTHER",
];
export const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH"];

export function labelize(v: string) {
  return v.toLowerCase().split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}
export function fmtDate(s: string | null | undefined) {
  return s ? new Date(s).toLocaleDateString("en-IN") : "—";
}
export function fmtDateTime(s: string | null | undefined) {
  return s ? new Date(s).toLocaleString("en-IN") : "—";
}
export function fmtMoney(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  return v ? `₹${v.toLocaleString("en-IN")}` : "—";
}

export const PRIORITY_CLS: Record<Priority, string> = {
  LOW: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  MEDIUM: "bg-accent/10 text-accent",
  HIGH: "bg-danger/10 text-danger",
};
export const STATUS_CLS: Record<ActivityStatus, string> = {
  OPEN: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  IN_PROGRESS: "bg-accent/10 text-accent",
  COMPLETED: "bg-success/10 text-success",
  CANCELLED: "bg-danger/10 text-danger",
};

export interface ActivityRow {
  id: string; type: ActivityType; contactPerson: string | null; purpose: string | null;
  description: string | null; outcome: string | null;
  activityDate: string; nextAction: string | null; nextFollowUpDate: string | null;
  priority: Priority; status: ActivityStatus;
  checkInAt: string | null; checkOutAt: string | null;
  user: { id: string; fullName: string };
  school: { id: string; name: string } | null;
  lead: { id: string; schoolName: string } | null;
  opportunity: { id: string; title: string } | null;
  generatedTask: { id: string; serialNo: string } | null;
}

export function useSchools() {
  const [schools, setSchools] = useState<SchoolOpt[]>([]);
  useEffect(() => { api<SchoolOpt[]>("/academic/schools").then(setSchools).catch(() => setSchools([])); }, []);
  return schools;
}

/** Fast-entry activity logger -- the single most-used action in the Sales
 * module (per spec: a salesperson logs a call/visit/meeting in seconds, not
 * minutes). Kept to the fields a rep actually fills in the field; deeper
 * Lead/Opportunity linkage happens from those records' own detail views. */
export function AddActivityModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const schools = useSchools();
  const [form, setForm] = useState({
    type: "CALL" as ActivityType, schoolId: "", contactPerson: "", purpose: "", description: "", outcome: "",
    nextAction: "", nextFollowUpDate: "", priority: "MEDIUM" as Priority, createTask: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/sales/activities", {
        method: "POST",
        body: JSON.stringify({
          type: form.type, schoolId: form.schoolId || undefined, contactPerson: form.contactPerson.trim() || undefined,
          purpose: form.purpose.trim() || undefined, description: form.description.trim() || undefined,
          outcome: form.outcome.trim() || undefined, nextAction: form.nextAction.trim() || undefined,
          nextFollowUpDate: form.nextFollowUpDate ? new Date(form.nextFollowUpDate).toISOString() : undefined,
          priority: form.priority, createTask: form.createTask && !!form.nextAction.trim(),
        }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log activity");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Log activity" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field id="a-type" label="Activity type">
            <select id="a-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ActivityType })} className={inputCls}>
              {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{labelize(t)}</option>)}
            </select>
          </Field>
          <Field id="a-school" label="School" optional>
            <select id="a-school" value={form.schoolId} onChange={(e) => setForm({ ...form, schoolId: e.target.value })} className={inputCls}>
              <option value="">None</option>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field id="a-contact" label="Contact person" optional>
            <input id="a-contact" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} className={inputCls} />
          </Field>
          <Field id="a-purpose" label="Purpose" optional>
            <input id="a-purpose" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} className={inputCls} />
          </Field>
        </div>
        <Field id="a-desc" label="Notes" optional>
          <textarea id="a-desc" rows={2} className={`${inputCls} h-auto py-3`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <Field id="a-outcome" label="Outcome" optional>
          <textarea id="a-outcome" rows={2} className={`${inputCls} h-auto py-3`} value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field id="a-next" label="Next action" optional>
            <input id="a-next" value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} className={inputCls} placeholder="e.g. Send proposal" />
          </Field>
          <Field id="a-followup" label="Next follow-up date" optional>
            <input id="a-followup" type="date" value={form.nextFollowUpDate} onChange={(e) => setForm({ ...form, nextFollowUpDate: e.target.value })} className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-2 items-end gap-4">
          <Field id="a-priority" label="Priority">
            <select id="a-priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })} className={inputCls}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{labelize(p)}</option>)}
            </select>
          </Field>
          <label className="flex h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={form.createTask} disabled={!form.nextAction.trim()} onChange={(e) => setForm({ ...form, createTask: e.target.checked })} />
            Also create a Task Manager task for this follow-up
          </label>
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Log activity"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export function ActivityRowCard({ a }: { a: ActivityRow }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-0 dark:border-white/5">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-night dark:text-white">{labelize(a.type)}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_CLS[a.priority]}`}>{labelize(a.priority)}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLS[a.status]}`}>{labelize(a.status)}</span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          {a.school?.name ?? a.lead?.schoolName ?? a.opportunity?.title ?? "—"}
          {a.contactPerson && ` · ${a.contactPerson}`} · {fmtDateTime(a.activityDate)}
        </p>
        {a.description && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{a.description}</p>}
        {a.nextAction && <p className="mt-1 text-xs text-accent">Next: {a.nextAction} {a.nextFollowUpDate && `· ${fmtDate(a.nextFollowUpDate)}`}</p>}
      </div>
    </div>
  );
}
