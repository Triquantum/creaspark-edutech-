"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, Field, inputCls } from "@/components/ui/modal";
import { ActivityType, ACTIVITY_TYPES, labelize, fmtDate } from "../sales-shared";

type Bucket = "today" | "upcoming" | "overdue" | "completed";
const BUCKETS: { key: Bucket; label: string }[] = [
  { key: "overdue", label: "Overdue" }, { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" }, { key: "completed", label: "Completed" },
];

interface FollowUpRow {
  id: string; nextAction: string; dueDate: string; priority: "LOW" | "MEDIUM" | "HIGH"; status: "PENDING" | "COMPLETED" | "CANCELLED";
  user: { fullName: string };
  school: { id: string; name: string } | null; lead: { id: string; schoolName: string } | null; opportunity: { id: string; title: string } | null;
}

function CompleteModal({ fu, onClose, onSaved }: { fu: FollowUpRow; onClose: () => void; onSaved: () => void }) {
  const [resultActivityType, setResultActivityType] = useState<ActivityType | "">("CALL");
  const [outcome, setOutcome] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api(`/sales/follow-ups/${fu.id}/complete`, {
        method: "POST",
        body: JSON.stringify({ resultActivityType: resultActivityType || undefined, outcome: outcome.trim() || undefined }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete follow-up");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Complete follow-up" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-500">{fu.nextAction}</p>
        <Field id="fu-type" label="Logged as" optional>
          <select id="fu-type" value={resultActivityType} onChange={(e) => setResultActivityType(e.target.value as ActivityType)} className={inputCls}>
            <option value="">Don&apos;t log a new activity</option>
            {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{labelize(t)}</option>)}
          </select>
        </Field>
        <Field id="fu-outcome" label="Outcome" optional>
          <textarea id="fu-outcome" rows={2} className={`${inputCls} h-auto py-3`} value={outcome} onChange={(e) => setOutcome(e.target.value)} />
        </Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Mark complete"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function FollowUpsPage() {
  const [bucket, setBucket] = useState<Bucket>("overdue");
  const [rows, setRows] = useState<FollowUpRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [completing, setCompleting] = useState<FollowUpRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    setState("loading");
    api<FollowUpRow[]>(`/sales/follow-ups?bucket=${bucket}`).then((r) => { setRows(r); setState("ready"); }).catch(() => setState("error"));
  }, [bucket]);
  useEffect(load, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Sales Team</p>
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Follow-up Center</h1>
      </div>

      <div className="flex gap-2">
        {BUCKETS.map((b) => (
          <button
            key={b.key} onClick={() => setBucket(b.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              bucket === b.key ? "bg-primary text-white" : "bg-white text-slate-600 hover:bg-black/5 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        {state === "error" && <p className="p-6 text-sm text-slate-500">Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.</p>}
        {state === "ready" && rows.length === 0 && <p className="p-6 text-sm text-slate-500">Nothing here.</p>}
        {rows.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">Next action</th>
                <th className="px-4 py-3 font-medium">School / Lead</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                  <td className="px-4 py-3 font-medium text-night dark:text-white">{f.nextAction}</td>
                  <td className="px-4 py-3 text-slate-500">{f.school?.name ?? f.lead?.schoolName ?? f.opportunity?.title ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{f.user.fullName}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(f.dueDate)}</td>
                  <td className="px-4 py-3 text-right">
                    {f.status === "PENDING" && <Button variant="ghost" className="h-8 px-3 text-xs" onClick={() => setCompleting(f)}>Complete</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {completing && (
        <CompleteModal fu={completing} onClose={() => setCompleting(null)} onSaved={() => { setToast("Follow-up completed"); setCompleting(null); load(); }} />
      )}
      {toast && <div role="status" className="fixed bottom-6 right-6 z-50 rounded-xl bg-night px-4 py-3 text-sm text-white shadow-lift">{toast}</div>}
    </div>
  );
}
