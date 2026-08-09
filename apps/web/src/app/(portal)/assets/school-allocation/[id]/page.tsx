"use client";
import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, Field, inputCls } from "@/components/ui/modal";

interface SchoolAllocationRow {
  id: string; assetItemId: string; allocatedQuantity: number; deliveredQuantity: number; status: string; createdAt: string;
  assetItem: { id: string; itemName: string; itemCode: string; assetCategory: { id: string; name: string } };
}
interface SchoolDetail {
  school: { id: string; name: string; code: string; institutionType: string; city: string | null; phone: string | null; email: string | null };
  allocations: SchoolAllocationRow[];
}

const STATUS_LABEL: Record<string, string> = { PENDING: "Pending", PARTIALLY_DELIVERED: "Partially delivered", DELIVERED: "Delivered" };
const STATUS_CLS: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  PARTIALLY_DELIVERED: "bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
  DELIVERED: "bg-success/10 text-success",
};

function DeliverModal({ allocation, onClose, onSaved }: { allocation: SchoolAllocationRow; onClose: () => void; onSaved: () => void }) {
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
    <Modal title={`Record delivery — ${allocation.assetItem.itemName}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-500">{allocation.deliveredQuantity} of {allocation.allocatedQuantity} delivered so far. {remaining} pending.</p>
        <Field id="sd-qty" label="Quantity delivered now">
          <input id="sd-qty" type="number" min={1} max={remaining} value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputCls} />
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

export default function SchoolAllocationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [detail, setDetail] = useState<SchoolDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [delivering, setDelivering] = useState<SchoolAllocationRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    setState("loading");
    api<SchoolDetail>(`/assets/schools/${id}`).then((r) => { setDetail(r); setState("ready"); }).catch(() => setState("error"));
  }, [id]);
  useEffect(load, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  if (state === "loading") return <p className="p-6 text-sm text-slate-500">Loading…</p>;
  if (state === "error" || !detail) return <p className="p-6 text-sm text-slate-500">Couldn&apos;t load this school&apos;s inventory allocation.</p>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
          <Link href="/assets/school-allocation" className="hover:underline">School Allocation</Link> · {detail.school.code}
        </p>
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">{detail.school.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {[detail.school.city, detail.school.phone, detail.school.email].filter(Boolean).join(" · ") || "No contact details on file."}
        </p>
      </div>

      <Card className="p-0 overflow-hidden">
        {detail.allocations.length === 0 && <p className="p-6 text-sm text-slate-500">No inventory allocated to this school yet.</p>}
        {detail.allocations.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Allocated</th>
                  <th className="px-4 py-3 font-medium">Delivered</th>
                  <th className="px-4 py-3 font-medium">Pending</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {detail.allocations.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                    <td className="px-4 py-3 font-medium text-night dark:text-white">
                      <Link href={`/assets/inventory/${a.assetItemId}`} className="hover:underline">{a.assetItem.itemName}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{a.assetItem.assetCategory.name}</td>
                    <td className="px-4 py-3">{a.allocatedQuantity}</td>
                    <td className="px-4 py-3">{a.deliveredQuantity}</td>
                    <td className="px-4 py-3">{a.allocatedQuantity - a.deliveredQuantity}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLS[a.status]}`}>{STATUS_LABEL[a.status]}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        {a.status !== "DELIVERED" && <Button variant="ghost" onClick={() => setDelivering(a)}>Deliver</Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {delivering && <DeliverModal allocation={delivering} onClose={() => setDelivering(null)} onSaved={() => { setDelivering(null); setToast("Delivery recorded"); load(); }} />}
      {toast && <div role="status" className="fixed bottom-6 right-6 z-50 rounded-xl bg-night px-4 py-3 text-sm text-white shadow-lift">{toast}</div>}
    </div>
  );
}
