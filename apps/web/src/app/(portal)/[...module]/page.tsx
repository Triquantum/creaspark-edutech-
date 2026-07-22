"use client";
import { use, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, RowActions, Field, inputCls } from "@/components/ui/modal";

interface RecordData { name: string; notes?: string; fields?: Record<string, string> }
interface RecordRow { id: string; data: RecordData; updatedAt: string }
interface School { id: string; name: string }

function titleCase(s: string) {
  return s.split("-").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
}

function RecordDialog({ moduleKey, schoolId, title, mode, initial, onClose, onSaved }: {
  moduleKey: string; schoolId: string; title: string; mode: "add" | "edit"; initial?: RecordRow;
  onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.data.name ?? "");
  const [notes, setNotes] = useState(initial?.data.notes ?? "");
  const [extra, setExtra] = useState<{ key: string; value: string }[]>(
    initial?.data.fields ? Object.entries(initial.data.fields).map(([key, value]) => ({ key, value })) : [],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const fields = Object.fromEntries(extra.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value]));
      const body = {
        name: name.trim(),
        ...(notes.trim() && { notes: notes.trim() }),
        ...(Object.keys(fields).length > 0 && { fields }),
      };
      if (mode === "add") {
        await api(`/records/${moduleKey}?schoolId=${schoolId}`, { method: "POST", body: JSON.stringify(body) });
      } else {
        await api(`/records/${moduleKey}/${initial!.id}`, { method: "PATCH", body: JSON.stringify(body) });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save record");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={mode === "add" ? `Add ${title.toLowerCase()}` : `Edit ${initial?.data.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field id="rec-name" label="Name">
          <input id="rec-name" required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <Field id="rec-notes" label="Notes" optional>
          <textarea id="rec-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
            className={`${inputCls} h-auto py-2.5`} />
        </Field>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-medium">Additional fields</span>
            <button type="button" onClick={() => setExtra((r) => [...r, { key: "", value: "" }])}
              className="text-xs font-medium text-primary hover:underline">
              + Add field
            </button>
          </div>
          <div className="space-y-2">
            {extra.map((row, i) => (
              <div key={i} className="flex gap-2">
                <input placeholder="Field name" value={row.key}
                  onChange={(e) => setExtra((rs) => rs.map((r, idx) => (idx === i ? { ...r, key: e.target.value } : r)))}
                  className={`${inputCls} h-9`} />
                <input placeholder="Value" value={row.value}
                  onChange={(e) => setExtra((rs) => rs.map((r, idx) => (idx === i ? { ...r, value: e.target.value } : r)))}
                  className={`${inputCls} h-9`} />
                <button type="button" aria-label="Remove field"
                  onClick={() => setExtra((rs) => rs.filter((_, idx) => idx !== i))}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-black/5 hover:text-danger dark:hover:bg-white/10">
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : mode === "add" ? "Save" : "Save changes"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ModuleScaffold({ params }: { params: Promise<{ module: string[] }> }) {
  const { module } = use(params);
  const moduleKey = module.join("-");
  const title = titleCase(module[module.length - 1]);
  const group = module.length > 1 ? titleCase(module[0]) : null;

  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [q, setQ] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [dialog, setDialog] = useState<{ mode: "add" } | { mode: "edit"; row: RecordRow } | null>(null);
  const [viewing, setViewing] = useState<RecordRow | null>(null);
  const [deleting, setDeleting] = useState<RecordRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    api<School[]>("/academic/schools").then((list) => {
      setSchools(list);
      setSchoolId((current) => current || list[0]?.id || "");
    }).catch(() => {});
  }, []);

  const load = useCallback(() => {
    if (!schoolId) return;
    setState("loading");
    const params = new URLSearchParams({ schoolId, ...(q && { q }) });
    api<RecordRow[]>(`/records/${moduleKey}?${params}`)
      .then((r) => { setRows(r); setState("ready"); })
      .catch(() => setState("error"));
  }, [moduleKey, q, schoolId]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { setQ(""); setDialog(null); setViewing(null); setDeleting(null); }, [moduleKey]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/records/${moduleKey}/${deleting.id}`, { method: "DELETE" });
      setToast("Deleted");
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
        <Button onClick={() => setDialog({ mode: "add" })} disabled={!schoolId}>Add {title.toLowerCase()}</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 dark:border-white/5 p-4">
          <select
            value={schoolId} onChange={(e) => setSchoolId(e.target.value)}
            aria-label="School"
            className="h-10 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${title.toLowerCase()}`} aria-label={`Search ${title}`}
            className="h-10 w-full max-w-sm rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-4 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>

        {state === "error" && (
          <p className="p-6 text-sm text-slate-500">
            Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.
          </p>
        )}
        {state === "ready" && rows.length === 0 && (
          <p className="p-6 text-sm leading-relaxed text-slate-500">
            No {title.toLowerCase()} yet. This module runs on a generic record store until it gets a dedicated
            data model (see <code className="rounded bg-surface px-1.5 py-0.5 text-xs dark:bg-white/10">docs/roadmap.md</code>) —
            add, edit and delete already persist.
          </p>
        )}

        {rows.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Notes</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 dark:border-white/5 transition-colors hover:bg-surface dark:hover:bg-white/5">
                  <td className="px-4 py-3 font-medium text-night dark:text-white">{r.data.name}</td>
                  <td className="px-4 py-3 text-slate-500">{r.data.notes ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(r.updatedAt).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-3">
                    <RowActions
                      onView={() => setViewing(r)}
                      onEdit={() => setDialog({ mode: "edit", row: r })}
                      onDelete={() => setDeleting(r)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {dialog && (
        <RecordDialog
          moduleKey={moduleKey} schoolId={schoolId} title={title} mode={dialog.mode}
          initial={dialog.mode === "edit" ? dialog.row : undefined}
          onClose={() => setDialog(null)}
          onSaved={() => { setToast(dialog.mode === "add" ? "Added" : "Changes saved"); load(); }}
        />
      )}

      {viewing && (
        <Modal title={viewing.data.name} onClose={() => setViewing(null)}>
          <div className="space-y-4 text-sm">
            {viewing.data.notes && <p className="text-slate-500">{viewing.data.notes}</p>}
            {viewing.data.fields && Object.keys(viewing.data.fields).length > 0 && (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                {Object.entries(viewing.data.fields).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">{k}</dt>
                    <dd className="mt-0.5 font-medium text-night dark:text-white">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
            {!viewing.data.notes && !viewing.data.fields && <p className="text-slate-500">No additional details.</p>}
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.data.name}?`}
          message="This permanently removes this record."
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
