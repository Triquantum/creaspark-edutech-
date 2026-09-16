"use client";
import { useEffect, useState } from "react";
import { History, LogIn, LogOut, Pencil, Plus, Trash2, Upload, Activity as ActivityIcon } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/ui/modal";

interface Me { role: string }
interface AuditLogRow {
  id: string; action: string; entity: string; entityId: string | null;
  ip: string | null; createdAt: string;
  user: { fullName: string; email: string; role: string } | null;
}
interface AuditLogResponse { rows: AuditLogRow[]; total: number; page: number; pageSize: number }
interface FilterOptions { actions: string[]; entities: string[] }

const ACCESS_ROLES = new Set(["SUPER_ADMIN"]);
const PAGE_SIZE = 25;

function actionVerb(action: string): string {
  const parts = action.split(".");
  return parts[parts.length - 1] ?? action;
}

function ActionIcon({ action }: { action: string }) {
  const verb = actionVerb(action);
  if (action === "auth.login") return <LogIn size={14} />;
  if (action === "auth.logout") return <LogOut size={14} />;
  if (verb === "create" || verb === "upload" || verb === "register") return <Plus size={14} />;
  if (verb === "update" || verb === "edit") return <Pencil size={14} />;
  if (verb === "delete" || verb === "remove") return <Trash2 size={14} />;
  if (verb.includes("upload")) return <Upload size={14} />;
  return <ActivityIcon size={14} />;
}

function actionStyle(action: string): string {
  const verb = actionVerb(action);
  if (action === "auth.login") return "bg-success/10 text-success";
  if (action === "auth.logout") return "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300";
  if (verb === "create" || verb === "upload" || verb === "register") return "bg-success/10 text-success";
  if (verb === "update" || verb === "edit") return "bg-accent/10 text-accent";
  if (verb === "delete" || verb === "remove") return "bg-danger/10 text-danger";
  return "bg-primary/10 text-primary";
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export default function AuditLogsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [checked, setChecked] = useState(false);

  const [data, setData] = useState<AuditLogResponse | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ actions: [], entities: [] });
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    api<Me>("/auth/me").then(setMe).catch(() => setMe(null)).finally(() => setChecked(true));
  }, []);

  useEffect(() => {
    if (!me || !ACCESS_ROLES.has(me.role)) return;
    api<FilterOptions>("/audit-logs/filter-options").then(setFilterOptions).catch(() => {});
  }, [me]);

  function load() {
    if (!me || !ACCESS_ROLES.has(me.role)) return;
    setState("loading");
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (q.trim()) params.set("q", q.trim());
    if (action) params.set("action", action);
    if (entity) params.set("entity", entity);
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(to + "T23:59:59").toISOString());
    api<AuditLogResponse>(`/audit-logs?${params.toString()}`)
      .then((r) => { setData(r); setState("ready"); })
      .catch(() => setState("error"));
  }

  useEffect(load, [me, page]);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  if (!checked) return null;

  if (!me || !ACCESS_ROLES.has(me.role)) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Activity Log</h1>
        <Card><p className="text-sm text-slate-500">Your role doesn&apos;t have access to this page.</p></Card>
      </div>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Super Admin</p>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-night dark:text-white">
          <History size={22} className="text-primary" /> Activity Log
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Every login, logout, create, update and delete recorded across the platform, newest first.
        </p>
      </div>

      <Card>
        <form onSubmit={applyFilters} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search user, action, entity…" aria-label="Search"
            className={inputCls}
          />
          <select value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter by action" className={inputCls}>
            <option value="">All actions</option>
            {filterOptions.actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={entity} onChange={(e) => setEntity(e.target.value)} aria-label="Filter by entity" className={inputCls}>
            <option value="">All entities</option>
            {filterOptions.entities.map((en) => <option key={en} value={en}>{en}</option>)}
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" className={inputCls} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" className={inputCls} />
          <Button type="submit" className="sm:col-span-2 lg:col-span-1">Apply Filters</Button>
        </form>
      </Card>

      {state === "error" && (
        <Card><p className="text-sm text-slate-500">Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.</p></Card>
      )}
      {state === "ready" && data && data.rows.length === 0 && (
        <Card><p className="text-sm text-slate-500">No activity matches these filters.</p></Card>
      )}

      {data && data.rows.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">Date &amp; Time (IST)</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Entity</th>
                <th className="px-4 py-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fmtDateTime(row.createdAt)}</td>
                  <td className="px-4 py-3">
                    {row.user ? (
                      <div>
                        <p className="font-medium text-night dark:text-white">{row.user.fullName}</p>
                        <p className="text-xs text-slate-400">{row.user.email} · {row.user.role}</p>
                      </div>
                    ) : (
                      <span className="text-slate-400">System</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${actionStyle(row.action)}`}>
                      <ActionIcon action={row.action} /> {row.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {row.entity}{row.entityId ? <span className="ml-1 text-xs text-slate-400">#{row.entityId.slice(-6)}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{row.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500 dark:border-white/5">
            <span>{data.total.toLocaleString("en-IN")} total events</span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span>Page {page} of {totalPages}</span>
              <Button type="button" variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
