"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, RowActions, Field, inputCls } from "@/components/ui/modal";

interface VendorRow {
  id: string; name: string; contactPerson: string | null; phone: string | null; email: string | null;
  address: string | null; notes: string | null; isArchived: boolean; updatedAt: string;
}

function VendorDialog({ initial, onClose, onSaved }: { initial?: VendorRow; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: initial?.name ?? "", contactPerson: initial?.contactPerson ?? "", phone: initial?.phone ?? "",
    email: initial?.email ?? "", address: initial?.address ?? "", notes: initial?.notes ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const body = {
        name: form.name.trim(),
        contactPerson: form.contactPerson.trim() || undefined, phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined, address: form.address.trim() || undefined, notes: form.notes.trim() || undefined,
      };
      if (initial) await api(`/assets/vendors/${initial.id}`, { method: "PATCH", body: JSON.stringify(body) });
      else await api("/assets/vendors", { method: "POST", body: JSON.stringify(body) });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save vendor");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={initial ? `Edit ${initial.name}` : "Add vendor"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field id="v-name" label="Vendor name">
          <input id="v-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field id="v-contact" label="Contact person" optional>
            <input id="v-contact" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} className={inputCls} />
          </Field>
          <Field id="v-phone" label="Phone" optional>
            <input id="v-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
          </Field>
        </div>
        <Field id="v-email" label="Email" optional>
          <input id="v-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
        </Field>
        <Field id="v-address" label="Address" optional>
          <textarea id="v-address" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={`${inputCls} h-auto py-2.5`} />
        </Field>
        <Field id="v-notes" label="Notes" optional>
          <textarea id="v-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${inputCls} h-auto py-2.5`} />
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

export default function VendorPage() {
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [dialog, setDialog] = useState<{ mode: "add" } | { mode: "edit"; row: VendorRow } | null>(null);
  const [viewing, setViewing] = useState<VendorRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    setState("loading");
    api<VendorRow[]>("/assets/vendors").then((r) => { setRows(r); setState("ready"); }).catch(() => setState("error"));
  }, []);
  useEffect(load, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  async function archive(row: VendorRow) {
    try {
      await api(`/assets/vendors/${row.id}`, { method: "PATCH", body: JSON.stringify({ isArchived: true }) });
      setToast("Vendor archived");
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
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Vendor</h1>
        </div>
        <Button onClick={() => setDialog({ mode: "add" })}>+ Add vendor</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {state === "error" && <p className="p-6 text-sm text-slate-500">Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.</p>}
        {state === "ready" && rows.length === 0 && <p className="p-6 text-sm text-slate-500">No vendors yet.</p>}
        {rows.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 last:border-0 dark:border-white/5 transition-colors hover:bg-surface dark:hover:bg-white/5">
                  <td className="px-4 py-3 font-medium text-night dark:text-white">{r.name}</td>
                  <td className="px-4 py-3 text-slate-500">{r.contactPerson ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{r.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{r.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <RowActions onView={() => setViewing(r)} onEdit={() => setDialog({ mode: "edit", row: r })} onDelete={() => archive(r)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {dialog && (
        <VendorDialog
          initial={dialog.mode === "edit" ? dialog.row : undefined}
          onClose={() => setDialog(null)}
          onSaved={() => { setToast(dialog.mode === "add" ? "Vendor added" : "Changes saved"); setDialog(null); load(); }}
        />
      )}
      {viewing && (
        <Modal title={viewing.name} onClose={() => setViewing(null)}>
          <div className="space-y-3 text-sm">
            <p><span className="text-slate-400">Contact: </span>{viewing.contactPerson ?? "—"}</p>
            <p><span className="text-slate-400">Phone: </span>{viewing.phone ?? "—"}</p>
            <p><span className="text-slate-400">Email: </span>{viewing.email ?? "—"}</p>
            <p><span className="text-slate-400">Address: </span>{viewing.address ?? "—"}</p>
            {viewing.notes && <p><span className="text-slate-400">Notes: </span>{viewing.notes}</p>}
            <div className="flex justify-end pt-2"><Button variant="ghost" onClick={() => setViewing(null)}>Close</Button></div>
          </div>
        </Modal>
      )}

      {toast && <div role="status" className="fixed bottom-6 right-6 z-50 rounded-xl bg-night px-4 py-3 text-sm text-white shadow-lift">{toast}</div>}
    </div>
  );
}
