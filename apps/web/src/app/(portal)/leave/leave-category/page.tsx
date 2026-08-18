"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, RowActions, Field, inputCls } from "@/components/ui/modal";

interface Me { role: string }
interface LeaveTypeRow { id: string; name: string; daysPerYear: number | null }

const MANAGE_ROLES = ["SUPER_ADMIN", "ORG_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "COORDINATOR", "HR", "FINANCE_HR_ADMIN"];

function LeaveTypeDialog({ mode, initial, onClose, onSaved }: {
  mode: "add" | "edit"; initial?: LeaveTypeRow; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [daysPerYear, setDaysPerYear] = useState(initial?.daysPerYear != null ? String(initial.daysPerYear) : "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const body = { name: name.trim(), ...(daysPerYear.trim() && { daysPerYear: Number(daysPerYear) }) };
      if (mode === "add") {
        await api("/leave/types", { method: "POST", body: JSON.stringify(body) });
      } else {
        await api(`/leave/types/${initial!.id}`, { method: "PATCH", body: JSON.stringify(body) });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save leave category");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={mode === "add" ? "Add leave category" : `Edit ${initial?.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field id="lt-name" label="Name">
          <input id="lt-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Casual Leave" className={inputCls} />
        </Field>
        <Field id="lt-days" label="Default days per year" optional>
          <input id="lt-days" type="number" min={0} max={365} value={daysPerYear} onChange={(e) => setDaysPerYear(e.target.value)} className={inputCls} />
        </Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function LeaveCategoryPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [rows, setRows] = useState<LeaveTypeRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [dialog, setDialog] = useState<{ mode: "add" } | { mode: "edit"; row: LeaveTypeRow } | null>(null);
  const [deleting, setDeleting] = useState<LeaveTypeRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const canManage = !!me && MANAGE_ROLES.includes(me.role);

  const load = useCallback(() => {
    setState("loading");
    api<LeaveTypeRow[]>("/leave/types").then((r) => { setRows(r); setState("ready"); }).catch(() => setState("error"));
  }, []);

  useEffect(() => { api<Me>("/auth/me").then(setMe).catch(() => setMe(null)); }, []);
  useEffect(load, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/leave/types/${deleting.id}`, { method: "DELETE" });
      setToast("Leave category deleted");
      setDeleting(null);
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not delete");
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Leave Application</p>
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Leave Category</h1>
        </div>
        {canManage && <Button onClick={() => setDialog({ mode: "add" })}>+ Add category</Button>}
      </div>

      <Card className="p-0 overflow-hidden">
        {state === "error" && (
          <p className="p-6 text-sm text-slate-500">
            Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.
          </p>
        )}
        {state === "ready" && rows.length === 0 && <p className="p-6 text-sm text-slate-500">No leave categories yet.</p>}
        {rows.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Default days/year</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                  <td className="px-4 py-3 font-medium text-night dark:text-white">{row.name}</td>
                  <td className="px-4 py-3 text-slate-500">{row.daysPerYear ?? "—"}</td>
                  <td className="px-4 py-3">
                    {canManage && (
                      <RowActions
                        onView={() => setDialog({ mode: "edit", row })}
                        onEdit={() => setDialog({ mode: "edit", row })}
                        onDelete={() => setDeleting(row)}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {dialog && (
        <LeaveTypeDialog
          mode={dialog.mode} initial={dialog.mode === "edit" ? dialog.row : undefined}
          onClose={() => setDialog(null)}
          onSaved={() => { setDialog(null); setToast(dialog.mode === "add" ? "Category added" : "Changes saved"); load(); }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete leave category?"
          message={`Permanently remove "${deleting.name}"? This fails if any balances or applications already use it.`}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
          busy={busy}
        />
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 right-6 z-50 rounded-xl bg-night px-4 py-3 text-sm text-white shadow-lift">
          {toast}
        </div>
      )}
    </div>
  );
}
