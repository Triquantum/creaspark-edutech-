"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, inputCls } from "@/components/ui/modal";

interface LeaveType { id: string; name: string; daysPerYear: number | null }
interface Balance { id: string; year: number; allotted: number; leaveType: { id: string; name: string } }
interface Application {
  id: string; fromDate: string; toDate: string; days: number; status: string;
  leaveType: { id: string; name: string };
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function LeaveApplyPage() {
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    setState("loading");
    Promise.all([
      api<LeaveType[]>("/leave/types"),
      api<Balance[]>("/leave/balances/mine"),
      api<Application[]>("/leave/applications/mine"),
    ])
      .then(([t, b, a]) => {
        setTypes(t);
        setBalances(b);
        setApplications(a);
        setLeaveTypeId((current) => current || t[0]?.id || "");
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  useEffect(load, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  const currentYear = new Date().getFullYear();
  const balanceSummary = useMemo(() => {
    return balances
      .filter((b) => b.year === currentYear)
      .map((b) => {
        const used = applications
          .filter((a) => a.leaveType.id === b.leaveType.id && a.status === "APPROVED" && new Date(a.fromDate).getFullYear() === currentYear)
          .reduce((sum, a) => sum + a.days, 0);
        return { ...b, used, remaining: b.allotted - used };
      });
  }, [balances, applications, currentYear]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api("/leave/applications", {
        method: "POST",
        body: JSON.stringify({ leaveTypeId, fromDate, toDate, reason: reason.trim() }),
      });
      setFromDate("");
      setToDate("");
      setReason("");
      setToast("Leave application submitted");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit application");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Leave Application</p>
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Leave Apply</h1>
      </div>

      {state === "error" && (
        <Card className="p-6">
          <p className="text-sm text-slate-500">
            Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.
          </p>
        </Card>
      )}

      {state === "ready" && balanceSummary.length > 0 && (
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold text-night dark:text-white">My balance ({currentYear})</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {balanceSummary.map((b) => (
              <div key={b.id} className="rounded-xl border border-slate-100 p-4 dark:border-white/10">
                <p className="text-xs uppercase tracking-wide text-slate-400">{b.leaveType.name}</p>
                <p className="mt-1 font-display text-xl font-semibold text-night dark:text-white">
                  {b.remaining} <span className="text-sm font-normal text-slate-400">/ {b.allotted} days left</span>
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {state === "ready" && (
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold text-night dark:text-white">Apply for leave</h2>
          <form onSubmit={submit} className="space-y-4">
            <Field id="apply-type" label="Leave category">
              <select id="apply-type" required value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)} className={inputCls}>
                {types.length === 0 && <option value="">No categories set up yet</option>}
                {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="apply-from" label="From date">
                <input id="apply-from" type="date" required value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputCls} />
              </Field>
              <Field id="apply-to" label="To date">
                <input id="apply-to" type="date" required value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field id="apply-reason" label="Reason">
              <textarea id="apply-reason" required rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputCls} h-auto py-2.5`} />
            </Field>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end">
              <Button type="submit" disabled={saving || types.length === 0}>{saving ? "Submitting…" : "Submit application"}</Button>
            </div>
          </form>
        </Card>
      )}

      {state === "ready" && (
        <Card className="p-0 overflow-hidden">
          <div className="border-b border-slate-100 p-4 dark:border-white/5">
            <h2 className="text-sm font-semibold text-night dark:text-white">My recent applications</h2>
          </div>
          {applications.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No applications submitted yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Dates</th>
                  <th className="px-4 py-3 font-medium">Days</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {applications.slice(0, 5).map((a) => (
                  <tr key={a.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                    <td className="px-4 py-3 font-medium text-night dark:text-white">{a.leaveType.name}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(a.fromDate)} – {fmtDate(a.toDate)}</td>
                    <td className="px-4 py-3 text-slate-500">{a.days}</td>
                    <td className="px-4 py-3 text-slate-500">{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 right-6 z-50 rounded-xl bg-night px-4 py-3 text-sm text-white shadow-lift">
          {toast}
        </div>
      )}
    </div>
  );
}
