"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, RowActions, Field, inputCls } from "@/components/ui/modal";

interface SchoolOpt { id: string; name: string }
interface CategoryRecord { id: string; data: { name: string } }
interface InventoryItemRow {
  id: string; name: string; category: string | null; description: string | null;
  quantity: number; imageUrl: string | null; submittedAt: string;
  remarks: string | null; comments: string | null;
  school?: { name: string } | null; schoolId: string;
}
interface Me { role: string }

const MANAGE_ROLES = new Set(["SUPER_ADMIN", "ORG_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "COORDINATOR", "INVENTORY_MANAGER"]);

async function uploadToInventoryBucket(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("inventory").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return supabase.storage.from("inventory").getPublicUrl(path).data.publicUrl;
}

function ItemDialog({ schools, mode, initial, onClose, onSaved }: {
  schools: SchoolOpt[]; mode: "add" | "edit"; initial?: InventoryItemRow;
  onClose: () => void; onSaved: () => void;
}) {
  const [schoolId, setSchoolId] = useState(initial?.schoolId ?? "");
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1));
  const [submittedAt, setSubmittedAt] = useState(
    initial?.submittedAt ? initial.submittedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
  );
  const [remarks, setRemarks] = useState(initial?.remarks ?? "");
  const [comments, setComments] = useState(initial?.comments ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (!schoolId && schools[0]) setSchoolId(schools[0].id); }, [schools, schoolId]);
  useEffect(() => {
    if (!schoolId) { setCategories([]); return; }
    api<CategoryRecord[]>(`/records/inventory-category?schoolId=${schoolId}`).then(setCategories).catch(() => setCategories([]));
  }, [schoolId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const imageUrl = file ? await uploadToInventoryBucket(file) : initial?.imageUrl ?? undefined;
      const body = {
        schoolId, name: name.trim(), category: category || undefined,
        description: description.trim() || undefined, quantity: Number(quantity),
        imageUrl, submittedAt, remarks: remarks.trim() || undefined, comments: comments.trim() || undefined,
      };
      if (mode === "add") {
        await api("/inventory-items", { method: "POST", body: JSON.stringify(body) });
      } else {
        await api(`/inventory-items/${initial!.id}`, { method: "PATCH", body: JSON.stringify(body) });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save item");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={mode === "add" ? "Add item" : `Edit ${initial?.name}`} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="if-school" label="Distributed school">
            <select id="if-school" required value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className={inputCls}>
              {schools.length === 0 && <option value="" disabled>Loading schools…</option>}
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field id="if-category" label="Category" optional>
            <select id="if-category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              <option value="">No category</option>
              {categories.map((c) => <option key={c.id} value={c.data.name}>{c.data.name}</option>)}
            </select>
          </Field>
          <Field id="if-name" label="Item name">
            <input id="if-name" required value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Projector" className={inputCls} />
          </Field>
          <Field id="if-quantity" label="Quantity">
            <input id="if-quantity" type="number" min={0} required value={quantity}
              onChange={(e) => setQuantity(e.target.value)} className={inputCls} />
          </Field>
          <Field id="if-date" label="Date of submission">
            <input id="if-date" type="date" required value={submittedAt} onChange={(e) => setSubmittedAt(e.target.value)} className={inputCls} />
          </Field>
          <Field id="if-image" label="Item photo" optional>
            <input id="if-image" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-white" />
          </Field>
        </div>
        <Field id="if-description" label="Item description" optional>
          <textarea id="if-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
            className={`${inputCls} h-auto py-2.5`} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="if-remarks" label="Remarks" optional>
            <textarea id="if-remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)}
              className={`${inputCls} h-auto py-2.5`} />
          </Field>
          <Field id="if-comments" label="Comments" optional>
            <textarea id="if-comments" rows={2} value={comments} onChange={(e) => setComments(e.target.value)}
              className={`${inputCls} h-auto py-2.5`} />
          </Field>
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : mode === "add" ? "Save" : "Save changes"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function InventoryProductPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [rows, setRows] = useState<InventoryItemRow[]>([]);
  const [schools, setSchools] = useState<SchoolOpt[]>([]);
  const [q, setQ] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ mode: "add" } | { mode: "edit"; row: InventoryItemRow } | null>(null);
  const [viewing, setViewing] = useState<InventoryItemRow | null>(null);
  const [deleting, setDeleting] = useState<InventoryItemRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const canManage = !!me && MANAGE_ROLES.has(me.role);

  useEffect(() => { api<Me>("/auth/me").then(setMe).catch(() => setMe(null)); }, []);

  function load() {
    setState("loading");
    api<InventoryItemRow[]>(`/inventory-items${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      .then((r) => { setRows(r); setState("ready"); })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Could not load inventory items");
        setState("error");
      });
  }

  useEffect(() => { if (canManage) { const t = setTimeout(load, 250); return () => clearTimeout(t); } }, [canManage, q]);
  useEffect(() => { if (canManage) api<SchoolOpt[]>("/academic/schools").then(setSchools).catch(() => setSchools([])); }, [canManage]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/inventory-items/${deleting.id}`, { method: "DELETE" });
      setToast("Item deleted");
      setDeleting(null);
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not delete");
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  if (!me) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Inventory</p>
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Product</h1>
        </div>
        {canManage && <Button onClick={() => setDialog({ mode: "add" })}>Add item</Button>}
      </div>

      {!canManage && (
        <Card><p className="text-sm text-slate-500">Inventory isn&apos;t available for your role.</p></Card>
      )}

      {canManage && (
        <Card className="p-0 overflow-hidden">
          <div className="border-b border-slate-100 dark:border-white/5 p-4">
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search by item or category" aria-label="Search inventory"
              className="h-10 w-full max-w-sm rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-4 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          {state === "error" && (
            <p className="p-6 text-sm text-slate-500">{loadError ?? "Couldn't load inventory items."}</p>
          )}
          {state === "ready" && rows.length === 0 && (
            <p className="p-6 text-sm text-slate-500">No items yet — add the first one.</p>
          )}

          {rows.length > 0 && (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">School</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Submitted</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((it) => (
                  <tr key={it.id} className="border-b border-slate-50 dark:border-white/5 transition-colors hover:bg-surface dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {it.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.imageUrl} alt={it.name} className="h-9 w-9 rounded-lg object-cover" />
                        ) : (
                          <div className="h-9 w-9 rounded-lg bg-surface dark:bg-white/10" />
                        )}
                        <span className="font-medium text-night dark:text-white">{it.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{it.category ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{it.school?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-night dark:text-white">{it.quantity}</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(it.submittedAt).toLocaleDateString("en-IN")}</td>
                    <td className="px-4 py-3">
                      <RowActions
                        onView={() => setViewing(it)}
                        onEdit={() => setDialog({ mode: "edit", row: it })}
                        onDelete={() => setDeleting(it)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {dialog && (
        <ItemDialog
          schools={schools} mode={dialog.mode}
          initial={dialog.mode === "edit" ? dialog.row : undefined}
          onClose={() => setDialog(null)}
          onSaved={() => { setToast(dialog.mode === "add" ? "Item added" : "Changes saved"); load(); }}
        />
      )}

      {viewing && (
        <Modal title={viewing.name} onClose={() => setViewing(null)}>
          <div className="space-y-4 text-sm">
            {viewing.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewing.imageUrl} alt={viewing.name} className="max-h-48 w-full rounded-xl object-cover" />
            )}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              {[
                ["Category", viewing.category ?? "—"],
                ["School", viewing.school?.name ?? "—"],
                ["Quantity", String(viewing.quantity)],
                ["Submitted", new Date(viewing.submittedAt).toLocaleDateString("en-IN")],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">{k}</dt>
                  <dd className="mt-0.5 font-medium text-night dark:text-white">{v}</dd>
                </div>
              ))}
            </dl>
            {viewing.description && (
              <div><p className="text-xs uppercase tracking-wide text-slate-400">Description</p><p className="mt-0.5 text-slate-500">{viewing.description}</p></div>
            )}
            {viewing.remarks && (
              <div><p className="text-xs uppercase tracking-wide text-slate-400">Remarks</p><p className="mt-0.5 text-slate-500">{viewing.remarks}</p></div>
            )}
            {viewing.comments && (
              <div><p className="text-xs uppercase tracking-wide text-slate-400">Comments</p><p className="mt-0.5 text-slate-500">{viewing.comments}</p></div>
            )}
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this item?"
          message={`This permanently removes "${deleting.name}" from inventory.`}
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
