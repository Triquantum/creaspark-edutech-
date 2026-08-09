"use client";
import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, Field, inputCls } from "@/components/ui/modal";

interface SchoolOpt { id: string; name: string; code: string; institutionType: string }
interface AllocationRow {
  id: string; schoolId: string; allocatedQuantity: number; deliveredQuantity: number; status: string; createdAt: string;
  school: { id: string; name: string; code: string }; allocatedBy: { fullName: string };
}
interface TransactionRow {
  id: string; type: string; quantity: number; reference: string | null; remarks: string | null; createdAt: string;
  previousValue: number | null; newValue: number | null; user: { fullName: string }; school: { name: string } | null;
}
interface ItemDetail {
  id: string; itemCode: string; itemName: string; description: string | null; brand: string | null; model: string | null;
  unit: string; totalQuantity: number; damagedQuantity: number; lostQuantity: number; returnedQuantity: number;
  reorderLevel: number | null; status: string; notes: string | null;
  assetCategory: { id: string; name: string }; location: { id: string; name: string } | null; vendor: { id: string; name: string } | null;
  createdBy: { fullName: string }; updatedBy: { fullName: string } | null;
  allocatedQuantity: number; deliveredQuantity: number; availableQuantity: number; pendingQuantity: number;
  allocations: AllocationRow[]; transactions: TransactionRow[];
}
interface Proposal { schoolId: string; schoolName: string; schoolCode: string; proposedQuantity: number }
interface PlanPreview {
  itemId: string; itemName: string; totalStock: number; alreadyAllocated: number; availableStock: number;
  schoolCount: number; baseQuantityPerSchool: number | null; remainder: number | null;
  proposals: Proposal[]; totalProposed: number; exceedsAvailable: boolean;
}

const STATUS_CLS: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  PARTIALLY_DELIVERED: "bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
  DELIVERED: "bg-success/10 text-success",
};
const STATUS_LABEL: Record<string, string> = { PENDING: "Pending", PARTIALLY_DELIVERED: "Partially delivered", DELIVERED: "Delivered" };

function fmtDateTime(s: string) { return new Date(s).toLocaleString("en-IN"); }

function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 text-center dark:border-white/10">
      <p className="text-lg font-semibold text-night dark:text-white">{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}

function AdjustStockModal({ itemId, current, onClose, onSaved }: { itemId: string; current: number; onClose: () => void; onSaved: () => void }) {
  const [newTotal, setNewTotal] = useState(String(current));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api(`/assets/items/${itemId}/adjust-stock`, {
        method: "POST",
        body: JSON.stringify({ newTotalQuantity: Number(newTotal), reason: reason.trim() }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not adjust stock");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Adjust stock" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field id="adj-total" label="New total quantity">
          <input id="adj-total" type="number" min={0} required value={newTotal} onChange={(e) => setNewTotal(e.target.value)} className={inputCls} />
        </Field>
        <Field id="adj-reason" label="Reason">
          <textarea id="adj-reason" required rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputCls} h-auto py-2.5`} placeholder="e.g. Physical stock verification" />
        </Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save adjustment"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function MovementModal({ itemId, onClose, onSaved }: { itemId: string; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<"RETURN" | "DAMAGE" | "LOST">("RETURN");
  const [quantity, setQuantity] = useState("1");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api(`/assets/items/${itemId}/movement`, {
        method: "POST",
        body: JSON.stringify({ type, quantity: Number(quantity), remarks: remarks.trim() || undefined }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record movement");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Record stock movement" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field id="mv-type" label="Type">
          <select id="mv-type" value={type} onChange={(e) => setType(e.target.value as typeof type)} className={inputCls}>
            <option value="RETURN">Return (adds back to available stock)</option>
            <option value="DAMAGE">Damage</option>
            <option value="LOST">Lost</option>
          </select>
        </Field>
        <Field id="mv-qty" label="Quantity">
          <input id="mv-qty" type="number" min={1} required value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputCls} />
        </Field>
        <Field id="mv-remarks" label="Remarks" optional>
          <textarea id="mv-remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} className={`${inputCls} h-auto py-2.5`} />
        </Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Record"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function AllocateModal({ itemId, available, onClose, onSaved }: { itemId: string; available: number; onClose: () => void; onSaved: () => void }) {
  const [schools, setSchools] = useState<SchoolOpt[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api<SchoolOpt[]>("/academic/schools").then((r) => { setSchools(r); setSchoolId(r[0]?.id ?? ""); }).catch(() => setSchools([])); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/assets/allocations", { method: "POST", body: JSON.stringify({ assetItemId: itemId, schoolId, quantity: Number(quantity) }) });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not allocate");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Allocate to a school" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-500">{available} units available.</p>
        <Field id="al-school" label="School">
          <select id="al-school" required value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className={inputCls}>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field id="al-qty" label="Quantity">
          <input id="al-qty" type="number" min={1} max={available} required value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputCls} />
        </Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || !schoolId}>{busy ? "Allocating…" : "Allocate"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function DeliverModal({ allocation, onClose, onSaved }: { allocation: AllocationRow; onClose: () => void; onSaved: () => void }) {
  const remaining = allocation.allocatedQuantity - allocation.deliveredQuantity;
  const [quantity, setQuantity] = useState(String(remaining));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(full: boolean) {
    setError(null);
    setBusy(true);
    try {
      await api(`/assets/allocations/${allocation.id}/deliver`, {
        method: "POST",
        body: JSON.stringify(full ? { full: true } : { quantity: Number(quantity) }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record delivery");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Record delivery — ${allocation.school.name}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-500">{allocation.deliveredQuantity} of {allocation.allocatedQuantity} delivered so far. {remaining} pending.</p>
        <Field id="dv-qty" label="Quantity delivered now">
          <input id="dv-qty" type="number" min={1} max={remaining} value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputCls} />
        </Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex items-center justify-between gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <div className="flex gap-3">
            <Button type="button" disabled={busy} onClick={() => submit(false)}>{busy ? "Saving…" : "Record partial"}</Button>
            <Button type="button" disabled={busy} onClick={() => submit(true)}>Mark full delivery</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** Category -> Item -> Schools -> Equal/Manual proposal -> PREVIEW -> admin
 * review/edit -> CONFIRM. Never commits an allocation without an explicit
 * confirm step. */
function DistributionPlannerModal({ itemId, available, onClose, onSaved }: { itemId: string; available: number; onClose: () => void; onSaved: () => void }) {
  const [schools, setSchools] = useState<SchoolOpt[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"EQUAL" | "MANUAL">("EQUAL");
  const [manualQty, setManualQty] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<PlanPreview | null>(null);
  const [finalQty, setFinalQty] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<SchoolOpt[]>("/academic/schools").then((r) => { setSchools(r); setSelected(new Set(r.map((s) => s.id))); }).catch(() => setSchools([]));
  }, []);

  function toggleSchool(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function runPreview() {
    setError(null);
    setBusy(true);
    try {
      const body: Record<string, unknown> = { assetItemId: itemId, schoolIds: [...selected], mode };
      if (mode === "MANUAL") {
        body.manualQuantities = Object.fromEntries([...selected].map((id) => [id, Number(manualQty[id] || 0)]));
      }
      const result = await api<PlanPreview>("/assets/distribution-plan/preview", { method: "POST", body: JSON.stringify(body) });
      setPreview(result);
      setFinalQty(Object.fromEntries(result.proposals.map((p) => [p.schoolId, String(p.proposedQuantity)])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate proposal");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!preview) return;
    setError(null);
    setBusy(true);
    try {
      const allocations = preview.proposals.map((p) => ({ schoolId: p.schoolId, quantity: Number(finalQty[p.schoolId] || 0) }));
      await api("/assets/distribution-plan/confirm", { method: "POST", body: JSON.stringify({ assetItemId: itemId, allocations }) });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm allocation");
    } finally {
      setBusy(false);
    }
  }

  const totalFinal = Object.values(finalQty).reduce((s, v) => s + (Number(v) || 0), 0);

  return (
    <Modal title="Distribution planning" onClose={onClose} wide>
      <div className="space-y-5">
        <p className="text-sm text-slate-500">{available} units available to distribute.</p>

        {!preview && (
          <>
            <div>
              <p className="mb-2 text-sm font-medium text-night dark:text-white">Select schools</p>
              <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3 dark:border-white/10">
                {schools.map((s) => (
                  <label key={s.id} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    selected.has(s.id) ? "border-primary bg-primary/10 text-primary" : "border-slate-200 text-slate-600 hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                  }`}>
                    <input type="checkbox" className="sr-only" checked={selected.has(s.id)} onChange={() => toggleSchool(s.id)} />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
            <Field id="dp-mode" label="Distribution mode">
              <select id="dp-mode" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className={inputCls}>
                <option value="EQUAL">Equal distribution</option>
                <option value="MANUAL">Manual distribution</option>
              </select>
            </Field>
            {mode === "MANUAL" && (
              <div className="space-y-2">
                {[...selected].map((id) => {
                  const school = schools.find((s) => s.id === id);
                  return (
                    <div key={id} className="flex items-center gap-3">
                      <span className="w-40 truncate text-sm text-slate-500">{school?.name}</span>
                      <input type="number" min={0} value={manualQty[id] ?? ""} onChange={(e) => setManualQty({ ...manualQty, [id]: e.target.value })} className={`${inputCls} h-9`} />
                    </div>
                  );
                })}
              </div>
            )}
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="button" disabled={busy || selected.size === 0} onClick={runPreview}>{busy ? "Calculating…" : "Generate proposal"}</Button>
            </div>
          </>
        )}

        {preview && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatBlock label="Total Stock" value={preview.totalStock} />
              <StatBlock label="Available" value={preview.availableStock} />
              <StatBlock label="Schools" value={preview.schoolCount} />
              <StatBlock label="Base / School" value={preview.baseQuantityPerSchool ?? 0} />
            </div>
            {preview.remainder != null && preview.remainder > 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-300">{preview.remainder} units remain unallocated with equal split — adjust Final Qty below if you want to assign them manually.</p>
            )}
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400 dark:bg-white/5">
                  <tr><th className="px-3 py-2 font-medium">School</th><th className="px-3 py-2 font-medium">Proposed Qty</th><th className="px-3 py-2 font-medium">Final Qty</th></tr>
                </thead>
                <tbody>
                  {preview.proposals.map((p) => (
                    <tr key={p.schoolId} className="border-t border-slate-100 dark:border-white/5">
                      <td className="px-3 py-2 text-night dark:text-white">{p.schoolName}</td>
                      <td className="px-3 py-2 text-slate-500">{p.proposedQuantity}</td>
                      <td className="px-3 py-2">
                        <input type="number" min={0} value={finalQty[p.schoolId] ?? "0"} onChange={(e) => setFinalQty({ ...finalQty, [p.schoolId]: e.target.value })} className={`${inputCls} h-9 w-24`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={`text-sm ${totalFinal > preview.availableStock ? "text-danger" : "text-slate-500"}`}>
              Total final quantity: {totalFinal} of {preview.availableStock} available
            </p>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setPreview(null)}>Back</Button>
              <Button type="button" disabled={busy || totalFinal > preview.availableStock || totalFinal === 0} onClick={confirm}>
                {busy ? "Confirming…" : "Confirm allocation"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default function InventoryItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [tab, setTab] = useState<"overview" | "allocation" | "transactions">("overview");
  const [modal, setModal] = useState<"adjust" | "movement" | "allocate" | "plan" | null>(null);
  const [delivering, setDelivering] = useState<AllocationRow | null>(null);
  const [cancelling, setCancelling] = useState<AllocationRow | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    setState("loading");
    api<ItemDetail>(`/assets/items/${id}`).then((r) => { setItem(r); setState("ready"); }).catch(() => setState("error"));
  }, [id]);
  useEffect(load, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  async function confirmCancel() {
    if (!cancelling) return;
    setCancelBusy(true);
    try {
      await api(`/assets/allocations/${cancelling.id}`, { method: "DELETE" });
      setToast("Allocation cancelled");
      setCancelling(null);
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not cancel allocation");
      setCancelling(null);
    } finally {
      setCancelBusy(false);
    }
  }

  if (state === "loading") return <p className="p-6 text-sm text-slate-500">Loading…</p>;
  if (state === "error" || !item) return <p className="p-6 text-sm text-slate-500">Couldn&apos;t load this inventory item.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
            <Link href="/assets/inventory" className="hover:underline">Inventory</Link> · {item.itemCode}
          </p>
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">{item.itemName}</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="ghost" onClick={() => setModal("movement")}>Return / Damage / Lost</Button>
          <Button variant="ghost" onClick={() => setModal("adjust")}>Adjust Stock</Button>
          <Button variant="ghost" onClick={() => setModal("allocate")}>Allocate</Button>
          <Button onClick={() => setModal("plan")}>Distribution Planning</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <StatBlock label="Total" value={item.totalQuantity} />
        <StatBlock label="Allocated" value={item.allocatedQuantity} />
        <StatBlock label="Delivered" value={item.deliveredQuantity} />
        <StatBlock label="Available" value={item.availableQuantity} />
        <StatBlock label="Pending" value={item.pendingQuantity} />
        <StatBlock label="Damaged" value={item.damagedQuantity} />
        <StatBlock label="Lost" value={item.lostQuantity} />
      </div>

      <div className="flex gap-2 border-b border-slate-100 dark:border-white/5">
        {(["overview", "allocation", "transactions"] as const).map((t) => (
          <button
            key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t ? "border-b-2 border-primary text-primary" : "text-slate-500 hover:text-night dark:hover:text-white"
            }`}
          >
            {t === "allocation" ? "School Allocation" : t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <Card className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div><p className="text-xs text-slate-400">Category</p><p className="font-medium text-night dark:text-white">{item.assetCategory.name}</p></div>
            <div><p className="text-xs text-slate-400">Brand</p><p className="font-medium text-night dark:text-white">{item.brand ?? "—"}</p></div>
            <div><p className="text-xs text-slate-400">Model</p><p className="font-medium text-night dark:text-white">{item.model ?? "—"}</p></div>
            <div><p className="text-xs text-slate-400">Vendor</p><p className="font-medium text-night dark:text-white">{item.vendor?.name ?? "—"}</p></div>
            <div><p className="text-xs text-slate-400">Location</p><p className="font-medium text-night dark:text-white">{item.location?.name ?? "—"}</p></div>
            <div><p className="text-xs text-slate-400">Unit</p><p className="font-medium text-night dark:text-white">{item.unit}</p></div>
          </div>
          {item.description && <div><p className="text-xs text-slate-400">Description</p><p className="mt-1 text-slate-600 dark:text-slate-300">{item.description}</p></div>}
          {item.notes && <div><p className="text-xs text-slate-400">Notes</p><p className="mt-1 text-slate-600 dark:text-slate-300">{item.notes}</p></div>}
          <p className="text-xs text-slate-400">Created by {item.createdBy.fullName}{item.updatedBy && ` · Last updated by ${item.updatedBy.fullName}`}</p>
        </Card>
      )}

      {tab === "allocation" && (
        <Card className="p-0 overflow-hidden">
          {item.allocations.length === 0 && <p className="p-6 text-sm text-slate-500">Not yet allocated to any school.</p>}
          {item.allocations.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr className="border-b border-slate-100 dark:border-white/5">
                    <th className="px-4 py-3 font-medium">School</th>
                    <th className="px-4 py-3 font-medium">Allocated</th>
                    <th className="px-4 py-3 font-medium">Delivered</th>
                    <th className="px-4 py-3 font-medium">Pending</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {item.allocations.map((a) => (
                    <tr key={a.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                      <td className="px-4 py-3 font-medium text-night dark:text-white">{a.school.name}</td>
                      <td className="px-4 py-3">{a.allocatedQuantity}</td>
                      <td className="px-4 py-3">{a.deliveredQuantity}</td>
                      <td className="px-4 py-3">{a.allocatedQuantity - a.deliveredQuantity}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLS[a.status]}`}>{STATUS_LABEL[a.status]}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {a.status !== "DELIVERED" && <Button variant="ghost" onClick={() => setDelivering(a)}>Deliver</Button>}
                          {a.deliveredQuantity === 0 && <Button variant="ghost" onClick={() => setCancelling(a)}>Cancel</Button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "transactions" && (
        <Card className="p-0 overflow-hidden">
          {item.transactions.length === 0 && <p className="p-6 text-sm text-slate-500">No transactions yet.</p>}
          {item.transactions.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr className="border-b border-slate-100 dark:border-white/5">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Quantity</th>
                    <th className="px-4 py-3 font-medium">School</th>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {item.transactions.map((t) => (
                    <tr key={t.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                      <td className="px-4 py-3 text-slate-500">{fmtDateTime(t.createdAt)}</td>
                      <td className="px-4 py-3 text-night dark:text-white">{t.type.replaceAll("_", " ")}</td>
                      <td className="px-4 py-3">{t.quantity > 0 ? `+${t.quantity}` : t.quantity}</td>
                      <td className="px-4 py-3 text-slate-500">{t.school?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{t.user.fullName}</td>
                      <td className="px-4 py-3 text-slate-500">{t.remarks ?? t.reference ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {modal === "adjust" && <AdjustStockModal itemId={item.id} current={item.totalQuantity} onClose={() => setModal(null)} onSaved={() => { setModal(null); setToast("Stock adjusted"); load(); }} />}
      {modal === "movement" && <MovementModal itemId={item.id} onClose={() => setModal(null)} onSaved={() => { setModal(null); setToast("Movement recorded"); load(); }} />}
      {modal === "allocate" && <AllocateModal itemId={item.id} available={item.availableQuantity} onClose={() => setModal(null)} onSaved={() => { setModal(null); setToast("Allocated"); load(); }} />}
      {modal === "plan" && <DistributionPlannerModal itemId={item.id} available={item.availableQuantity} onClose={() => setModal(null)} onSaved={() => { setModal(null); setToast("Allocation created"); load(); }} />}
      {delivering && <DeliverModal allocation={delivering} onClose={() => setDelivering(null)} onSaved={() => { setDelivering(null); setToast("Delivery recorded"); load(); }} />}
      {cancelling && (
        <ConfirmDialog
          title="Cancel allocation?"
          message={`Remove the ${cancelling.allocatedQuantity}-unit allocation to ${cancelling.school.name}? This frees the stock back to available.`}
          onConfirm={confirmCancel}
          onClose={() => setCancelling(null)}
          busy={cancelBusy}
        />
      )}

      {toast && <div role="status" className="fixed bottom-6 right-6 z-50 rounded-xl bg-night px-4 py-3 text-sm text-white shadow-lift">{toast}</div>}
    </div>
  );
}
