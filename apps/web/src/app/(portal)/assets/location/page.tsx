"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, RowActions, Field, inputCls } from "@/components/ui/modal";

interface LocationRow { id: string; name: string; description: string | null; isArchived: boolean; updatedAt: string }

function LocationDialog({ initial, onClose, onSaved }: { initial?: LocationRow; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const body = { name: name.trim(), description: description.trim() || undefined };
      if (initial) await api(`/assets/locations/${initial.id}`, { method: "PATCH", body: JSON.stringify(body) });
      else await api("/assets/locations", { method: "POST", body: JSON.stringify(body) });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save location");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={initial ? `Edit ${initial.name}` : "Add location"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field id="loc-name" label="Location name">
          <input id="loc-name" required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Central Store Room" />
        </Field>
        <Field id="loc-desc" label="Description" optional>
          <textarea id="loc-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputCls} h-auto py-2.5`} />
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

export default function LocationPage() {
  const [rows, setRows] = useState<LocationRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [dialog, setDialog] = useState<{ mode: "add" } | { mode: "edit"; row: LocationRow } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    setState("loading");
    api<LocationRow[]>("/assets/locations").then((r) => { setRows(r); setState("ready"); }).catch(() => setState("error"));
  }, []);
  useEffect(load, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  async function archive(row: LocationRow) {
    try {
      await api(`/assets/locations/${row.id}`, { method: "PATCH", body: JSON.stringify({ isArchived: true }) });
      setToast("Location archived");
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not archive");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Asset Management</p>
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Location</h1>
        </div>
        <Button onClick={() => setDialog({ mode: "add" })}>+ Add location</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {state === "error" && <p className="p-6 text-sm text-slate-500">Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.</p>}
        {state === "ready" && rows.length === 0 && <p className="p-6 text-sm text-slate-500">No locations yet.</p>}
        {rows.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 last:border-0 dark:border-white/5 transition-colors hover:bg-surface dark:hover:bg-white/5">
                  <td className="px-4 py-3 font-medium text-night dark:text-white">{r.name}</td>
                  <td className="px-4 py-3 text-slate-500">{r.description ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(r.updatedAt).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-3">
                    <RowActions onView={() => setDialog({ mode: "edit", row: r })} onEdit={() => setDialog({ mode: "edit", row: r })} onDelete={() => archive(r)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {dialog && (
        <LocationDialog
          initial={dialog.mode === "edit" ? dialog.row : undefined}
          onClose={() => setDialog(null)}
          onSaved={() => { setToast(dialog.mode === "add" ? "Location added" : "Changes saved"); setDialog(null); load(); }}
        />
      )}

      {toast && <div role="status" className="fixed bottom-6 right-6 z-50 rounded-xl bg-night px-4 py-3 text-sm text-white shadow-lift">{toast}</div>}
    </div>
  );
}
