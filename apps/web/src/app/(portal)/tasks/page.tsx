"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, RowActions, Field, inputCls } from "@/components/ui/modal";
import { INSTITUTION_TYPES } from "@/components/platform/school-edit-modal";

interface Me { id: string; role: string }
interface DepartmentOpt { id: string; name: string }
interface SchoolOpt { id: string; name: string; institutionType: string }
interface StaffOpt { id: string; fullName: string; role: string }
type TaskStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
interface TaskRow {
  id: string; serialNo: string;
  subject: string; description: string | null; targetDate: string | null; remarks: string | null;
  status: TaskStatus; createdAt: string;
  departments: { department: { id: string; name: string } }[];
  assignees: { user: { id: string; fullName: string; role: string } }[];
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
function institutionLabel(t: string) {
  return t.charAt(0) + t.slice(1).toLowerCase();
}

/** Toggle-style multi-select: a bordered chip grid of checkboxes, matching
 * this app's established "like a toggle" pattern (Subject page's toggle
 * grid) rather than a plain multi-select <select>. */
function ToggleGrid<T extends { id: string }>({ items, selected, onToggle, renderLabel, empty }: {
  items: T[]; selected: Set<string>; onToggle: (id: string) => void; renderLabel: (item: T) => string; empty: string;
}) {
  if (!items.length) return <p className="text-xs text-slate-400">{empty}</p>;
  return (
    <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3 dark:border-white/10">
      {items.map((item) => (
        <label
          key={item.id}
          className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            selected.has(item.id)
              ? "border-primary bg-primary/10 text-primary"
              : "border-slate-200 text-slate-600 hover:bg-black/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
          }`}
        >
          <input type="checkbox" className="sr-only" checked={selected.has(item.id)} onChange={() => onToggle(item.id)} />
          {renderLabel(item)}
        </label>
      ))}
    </div>
  );
}

/** Shared by create + edit: Institution type -> School cascading filter for
 * the Assigned To picker, plus the Department toggle grid (departments are
 * a global catalog now, not per-school, so they need no cascading filter
 * of their own). */
function useTaskPickers(initialSchoolId?: string) {
  const [departments, setDepartments] = useState<DepartmentOpt[]>([]);
  const [schools, setSchools] = useState<SchoolOpt[]>([]);
  const [institutionType, setInstitutionType] = useState("");
  const [schoolId, setSchoolId] = useState(initialSchoolId ?? "");
  const [staff, setStaff] = useState<StaffOpt[]>([]);

  useEffect(() => {
    api<DepartmentOpt[]>("/academic/departments").then(setDepartments).catch(() => setDepartments([]));
    api<SchoolOpt[]>("/academic/schools").then(setSchools).catch(() => setSchools([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api<StaffOpt[]>(`/tasks/staff${schoolId ? `?schoolId=${schoolId}` : ""}`).then(setStaff).catch(() => setStaff([]));
  }, [schoolId]);

  const filteredSchools = institutionType ? schools.filter((s) => s.institutionType === institutionType) : schools;

  return { departments, schools, filteredSchools, institutionType, setInstitutionType, schoolId, setSchoolId, staff };
}

function CreateTaskModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { departments, filteredSchools, institutionType, setInstitutionType, schoolId, setSchoolId, staff } = useTaskPickers();
  const [selectedDeptIds, setSelectedDeptIds] = useState<Set<string>>(new Set());
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ subject: "", description: "", targetDate: "", remarks: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSet(setter: (fn: (prev: Set<string>) => Set<string>) => void, id: string) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDeptIds.size) { setError("Choose at least one department"); return; }
    if (!selectedAssigneeIds.size) { setError("Choose at least one assignee"); return; }
    setError(null);
    setBusy(true);
    try {
      await api("/tasks", {
        method: "POST",
        body: JSON.stringify({
          subject: form.subject.trim(), description: form.description.trim() || undefined,
          departmentIds: [...selectedDeptIds], targetDate: form.targetDate || undefined,
          assignedToIds: [...selectedAssigneeIds], remarks: form.remarks.trim() || undefined,
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
        <Field id="t-dept" label="Assigned Departments">
          <ToggleGrid
            items={departments} selected={selectedDeptIds} empty="No departments yet — add one under Academic > Department."
            onToggle={(id) => toggleSet(setSelectedDeptIds, id)} renderLabel={(d) => d.name}
          />
        </Field>
        <Field id="t-subject" label="Subject">
          <input id="t-subject" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className={inputCls} />
        </Field>
        <Field id="t-desc" label="Description" optional>
          <textarea id="t-desc" rows={3} className={`${inputCls} h-auto py-3`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field id="t-insttype" label="Institution type" optional>
            <select id="t-insttype" value={institutionType} onChange={(e) => { setInstitutionType(e.target.value); setSchoolId(""); }} className={inputCls}>
              <option value="">All types</option>
              {INSTITUTION_TYPES.map((t) => <option key={t} value={t}>{institutionLabel(t)}</option>)}
            </select>
          </Field>
          <Field id="t-school" label="School / institute" optional>
            <select id="t-school" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className={inputCls}>
              <option value="">All schools</option>
              {filteredSchools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        </div>
        <Field id="t-assignee" label="Assigned to">
          <ToggleGrid
            items={staff} selected={selectedAssigneeIds} empty="No staff match this filter."
            onToggle={(id) => toggleSet(setSelectedAssigneeIds, id)} renderLabel={(s) => `${s.fullName} · ${s.role}`}
          />
        </Field>
        <Field id="t-target" label="Target date" optional>
          <input id="t-target" type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} className={inputCls} />
        </Field>
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
  const { departments, filteredSchools, institutionType, setInstitutionType, schoolId, setSchoolId, staff } = useTaskPickers();
  const [selectedDeptIds, setSelectedDeptIds] = useState<Set<string>>(new Set(task.departments.map((d) => d.department.id)));
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<Set<string>>(new Set(task.assignees.map((a) => a.user.id)));
  const [form, setForm] = useState({
    subject: task.subject, description: task.description ?? "",
    targetDate: task.targetDate ? task.targetDate.slice(0, 10) : "",
    remarks: task.remarks ?? "", status: task.status,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function toggleSet(setter: (fn: (prev: Set<string>) => Set<string>) => void, id: string) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (isManager && !selectedDeptIds.size) { setError("Choose at least one department"); return; }
    if (isManager && !selectedAssigneeIds.size) { setError("Choose at least one assignee"); return; }
    setError(null);
    setBusy(true);
    try {
      const body = isManager
        ? {
            subject: form.subject.trim(), description: form.description.trim() || undefined,
            departmentIds: [...selectedDeptIds], targetDate: form.targetDate || undefined,
            assignedToIds: [...selectedAssigneeIds], remarks: form.remarks.trim() || undefined, status: form.status,
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
          <div><p className="text-xs text-slate-400">Date</p><p className="font-medium text-night dark:text-white">{fmtDate(task.createdAt)}</p></div>
          <div><p className="text-xs text-slate-400">Assigned by</p><p className="font-medium text-night dark:text-white">{task.assignedBy.fullName}</p></div>
          <div><p className="text-xs text-slate-400">Updated by</p><p className="font-medium text-night dark:text-white">{task.updatedBy?.fullName ?? "—"}</p></div>
        </div>

        {canEdit ? (
          <form onSubmit={submit} className="space-y-4 border-t border-slate-100 pt-4 dark:border-white/10">
            {isManager ? (
              <>
                <Field id="td-dept" label="Assigned Departments">
                  <ToggleGrid
                    items={departments} selected={selectedDeptIds} empty="No departments yet."
                    onToggle={(id) => toggleSet(setSelectedDeptIds, id)} renderLabel={(d) => d.name}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field id="td-insttype" label="Institution type" optional>
                    <select id="td-insttype" value={institutionType} onChange={(e) => { setInstitutionType(e.target.value); setSchoolId(""); }} className={inputCls}>
                      <option value="">All types</option>
                      {INSTITUTION_TYPES.map((t) => <option key={t} value={t}>{institutionLabel(t)}</option>)}
                    </select>
                  </Field>
                  <Field id="td-school" label="School / institute" optional>
                    <select id="td-school" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className={inputCls}>
                      <option value="">All schools</option>
                      {filteredSchools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </Field>
                </div>
                <Field id="td-assignee" label="Assigned to">
                  <ToggleGrid
                    items={staff} selected={selectedAssigneeIds} empty="No staff match this filter."
                    onToggle={(id) => toggleSet(setSelectedAssigneeIds, id)} renderLabel={(s) => `${s.fullName} · ${s.role}`}
                  />
                </Field>
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

  useEffect(() => { api<Me>("/auth/me").then(setMe).catch(() => setMe(null)); }, []);
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
                  <th className="px-4 py-3 font-medium">Departments</th>
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
                    <td className="px-4 py-3 text-slate-500">{row.departments.map((d) => d.department.name).join(", ") || "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(row.targetDate)}</td>
                    <td className="px-4 py-3 text-slate-500">{row.assignees.map((a) => a.user.fullName).join(", ") || "—"}</td>
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
        <CreateTaskModal onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); setToast("Task created"); load(); }} />
      )}
      {viewing && me && (
        <TaskDetailModal
          task={viewing} isManager={isManager} isAssignee={viewing.assignees.some((a) => a.user.id === me.id)}
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
