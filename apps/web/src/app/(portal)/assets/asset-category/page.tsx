"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, RowActions, Field, inputCls } from "@/components/ui/modal";

interface CategoryRow { id: string; name: string; description: string | null; isArchived: boolean; createdAt: string; updatedAt: string }
interface ItemRollupRow {
  id: string; itemCode: string; itemName: string; totalQuantity: number;
  allocatedQuantity: number; deliveredQuantity: number; availableQuantity: number; status: string;
}
interface CategoryDetail {
  category: CategoryRow; itemCount: number; totalStock: number; allocatedStock: number; availableStock: number;
  schoolCount: number; items: ItemRollupRow[];
}

function CategoryDialog({ initial, onClose, onSaved }: { initial?: CategoryRow; onClose: () => void; onSaved: () => void }) {
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
      if (initial) await api(`/assets/categories/${initial.id}`, { method: "PATCH", body: JSON.stringify(body) });
      else await api("/assets/categories", { method: "POST", body: JSON.stringify(body) });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save category");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={initial ? `Edit ${initial.name}` : "Add asset category"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field id="cat-name" label="Category name">
          <input id="cat-name" required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <Field id="cat-desc" label="Description" optional>
          <textarea id="cat-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputCls} h-auto py-2.5`} />
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

function CategoryDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<CategoryDetail | null>(null);
  useEffect(() => { api<CategoryDetail>(`/assets/categories/${id}`).then(setDetail).catch(() => setDetail(null)); }, [id]);

  return (
    <Modal title={detail?.category.name ?? "Category"} onClose={onClose} wide>
      {!detail && <p className="text-sm text-slate-500">Loading…</p>}
      {detail && (
        <div className="space-y-5">
          {detail.category.description && <p className="text-sm text-slate-500">{detail.category.description}</p>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ["Items", detail.itemCount], ["Total Stock", detail.totalStock], ["Allocated", detail.allocatedStock],
              ["Available", detail.availableStock], ["Schools", detail.schoolCount],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-xl border border-slate-200 p-3 text-center dark:border-white/10">
                <p className="text-lg font-semibold text-night dark:text-white">{value}</p>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
              </div>
            ))}
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400 dark:bg-white/5">
                <tr>
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">Total</th>
                  <th className="px-3 py-2 font-medium">Allocated</th>
                  <th className="px-3 py-2 font-medium">Delivered</th>
                  <th className="px-3 py-2 font-medium">Available</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">No inventory items in this category yet.</td></tr>
                )}
                {detail.items.map((i) => (
                  <tr key={i.id} className="border-t border-slate-100 dark:border-white/5">
                    <td className="px-3 py-2 font-medium text-night dark:text-white">{i.itemName} <span className="text-xs text-slate-400">({i.itemCode})</span></td>
                    <td className="px-3 py-2">{i.totalQuantity}</td>
                    <td className="px-3 py-2">{i.allocatedQuantity}</td>
                    <td className="px-3 py-2">{i.deliveredQuantity}</td>
                    <td className="px-3 py-2">{i.availableQuantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end"><Button variant="ghost" onClick={onClose}>Close</Button></div>
        </div>
      )}
    </Modal>
  );
}

export default function AssetCategoryPage() {
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [dialog, setDialog] = useState<{ mode: "add" } | { mode: "edit"; row: CategoryRow } | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    setState("loading");
    api<CategoryRow[]>("/assets/categories").then((r) => { setRows(r); setState("ready"); }).catch(() => setState("error"));
  }, []);

  useEffect(load, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  async function archive(row: CategoryRow) {
    try {
      await api(`/assets/categories/${row.id}`, { method: "PATCH", body: JSON.stringify({ isArchived: true }) });
      setToast("Category archived");
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
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Asset Category</h1>
        </div>
        <Button onClick={() => setDialog({ mode: "add" })}>+ Add category</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {state === "error" && <p className="p-6 text-sm text-slate-500">Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.</p>}
        {state === "ready" && rows.length === 0 && <p className="p-6 text-sm text-slate-500">No categories yet.</p>}
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
                    <RowActions onView={() => setViewingId(r.id)} onEdit={() => setDialog({ mode: "edit", row: r })} onDelete={() => archive(r)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {dialog && (
        <CategoryDialog
          initial={dialog.mode === "edit" ? dialog.row : undefined}
          onClose={() => setDialog(null)}
          onSaved={() => { setToast(dialog.mode === "add" ? "Category added" : "Changes saved"); setDialog(null); load(); }}
        />
      )}
      {viewingId && <CategoryDetailModal id={viewingId} onClose={() => setViewingId(null)} />}

      {toast && (
        <div role="status" className="fixed bottom-6 right-6 z-50 rounded-xl bg-night px-4 py-3 text-sm text-white shadow-lift">{toast}</div>
      )}
    </div>
  );
}
