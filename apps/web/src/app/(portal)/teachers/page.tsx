"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, RowActions, Field, inputCls } from "@/components/ui/modal";

interface TeacherRow {
  id: string; fullName: string; email: string; phone?: string | null; isActive: boolean;
  staffProfile?: { employeeNo: string; designation: string; department?: string | null; joinDate?: string } | null;
}
interface SchoolOpt { id: string; name: string }

function TeacherDialog({ mode, initial, schools, onClose, onSaved }: {
  mode: "add" | "edit"; initial?: TeacherRow; schools: SchoolOpt[];
  onClose: () => void; onSaved: (tempPassword?: string) => void;
}) {
  const [form, setForm] = useState({
    fullName: initial?.fullName ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    employeeNo: initial?.staffProfile?.employeeNo ?? "",
    designation: initial?.staffProfile?.designation ?? "",
    department: initial?.staffProfile?.department ?? "",
    schoolId: schools[0]?.id ?? "",
    isActive: initial ? String(initial.isActive) : "true",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const common = {
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        ...(form.phone && { phone: form.phone.trim() }),
        employeeNo: form.employeeNo.trim(),
        designation: form.designation.trim(),
        ...(form.department && { department: form.department.trim() }),
      };
      if (mode === "add") {
        const res = await api<{ tempPassword?: string }>("/teachers", {
          method: "POST",
          body: JSON.stringify({ ...common, schoolId: form.schoolId }),
        });
        onSaved(res.tempPassword);
      } else {
        await api(`/teachers/${initial!.id}`, {
          method: "PATCH",
          body: JSON.stringify({ ...common, isActive: form.isActive === "true" }),
        });
        onSaved();
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save teacher");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={mode === "add" ? "Add teacher" : `Edit ${initial?.fullName}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field id="ft-name" label="Full name">
          <input id="ft-name" required value={form.fullName} onChange={set("fullName")} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="ft-email" label="Email">
            <input id="ft-email" type="email" required value={form.email} onChange={set("email")} className={inputCls} />
          </Field>
          <Field id="ft-phone" label="Phone" optional>
            <input id="ft-phone" value={form.phone ?? ""} onChange={set("phone")} inputMode="tel" className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field id="ft-emp" label="Employee no.">
            <input id="ft-emp" required value={form.employeeNo} onChange={set("employeeNo")} placeholder="EMP-014" className={inputCls} />
          </Field>
          {mode === "add" ? (
            <Field id="ft-school" label="School">
              <select id="ft-school" required value={form.schoolId} onChange={set("schoolId")} className={inputCls}>
                {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          ) : (
            <Field id="ft-active" label="Status">
              <select id="ft-active" value={form.isActive} onChange={set("isActive")} className={inputCls}>
                <option value="true">Active</option>
                <option value="false">Inactive (blocks sign-in)</option>
              </select>
            </Field>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field id="ft-desig" label="Designation">
            <input id="ft-desig" required value={form.designation} onChange={set("designation")} placeholder="Mathematics Teacher" className={inputCls} />
          </Field>
          <Field id="ft-dept" label="Department" optional>
            <input id="ft-dept" value={form.department ?? ""} onChange={set("department")} className={inputCls} />
          </Field>
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : mode === "add" ? "Save teacher" : "Save changes"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function TeachersPage() {
  const [rows, setRows] = useState<TeacherRow[]>([]);
  const [schools, setSchools] = useState<SchoolOpt[]>([]);
  const [q, setQ] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [dialog, setDialog] = useState<{ mode: "add" } | { mode: "edit"; row: TeacherRow } | null>(null);
  const [viewing, setViewing] = useState<TeacherRow | null>(null);
  const [deleting, setDeleting] = useState<TeacherRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    setState("loading");
    api<TeacherRow[]>(`/teachers${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      .then((r) => { setRows(r); setState("ready"); })
      .catch(() => setState("error"));
  }, [q]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { api<SchoolOpt[]>("/academic/schools").then(setSchools).catch(() => setSchools([])); }, []);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/teachers/${deleting.id}`, { method: "DELETE" });
      setToast("Teacher deleted");
      setDeleting(null);
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not delete");
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Teachers</h1>
        <Button onClick={() => setDialog({ mode: "add" })}>Add teacher</Button>
      </div>

      {notice && (
        <Card className="border border-accent/30 bg-accent/5">
          <p className="text-sm text-night dark:text-white">{notice}</p>
          <p className="mt-1 text-xs text-slate-500">Shown once — share it with the teacher; they can change it after first sign-in.</p>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="border-b border-slate-100 dark:border-white/5 p-4">
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email or employee no." aria-label="Search teachers"
            className="h-10 w-full max-w-sm rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-4 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>

        {state === "error" && (
          <p className="p-6 text-sm text-slate-500">
            Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.
          </p>
        )}
        {state === "ready" && rows.length === 0 && (
          <p className="p-6 text-sm text-slate-500">No teachers match this search.</p>
        )}

        {rows.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">Employee no.</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Designation</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-b border-slate-50 dark:border-white/5 transition-colors hover:bg-surface dark:hover:bg-white/5">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{t.staffProfile?.employeeNo ?? "—"}</td>
                  <td className="px-4 py-3 font-medium text-night dark:text-white">{t.fullName}</td>
                  <td className="px-4 py-3">
                    {t.staffProfile?.designation ?? "—"}
                    {t.staffProfile?.department && <span className="text-slate-400"> · {t.staffProfile.department}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{t.email}{t.phone ? ` · ${t.phone}` : ""}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium
                      ${t.isActive ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                      {t.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <RowActions
                      onView={() => setViewing(t)}
                      onEdit={() => setDialog({ mode: "edit", row: t })}
                      onDelete={() => setDeleting(t)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {dialog && (
        <TeacherDialog
          mode={dialog.mode}
          initial={dialog.mode === "edit" ? dialog.row : undefined}
          schools={schools}
          onClose={() => setDialog(null)}
          onSaved={(tempPassword) => {
            if (dialog.mode === "add") {
              setNotice(tempPassword ? `✓ Teacher added. Temporary password: ${tempPassword}` : "✓ Teacher added.");
            } else {
              setToast("Changes saved");
            }
            setQ(""); load();
          }}
        />
      )}

      {viewing && (
        <Modal title={viewing.fullName} onClose={() => setViewing(null)}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {[
              ["Employee no.", viewing.staffProfile?.employeeNo ?? "—"],
              ["Status", viewing.isActive ? "Active" : "Inactive"],
              ["Designation", viewing.staffProfile?.designation ?? "—"],
              ["Department", viewing.staffProfile?.department ?? "—"],
              ["Email", viewing.email],
              ["Phone", viewing.phone ?? "—"],
              ["Joined", viewing.staffProfile?.joinDate ? new Date(viewing.staffProfile.joinDate).toLocaleDateString("en-IN") : "—"],
            ].map(([k, v]) => (
              <div key={k as string}>
                <dt className="text-xs uppercase tracking-wide text-slate-400">{k}</dt>
                <dd className="mt-0.5 font-medium text-night dark:text-white">{v}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete teacher?"
          message={`This removes ${deleting.fullName}'s login and staff profile permanently. If they might return, set them Inactive instead (Edit → Status).`}
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
