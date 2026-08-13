"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, RowActions, Field, inputCls } from "@/components/ui/modal";

interface SchoolOpt { id: string; name: string; code: string; institutionType: string; tenantName?: string }
interface ClassRow { id: string; name: string; schoolId: string; schoolName: string; sectionCount: number }
interface BulkResult { createdCount: number; skippedCount: number }

const MANAGE_ROLES = new Set(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "COORDINATOR"]);
const BULK_ROLES = new Set(["SUPER_ADMIN", "ORG_ADMIN"]);

function institutionLabel(t: string) {
  return t === "SCHOOL" ? "School" : t === "COLLEGE" ? "College" : t === "INSTITUTE" ? "Institute" : t;
}

export default function ClassesPage() {
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [schools, setSchools] = useState<SchoolOpt[]>([]);
  const [schoolFilter, setSchoolFilter] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [myRole, setMyRole] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [deleting, setDeleting] = useState<ClassRow | null>(null);
  const [name, setName] = useState("");
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const canManage = myRole !== null && MANAGE_ROLES.has(myRole);
  const canBulk = myRole !== null && BULK_ROLES.has(myRole);

  const load = useCallback(() => {
    setState("loading");
    const qs = schoolFilter ? `?schoolId=${schoolFilter}` : "";
    api<ClassRow[]>(`/academic/classes${qs}`).then((r) => { setRows(r); setState("ready"); }).catch(() => setState("error"));
  }, [schoolFilter]);

  useEffect(load, [load]);
  useEffect(() => {
    api<{ role: string }>("/auth/me").then((r) => setMyRole(r.role)).catch(() => setMyRole(null));
    api<SchoolOpt[]>("/academic/schools").then(setSchools).catch(() => setSchools([]));
  }, []);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); } }, [toast]);

  function openAdd() {
    setError(null);
    setName("");
    setSelectedSchoolIds(new Set());
    setShowAdd(true);
  }
  function openEdit(row: ClassRow) {
    setError(null);
    setName(row.name);
    setEditing(row);
  }
  function toggleSchool(id: string) {
    setSelectedSchoolIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (selectedSchoolIds.size === 0) { setError("Toggle on at least one school, college or institute."); return; }
    setBusy(true);
    try {
      const result = await api<BulkResult>("/academic/classes/bulk", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), schoolIds: [...selectedSchoolIds] }),
      });
      setToast(
        result.skippedCount > 0
          ? `Created in ${result.createdCount} school${result.createdCount === 1 ? "" : "s"} — ${result.skippedCount} already had it`
          : `Created in ${result.createdCount} school${result.createdCount === 1 ? "" : "s"}`,
      );
      setShowAdd(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create class");
    } finally {
      setBusy(false);
    }
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError(null);
    setBusy(true);
    try {
      await api(`/academic/classes/${editing.id}`, { method: "PATCH", body: JSON.stringify({ name: name.trim() }) });
      setToast("Changes saved");
      setEditing(null);
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
      await api(`/academic/classes/${deleting.id}`, { method: "DELETE" });
      setToast("Class deleted");
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
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Academic</p>
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Classes</h1>
        </div>
        <div className="flex items-center gap-3">
          <select value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)} className={inputCls}>
            <option value="">All schools</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {canManage && <Button onClick={openAdd}>Add class</Button>}
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {state === "error" && (
          <p className="p-6 text-sm text-slate-500">
            Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.
          </p>
        )}
        {state === "ready" && rows.length === 0 && (
          <p className="p-6 text-sm text-slate-500">Nothing here yet — add the first class.</p>
        )}
        {rows.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">Class</th>
                <th className="px-4 py-3 font-medium">School</th>
                <th className="px-4 py-3 font-medium">Divisions</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-50 dark:border-white/5 transition-colors hover:bg-surface dark:hover:bg-white/5">
                  <td className="px-4 py-3 font-medium text-night dark:text-white">{row.name}</td>
                  <td className="px-4 py-3 text-slate-500">{row.schoolName}</td>
                  <td className="px-4 py-3 text-slate-500">{row.sectionCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <RowActions
                        onView={() => openEdit(row)}
                        onEdit={canManage ? () => openEdit(row) : undefined}
                        onDelete={canManage ? () => setDeleting(row) : undefined}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {showAdd && (
        <Modal title="Add class" onClose={() => setShowAdd(false)} wide>
          <form onSubmit={submitAdd} className="space-y-4">
            <Field id="cls-name" label="Class name">
              <input id="cls-name" required value={name} placeholder="Grade 11" className={inputCls} onChange={(e) => setName(e.target.value)} />
            </Field>

            <div>
              <p className="mb-1.5 text-sm font-medium">Create in schools / colleges / institutes</p>
              {!canBulk && (
                <p className="mb-2 text-xs text-slate-500">
                  You can only create classes in your own school. Cross-school bulk creation is limited to Super Admin / Org Admin.
                </p>
              )}
              {schools.length === 0 ? (
                <p className="text-sm text-slate-500">No registered schools yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 p-3 dark:border-white/10">
                  {schools.map((sc) => {
                    const active = selectedSchoolIds.has(sc.id);
                    const disabled = !canBulk && selectedSchoolIds.size > 0 && !active;
                    return (
                      <button
                        key={sc.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleSchool(sc.id)}
                        aria-pressed={active}
                        className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed
                          ${active
                            ? "border-accent bg-accent text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-accent/50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"}`}
                      >
                        {sc.name} <span className="opacity-70">· {institutionLabel(sc.institutionType)}</span>
                        {sc.tenantName && <span className="opacity-50"> ({sc.tenantName})</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="mt-1.5 text-xs text-slate-500">Toggle on every school this class applies to — one submit creates it everywhere, skipping schools that already have it.</p>
            </div>

            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create"}</Button>
            </div>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal title="Edit class" onClose={() => setEditing(null)}>
          <form onSubmit={submitEdit} className="space-y-4">
            <Field id="cls-edit-name" label="Class name">
              <input id="cls-edit-name" required value={name} className={inputCls} onChange={(e) => setName(e.target.value)} disabled={!canManage} />
            </Field>
            <p className="text-xs text-slate-500">{editing.schoolName}</p>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              {canManage && <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>}
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete class?"
          message={`Permanently remove "${deleting.name}" from ${deleting.schoolName}. Classes with divisions can't be deleted until the divisions are removed.`}
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
