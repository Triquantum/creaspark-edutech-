"use client";
import { useEffect, useState } from "react";
import { LogOut, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, Field, inputCls } from "@/components/ui/modal";

interface School { id: string; name: string; code: string; tenantName: string }
interface Visitor {
  id: string; visitorName: string; phone: string; purpose: string;
  personToMeet?: string | null; idProofType?: string | null; idProofNumber?: string | null;
  checkInAt: string; checkOutAt?: string | null;
  school: { name: string };
}

function LogVisitorDialog({ schools, onClose, onSaved }: {
  schools: School[]; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    schoolId: schools[0]?.id ?? "", visitorName: "", phone: "", purpose: "",
    personToMeet: "", idProofType: "", idProofNumber: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.schoolId || !form.visitorName.trim() || !form.phone.trim() || !form.purpose.trim()) {
      setError("School, visitor name, phone, and purpose are required");
      return;
    }
    setSaving(true);
    try {
      await api("/visitors", {
        method: "POST",
        body: JSON.stringify({
          schoolId: form.schoolId, visitorName: form.visitorName.trim(), phone: form.phone.trim(),
          purpose: form.purpose.trim(),
          personToMeet: form.personToMeet.trim() || undefined,
          idProofType: form.idProofType.trim() || undefined,
          idProofNumber: form.idProofNumber.trim() || undefined,
        }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log visitor");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Log Visitor" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field id="schoolId" label="School">
          <select id="schoolId" className={inputCls} value={form.schoolId} onChange={set("schoolId")}>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.tenantName})</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field id="visitorName" label="Visitor name">
            <input id="visitorName" className={inputCls} value={form.visitorName} onChange={set("visitorName")} placeholder="Rohan Mehta" />
          </Field>
          <Field id="phone" label="Phone">
            <input id="phone" className={inputCls} value={form.phone} onChange={set("phone")} placeholder="+91 98xxxxxxx" />
          </Field>
        </div>
        <Field id="purpose" label="Purpose of visit">
          <input id="purpose" className={inputCls} value={form.purpose} onChange={set("purpose")} placeholder="Parent-teacher meeting" />
        </Field>
        <Field id="personToMeet" label="Person to meet" optional>
          <input id="personToMeet" className={inputCls} value={form.personToMeet} onChange={set("personToMeet")} placeholder="Priya Sharma (Teacher)" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field id="idProofType" label="ID proof type" optional>
            <input id="idProofType" className={inputCls} value={form.idProofType} onChange={set("idProofType")} placeholder="Aadhaar" />
          </Field>
          <Field id="idProofNumber" label="ID proof number" optional>
            <input id="idProofNumber" className={inputCls} value={form.idProofNumber} onChange={set("idProofNumber")} placeholder="xxxx-xxxx-xxxx" />
          </Field>
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Logging…" : "Log Visitor"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function VisitorsPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolFilter, setSchoolFilter] = useState("");
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [logging, setLogging] = useState(false);
  const [deleting, setDeleting] = useState<Visitor | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    api<School[]>("/platform/schools").then(setSchools).catch(() => setSchools([]));
  }, []);

  useEffect(() => {
    setState("loading");
    api<Visitor[]>(`/visitors${schoolFilter ? `?schoolId=${schoolFilter}` : ""}`)
      .then((r) => { setVisitors(r); setState("ready"); })
      .catch(() => setState("error"));
  }, [schoolFilter, refreshKey]);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  async function checkOut(v: Visitor) {
    try {
      await api(`/visitors/${v.id}/checkout`, { method: "PATCH" });
      setToast(`${v.visitorName} checked out`);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not check out");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/visitors/${deleting.id}`, { method: "DELETE" });
      setToast("Removed");
      setDeleting(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not remove");
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Visitor Information</h1>
          <p className="text-sm text-slate-500">Front-desk visitor log across every registered school.</p>
        </div>
        <Button onClick={() => setLogging(true)}>+ Log Visitor</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/5 p-4">
          <select
            value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)}
            aria-label="Filter by school"
            className="h-10 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            <option value="">All schools</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {state === "error" && (
          <p className="p-6 text-sm text-slate-500">Couldn&apos;t reach the API. Reload once it&apos;s available.</p>
        )}
        {state === "ready" && visitors.length === 0 && (
          <p className="p-6 text-sm text-slate-500">No visitors logged yet.</p>
        )}

        {visitors.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">Visitor</th>
                <th className="px-4 py-3 font-medium">School</th>
                <th className="px-4 py-3 font-medium">Purpose</th>
                <th className="px-4 py-3 font-medium">Check-in</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visitors.map((v) => (
                <tr key={v.id} className="border-b border-slate-50 dark:border-white/5 transition-colors hover:bg-surface dark:hover:bg-white/5">
                  <td className="px-4 py-3">
                    <p className="font-medium text-night dark:text-white">{v.visitorName}</p>
                    <p className="text-xs text-slate-400">{v.phone}{v.personToMeet ? ` · to see ${v.personToMeet}` : ""}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{v.school.name}</td>
                  <td className="px-4 py-3 text-slate-500">{v.purpose}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(v.checkInAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-3">
                    {v.checkOutAt ? (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-white/10">Checked out</span>
                    ) : (
                      <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">On premises</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {!v.checkOutAt && (
                        <button onClick={() => checkOut(v)} aria-label="Check out" title="Check out"
                          className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-black/5 hover:text-night dark:hover:bg-white/10 dark:hover:text-white">
                          <LogOut size={15} />
                        </button>
                      )}
                      <button onClick={() => setDeleting(v)} aria-label="Delete" title="Delete"
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-danger/10 hover:text-danger">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {logging && (
        <LogVisitorDialog
          schools={schools}
          onClose={() => setLogging(false)}
          onSaved={() => { setLogging(false); setToast("Visitor logged"); setRefreshKey((k) => k + 1); }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={`Remove ${deleting.visitorName}?`}
          message="This permanently removes this visitor record."
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
