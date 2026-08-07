"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, RowActions, Field, inputCls } from "@/components/ui/modal";

interface Me { id: string; role: string }
interface SchoolOpt { id: string; name: string }
interface DepartmentOpt { id: string; name: string }
interface StaffOpt { id: string; fullName: string; role: string }
type TaskStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
interface TaskRow {
  id: string; serialNo: string; schoolId: string; departmentId: string; assignedToId: string;
  subject: string; description: string | null; targetDate: string | null; remarks: string | null;
  status: TaskStatus; createdAt: string;
  school: { name: string }; department: { name: string };
  assignedTo: { id: string; fullName: string; role: string };
  assignedBy: { fullName: string };
  updatedBy: { fullName: string } | null;
}

const MANAGE_ROLES = ["SUPER_ADMIN", "ORG_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "COORDINATOR"];
const STATUS_OPTIONS: TaskStatus[] = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const STATUS_LABEL: Record<TaskStatus, string> = { OPEN: "Open", IN_PROGRESS: "In Progress", COMPLETED: "Completed", CANCELLED: "Cancelled" };
const STATUS_CLS: Record<TaskStatus, string> = {
  OPEN: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  IN_PROGRESS: "bg-accent/10 text-accent",
  COMPLETED: "bg-success/10 text-success",
  CANCELLED: "bg-danger/10 text-danger",
};

function fmtDate(s: string | null) {
  return s ? new Date(s).toLocaleDateString("en-IN") : "—";
}

function CreateTaskModal({ schools, onClose, onSaved }: {
  schools: SchoolOpt[]; onClose: () => void; onSaved: () => void;
}) {
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? "");
  const [departments, setDepartments] = useState<DepartmentOpt[]>([]);
  const [staff, setStaff] = useState<StaffOpt[]>([]);
  const [form, setForm] = useState({ subject: "", description: "", departmentId: "", targetDate: "", assignedToId: "", remarks: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    api<DepartmentOpt[]>(`/academic/departments?schoolId=${schoolId}`).then(setDepartments).catch(() => setDepartments([]));
    api<StaffOpt[]>(`/tasks/staff?schoolId=${schoolId}`).then(setStaff).catch(() => setStaff([]));
    setForm((f) => ({ ...f, departmentId: "", assignedToId: "" }));
  }, [schoolId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/tasks", {
        method: "POST",
        body: JSON.stringify({
          schoolId, subject: form.subject.trim(), description: form.description.trim() || undefined,
          departmentId: form.departmentId, targetDate: form.targetDate || undefined,
          assignedToId: form.assignedToId, remarks: form.remarks.trim() || undefined,
        }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create task");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New task" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field id="t-school" label="School">
            <select id="t-school" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className={inputCls}>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field id="t-dept" label="Assigned Department">
            <select id="t-dept" required value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} className={inputCls}>
              <option value="">Select…</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        </div>
        <Field id="t-subject" label="Subject">
          <input id="t-subject" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className={inputCls} />
        </Field>
        <Field id="t-desc" label="Description" optional>
          <textarea id="t-desc" rows={3} className={`${inputCls} h-auto py-3`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field id="t-assignee" label="Assigned to">
            <select id="t-assignee" required value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })} className={inputCls}>
              <option value="">Select…</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.fullName} · {s.role}</option>)}
            </select>
          </Field>
          <Field id="t-target" label="Target date" optional>
            <input id="t-target" type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} className={inputCls} />
          </Field>
        </div>
        <Field id="t-remarks" label="Remarks" optional>
          <textarea id="t-remarks" rows={2} className={`${inputCls} h-auto py-3`} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create task"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function TaskDetailModal({ task, isManager, isAssignee, onClose, onSaved, onDeleted }: {
  task: TaskRow; isManager: boolean; isAssignee: boolean;
  onClose: () => void; onSaved: () => void; onDeleted: () => void;
}) {
  const [departments, setDepartments] = useState<DepartmentOpt[]>([]);
  const [staff, setStaff] = useState<StaffOpt[]>([]);
  const [form, setForm] = useState({
    subject: task.subject, description: task.description ?? "", departmentId: task.departmentId,
    targetDate: task.targetDate ? task.targetDate.slice(0, 10) : "", assignedToId: task.assignedToId,
    remarks: task.remarks ?? "", status: task.status,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isManager) return;
    api<DepartmentOpt[]>(`/academic/departments?schoolId=${task.schoolId}`).then(setDepartments).catch(() => setDepartments([]));
    api<StaffOpt[]>(`/tasks/staff?schoolId=${task.schoolId}`).then(setStaff).catch(() => setStaff([]));
  }, [isManager, task.schoolId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const body = isManager
        ? {
            subject: form.subject.trim(), description: form.description.trim() || undefined,
            departmentId: form.departmentId, targetDate: form.targetDate || undefined,
            assignedToId: form.assignedToId, remarks: form.remarks.trim() || undefined, status: form.status,
          }
        : { remarks: form.remarks.trim() || undefined, status: form.status };
      await api(`/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify(body) });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      await api(`/tasks/${task.id}`, { method: "DELETE" });
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
      setDeleting(false);
    } finally {
      setBusy(false);
    }
  }

  const canEdit = isManager || isAssignee;

  return (
    <Modal title={`${task.serialNo} · ${task.subject}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><p className="text-xs text-slate-400">School</p><p className="font-medium text-night dark:text-white">{task.school.name}</p></div>
          <div><p className="text-xs text-slate-400">Date</p><p className="font-medium text-night dark:text-white">{fmtDate(task.createdAt)}</p></div>
          <div><p className="text-xs text-slate-400">Assigned by</p><p className="font-medium text-night dark:text-white">{task.assignedBy.fullName}</p></div>
          <div><p className="text-xs text-slate-400">Updated by</p><p className="font-medium text-night dark:text-white">{task.updatedBy?.fullName ?? "—"}</p></div>
        </div>

        {canEdit ? (
          <form onSubmit={submit} className="space-y-4 border-t border-slate-100 pt-4 dark:border-white/10">
            {isManager ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Field id="td-dept" label="Assigned Department">
                    <select id="td-dept" required value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} className={inputCls}>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </Field>
                  <Field id="td-assignee" label="Assigned to">
                    <select id="td-assignee" required value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })} className={inputCls}>
                      {staff.map((s) => <option key={s.id} value={s.id}>{s.fullName} · {s.role}</option>)}
                    </select>
                  </Field>
                </div>
                <Field id="td-subject" label="Subject">
                  <input id="td-subject" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className={inputCls} />
                </Field>
                <Field id="td-desc" label="Description" optional>
                  <textarea id="td-desc" rows={3} className={`${inputCls} h-auto py-3`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </Field>
                <Field id="td-target" label="Target date" optional>
                  <input id="td-target" type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} className={inputCls} />
                </Field>
              </>
            ) : (
              task.description && (
                <div><p className="text-xs text-slate-400">Description</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{task.description}</p></div>
              )
            )}
            <div className="grid grid-cols-2 gap-4">
              <Field id="td-status" label="Status">
                <select id="td-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })} className={inputCls}>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </Field>
            </div>
            <Field id="td-remarks" label="Remarks" optional>
              <textarea id="td-remarks" rows={3} className={`${inputCls} h-auto py-3`} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            </Field>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex items-center justify-between gap-3">
              {isManager ? <Button type="button" variant="danger" onClick={() => setDeleting(true)}>Delete</Button> : <span />}
              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
                <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
              </div>
            </div>
          </form>
        ) : (
          <>
            {task.description && (
              <div><p className="text-xs text-slate-400">Description</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{task.description}</p></div>
            )}
            <div>
              <p className="text-xs text-slate-400">Status</p>
              <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLS[task.status]}`}>{STATUS_LABEL[task.status]}</span>
            </div>
            {task.remarks && <div><p className="text-xs text-slate-400">Remarks</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{task.remarks}</p></div>}
            <div className="flex justify-end"><Button variant="ghost" onClick={onClose}>Close</Button></div>
          </>
        )}
      </div>

      {deleting && (
        <ConfirmDialog
          title="Delete task?"
          message={`Permanently remove "${task.serialNo} · ${task.subject}"?`}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(false)}
          busy={busy}
        />
      )}
    </Modal>
  );
}

export default function TasksPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [schools, setSchools] = useState<SchoolOpt[]>([]);
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<TaskRow | null>(null);
  const [deletingRow, setDeletingRow] = useState<TaskRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const isManager = !!me && MANAGE_ROLES.includes(me.role);

  const load = useCallback(() => {
    setState("loading");
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    api<TaskRow[]>(`/tasks?${params.toString()}`).then((r) => { setRows(r); setState("ready"); }).catch(() => setState("error"));
  }, [q, status]);

  useEffect(() => {
    api<Me>("/auth/me").then(setMe).catch(() => setMe(null));
    api<SchoolOpt[]>("/academic/schools").then(setSchools).catch(() => setSchools([]));
  }, []);
  useEffect(load, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  async function confirmDeleteRow() {
    if (!deletingRow) return;
    setDeleteBusy(true);
    try {
      await api(`/tasks/${deletingRow.id}`, { method: "DELETE" });
      setToast("Task deleted");
      setDeletingRow(null);
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not delete");
      setDeletingRow(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Work</p>
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Task Manager</h1>
        </div>
        {isManager && <Button onClick={() => setCreating(true)}>+ New task</Button>}
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search subject, description, serial no…"
          className={`${inputCls} max-w-sm`}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} max-w-xs`}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      <Card className="p-0 overflow-hidden">
        {state === "error" && (
          <p className="p-6 text-sm text-slate-500">
            Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.
          </p>
        )}
        {state === "ready" && rows.length === 0 && (
          <p className="p-6 text-sm text-slate-500">No tasks yet.</p>
        )}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <th className="px-4 py-3 font-medium">Serial No.</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Subject</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Target Date</th>
                  <th className="px-4 py-3 font-medium">Assigned To</th>
                  <th className="px-4 py-3 font-medium">Updated By</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.serialNo}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(row.createdAt)}</td>
                    <td className="px-4 py-3 font-medium text-night dark:text-white">{row.subject}</td>
                    <td className="px-4 py-3 text-slate-500">{row.department.name}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(row.targetDate)}</td>
                    <td className="px-4 py-3 text-slate-500">{row.assignedTo.fullName}</td>
                    <td className="px-4 py-3 text-slate-500">{row.updatedBy?.fullName ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLS[row.status]}`}>{STATUS_LABEL[row.status]}</span>
                    </td>
                    <td className="px-4 py-3">
                      <RowActions
                        onView={() => setViewing(row)}
                        onEdit={isManager ? () => setViewing(row) : undefined}
                        onDelete={isManager ? () => setDeletingRow(row) : undefined}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {creating && (
        <CreateTaskModal schools={schools} onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); setToast("Task created"); load(); }} />
      )}
      {viewing && me && (
        <TaskDetailModal
          task={viewing} isManager={isManager} isAssignee={viewing.assignedToId === me.id}
          onClose={() => setViewing(null)}
          onSaved={() => { setViewing(null); setToast("Task updated"); load(); }}
          onDeleted={() => { setViewing(null); setToast("Task deleted"); load(); }}
        />
      )}

      {deletingRow && (
        <ConfirmDialog
          title="Delete task?"
          message={`Permanently remove "${deletingRow.serialNo} · ${deletingRow.subject}"?`}
          onConfirm={confirmDeleteRow}
          onClose={() => setDeletingRow(null)}
          busy={deleteBusy}
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
