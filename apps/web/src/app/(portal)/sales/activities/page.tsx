"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AddActivityModal, ActivityRow, ActivityType, ACTIVITY_TYPES, labelize, fmtDateTime } from "../sales-shared";

const VISIT_TYPES: ActivityType[] = ["SCHOOL_VISIT", "CUSTOMER_VISIT"];

function geolocate(): Promise<{ lat?: number; lng?: number }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve({}); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({}),
      { timeout: 5000 },
    );
  });
}

export default function ActivitiesPage() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [type, setType] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setState("loading");
    const qs = type ? `?type=${type}` : "";
    api<ActivityRow[]>(`/sales/activities${qs}`).then((r) => { setRows(r); setState("ready"); }).catch(() => setState("error"));
  }, [type]);
  useEffect(load, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  async function checkIn(id: string) {
    setBusyId(id);
    try {
      const { lat, lng } = await geolocate();
      await api(`/sales/activities/${id}/check-in`, { method: "POST", body: JSON.stringify({ lat, lng }) });
      setToast("Checked in");
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not check in");
    } finally {
      setBusyId(null);
    }
  }

  async function checkOut(id: string) {
    setBusyId(id);
    try {
      const { lat, lng } = await geolocate();
      await api(`/sales/activities/${id}/check-out`, { method: "POST", body: JSON.stringify({ lat, lng }) });
      setToast("Checked out");
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not check out");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Sales Team</p>
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Activities</h1>
        </div>
        <Button onClick={() => setShowAdd(true)}>+ Log activity</Button>
      </div>

      <Card className="p-4">
        <select value={type} onChange={(e) => setType(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/5">
          <option value="">All types</option>
          {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{labelize(t)}</option>)}
        </select>
      </Card>

      <Card className="p-0 overflow-hidden">
        {state === "error" && <p className="p-6 text-sm text-slate-500">Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.</p>}
        {state === "ready" && rows.length === 0 && <p className="p-6 text-sm text-slate-500">No activities logged yet.</p>}
        {rows.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">School / Contact</th>
                <th className="px-4 py-3 font-medium">By</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Next action</th>
                <th className="px-4 py-3 text-right font-medium">Visit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                  <td className="px-4 py-3 font-medium text-night dark:text-white">{labelize(a.type)}</td>
                  <td className="px-4 py-3 text-slate-500">{a.school?.name ?? a.lead?.schoolName ?? a.opportunity?.title ?? "—"}{a.contactPerson && ` · ${a.contactPerson}`}</td>
                  <td className="px-4 py-3 text-slate-500">{a.user.fullName}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtDateTime(a.activityDate)}</td>
                  <td className="px-4 py-3 text-slate-500">{a.nextAction ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {VISIT_TYPES.includes(a.type) && (
                      !a.checkInAt ? (
                        <Button variant="ghost" className="h-8 px-3 text-xs" disabled={busyId === a.id} onClick={() => checkIn(a.id)}>Check in</Button>
                      ) : !a.checkOutAt ? (
                        <Button variant="ghost" className="h-8 px-3 text-xs" disabled={busyId === a.id} onClick={() => checkOut(a.id)}>Check out</Button>
                      ) : (
                        <span className="text-xs text-success">Visited</span>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

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
