"use client";
import { useEffect, useState } from "react";
import { api, apiBlob } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/ui/modal";

interface MatrixSchool { id: string; name: string; code: string }
interface MatrixCell { schoolId: string; allocated: number; delivered: number }
interface MatrixItem { id: string; itemName: string; itemCode: string; category: string; cells: MatrixCell[] }
interface Matrix { schools: MatrixSchool[]; items: MatrixItem[] }

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function AssetReportsPage() {
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [category, setCategory] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    api<Matrix>("/assets/reports/distribution-matrix").then((r) => { setMatrix(r); setState("ready"); }).catch(() => setState("error"));
  }, []);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  const categories = matrix ? [...new Set(matrix.items.map((i) => i.category))].sort() : [];
  const visibleItems = matrix ? matrix.items.filter((i) => !category || i.category === category) : [];

  async function exportReport(path: string, filename: string) {
    try {
      download(await apiBlob(path), filename);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not export report");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Asset Management</p>
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Inventory Reports</h1>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="ghost" onClick={() => exportReport("/assets/reports/inventory.csv", "inventory-report.csv")}>Download Inventory Report (CSV)</Button>
        <Button variant="ghost" onClick={() => exportReport("/assets/reports/distribution-matrix.csv", "distribution-matrix.csv")}>Download Distribution Matrix (CSV)</Button>
        <Button variant="ghost" onClick={() => window.print()}>Print this page</Button>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display font-semibold text-night dark:text-white">School-wise Distribution Matrix</h2>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputCls} max-w-xs`}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {state === "error" && <p className="text-sm text-slate-500">Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.</p>}
        {state === "ready" && matrix && matrix.items.length === 0 && <p className="text-sm text-slate-500">No inventory items yet.</p>}
        {matrix && visibleItems.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <th className="px-3 py-2 font-medium">Item</th>
                  {matrix.schools.map((s) => <th key={s.id} className="px-3 py-2 font-medium">{s.code}</th>)}
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr key={item.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                    <td className="px-3 py-2 font-medium text-night dark:text-white">{item.itemName}</td>
                    {item.cells.map((c) => (
                      <td key={c.schoolId} className="px-3 py-2 text-slate-500">
                        {c.allocated === 0 ? "—" : `${c.allocated} (${c.delivered} delivered)`}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {toast && <div role="status" className="fixed bottom-6 right-6 z-50 rounded-xl bg-night px-4 py-3 text-sm text-white shadow-lift">{toast}</div>}
    </div>
  );
}
