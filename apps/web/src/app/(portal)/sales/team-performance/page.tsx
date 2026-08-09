"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { ActivityRow, ActivityRowCard, fmtMoney } from "../sales-shared";

interface Dashboard {
  totalSalespeople: number; activeToday: number; activitiesToday: number;
  tasksCompleted: number; tasksPending: number; overdueTasks: number;
  calls: number; visits: number; meetings: number; newLeads: number; followUps: number; proposals: number;
  openOpportunities: number; pipelineValue: number; wonDeals: number; lostDeals: number;
}
interface PerfRow {
  id: string; name: string; tasks: number; completed: number; calls: number; visits: number; meetings: number;
  leads: number; proposals: number; won: number; lost: number; revenue: number;
}
interface SalespersonDetail {
  profile: { id: string; fullName: string; email: string; phone: string | null; role: string };
  todayStats: { tasksPlanned: number; tasksCompleted: number; calls: number; visits: number; meetings: number; demos: number; newLeads: number; proposals: number };
  weekActivityCount: number; monthActivityCount: number; activities: ActivityRow[];
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-4 text-center">
      <p className="font-display text-xl font-semibold text-night dark:text-white">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
    </Card>
  );
}

function SalespersonModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [data, setData] = useState<SalespersonDetail | null>(null);
  useEffect(() => { api<SalespersonDetail>(`/sales/dashboard/salesperson/${userId}`).then(setData).catch(() => {}); }, [userId]);
  if (!data) return <Modal title="Loading…" onClose={onClose}><p className="text-sm text-slate-500">Loading…</p></Modal>;

  return (
    <Modal title={data.profile.fullName} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><p className="text-xs text-slate-400">Email</p><p className="font-medium text-night dark:text-white">{data.profile.email}</p></div>
          <div><p className="text-xs text-slate-400">Phone</p><p className="font-medium text-night dark:text-white">{data.profile.phone ?? "—"}</p></div>
          <div><p className="text-xs text-slate-400">This week</p><p className="font-medium text-night dark:text-white">{data.weekActivityCount} activities</p></div>
          <div><p className="text-xs text-slate-400">This month</p><p className="font-medium text-night dark:text-white">{data.monthActivityCount} activities</p></div>
        </div>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
          {Object.entries(data.todayStats).map(([k, v]) => (
            <div key={k} className="rounded-xl bg-slate-50 px-3 py-2 text-center dark:bg-white/5">
              <p className="font-display text-lg font-semibold text-night dark:text-white">{v}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">{k}</p>
            </div>
          ))}
        </div>
        <div>
          <h3 className="mb-2 font-display text-sm font-semibold text-night dark:text-white">Recent activity</h3>
          {data.activities.length === 0 ? (
            <p className="text-sm text-slate-500">No activity logged yet.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto">{data.activities.map((a) => <ActivityRowCard key={a.id} a={a} />)}</div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default function TeamPerformancePage() {
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [rows, setRows] = useState<PerfRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    setState("loading");
    Promise.all([
      api<Dashboard>("/sales/dashboard"),
      api<PerfRow[]>("/sales/dashboard/team-performance"),
    ]).then(([d, p]) => { setDash(d); setRows(p); setState("ready"); }).catch(() => setState("error"));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Sales Team</p>
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Team Performance</h1>
      </div>

      {state === "error" && <p className="text-sm text-slate-500">Couldn&apos;t reach the API, or you don&apos;t have manager access to this page.</p>}

      {dash && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          <StatCard label="Salespeople" value={dash.totalSalespeople} />
          <StatCard label="Active Today" value={dash.activeToday} />
          <StatCard label="Activities Today" value={dash.activitiesToday} />
          <StatCard label="Overdue Follow-ups" value={dash.overdueTasks} />
          <StatCard label="Open Opportunities" value={dash.openOpportunities} />
          <StatCard label="Pipeline Value" value={fmtMoney(dash.pipelineValue)} />
          <StatCard label="Won (month)" value={dash.wonDeals} />
          <StatCard label="Lost (month)" value={dash.lostDeals} />
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        {state === "ready" && rows.length === 0 && <p className="p-6 text-sm text-slate-500">No salespeople registered yet.</p>}
        {rows.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">Salesperson</th>
                <th className="px-4 py-3 font-medium">Tasks</th>
                <th className="px-4 py-3 font-medium">Calls</th>
                <th className="px-4 py-3 font-medium">Visits</th>
                <th className="px-4 py-3 font-medium">Meetings</th>
                <th className="px-4 py-3 font-medium">Leads</th>
                <th className="px-4 py-3 font-medium">Proposals</th>
                <th className="px-4 py-3 font-medium">Won</th>
                <th className="px-4 py-3 font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-surface dark:border-white/5 dark:hover:bg-white/5" onClick={() => setSelected(r.id)}>
                  <td className="px-4 py-3 font-medium text-night dark:text-white">{r.name}</td>
                  <td className="px-4 py-3 text-slate-500">{r.completed}/{r.tasks}</td>
                  <td className="px-4 py-3 text-slate-500">{r.calls}</td>
                  <td className="px-4 py-3 text-slate-500">{r.visits}</td>
                  <td className="px-4 py-3 text-slate-500">{r.meetings}</td>
                  <td className="px-4 py-3 text-slate-500">{r.leads}</td>
                  <td className="px-4 py-3 text-slate-500">{r.proposals}</td>
                  <td className="px-4 py-3 text-slate-500">{r.won}</td>
                  <td className="px-4 py-3 font-medium text-accent">{fmtMoney(r.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {selected && <SalespersonModal userId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
