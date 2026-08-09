"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, RowActions, inputCls } from "@/components/ui/modal";
import {
  Me, TaskRow, MANAGE_ROLES, STATUS_OPTIONS, STATUS_LABEL, STATUS_CLS, fmtDate,
  CreateTaskModal, TaskDetailModal,
} from "../task-shared";

/** Tasks the current user assigned to others (or to themselves) -- shows a
 * reply-progress rollup per task so the assigner can see at a glance who's
 * still pending, without opening every task. */
export default function TaskOutboxPage() {
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
    const params = new URLSearchParams({ box: "outbox" });
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
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Task Manager Outbox</h1>
          <p className="mt-1 text-sm text-slate-500">Tasks you assigned. See who has replied and who's still pending.</p>
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
          <p className="p-6 text-sm text-slate-500">
            {isManager ? "You haven't assigned any tasks yet." : "Only manager roles can assign tasks."}
          </p>
        )}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <th className="px-4 py-3 font-medium">Serial No.</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Subject</th>
                  <th className="px-4 py-3 font-medium">Assigned To</th>
                  <th className="px-4 py-3 font-medium">Target Date</th>
                  <th className="px-4 py-3 font-medium">Replies</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const repliedCount = row.assignees.filter((a) => a.respondedAt).length;
                  const allReplied = repliedCount === row.assignees.length;
                  return (
                    <tr key={row.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.serialNo}</td>
                      <td className="px-4 py-3 text-slate-500">{fmtDate(row.createdAt)}</td>
                      <td className="px-4 py-3 font-medium text-night dark:text-white">{row.subject}</td>
                      <td className="px-4 py-3 text-slate-500">{row.assignees.map((a) => a.user.fullName).join(", ") || "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{fmtDate(row.targetDate)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${allReplied ? "bg-success/10 text-success" : "bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300"}`}>
                          {repliedCount}/{row.assignees.length} replied
                        </span>
                      </td>
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
                  );
                })}
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
          task={viewing} isManager={isManager} isAssignee={viewing.assignees.some((a) => a.user.id === me.id)} meId={me.id}
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
