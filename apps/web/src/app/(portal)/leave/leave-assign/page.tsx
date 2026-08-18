"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, RowActions, Field, inputCls } from "@/components/ui/modal";

interface School { id: string; name: string }
interface Staff { id: string; fullName: string; role: string }
interface LeaveType { id: string; name: string; daysPerYear: number | null }
interface BalanceRow {
  id: string; year: number; allotted: number;
  leaveType: { id: string; name: string };
  user: { fullName: string; role: string };
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 1 + i);

export default function LeaveAssignPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [staff, setStaff] = useState<Staff[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const [userId, setUserId] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [allotted, setAllotted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<BalanceRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    api<School[]>("/academic/schools").then((list) => {
      setSchools(list);
      setSchoolId((current) => current || list[0]?.id || "");
    }).catch(() => {});
    api<LeaveType[]>("/leave/types").then((list) => {
      setTypes(list);
      setLeaveTypeId((current) => current || list[0]?.id || "");
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    api<Staff[]>(`/leave/balances/staff?schoolId=${schoolId}`).then((list) => {
      setStaff(list);
      setUserId((current) => (list.some((s) => s.id === current) ? current : list[0]?.id ?? ""));
    }).catch(() => setStaff([]));
  }, [schoolId]);

  const load = useCallback(() => {
    setState("loading");
    api<BalanceRow[]>("/leave/balances").then((r) => { setRows(r); setState("ready"); }).catch(() => setState("error"));
  }, []);

  useEffect(load, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api("/leave/balances", {
        method: "POST",
        body: JSON.stringify({ userId, leaveTypeId, year: Number(year), allotted: Number(allotted) }),
      });
      setAllotted("");
      setToast("Leave balance assigned");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign balance");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/leave/balances/${deleting.id}`, { method: "DELETE" });
      setToast("Balance removed");
      setDeleting(null);
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not remove");
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Leave Application</p>
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Leave Assign</h1>
      </div>

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-semibold text-night dark:text-white">Assign a balance</h2>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field id="la-school" label="School">
            <select id="la-school" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className={inputCls}>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field id="la-staff" label="Staff member">
            <select id="la-staff" required value={userId} onChange={(e) => setUserId(e.target.value)} className={inputCls}>
              {staff.length === 0 && <option value="">No staff at this school</option>}
              {staff.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
            </select>
          </Field>
          <Field id="la-type" label="Leave category">
            <select id="la-type" required value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)} className={inputCls}>
              {types.length === 0 && <option value="">No categories yet</option>}
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field id="la-year" label="Year">
            <select id="la-year" value={year} onChange={(e) => setYear(e.target.value)} className={inputCls}>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </Field>
          <Field id="la-days" label="Days allotted">
            <input id="la-days" type="number" required min={0} max={365} value={allotted} onChange={(e) => setAllotted(e.target.value)} className={inputCls} />
          </Field>
          <div className="sm:col-span-2 lg:col-span-5 flex items-center justify-between gap-4">
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <Button type="submit" disabled={saving || !userId || !leaveTypeId} className="ml-auto">
              {saving ? "Assigning…" : "Assign balance"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-0 overflow-hidden">
        {state === "error" && (
          <p className="p-6 text-sm text-slate-500">
            Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.
          </p>
        )}
        {state === "ready" && rows.length === 0 && <p className="p-6 text-sm text-slate-500">No balances assigned yet.</p>}
        {rows.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">Staff</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Year</th>
                <th className="px-4 py-3 font-medium">Days allotted</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                  <td className="px-4 py-3 font-medium text-night dark:text-white">{row.user.fullName}</td>
                  <td className="px-4 py-3 text-slate-500">{row.leaveType.name}</td>
                  <td className="px-4 py-3 text-slate-500">{row.year}</td>
                  <td className="px-4 py-3 text-slate-500">{row.allotted}</td>
                  <td className="px-4 py-3">
                    <RowActions onView={() => setDeleting(row)} onDelete={() => setDeleting(row)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {deleting && (
        <ConfirmDialog
          title="Remove leave balance?"
          message={`Remove the ${deleting.leaveType.name} balance for ${deleting.user.fullName} (${deleting.year})?`}
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
