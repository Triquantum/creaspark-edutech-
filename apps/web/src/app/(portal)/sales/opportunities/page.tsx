"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, Field, inputCls } from "@/components/ui/modal";
import { labelize, fmtDate, fmtMoney, useSchools } from "../sales-shared";

type Stage = "LEAD" | "CONTACTED" | "INTERESTED" | "MEETING" | "DEMO" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST";
const STAGES: Stage[] = ["LEAD", "CONTACTED", "INTERESTED", "MEETING", "DEMO", "PROPOSAL", "NEGOTIATION", "WON", "LOST"];

interface OpportunityRow {
  id: string; title: string; value: string | null; stage: Stage; probability: number; expectedClosingDate: string | null;
  assignedTo: { fullName: string }; school: { id: string; name: string } | null; lead: { id: string; schoolName: string } | null;
}

function NewOpportunityDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const schools = useSchools();
  const [form, setForm] = useState({ title: "", schoolId: "", value: "", probability: "10", expectedClosingDate: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api("/sales/opportunities", {
        method: "POST",
        body: JSON.stringify({
          title: form.title.trim(), schoolId: form.schoolId || undefined,
          value: form.value ? Number(form.value) : undefined, probability: Number(form.probability),
          expectedClosingDate: form.expectedClosingDate || undefined,
        }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create opportunity");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New opportunity" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field id="o-title" label="Title">
          <input id="o-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} placeholder="e.g. AMRITA Robotics Kit — 40 units" />
        </Field>
        <Field id="o-school" label="School" optional>
          <select id="o-school" value={form.schoolId} onChange={(e) => setForm({ ...form, schoolId: e.target.value })} className={inputCls}>
            <option value="">None</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field id="o-value" label="Estimated value (₹)" optional>
            <input id="o-value" type="number" min="0" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className={inputCls} />
          </Field>
          <Field id="o-prob" label="Probability (%)">
            <input id="o-prob" type="number" min="0" max="100" value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })} className={inputCls} />
          </Field>
        </div>
        <Field id="o-close" label="Expected closing date" optional>
          <input id="o-close" type="date" value={form.expectedClosingDate} onChange={(e) => setForm({ ...form, expectedClosingDate: e.target.value })} className={inputCls} />
        </Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Create"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function OpportunityDetailModal({ opp, onClose, onSaved }: { opp: OpportunityRow; onClose: () => void; onSaved: () => void }) {
  const [stage, setStage] = useState<Stage>(opp.stage);
  const [lostReason, setLostReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true); setError(null);
    try {
      await api(`/sales/opportunities/${opp.id}`, {
        method: "PATCH",
        body: JSON.stringify({ stage, ...(stage === "LOST" && { lostReason: lostReason.trim() || undefined }) }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={opp.title} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div><p className="text-xs text-slate-400">School</p><p className="font-medium text-night dark:text-white">{opp.school?.name ?? opp.lead?.schoolName ?? "—"}</p></div>
          <div><p className="text-xs text-slate-400">Value</p><p className="font-medium text-night dark:text-white">{fmtMoney(opp.value)}</p></div>
          <div><p className="text-xs text-slate-400">Owner</p><p className="font-medium text-night dark:text-white">{opp.assignedTo.fullName}</p></div>
          <div><p className="text-xs text-slate-400">Expected close</p><p className="font-medium text-night dark:text-white">{fmtDate(opp.expectedClosingDate)}</p></div>
        </div>
        <Field id="od-stage" label="Stage">
          <select id="od-stage" value={stage} onChange={(e) => setStage(e.target.value as Stage)} className={inputCls}>
            {STAGES.map((s) => <option key={s} value={s}>{labelize(s)}</option>)}
          </select>
        </Field>
        {stage === "LOST" && (
          <Field id="od-lost" label="Lost reason" optional>
            <input id="od-lost" value={lostReason} onChange={(e) => setLostReason(e.target.value)} className={inputCls} />
          </Field>
        )}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
          <Button type="button" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </div>
      </div>
    </Modal>
  );
}

export default function OpportunitiesPage() {
  const [rows, setRows] = useState<OpportunityRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<OpportunityRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    setState("loading");
    api<OpportunityRow[]>("/sales/opportunities").then((r) => { setRows(r); setState("ready"); }).catch(() => setState("error"));
  }, []);
  useEffect(load, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  const openPipelineValue = rows.filter((o) => o.stage !== "WON" && o.stage !== "LOST").reduce((s, o) => s + Number(o.value ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Sales Team</p>
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Opportunities</h1>
          <p className="mt-1 text-sm text-slate-500">Open pipeline value: <span className="font-medium text-night dark:text-white">{fmtMoney(openPipelineValue)}</span></p>
        </div>
        <Button onClick={() => setShowAdd(true)}>+ New opportunity</Button>
      </div>

      {state === "error" && <p className="text-sm text-slate-500">Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.</p>}
      {state === "ready" && rows.length === 0 && <p className="text-sm text-slate-500">No opportunities yet.</p>}

      <div className="grid grid-cols-1 gap-4 overflow-x-auto sm:grid-cols-3 lg:grid-cols-5">
        {STAGES.map((stage) => {
          const stageRows = rows.filter((o) => o.stage === stage);
          return (
            <div key={stage} className="min-w-[220px] space-y-3">
              <p className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-400">
                {labelize(stage)} <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500 dark:bg-white/10">{stageRows.length}</span>
              </p>
              <div className="space-y-2">
                {stageRows.map((o) => (
                  <Card key={o.id} className="cursor-pointer p-3" onClick={() => setSelected(o)}>
                    <p className="text-sm font-medium text-night dark:text-white">{o.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{o.school?.name ?? o.lead?.schoolName ?? "—"}</p>
                    <p className="mt-1 text-xs font-medium text-accent">{fmtMoney(o.value)}</p>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {showAdd && <NewOpportunityDialog onClose={() => setShowAdd(false)} onSaved={() => { setToast("Opportunity created"); setShowAdd(false); load(); }} />}
      {selected && <OpportunityDetailModal opp={selected} onClose={() => setSelected(null)} onSaved={() => { setToast("Saved"); setSelected(null); load(); }} />}
      {toast && <div role="status" className="fixed bottom-6 right-6 z-50 rounded-xl bg-night px-4 py-3 text-sm text-white shadow-lift">{toast}</div>}
    </div>
  );
}
