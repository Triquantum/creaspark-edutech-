"use client";
import { useEffect, useState } from "react";
import { Modal, Field, inputCls } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export const BOARDS = ["CBSE", "ICSE", "IB", "IGCSE", "STATE", "OTHER"] as const;
export const PLANS = ["STARTER", "GROWTH", "ENTERPRISE"] as const;
export const STATUSES = ["ACTIVE", "SUSPENDED", "TRIAL"] as const;
export const INSTITUTION_TYPES = ["SCHOOL", "COLLEGE", "INSTITUTE"] as const;

export interface SchoolFull {
  id: string; name: string; code: string; institutionType: string; board: string;
  city: string | null; state: string | null; phone: string | null; email: string | null;
  plan: string; status: string;
}
export type SchoolForm = {
  name: string; code: string; institutionType: string; board: string;
  city: string; state: string; phone: string; email: string; plan: string; status: string;
};

export function toSchoolForm(s: SchoolFull): SchoolForm {
  return {
    name: s.name, code: s.code, institutionType: s.institutionType, board: s.board,
    city: s.city ?? "", state: s.state ?? "", phone: s.phone ?? "", email: s.email ?? "",
    plan: s.plan, status: s.status,
  };
}

/** Shared edit form for any School row (Schools, Colleges, Institutes all
 * share this one model — see institutionType). Used by the Super Admin
 * dashboard's Registered Schools table and the Colleges/Institutes page. */
export function SchoolEditModal({ schoolId, onClose, onSaved }: { schoolId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<SchoolForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ school: SchoolFull }>(`/platform/schools/${schoolId}`).then((r) => setForm(toSchoolForm(r.school))).catch(() => setError("Could not load school"));
  }, [schoolId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);
    setBusy(true);
    try {
      await api(`/platform/schools/${schoolId}`, { method: "PATCH", body: JSON.stringify(form) });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Edit institution" onClose={onClose} wide>
      {!form ? (
        <p className="text-sm text-slate-500">{error ?? "Loading…"}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="se-name" label="Name">
              <input id="se-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
            </Field>
            <Field id="se-code" label="Code">
              <input id="se-code" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={inputCls} />
            </Field>
            <Field id="se-type" label="Institution type">
              <select id="se-type" value={form.institutionType} onChange={(e) => setForm({ ...form, institutionType: e.target.value })} className={inputCls}>
                {INSTITUTION_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
              </select>
            </Field>
            <Field id="se-board" label="Board" optional>
              <select id="se-board" value={form.board} onChange={(e) => setForm({ ...form, board: e.target.value })} className={inputCls}>
                {BOARDS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
            <Field id="se-city" label="City" optional>
              <input id="se-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputCls} />
            </Field>
            <Field id="se-state" label="State" optional>
              <input id="se-state" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className={inputCls} />
            </Field>
            <Field id="se-phone" label="Phone" optional>
              <input id="se-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
            </Field>
            <Field id="se-email" label="Email" optional>
              <input id="se-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
            </Field>
            <Field id="se-plan" label="Plan">
              <select id="se-plan" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} className={inputCls}>
                {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field id="se-status" label="Status">
              <select id="se-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
