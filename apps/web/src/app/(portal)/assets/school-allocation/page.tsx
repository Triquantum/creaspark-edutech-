"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";

interface SchoolRollupRow {
  id: string; name: string; code: string; institutionType: string;
  totalItems: number; allocated: number; delivered: number; pending: number; status: string;
}

const STATUS_LABEL: Record<string, string> = { NONE: "No allocation", PENDING: "Pending", PARTIAL: "Partially delivered", FULLY_DELIVERED: "Fully delivered" };
const STATUS_CLS: Record<string, string> = {
  NONE: "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400",
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
  PARTIAL: "bg-accent/10 text-accent",
  FULLY_DELIVERED: "bg-success/10 text-success",
};

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4 text-center">
      <p className="font-display text-xl font-semibold text-night dark:text-white">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
    </Card>
  );
}

export default function SchoolAllocationPage() {
  const [rows, setRows] = useState<SchoolRollupRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    api<SchoolRollupRow[]>("/assets/schools").then((r) => { setRows(r); setState("ready"); }).catch(() => setState("error"));
  }, []);

  const withAllocation = rows.filter((r) => r.totalItems > 0).length;
  const fullyDistributed = rows.filter((r) => r.status === "FULLY_DELIVERED").length;
  const withPending = rows.filter((r) => r.pending > 0).length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Asset Management</p>
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">School Allocation</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Schools" value={rows.length} />
        <StatCard label="With Allocation" value={withAllocation} />
        <StatCard label="Fully Distributed" value={fullyDistributed} />
        <StatCard label="With Pending Items" value={withPending} />
      </div>

      <Card className="p-0 overflow-hidden">
        {state === "error" && <p className="p-6 text-sm text-slate-500">Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.</p>}
        {state === "ready" && rows.length === 0 && <p className="p-6 text-sm text-slate-500">No registered schools yet.</p>}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <th className="px-4 py-3 font-medium">School</th>
                  <th className="px-4 py-3 font-medium">Total Items</th>
                  <th className="px-4 py-3 font-medium">Allocated</th>
                  <th className="px-4 py-3 font-medium">Delivered</th>
                  <th className="px-4 py-3 font-medium">Pending</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 last:border-0 dark:border-white/5 transition-colors hover:bg-surface dark:hover:bg-white/5">
                    <td className="px-4 py-3 font-medium text-night dark:text-white">
                      <Link href={`/assets/school-allocation/${r.id}`} className="hover:underline">{r.name}</Link>
                      <span className="ml-2 text-xs text-slate-400">{r.code}</span>
                    </td>
                    <td className="px-4 py-3">{r.totalItems}</td>
                    <td className="px-4 py-3">{r.allocated}</td>
                    <td className="px-4 py-3">{r.delivered}</td>
                    <td className="px-4 py-3">{r.pending}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLS[r.status]}`}>{STATUS_LABEL[r.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
