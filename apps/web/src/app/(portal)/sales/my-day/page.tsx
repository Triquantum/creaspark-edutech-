"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AddActivityModal, ActivityRow, ActivityRowCard } from "../sales-shared";

interface MyDay {
  totalTasks: number; completed: number; pending: number; overdue: number;
  calls: number; visits: number; meetings: number; followUps: number; newLeads: number;
  timeline: ActivityRow[];
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "danger" | "success" }) {
  return (
    <Card className="p-4 text-center">
      <p className={`font-display text-xl font-semibold ${tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-night dark:text-white"}`}>{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
    </Card>
  );
}

export default function MyDayPage() {
  const [data, setData] = useState<MyDay | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    setState("loading");
    api<MyDay>("/sales/my-day").then((r) => { setData(r); setState("ready"); }).catch(() => setState("error"));
  }, []);
  useEffect(load, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Sales Team</p>
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">My Day</h1>
        </div>
        <div className="flex gap-3">
          <Link href="/sales/follow-ups"><Button variant="ghost">Follow-up Center</Button></Link>
          <Button onClick={() => setShowAdd(true)}>+ Log activity</Button>
        </div>
      </div>

      {state === "error" && <p className="text-sm text-slate-500">Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <StatCard label="Today's Tasks" value={data.totalTasks} />
            <StatCard label="Completed" value={data.completed} tone="success" />
            <StatCard label="Pending" value={data.pending} />
            <StatCard label="Overdue Follow-ups" value={data.overdue} tone={data.overdue > 0 ? "danger" : undefined} />
            <StatCard label="Calls" value={data.calls} />
            <StatCard label="Visits" value={data.visits} />
            <StatCard label="Meetings" value={data.meetings} />
            <StatCard label="New Leads" value={data.newLeads} />
          </div>

          <Card className="p-6">
            <h2 className="mb-3 font-display text-base font-semibold text-night dark:text-white">Today&apos;s timeline</h2>
            {data.timeline.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing logged yet today — tap &quot;Log activity&quot; after a call or visit.</p>
            ) : (
              <div>{data.timeline.map((a) => <ActivityRowCard key={a.id} a={a} />)}</div>
            )}
          </Card>
        </>
      )}

      {showAdd && (
        <AddActivityModal
          onClose={() => setShowAdd(false)}
          onSaved={() => { setToast("Activity logged"); setShowAdd(false); load(); }}
        />
      )}

      {toast && <div role="status" className="fixed bottom-6 right-6 z-50 rounded-xl bg-night px-4 py-3 text-sm text-white shadow-lift">{toast}</div>}
    </div>
  );
}
