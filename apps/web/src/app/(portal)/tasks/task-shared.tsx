"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, Field, inputCls } from "@/components/ui/modal";
import { INSTITUTION_TYPES } from "@/components/platform/school-edit-modal";

export interface Me { id: string; role: string }
export interface DepartmentOpt { id: string; name: string }
export interface SchoolOpt { id: string; name: string; institutionType: string }
export interface StaffOpt { id: string; fullName: string; role: string }
export type TaskStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export interface TaskAssigneeRow {
  status: TaskStatus; remarks: string | null; respondedAt: string | null;
  user: { id: string; fullName: string; role: string };
}
export interface TaskRow {
  id: string; serialNo: string;
  subject: string; description: string | null; targetDate: string | null; remarks: string | null;
  status: TaskStatus; createdAt: string;
  departments: { department: { id: string; name: string } }[];
  assignees: TaskAssigneeRow[];
  assignedBy: { fullName: string };
  updatedBy: { fullName: string } | null;
}

export const MANAGE_ROLES = ["SUPER_ADMIN", "ORG_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "COORDINATOR"];
export const STATUS_OPTIONS: TaskStatus[] = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
export const STATUS_LABEL: Record<TaskStatus, string> = { OPEN: "Open", IN_PROGRESS: "In Progress", COMPLETED: "Completed", CANCELLED: "Cancelled" };
export const STATUS_CLS: Record<TaskStatus, string> = {
  OPEN: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  IN_PROGRESS: "bg-accent/10 text-accent",
  COMPLETED: "bg-success/10 text-success",
  CANCELLED: "bg-danger/10 text-danger",
};

export function fmtDate(s: string | null) {
  return s ? new Date(s).toLocaleDateString("en-IN") : "—";
}
export function fmtDateTime(s: string | null) {
  return s ? new Date(s).toLocaleString("en-IN") : "—";
}
export function institutionLabel(t: string) {
  return t.charAt(0) + t.slice(1).toLowerCase();
}

/** Toggle-style multi-select: a bordered chip grid of checkboxes, matching
 * this app's established "like a toggle" pattern (Subject page's toggle
 * grid) rather than a plain multi-select <select>. */
export function ToggleGrid<T extends { id: string }>({ items, selected, onToggle, renderLabel, empty }: {
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
export function useTaskPickers(initialSchoolId?: string) {
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

export function CreateTaskModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
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

/** Read-only per-assignee breakdown -- who has replied (their own status +
 * remarks + when) and who is still pending. Shown to managers so a task
 * with several assignees doesn't hide behind one shared status. */
function RepliesTable({ assignees }: { assignees: TaskAssigneeRow[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Replies</p>
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-400 dark:bg-white/5">
            <tr>
              <th className="px-3 py-2 font-medium">Assignee</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Remarks</th>
              <th className="px-3 py-2 font-medium">Replied</th>
            </tr>
          </thead>
          <tbody>
            {assignees.map((a) => (
              <tr key={a.user.id} className="border-t border-slate-100 dark:border-white/5">
                <td className="px-3 py-2 text-night dark:text-white">{a.user.fullName}</td>
                <td className="px-3 py-2">
                  {a.respondedAt ? (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLS[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">Pending reply</span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-500">{a.remarks || "—"}</td>
                <td className="px-3 py-2 text-slate-500">{fmtDateTime(a.respondedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** An assignee's own reply -- independent of the manager's overall status.
 * Every assignee (including a manager assigned to their own task) gets this
 * so the assigner can see who has responded and who is still pending. */
function ReplyForm({ taskId, mine, onSaved }: { taskId: string; mine: TaskAssigneeRow; onSaved: () => void }) {
  const [status, setStatus] = useState<TaskStatus>(mine.status);
  const [remarks, setRemarks] = useState(mine.remarks ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api(`/tasks/${taskId}/reply`, { method: "POST", body: JSON.stringify({ status, remarks: remarks.trim() || undefined }) });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reply");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-primary">Your reply</p>
      {mine.respondedAt && <p className="text-xs text-slate-500">Last replied {fmtDateTime(mine.respondedAt)}</p>}
      <div className="grid grid-cols-2 gap-4">
        <Field id="reply-status" label="Your status">
          <select id="reply-status" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} className={inputCls}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
      </div>
      <Field id="reply-remarks" label="Remarks" optional>
        <textarea id="reply-remarks" rows={2} className={`${inputCls} h-auto py-3`} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </Field>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send reply"}</Button>
      </div>
    </form>
  );
}

export function TaskDetailModal({ task, isManager, isAssignee, meId, onClose, onSaved, onDeleted }: {
  task: TaskRow; isManager: boolean; isAssignee: boolean; meId: string;
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

  const mine = task.assignees.find((a) => a.user.id === meId);

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
      await api(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          subject: form.subject.trim(), description: form.description.trim() || undefined,
          departmentIds: [...selectedDeptIds], targetDate: form.targetDate || undefined,
          assignedToIds: [...selectedAssigneeIds], remarks: form.remarks.trim() || undefined, status: form.status,
        }),
      });
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

  return (
    <Modal title={`${task.serialNo} · ${task.subject}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><p className="text-xs text-slate-400">Date</p><p className="font-medium text-night dark:text-white">{fmtDate(task.createdAt)}</p></div>
          <div><p className="text-xs text-slate-400">Assigned by</p><p className="font-medium text-night dark:text-white">{task.assignedBy.fullName}</p></div>
          <div><p className="text-xs text-slate-400">Updated by</p><p className="font-medium text-night dark:text-white">{task.updatedBy?.fullName ?? "—"}</p></div>
        </div>

        {isAssignee && mine && (
          <ReplyForm taskId={task.id} mine={mine} onSaved={onSaved} />
        )}

        {isManager ? (
          <form onSubmit={submit} className="space-y-4 border-t border-slate-100 pt-4 dark:border-white/10">
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
            <div className="grid grid-cols-2 gap-4">
              <Field id="td-status" label="Overall status" optional>
                <select id="td-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })} className={inputCls}>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </Field>
            </div>
            <Field id="td-remarks" label="Remarks" optional>
              <textarea id="td-remarks" rows={2} className={`${inputCls} h-auto py-3`} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            </Field>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex items-center justify-between gap-3">
              <Button type="button" variant="danger" onClick={() => setDeleting(true)}>Delete</Button>
              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
                <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
              </div>
            </div>

            <RepliesTable assignees={task.assignees} />
          </form>
        ) : (
          <>
            {task.description && (
              <div><p className="text-xs text-slate-400">Description</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{task.description}</p></div>
            )}
            {error && <p className="text-sm text-danger">{error}</p>}
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
