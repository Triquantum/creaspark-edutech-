"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, apiBlob } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, RowActions, Field, inputCls } from "@/components/ui/modal";

interface CategoryOpt { id: string; name: string }
interface VendorOpt { id: string; name: string }
interface LocationOpt { id: string; name: string }
interface ItemRow {
  id: string; itemCode: string; itemName: string; unit: string; status: string; reorderLevel: number | null;
  totalQuantity: number; allocatedQuantity: number; deliveredQuantity: number; availableQuantity: number; imageUrl: string | null;
  assetCategory: { id: string; name: string }; location: { id: string; name: string } | null; vendor: { id: string; name: string } | null;
}

/** Same bucket already used by the Product inventory module's image upload
 * -- shared Storage bucket, random-UUID paths, no collision risk. */
async function uploadItemImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("inventory").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Image upload failed: ${error.message}`);
  return supabase.storage.from("inventory").getPublicUrl(path).data.publicUrl;
}
interface Dashboard {
  totalItems: number; totalStock: number; totalAvailable: number; totalAllocated: number;
  totalDelivered: number; totalPending: number; lowStock: number; schoolsWithAllocation: number;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4 text-center">
      <p className="font-display text-xl font-semibold text-night dark:text-white">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
    </Card>
  );
}

function ItemDialog({ initial, categories, locations, vendors, onClose, onSaved }: {
  initial?: ItemRow; categories: CategoryOpt[]; locations: LocationOpt[]; vendors: VendorOpt[];
  onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    itemCode: initial?.itemCode ?? "", itemName: initial?.itemName ?? "",
    assetCategoryId: initial?.assetCategory.id ?? categories[0]?.id ?? "",
    unit: initial?.unit ?? "unit", totalQuantity: initial ? String(initial.totalQuantity) : "0",
    reorderLevel: initial?.reorderLevel != null ? String(initial.reorderLevel) : "",
    locationId: initial?.location?.id ?? "", vendorId: initial?.vendor?.id ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(initial?.imageUrl ?? null);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageError(null);
    if (file && !file.type.startsWith("image/")) {
      setImageError("Choose an image file");
      return;
    }
    setImageFile(file);
    if (file) setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const imageUrl = imageFile ? await uploadItemImage(imageFile) : (imagePreview ? undefined : null);
      if (initial) {
        await api(`/assets/items/${initial.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            itemName: form.itemName.trim(), assetCategoryId: form.assetCategoryId, unit: form.unit.trim() || "unit",
            reorderLevel: form.reorderLevel.trim() ? Number(form.reorderLevel) : undefined,
            locationId: form.locationId || undefined, vendorId: form.vendorId || undefined,
            ...(imageUrl !== undefined && { imageUrl }),
          }),
        });
      } else {
        await api("/assets/items", {
          method: "POST",
          body: JSON.stringify({
            itemCode: form.itemCode.trim() || undefined, itemName: form.itemName.trim(), assetCategoryId: form.assetCategoryId,
            unit: form.unit.trim() || "unit", totalQuantity: Number(form.totalQuantity) || 0,
            reorderLevel: form.reorderLevel.trim() ? Number(form.reorderLevel) : undefined,
            locationId: form.locationId || undefined, vendorId: form.vendorId || undefined,
            imageUrl: imageUrl || undefined,
          }),
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save item");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={initial ? `Edit ${initial.itemName}` : "Add inventory item"} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field id="it-name" label="Item name">
            <input id="it-name" required value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} className={inputCls} />
          </Field>
          <Field id="it-category" label="Asset category">
            <select id="it-category" required value={form.assetCategoryId} onChange={(e) => setForm({ ...form, assetCategoryId: e.target.value })} className={inputCls}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>

        <Field id="it-image" label="Item photo" optional>
          <div className="flex items-center gap-3">
            {imagePreview ? (
              <img src={imagePreview} alt="" className="h-16 w-16 rounded-lg object-cover border border-slate-200 dark:border-white/10" />
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-lg border border-dashed border-slate-300 text-[10px] text-slate-400 dark:border-white/10">
                No photo
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <input id="it-image" ref={fileInputRef} type="file" accept="image/*" onChange={pickImage} className="text-sm" />
              {imagePreview && (
                <button type="button" onClick={clearImage} className="text-left text-xs text-slate-500 hover:text-danger">Remove photo</button>
              )}
            </div>
          </div>
          {imageError && <p className="mt-1 text-xs text-danger">{imageError}</p>}
        </Field>
        {!initial && (
          <Field id="it-code" label="Item code" optional>
            <input id="it-code" value={form.itemCode} onChange={(e) => setForm({ ...form, itemCode: e.target.value })} className={inputCls} placeholder="Auto-generated if left blank" />
          </Field>
        )}
        <div className="grid grid-cols-3 gap-4">
          <Field id="it-unit" label="Unit" optional>
            <input id="it-unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputCls} placeholder="unit / pcs / set" />
          </Field>
          {!initial && (
            <Field id="it-total" label="Total quantity">
              <input id="it-total" type="number" min={0} value={form.totalQuantity} onChange={(e) => setForm({ ...form, totalQuantity: e.target.value })} className={inputCls} />
            </Field>
          )}
          <Field id="it-reorder" label="Reorder level" optional>
            <input id="it-reorder" type="number" min={0} value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field id="it-location" label="Location" optional>
            <select id="it-location" value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} className={inputCls}>
              <option value="">—</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
          <Field id="it-vendor" label="Vendor" optional>
            <select id="it-vendor" value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })} className={inputCls}>
              <option value="">—</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </Field>
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function InventoryPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [categories, setCategories] = useState<CategoryOpt[]>([]);
  const [locations, setLocations] = useState<LocationOpt[]>([]);
  const [vendors, setVendors] = useState<VendorOpt[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [stockStatus, setStockStatus] = useState("");
  const [dialog, setDialog] = useState<{ mode: "add" } | { mode: "edit"; row: ItemRow } | null>(null);
  const [deleting, setDeleting] = useState<ItemRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    api<CategoryOpt[]>("/assets/categories").then(setCategories).catch(() => setCategories([]));
    api<LocationOpt[]>("/assets/locations").then(setLocations).catch(() => setLocations([]));
    api<VendorOpt[]>("/assets/vendors").then(setVendors).catch(() => setVendors([]));
    api<Dashboard>("/assets/dashboard").then(setDashboard).catch(() => setDashboard(null));
  }, []);

  const load = useCallback(() => {
    setState("loading");
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (categoryId) params.set("assetCategoryId", categoryId);
    if (stockStatus) params.set("stockStatus", stockStatus);
    api<ItemRow[]>(`/assets/items?${params.toString()}`).then((r) => { setRows(r); setState("ready"); }).catch(() => setState("error"));
  }, [q, categoryId, stockStatus]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api(`/assets/items/${deleting.id}`, { method: "DELETE" });
      setToast("Item deleted");
      setDeleting(null);
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not delete item");
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  async function exportCsv() {
    try {
      const blob = await apiBlob("/assets/reports/inventory.csv");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "inventory-report.csv"; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not export report");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Asset Management</p>
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Inventory</h1>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={exportCsv}>Export CSV</Button>
          <Button onClick={() => setDialog({ mode: "add" })}>+ New item</Button>
        </div>
      </div>

      {dashboard && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          <StatCard label="Total Items" value={dashboard.totalItems} />
          <StatCard label="Total Stock" value={dashboard.totalStock} />
          <StatCard label="Available" value={dashboard.totalAvailable} />
          <StatCard label="Allocated" value={dashboard.totalAllocated} />
          <StatCard label="Delivered" value={dashboard.totalDelivered} />
          <StatCard label="Pending" value={dashboard.totalPending} />
          <StatCard label="Low Stock" value={dashboard.lowStock} />
          <StatCard label="Schools" value={dashboard.schoolsWithAllocation} />
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search item name or code…" className={`${inputCls} max-w-sm`} />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`${inputCls} max-w-xs`}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={stockStatus} onChange={(e) => setStockStatus(e.target.value)} className={`${inputCls} max-w-xs`}>
          <option value="">All stock statuses</option>
          <option value="LOW">Low stock</option>
          <option value="OUT">Out of stock</option>
          <option value="IN_STOCK">In stock</option>
        </select>
      </div>

      <Card className="p-0 overflow-hidden">
        {state === "error" && <p className="p-6 text-sm text-slate-500">Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.</p>}
        {state === "ready" && rows.length === 0 && <p className="p-6 text-sm text-slate-500">No inventory items yet.</p>}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <th className="px-4 py-3 font-medium">Item Code</th>
                  <th className="px-4 py-3 font-medium">Item Name</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Allocated</th>
                  <th className="px-4 py-3 font-medium">Delivered</th>
                  <th className="px-4 py-3 font-medium">Available</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const low = r.reorderLevel != null && r.availableQuantity <= r.reorderLevel;
                  return (
                    <tr key={r.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.itemCode}</td>
                      <td className="px-4 py-3 font-medium text-night dark:text-white">
                        <Link href={`/assets/inventory/${r.id}`} className="flex items-center gap-2.5 hover:underline">
                          {r.imageUrl ? (
                            <img src={r.imageUrl} alt="" className="h-8 w-8 rounded-md object-cover border border-slate-200 dark:border-white/10" />
                          ) : (
                            <span className="grid h-8 w-8 place-items-center rounded-md border border-dashed border-slate-200 text-[9px] text-slate-400 dark:border-white/10">—</span>
                          )}
                          {r.itemName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{r.assetCategory.name}</td>
                      <td className="px-4 py-3 text-slate-500">{r.location?.name ?? "—"}</td>
                      <td className="px-4 py-3">{r.totalQuantity}</td>
                      <td className="px-4 py-3">{r.allocatedQuantity}</td>
                      <td className="px-4 py-3">{r.deliveredQuantity}</td>
                      <td className="px-4 py-3">
                        <span className={low ? "font-medium text-danger" : ""}>{r.availableQuantity}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          r.availableQuantity <= 0 ? "bg-danger/10 text-danger" : low ? "bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300" : "bg-success/10 text-success"
                        }`}>
                          {r.availableQuantity <= 0 ? "Out of stock" : low ? "Low stock" : "In stock"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <RowActions
                          onView={() => { window.location.href = `/assets/inventory/${r.id}`; }}
                          onEdit={() => setDialog({ mode: "edit", row: r })}
                          onDelete={() => setDeleting(r)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {dialog && (
        <ItemDialog
          initial={dialog.mode === "edit" ? dialog.row : undefined}
          categories={categories} locations={locations} vendors={vendors}
          onClose={() => setDialog(null)}
          onSaved={() => { setToast(dialog.mode === "add" ? "Item added" : "Changes saved"); setDialog(null); load(); }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete inventory item?"
          message={`Permanently remove "${deleting.itemName}"? This is blocked if it still has school allocations.`}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
          busy={deleteBusy}
        />
      )}

      {toast && <div role="status" className="fixed bottom-6 right-6 z-50 rounded-xl bg-night px-4 py-3 text-sm text-white shadow-lift">{toast}</div>}
    </div>
  );
}
