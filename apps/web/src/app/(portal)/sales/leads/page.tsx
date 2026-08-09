"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, RowActions, Field, inputCls } from "@/components/ui/modal";
import { labelize, fmtDate, useSchools } from "../sales-shared";

type LeadSource = "WEBSITE" | "REFERRAL" | "DIRECT_CONTACT" | "EVENT" | "SCHOOL_VISIT" | "EXISTING_CUSTOMER" | "CAMPAIGN" | "OTHER";
type LeadStatus = "NEW" | "CONTACTED" | "INTERESTED" | "QUALIFIED" | "CONVERTED" | "LOST";
const SOURCES: LeadSource[] = ["WEBSITE", "REFERRAL", "DIRECT_CONTACT", "EVENT", "SCHOOL_VISIT", "EXISTING_CUSTOMER", "CAMPAIGN", "OTHER"];
const STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "INTERESTED", "QUALIFIED", "CONVERTED", "LOST"];
const STATUS_CLS: Record<LeadStatus, string> = {
  NEW: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  CONTACTED: "bg-accent/10 text-accent",
  INTERESTED: "bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
  QUALIFIED: "bg-primary/10 text-primary",
  CONVERTED: "bg-success/10 text-success",
  LOST: "bg-danger/10 text-danger",
};

interface LeadRow {
  id: string; schoolName: string; contactPerson: string | null; phone: string | null; email: string | null;
  location: string | null; source: LeadSource; status: LeadStatus; notes: string | null;
  leadDate: string; assignedTo: { fullName: string }; convertedSchool: { id: string; name: string } | null;
}

function LeadDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ schoolName: "", contactPerson: "", phone: "", email: "", location: "", source: "OTHER" as LeadSource, notes: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/sales/leads", {
        method: "POST",
        body: JSON.stringify({
          schoolName: form.schoolName.trim(), contactPerson: form.contactPerson.trim() || undefined,
          phone: form.phone.trim() || undefined, email: form.email.trim() || undefined,
          location: form.location.trim() || undefined, source: form.source, notes: form.notes.trim() || undefined,
        }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create lead");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New lead" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field id="l-name" label="School / organization name">
          <input id="l-name" required value={form.schoolName} onChange={(e) => setForm({ ...form, schoolName: e.target.value })} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field id="l-contact" label="Contact person" optional>
            <input id="l-contact" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} className={inputCls} />
          </Field>
          <Field id="l-phone" label="Phone" optional>
            <input id="l-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field id="l-email" label="Email" optional>
            <input id="l-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
          </Field>
          <Field id="l-location" label="Location" optional>
            <input id="l-location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={inputCls} />
          </Field>
        </div>
        <Field id="l-source" label="Source">
          <select id="l-source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as LeadSource })} className={inputCls}>
            {SOURCES.map((s) => <option key={s} value={s}>{labelize(s)}</option>)}
          </select>
        </Field>
        <Field id="l-notes" label="Notes" optional>
          <textarea id="l-notes" rows={2} className={`${inputCls} h-auto py-3`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save lead"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function LeadDetailModal({ lead, onClose, onSaved }: { lead: LeadRow; onClose: () => void; onSaved: () => void }) {
  const schools = useSchools();
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [convertSchoolId, setConvertSchoolId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveStatus() {
    setBusy(true); setError(null);
    try {
      await api(`/sales/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update");
    } finally {
      setBusy(false);
    }
  }

  async function convert() {
    if (!convertSchoolId) return;
    setBusy(true); setError(null);
    try {
      await api(`/sales/leads/${lead.id}/convert`, { method: "POST", body: JSON.stringify({ schoolId: convertSchoolId }) });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not convert lead");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={lead.schoolName} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div><p className="text-xs text-slate-400">Contact</p><p className="font-medium text-night dark:text-white">{lead.contactPerson ?? "—"}</p></div>
          <div><p className="text-xs text-slate-400">Phone</p><p className="font-medium text-night dark:text-white">{lead.phone ?? "—"}</p></div>
          <div><p className="text-xs text-slate-400">Email</p><p className="font-medium text-night dark:text-white">{lead.email ?? "—"}</p></div>
          <div><p className="text-xs text-slate-400">Source</p><p className="font-medium text-night dark:text-white">{labelize(lead.source)}</p></div>
          <div><p className="text-xs text-slate-400">Assigned to</p><p className="font-medium text-night dark:text-white">{lead.assignedTo.fullName}</p></div>
          <div><p className="text-xs text-slate-400">Lead date</p><p className="font-medium text-night dark:text-white">{fmtDate(lead.leadDate)}</p></div>
        </div>
        {lead.notes && <div><p className="text-xs text-slate-400">Notes</p><p className="mt-1 whitespace-pre-wrap text-slate-600 dark:text-slate-300">{lead.notes}</p></div>}

        {lead.status !== "CONVERTED" ? (
          <>
            <Field id="ld-status" label="Status">
              <div className="flex gap-2">
                <select id="ld-status" value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)} className={inputCls}>
                  {STATUSES.filter((s) => s !== "CONVERTED").map((s) => <option key={s} value={s}>{labelize(s)}</option>)}
                </select>
                <Button type="button" onClick={saveStatus} disabled={busy}>Save</Button>
              </div>
            </Field>
            <Field id="ld-convert" label="Convert to registered school">
              <div className="flex gap-2">
                <select id="ld-convert" value={convertSchoolId} onChange={(e) => setConvertSchoolId(e.target.value)} className={inputCls}>
                  <option value="">Select school…</option>
                  {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <Button type="button" variant="primary" onClick={convert} disabled={busy || !convertSchoolId}>Convert</Button>
              </div>
            </Field>
          </>
        ) : (
          <p className="rounded-xl bg-success/10 px-4 py-3 text-success">Converted to {lead.convertedSchool?.name}</p>
        )}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end"><Button variant="ghost" onClick={onClose}>Close</Button></div>
      </div>
    </Modal>
  );
}

export default function LeadsPage() {
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [dialog, setDialog] = useState<"add" | LeadRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    setState("loading");
    api<LeadRow[]>("/sales/leads").then((r) => { setRows(r); setState("ready"); }).catch(() => setState("error"));
  }, []);
  useEffect(load, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Sales Team</p>
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Leads</h1>
        </div>
        <Button onClick={() => setDialog("add")}>+ Add lead</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {state === "error" && <p className="p-6 text-sm text-slate-500">Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.</p>}
        {state === "ready" && rows.length === 0 && <p className="p-6 text-sm text-slate-500">No leads yet.</p>}
        {rows.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">School</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Assigned to</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                  <td className="px-4 py-3 font-medium text-night dark:text-white">{l.schoolName}</td>
                  <td className="px-4 py-3 text-slate-500">{l.contactPerson ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{labelize(l.source)}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLS[l.status]}`}>{labelize(l.status)}</span></td>
                  <td className="px-4 py-3 text-slate-500">{l.assignedTo.fullName}</td>
                  <td className="px-4 py-3"><RowActions onView={() => setDialog(l)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {dialog === "add" && (
        <LeadDialog onClose={() => setDialog(null)} onSaved={() => { setToast("Lead added"); setDialog(null); load(); }} />
      )}
      {dialog && dialog !== "add" && (
        <LeadDetailModal lead={dialog} onClose={() => setDialog(null)} onSaved={() => { setToast("Saved"); setDialog(null); load(); }} />
      )}

      {toast && <div role="status" className="fixed bottom-6 right-6 z-50 rounded-xl bg-night px-4 py-3 text-sm text-white shadow-lift">{toast}</div>}
    </div>
  );
}
