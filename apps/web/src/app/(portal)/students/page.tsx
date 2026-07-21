"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, RowActions, Field, inputCls } from "@/components/ui/modal";

interface StudentRow {
  id: string; admissionNo: string; firstName: string; lastName: string;
  gender?: string | null; dob?: string | null; rollNo?: string | null; status?: string;
  sectionId?: string | null;
  section?: { name: string; class: { name: string } } | null;
  guardians: { fullName: string; phone: string; relation?: string }[];
}
interface StudentDetail extends StudentRow {
  invoices: { invoiceNo: string; amount: string; status: string; dueDate: string }[];
  attendance: { date: string; status: string }[];
}
interface SectionOpt { id: string; label: string; schoolId: string }

function StudentDialog({ mode, initial, sections, onClose, onSaved }: {
  mode: "add" | "edit"; initial?: StudentRow; sections: SectionOpt[];
  onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    admissionNo: initial?.admissionNo ?? "",
    firstName: initial?.firstName ?? "",
    lastName: initial?.lastName ?? "",
    sectionId: initial?.sectionId ?? sections[0]?.id ?? "",
    gender: initial?.gender ?? "",
    dob: initial?.dob ? initial.dob.slice(0, 10) : "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const section = sections.find((s) => s.id === form.sectionId);
    setSaving(true);
    try {
      const body = {
        ...(mode === "add" && section && { schoolId: section.schoolId }),
        sectionId: form.sectionId || undefined,
        admissionNo: form.admissionNo.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        ...(form.gender && { gender: form.gender }),
        ...(form.dob && { dob: form.dob }),
      };
      if (mode === "add") {
        await api("/students", { method: "POST", body: JSON.stringify(body) });
      } else {
        await api(`/students/${initial!.id}`, { method: "PATCH", body: JSON.stringify(body) });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save student");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={mode === "add" ? "Add student" : `Edit ${initial?.firstName} ${initial?.lastName}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field id="fs-first" label="First name">
            <input id="fs-first" required value={form.firstName} onChange={set("firstName")} className={inputCls} />
          </Field>
          <Field id="fs-last" label="Last name">
            <input id="fs-last" required value={form.lastName} onChange={set("lastName")} className={inputCls} />
          </Field>
        </div>
        <Field id="fs-adm" label="Admission no.">
          <input id="fs-adm" required value={form.admissionNo} onChange={set("admissionNo")} placeholder="ADM-1041" className={inputCls} />
        </Field>
        <Field id="fs-sec" label="Class & section">
          <select id="fs-sec" required value={form.sectionId} onChange={set("sectionId")} className={inputCls}>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="fs-gender" label="Gender" optional>
            <select id="fs-gender" value={form.gender} onChange={set("gender")} className={inputCls}>
              <option value="">—</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option>
            </select>
          </Field>
          <Field id="fs-dob" label="Date of birth" optional>
            <input id="fs-dob" type="date" value={form.dob} onChange={set("dob")} className={inputCls} />
          </Field>
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : mode === "add" ? "Save student" : "Save changes"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function ViewStudent({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    api<StudentDetail>(`/students/${id}`).then(setDetail).catch(() => setFailed(true));
  }, [id]);

  const statusColor: Record<string, string> = {
    PAID: "bg-success/10 text-success", PENDING: "bg-warning/10 text-warning",
    PARTIAL: "bg-accent/10 text-accent", OVERDUE: "bg-danger/10 text-danger",
  };

  return (
    <Modal title={detail ? `${detail.firstName} ${detail.lastName}` : "Student"} onClose={onClose} wide>
      {failed && <p className="text-sm text-slate-500">Couldn&apos;t load this student.</p>}
      {!detail && !failed && <p className="text-sm text-slate-500">Loading…</p>}
      {detail && (
        <div className="space-y-6 text-sm">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {[
              ["Admission no.", detail.admissionNo],
              ["Class", detail.section ? `${detail.section.class.name} · ${detail.section.name}` : "—"],
              ["Roll no.", detail.rollNo ?? "—"],
              ["Gender", detail.gender ?? "—"],
              ["Date of birth", detail.dob ? new Date(detail.dob).toLocaleDateString("en-IN") : "—"],
              ["Status", detail.status ?? "ACTIVE"],
            ].map(([k, v]) => (
              <div key={k as string}>
                <dt className="text-xs uppercase tracking-wide text-slate-400">{k}</dt>
                <dd className="mt-0.5 font-medium text-night dark:text-white">{v}</dd>
              </div>
            ))}
          </dl>

          <div>
            <h3 className="mb-2 font-medium text-night dark:text-white">Guardians</h3>
            {detail.guardians.length === 0 && <p className="text-slate-500">None on record.</p>}
            {detail.guardians.map((g) => (
              <p key={g.phone} className="text-slate-500">
                {g.fullName} {g.relation ? `(${g.relation})` : ""} · {g.phone}
              </p>
            ))}
          </div>

          <div>
            <h3 className="mb-2 font-medium text-night dark:text-white">Recent invoices</h3>
            {detail.invoices.length === 0 && <p className="text-slate-500">No invoices yet.</p>}
            {detail.invoices.map((inv) => (
              <div key={inv.invoiceNo} className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0 dark:border-white/5">
                <span className="font-mono text-xs text-slate-500">{inv.invoiceNo}</span>
                <span>₹{Number(inv.amount).toLocaleString("en-IN")}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[inv.status] ?? "bg-slate-100 text-slate-500"}`}>{inv.status}</span>
              </div>
            ))}
          </div>

          <div>
            <h3 className="mb-2 font-medium text-night dark:text-white">Attendance (last 30 records)</h3>
            <p className="text-slate-500">
              {detail.attendance.length === 0 ? "No attendance yet." : (() => {
                const present = detail.attendance.filter((a) => a.status === "PRESENT").length;
                return `${present}/${detail.attendance.length} present (${Math.round((present / detail.attendance.length) * 100)}%)`;
              })()}
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function StudentsPage() {
  return (
    <Suspense fallback={null}>
      <StudentsPageInner />
    </Suspense>
  );
}

function StudentsPageInner() {
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [sections, setSections] = useState<SectionOpt[]>([]);
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [dialog, setDialog] = useState<{ mode: "add" } | { mode: "edit"; row: StudentRow } | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<StudentRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    setState("loading");
    api<{ items: StudentRow[] }>(`/students${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      .then((r) => { setRows(r.items); setState("ready"); })
      .catch(() => setState("error"));
  }, [q]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { api<SectionOpt[]>("/academic/sections").then(setSections).catch(() => setSections([])); }, []);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/students/${deleting.id}`, { method: "DELETE" });
      setToast("Student deleted");
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
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Students</h1>
        <Button onClick={() => setDialog({ mode: "add" })}>Add student</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="border-b border-slate-100 dark:border-white/5 p-4">
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or admission no." aria-label="Search students"
            className="h-10 w-full max-w-sm rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-4 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>

        {state === "error" && (
          <p className="p-6 text-sm text-slate-500">
            Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.
          </p>
        )}
        {state === "ready" && rows.length === 0 && (
          <p className="p-6 text-sm text-slate-500">No students match this search.</p>
        )}

        {rows.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">Admission no.</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Class</th>
                <th className="px-4 py-3 font-medium">Primary guardian</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-slate-50 dark:border-white/5 transition-colors hover:bg-surface dark:hover:bg-white/5">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{s.admissionNo}</td>
                  <td className="px-4 py-3 font-medium text-night dark:text-white">{s.firstName} {s.lastName}</td>
                  <td className="px-4 py-3">{s.section ? `${s.section.class.name} · ${s.section.name}` : "—"}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {s.guardians[0] ? `${s.guardians[0].fullName} · ${s.guardians[0].phone}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <RowActions
                      onView={() => setViewing(s.id)}
                      onEdit={() => setDialog({ mode: "edit", row: s })}
                      onDelete={() => setDeleting(s)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {dialog && (
        <StudentDialog
          mode={dialog.mode}
          initial={dialog.mode === "edit" ? dialog.row : undefined}
          sections={sections}
          onClose={() => setDialog(null)}
          onSaved={() => { setToast(dialog.mode === "add" ? "Student added" : "Changes saved"); setQ(""); load(); }}
        />
      )}
      {viewing && <ViewStudent id={viewing} onClose={() => setViewing(null)} />}
      {deleting && (
        <ConfirmDialog
          title="Delete student?"
          message={`This permanently removes ${deleting.firstName} ${deleting.lastName} (${deleting.admissionNo}) along with their attendance, results and unpaid invoices. Students with payment history can't be deleted — set them to Transferred/Alumni instead.`}
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
