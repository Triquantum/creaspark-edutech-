"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, RowActions, Field, inputCls } from "@/components/ui/modal";

export interface FieldDef {
  name: string; label: string; required?: boolean; placeholder?: string;
  /** "text" (default), "select" fed by optionsUrl, or "date" */
  type?: "text" | "select" | "date";
  optionsUrl?: string;             // endpoint returning array of objects
  optionValue?: string;            // default "id"
  optionLabel?: string;            // default "name"
  editable?: boolean;              // default true; false = only on create
  /** Cascading select: only options whose `filterKey` property matches the
   * `dependsOn` field's current value are shown (e.g. Class filtered to the
   * chosen School). Declare the field this depends on earlier in `fields`. */
  dependsOn?: string;
  filterKey?: string;
}
export interface ColumnDef { key: string; label: string; muted?: boolean }

function get(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);
}

export function ResourcePage({ title, singular, group, endpoint, columns, fields, deleteHint, manageRoles, schoolFilterable }: {
  title: string; singular: string; group?: string; endpoint: string;
  columns: ColumnDef[]; fields: FieldDef[]; deleteHint?: string;
  /** Roles allowed to Add/Edit/Delete, matching this endpoint's real @Roles
   * set on the backend — everyone else gets a read-only view (View action
   * only) instead of buttons that would just 403. Omit to leave ungated. */
  manageRoles?: string[];
  /** Adds a School filter dropdown that narrows the list server-side via
   * `?schoolId=`. Rows across different schools can otherwise look
   * identical (e.g. every school has its own "Grade 1 - A") — this doesn't
   * change what a row IS, just lets the admin narrow down which one. */
  schoolFilterable?: boolean;
}) {
  type Row = Record<string, unknown> & { id: string };
  const [rows, setRows] = useState<Row[]>([]);
  const [rawOptions, setRawOptions] = useState<Record<string, Record<string, unknown>[]>>({});
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [dialog, setDialog] = useState<{ mode: "add" } | { mode: "edit"; row: Row } | null>(null);
  const [viewing, setViewing] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [schoolOptions, setSchoolOptions] = useState<{ id: string; name: string }[]>([]);
  const [schoolFilter, setSchoolFilter] = useState("");

  useEffect(() => {
    if (!manageRoles) return;
    api<{ role: string }>("/auth/me").then((r) => setMyRole(r.role)).catch(() => setMyRole(null));
  }, [manageRoles]);
  const canManage = !manageRoles || (myRole !== null && manageRoles.includes(myRole));

  useEffect(() => {
    if (!schoolFilterable) return;
    api<{ id: string; name: string }[]>("/academic/schools").then(setSchoolOptions).catch(() => setSchoolOptions([]));
  }, [schoolFilterable]);

  const load = useCallback(() => {
    setState("loading");
    const url = schoolFilterable && schoolFilter ? `${endpoint}?schoolId=${schoolFilter}` : endpoint;
    api<Row[]>(url).then((r) => { setRows(r); setState("ready"); }).catch(() => setState("error"));
  }, [endpoint, schoolFilterable, schoolFilter]);

  useEffect(load, [load]);
  useEffect(() => {
    for (const f of fields) {
      if (f.type === "select" && f.optionsUrl) {
        api<Record<string, unknown>[]>(f.optionsUrl).then((list) =>
          setRawOptions((o) => ({ ...o, [f.name]: list })),
        ).catch(() => {});
      }
    }
  }, [fields]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  /** Options for a select field, filtered to the current dependsOn value
   * when the field declares one (e.g. Class narrowed to the chosen School).
   * Returns [] until that field's own fetch has resolved at least once. */
  function fieldOptions(f: FieldDef, formValues: Record<string, string>): { value: string; label: string }[] {
    const raw = rawOptions[f.name];
    if (!raw) return [];
    const filtered = f.dependsOn && f.filterKey
      ? raw.filter((item) => String(item[f.filterKey!] ?? "") === (formValues[f.dependsOn!] ?? ""))
      : raw;
    return filtered.map((item) => ({
      value: String(item[f.optionValue ?? "id"]),
      label: String(item[f.optionLabel ?? "name"]),
    }));
  }

  // A select's value can go stale for two reasons: its options were still
  // loading when the dialog opened (form state stuck at ""), or a dependsOn
  // field just changed and the previous pick no longer belongs to the new
  // filtered set. Either way, once real options exist, snap back to a valid
  // one — first available, or "" if the (now-filtered) list is empty.
  useEffect(() => {
    if (!dialog) return;
    setForm((fm) => {
      let changed = false;
      const next = { ...fm };
      for (const f of fields) {
        if (f.type !== "select" || !(f.name in rawOptions)) continue;
        const opts = fieldOptions(f, next);
        const valid = new Set(opts.map((o) => o.value));
        if (!next[f.name] || !valid.has(next[f.name])) {
          const fallback = opts[0]?.value ?? "";
          if (next[f.name] !== fallback) { next[f.name] = fallback; changed = true; }
        }
      }
      return changed ? next : fm;
    });
  }, [rawOptions, dialog, fields, form]);

  function openDialog(d: { mode: "add" } | { mode: "edit"; row: Row }) {
    setError(null);
    const initial: Record<string, string> = {};
    for (const f of fields) {
      // "add" mode leaves selects at "" — the sync effect above fills in a
      // valid default (respecting dependsOn order) as soon as options load.
      initial[f.name] = d.mode === "edit" ? String((d.row[f.name] as string | undefined) ?? "") : "";
    }
    setForm(initial);
    setDialog(d);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const activeFields = dialog?.mode === "edit" ? fields.filter((f) => f.editable !== false) : fields;
    const body: Record<string, string> = {};
    for (const f of activeFields) if (form[f.name]) body[f.name] = form[f.name].trim();
    try {
      if (dialog?.mode === "add") {
        await api(endpoint, { method: "POST", body: JSON.stringify(body) });
        setToast(`${singular} added`);
      } else if (dialog?.mode === "edit") {
        await api(`${endpoint}/${dialog.row.id}`, { method: "PATCH", body: JSON.stringify(body) });
        setToast("Changes saved");
      }
      setDialog(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`${endpoint}/${deleting.id}`, { method: "DELETE" });
      setToast(`${singular} deleted`);
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
        <div>
          {group && <p className="text-xs font-medium uppercase tracking-widest text-slate-400">{group}</p>}
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">{title}</h1>
        </div>
        <div className="flex items-center gap-3">
          {schoolFilterable && (
            <select value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)} className={`${inputCls} w-auto`}>
              <option value="">All schools</option>
              {schoolOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          {canManage && <Button onClick={() => openDialog({ mode: "add" })}>Add {singular.toLowerCase()}</Button>}
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {state === "error" && (
          <p className="p-6 text-sm text-slate-500">
            Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.
          </p>
        )}
        {state === "ready" && rows.length === 0 && (
          <p className="p-6 text-sm text-slate-500">Nothing here yet — add the first {singular.toLowerCase()}.</p>
        )}
        {rows.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100 dark:border-white/5">
                {columns.map((c) => <th key={c.key} className="px-4 py-3 font-medium">{c.label}</th>)}
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-50 dark:border-white/5 transition-colors hover:bg-surface dark:hover:bg-white/5">
                  {columns.map((c, i) => (
                    <td key={c.key} className={`px-4 py-3 ${c.muted ? "text-slate-500" : i === 0 ? "font-medium text-night dark:text-white" : ""}`}>
                      {String(get(row, c.key) ?? "—")}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <RowActions
                      onView={() => setViewing(row)}
                      onEdit={canManage ? () => openDialog({ mode: "edit", row }) : undefined}
                      onDelete={canManage ? () => setDeleting(row) : undefined}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {dialog && (
        <Modal title={dialog.mode === "add" ? `Add ${singular.toLowerCase()}` : `Edit ${singular.toLowerCase()}`} onClose={() => setDialog(null)}>
          <form onSubmit={submit} className="space-y-4">
            {(dialog.mode === "edit" ? fields.filter((f) => f.editable !== false) : fields).map((f) => (
              <Field key={f.name} id={`rf-${f.name}`} label={f.label} optional={!f.required}>
                {f.type === "select" ? (
                  <select id={`rf-${f.name}`} required={f.required} value={form[f.name] ?? ""} className={inputCls}
                    onChange={(e) => setForm((fm) => ({ ...fm, [f.name]: e.target.value }))}>
                    {fieldOptions(f, form).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input id={`rf-${f.name}`} type={f.type === "date" ? "date" : "text"} required={f.required}
                    value={form[f.name] ?? ""} placeholder={f.placeholder} className={inputCls}
                    onChange={(e) => setForm((fm) => ({ ...fm, [f.name]: e.target.value }))} />
                )}
              </Field>
            ))}
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
            </div>
          </form>
        </Modal>
      )}

      {viewing && (
        <Modal title={String(get(viewing, columns[0].key) ?? singular)} onClose={() => setViewing(null)}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {columns.map((c) => (
              <div key={c.key}>
                <dt className="text-xs uppercase tracking-wide text-slate-400">{c.label}</dt>
                <dd className="mt-0.5 font-medium text-night dark:text-white">{String(get(viewing, c.key) ?? "—")}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete ${singular.toLowerCase()}?`}
          message={`This permanently removes "${String(get(deleting, columns[0].key))}". ${deleteHint ?? ""}`}
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
