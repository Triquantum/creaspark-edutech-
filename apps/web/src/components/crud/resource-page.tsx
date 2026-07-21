"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, RowActions, Field, inputCls } from "@/components/ui/modal";

export interface FieldDef {
  name: string; label: string; required?: boolean; placeholder?: string;
  /** "text" (default) or "select" fed by optionsUrl */
  type?: "text" | "select";
  optionsUrl?: string;             // endpoint returning array of objects
  optionValue?: string;            // default "id"
  optionLabel?: string;            // default "name"
  editable?: boolean;              // default true; false = only on create
}
export interface ColumnDef { key: string; label: string; muted?: boolean }

function get(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);
}

export function ResourcePage({ title, singular, group, endpoint, columns, fields, deleteHint }: {
  title: string; singular: string; group?: string; endpoint: string;
  columns: ColumnDef[]; fields: FieldDef[]; deleteHint?: string;
}) {
  type Row = Record<string, unknown> & { id: string };
  const [rows, setRows] = useState<Row[]>([]);
  const [options, setOptions] = useState<Record<string, { value: string; label: string }[]>>({});
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [dialog, setDialog] = useState<{ mode: "add" } | { mode: "edit"; row: Row } | null>(null);
  const [viewing, setViewing] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setState("loading");
    api<Row[]>(endpoint).then((r) => { setRows(r); setState("ready"); }).catch(() => setState("error"));
  }, [endpoint]);

  useEffect(load, [load]);
  useEffect(() => {
    for (const f of fields) {
      if (f.type === "select" && f.optionsUrl) {
        api<Record<string, unknown>[]>(f.optionsUrl).then((list) =>
          setOptions((o) => ({
            ...o,
            [f.name]: list.map((item) => ({
              value: String(item[f.optionValue ?? "id"]),
              label: String(item[f.optionLabel ?? "name"]),
            })),
          })),
        ).catch(() => {});
      }
    }
  }, [fields]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  function openDialog(d: { mode: "add" } | { mode: "edit"; row: Row }) {
    setError(null);
    const initial: Record<string, string> = {};
    for (const f of fields) {
      initial[f.name] = d.mode === "edit"
        ? String((d.row[f.name] as string | undefined) ?? "")
        : (f.type === "select" ? (options[f.name]?.[0]?.value ?? "") : "");
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
        <Button onClick={() => openDialog({ mode: "add" })}>Add {singular.toLowerCase()}</Button>
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
                      onEdit={() => openDialog({ mode: "edit", row })}
                      onDelete={() => setDeleting(row)}
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
                    {(options[f.name] ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input id={`rf-${f.name}`} required={f.required} value={form[f.name] ?? ""} placeholder={f.placeholder} className={inputCls}
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
