"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, RowActions, Field, inputCls } from "@/components/ui/modal";

const MANAGE_ROLES = new Set(["SUPER_ADMIN", "ORG_ADMIN"]);

interface GradeRow { id: string; academicYear: string; gradeLabel: string; sortOrder: number; entryCount: number }
interface Me { role: string }

function GradeDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ academicYear: "2026-2027", gradeLabel: "", sortOrder: "0" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/academic/yearly-plan/grades", {
        method: "POST",
        body: JSON.stringify({ academicYear: form.academicYear.trim(), gradeLabel: form.gradeLabel.trim(), sortOrder: Number(form.sortOrder) || 0 }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create yearly plan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New yearly plan" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field id="yp-year" label="Academic year">
          <input id="yp-year" required value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} className={inputCls} placeholder="e.g. 2026-2027" />
        </Field>
        <Field id="yp-grade" label="Grade / Class label">
          <input id="yp-grade" required value={form.gradeLabel} onChange={(e) => setForm({ ...form, gradeLabel: e.target.value })} className={inputCls} placeholder="e.g. Grade 5" />
        </Field>
        <Field id="yp-sort" label="Sort order" optional>
          <input id="yp-sort" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} className={inputCls} />
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

export default function YearlyPlanPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [showAdd, setShowAdd] = useState(false);
  const [deleting, setDeleting] = useState<GradeRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    setState("loading");
    api<GradeRow[]>("/academic/yearly-plan/grades").then((r) => { setRows(r); setState("ready"); }).catch(() => setState("error"));
  }, []);
  useEffect(() => { api<Me>("/auth/me").then(setMe).catch(() => {}); }, []);
  useEffect(load, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  const canManage = !!me && MANAGE_ROLES.has(me.role);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/academic/yearly-plan/grades/${deleting.id}`, { method: "DELETE" });
      setToast("Yearly plan deleted");
      setDeleting(null);
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Academic</p>
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Yearly Plan</h1>
          <p className="mt-1 text-sm text-slate-500">Week-by-week curriculum plan by grade.</p>
        </div>
        {canManage && <Button onClick={() => setShowAdd(true)}>+ Add grade</Button>}
      </div>

      {state === "error" && <p className="text-sm text-slate-500">Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.</p>}
      {state === "ready" && rows.length === 0 && <p className="text-sm text-slate-500">No yearly plans uploaded yet.</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((g) => (
          <Card key={g.id} className="cursor-pointer p-5" onClick={() => router.push(`/academic/yearly-plan/${g.id}`)}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{g.academicYear}</p>
                <h2 className="mt-0.5 font-display text-lg font-semibold text-night dark:text-white">{g.gradeLabel}</h2>
                <p className="mt-1 text-xs text-slate-500">{g.entryCount} week{g.entryCount === 1 ? "" : "s"} planned</p>
              </div>
              {canManage && (
                <div onClick={(e) => e.stopPropagation()}>
                  <RowActions onView={() => router.push(`/academic/yearly-plan/${g.id}`)} onDelete={() => setDeleting(g)} />
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {showAdd && <GradeDialog onClose={() => setShowAdd(false)} onSaved={() => { setToast("Yearly plan created"); setShowAdd(false); load(); }} />}
      {deleting && (
        <ConfirmDialog
          title="Delete yearly plan?"
          message={`Permanently remove the ${deleting.academicYear} plan for ${deleting.gradeLabel}, including all ${deleting.entryCount} weeks?`}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
          busy={busy}
        />
      )}
      {toast && <div role="status" className="fixed bottom-6 right-6 z-50 rounded-xl bg-night px-4 py-3 text-sm text-white shadow-lift">{toast}</div>}
    </div>
  );
}
