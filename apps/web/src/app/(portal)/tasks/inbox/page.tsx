"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/ui/modal";
import {
  Me, TaskRow, MANAGE_ROLES, STATUS_OPTIONS, STATUS_LABEL, STATUS_CLS, fmtDate, fmtDateTime,
  TaskDetailModal,
} from "../task-shared";

/** Tasks assigned TO the current user -- their own inbox to reply to and
 * track, independent of the manager's tenant-wide "All Tasks" list. */
export default function TaskInboxPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [viewing, setViewing] = useState<TaskRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const isManager = !!me && MANAGE_ROLES.includes(me.role);

  const load = useCallback(() => {
    setState("loading");
    const params = new URLSearchParams({ box: "inbox" });
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    api<TaskRow[]>(`/tasks?${params.toString()}`).then((r) => { setRows(r); setState("ready"); }).catch(() => setState("error"));
  }, [q, status]);

  useEffect(() => { api<Me>("/auth/me").then(setMe).catch(() => setMe(null)); }, []);
  useEffect(load, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Work</p>
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Task Manager Inbox</h1>
        <p className="mt-1 text-sm text-slate-500">Tasks assigned to you. Open one to reply with your status.</p>
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
          <p className="p-6 text-sm text-slate-500">No tasks assigned to you yet.</p>
        )}
        {rows.length > 0 && me && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <th className="px-4 py-3 font-medium">Serial No.</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Subject</th>
                  <th className="px-4 py-3 font-medium">Assigned By</th>
                  <th className="px-4 py-3 font-medium">Target Date</th>
                  <th className="px-4 py-3 font-medium">Your Status</th>
                  <th className="px-4 py-3 font-medium">Replied</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const mine = row.assignees.find((a) => a.user.id === me.id);
                  return (
                    <tr key={row.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.serialNo}</td>
                      <td className="px-4 py-3 text-slate-500">{fmtDate(row.createdAt)}</td>
                      <td className="px-4 py-3 font-medium text-night dark:text-white">{row.subject}</td>
                      <td className="px-4 py-3 text-slate-500">{row.assignedBy.fullName}</td>
                      <td className="px-4 py-3 text-slate-500">{fmtDate(row.targetDate)}</td>
                      <td className="px-4 py-3">
                        {mine && (
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLS[mine.status]}`}>{STATUS_LABEL[mine.status]}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{mine?.respondedAt ? fmtDateTime(mine.respondedAt) : "Pending"}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <Button variant="ghost" onClick={() => setViewing(row)}>Reply</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {viewing && me && (
        <TaskDetailModal
          task={viewing} isManager={isManager} isAssignee meId={me.id}
          onClose={() => setViewing(null)}
          onSaved={() => { setViewing(null); setToast("Reply sent"); load(); }}
          onDeleted={() => { setViewing(null); setToast("Task deleted"); load(); }}
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
