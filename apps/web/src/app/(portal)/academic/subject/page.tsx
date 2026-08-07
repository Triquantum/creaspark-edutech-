"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, RowActions, Field, inputCls } from "@/components/ui/modal";

interface SchoolOpt { id: string; name: string; code: string; institutionType: string; tenantName?: string }
interface SubjectRow {
  id: string; name: string; code: string | null;
  schoolIds: string[];
  schools: { id: string; name: string; code: string; institutionType: string; tenant: { name: string } }[];
}

const MANAGE_ROLES = ["SUPER_ADMIN", "ORG_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "COORDINATOR"];

function institutionLabel(t: string) {
  return t === "SCHOOL" ? "School" : t === "COLLEGE" ? "College" : t === "INSTITUTE" ? "Institute" : t;
}

export default function SubjectsPage() {
  const [rows, setRows] = useState<SubjectRow[]>([]);
  const [schools, setSchools] = useState<SchoolOpt[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [myRole, setMyRole] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ mode: "add" } | { mode: "edit"; row: SubjectRow } | null>(null);
  const [deleting, setDeleting] = useState<SubjectRow | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const canManage = myRole !== null && MANAGE_ROLES.includes(myRole);

  const load = useCallback(() => {
    setState("loading");
    api<SubjectRow[]>("/academic/subjects").then((r) => { setRows(r); setState("ready"); }).catch(() => setState("error"));
  }, []);

  useEffect(load, [load]);
  useEffect(() => {
    api<{ role: string }>("/auth/me").then((r) => setMyRole(r.role)).catch(() => setMyRole(null));
    api<SchoolOpt[]>("/academic/schools").then(setSchools).catch(() => setSchools([]));
  }, []);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  function openDialog(d: { mode: "add" } | { mode: "edit"; row: SubjectRow }) {
    setError(null);
    setName(d.mode === "edit" ? d.row.name : "");
    setCode(d.mode === "edit" ? d.row.code ?? "" : "");
    setSelectedSchoolIds(new Set(d.mode === "edit" ? d.row.schoolIds : []));
    setDialog(d);
  }

  function toggleSchool(id: string) {
    setSelectedSchoolIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (selectedSchoolIds.size === 0) { setError("Toggle on at least one school, college or institute."); return; }
    setBusy(true);
    const body = { name: name.trim(), code: code.trim() || undefined, schoolIds: [...selectedSchoolIds] };
    try {
      if (dialog?.mode === "add") {
        await api("/academic/subjects", { method: "POST", body: JSON.stringify(body) });
        setToast("Subject added");
      } else if (dialog?.mode === "edit") {
        await api(`/academic/subjects/${dialog.row.id}`, { method: "PATCH", body: JSON.stringify(body) });
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
      await api(`/academic/subjects/${deleting.id}`, { method: "DELETE" });
      setToast("Subject deleted");
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
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Subjects</h1>
        </div>
        {canManage && <Button onClick={() => openDialog({ mode: "add" })}>Add subject</Button>}
      </div>

      <Card className="p-0 overflow-hidden">
        {state === "error" && (
          <p className="p-6 text-sm text-slate-500">
            Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.
          </p>
        )}
        {state === "ready" && rows.length === 0 && (
          <p className="p-6 text-sm text-slate-500">Nothing here yet — add the first subject.</p>
        )}
        {rows.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Assigned to</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-50 dark:border-white/5 transition-colors hover:bg-surface dark:hover:bg-white/5">
                  <td className="px-4 py-3 font-medium text-night dark:text-white">{row.name}</td>
                  <td className="px-4 py-3 text-slate-500">{row.code ?? "—"}</td>
                  <td className="px-4 py-3">
                    {row.schools.length === 0 ? (
                      <span className="text-slate-400">Not assigned</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {row.schools.map((sc) => (
                          <span key={sc.id} className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                            {sc.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/academic/subject/${row.id}/content`}
                        aria-label={`Manage ${row.name} content`}
                        title="Lessons, assignments & quizzes"
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-black/5 hover:text-night dark:hover:bg-white/10 dark:hover:text-white transition-colors"
                      >
                        <BookOpen size={15} />
                      </Link>
                      <RowActions
                        onView={() => openDialog({ mode: "edit", row })}
                        onEdit={canManage ? () => openDialog({ mode: "edit", row }) : undefined}
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

      {dialog && (
        <Modal title={dialog.mode === "add" ? "Add subject" : "Edit subject"} onClose={() => setDialog(null)} wide>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field id="subj-name" label="Subject name">
                <input id="subj-name" required value={name} placeholder="Mathematics" className={inputCls}
                  onChange={(e) => setName(e.target.value)} disabled={!canManage} />
              </Field>
              <Field id="subj-code" label="Code" optional>
                <input id="subj-code" value={code} placeholder="MATH" className={inputCls}
                  onChange={(e) => setCode(e.target.value)} disabled={!canManage} />
              </Field>
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium">Assign to schools / colleges / institutes</p>
              {schools.length === 0 ? (
                <p className="text-sm text-slate-500">No registered schools yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 p-3 dark:border-white/10">
                  {schools.map((sc) => {
                    const active = selectedSchoolIds.has(sc.id);
                    return (
                      <button
                        key={sc.id}
                        type="button"
                        disabled={!canManage}
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
            </div>

            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
              {canManage && <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>}
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete subject?"
          message={`This permanently removes "${deleting.name}". Subjects used in exams can't be deleted.`}
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
