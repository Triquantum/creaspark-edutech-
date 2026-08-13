"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, RowActions, Field, inputCls } from "@/components/ui/modal";

const MANAGE_ROLES = new Set(["SUPER_ADMIN", "ORG_ADMIN"]);

interface EntryRow {
  id: string; rowIndex: number; term: string | null; month: string | null; week: string | null;
  workingDays: number | null; instructedDays: number | null; subject: string | null; unitChapter: string | null;
  learningOutcome: string | null; activity: string | null; sdgMapping: string | null; skills: string | null;
  values: string | null; digitalContent: string | null; assessment: string | null; remarks: string | null;
}
interface GradeDetail { id: string; academicYear: string; gradeLabel: string; entries: EntryRow[] }
interface Me { role: string }

const FIELD_LABELS: { key: keyof EntryRow; label: string }[] = [
  { key: "term", label: "Term" }, { key: "workingDays", label: "Working days" }, { key: "instructedDays", label: "Instructed days" },
  { key: "subject", label: "Subject" }, { key: "sdgMapping", label: "SDG mapping" }, { key: "skills", label: "Skills" },
  { key: "values", label: "Values" }, { key: "digitalContent", label: "Digital content" }, { key: "assessment", label: "Assessment" },
  { key: "remarks", label: "Remarks" },
];

function EntryEditModal({ entry, onClose, onSaved }: { entry: EntryRow; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    term: entry.term ?? "", month: entry.month ?? "", week: entry.week ?? "",
    subject: entry.subject ?? "", unitChapter: entry.unitChapter ?? "", learningOutcome: entry.learningOutcome ?? "",
    activity: entry.activity ?? "", sdgMapping: entry.sdgMapping ?? "", skills: entry.skills ?? "", values: entry.values ?? "",
    digitalContent: entry.digitalContent ?? "", assessment: entry.assessment ?? "", remarks: entry.remarks ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api(`/academic/yearly-plan/entries/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify(Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || undefined]))),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`${form.month || "Week"} ${form.week || ""}`} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Field id="e-term" label="Term" optional><input id="e-term" value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} className={inputCls} /></Field>
          <Field id="e-month" label="Month"><input id="e-month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} className={inputCls} /></Field>
          <Field id="e-week" label="Week"><input id="e-week" value={form.week} onChange={(e) => setForm({ ...form, week: e.target.value })} className={inputCls} /></Field>
        </div>
        <Field id="e-subject" label="Subject" optional><input id="e-subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className={inputCls} /></Field>
        <Field id="e-chapter" label="Unit / Chapter" optional><textarea id="e-chapter" rows={2} className={`${inputCls} h-auto py-3`} value={form.unitChapter} onChange={(e) => setForm({ ...form, unitChapter: e.target.value })} /></Field>
        <Field id="e-outcome" label="Learning outcome" optional><textarea id="e-outcome" rows={2} className={`${inputCls} h-auto py-3`} value={form.learningOutcome} onChange={(e) => setForm({ ...form, learningOutcome: e.target.value })} /></Field>
        <Field id="e-activity" label="Activity / Project" optional><textarea id="e-activity" rows={2} className={`${inputCls} h-auto py-3`} value={form.activity} onChange={(e) => setForm({ ...form, activity: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field id="e-sdg" label="SDG mapping" optional><input id="e-sdg" value={form.sdgMapping} onChange={(e) => setForm({ ...form, sdgMapping: e.target.value })} className={inputCls} /></Field>
          <Field id="e-digital" label="Digital content" optional><input id="e-digital" value={form.digitalContent} onChange={(e) => setForm({ ...form, digitalContent: e.target.value })} className={inputCls} /></Field>
          <Field id="e-skills" label="Skills" optional><input id="e-skills" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} className={inputCls} /></Field>
          <Field id="e-values" label="Values" optional><input id="e-values" value={form.values} onChange={(e) => setForm({ ...form, values: e.target.value })} className={inputCls} /></Field>
        </div>
        <Field id="e-assessment" label="Assessment" optional><textarea id="e-assessment" rows={2} className={`${inputCls} h-auto py-3`} value={form.assessment} onChange={(e) => setForm({ ...form, assessment: e.target.value })} /></Field>
        <Field id="e-remarks" label="Remarks" optional><textarea id="e-remarks" rows={2} className={`${inputCls} h-auto py-3`} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function EntryViewModal({ entry, onClose }: { entry: EntryRow; onClose: () => void }) {
  return (
    <Modal title={`${entry.month || "Week"} · ${entry.week || ""}`} onClose={onClose} wide>
      <div className="space-y-4 text-sm">
        {entry.unitChapter && <div><p className="text-xs text-slate-400">Unit / Chapter</p><p className="mt-1 whitespace-pre-wrap text-night dark:text-white">{entry.unitChapter}</p></div>}
        {entry.learningOutcome && <div><p className="text-xs text-slate-400">Learning outcome</p><p className="mt-1 whitespace-pre-wrap text-slate-600 dark:text-slate-300">{entry.learningOutcome}</p></div>}
        {entry.activity && <div><p className="text-xs text-slate-400">Activity / Project</p><p className="mt-1 whitespace-pre-wrap text-slate-600 dark:text-slate-300">{entry.activity}</p></div>}
        <div className="grid grid-cols-2 gap-3">
          {FIELD_LABELS.map(({ key, label }) => entry[key] != null && entry[key] !== "" ? (
            <div key={key}><p className="text-xs text-slate-400">{label}</p><p className="mt-0.5 text-night dark:text-white">{String(entry[key])}</p></div>
          ) : null)}
        </div>
        <div className="flex justify-end"><Button variant="ghost" onClick={onClose}>Close</Button></div>
      </div>
    </Modal>
  );
}

export default function YearlyPlanDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [grade, setGrade] = useState<GradeDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [viewing, setViewing] = useState<EntryRow | null>(null);
  const [editing, setEditing] = useState<EntryRow | null>(null);
  const [deleting, setDeleting] = useState<EntryRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    setState("loading");
    api<GradeDetail>(`/academic/yearly-plan/grades/${params.id}`).then((r) => { setGrade(r); setState("ready"); }).catch(() => setState("error"));
  }, [params.id]);
  useEffect(() => { api<Me>("/auth/me").then(setMe).catch(() => {}); }, []);
  useEffect(load, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  const canManage = !!me && MANAGE_ROLES.has(me.role);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/academic/yearly-plan/entries/${deleting.id}`, { method: "DELETE" });
      setToast("Week removed");
      setDeleting(null);
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button onClick={() => router.push("/academic/yearly-plan")} className="text-xs font-medium uppercase tracking-widest text-slate-400 hover:text-accent">← Yearly Plan</button>
          <h1 className="mt-1 font-display text-2xl font-semibold text-night dark:text-white">{grade ? `${grade.gradeLabel} · ${grade.academicYear}` : "Loading…"}</h1>
        </div>
      </div>

      {state === "error" && <p className="text-sm text-slate-500">Couldn&apos;t load this plan.</p>}

      {grade && (
        <Card className="p-0 overflow-hidden">
          {grade.entries.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No weeks added yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr className="border-b border-slate-100 dark:border-white/5">
                    <th className="px-4 py-3 font-medium">Month</th>
                    <th className="px-4 py-3 font-medium">Week</th>
                    {grade.entries.some((e) => e.subject) && <th className="px-4 py-3 font-medium">Subject</th>}
                    <th className="px-4 py-3 font-medium">Unit / Chapter</th>
                    <th className="px-4 py-3 font-medium">Learning Outcome</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {grade.entries.map((e) => (
                    <tr key={e.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                      <td className="px-4 py-3 text-slate-500">{e.month ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{e.week ?? "—"}</td>
                      {grade.entries.some((x) => x.subject) && <td className="px-4 py-3 text-slate-500">{e.subject ?? "—"}</td>}
                      <td className="px-4 py-3 font-medium text-night dark:text-white">{(e.unitChapter ?? "—").slice(0, 60)}{(e.unitChapter?.length ?? 0) > 60 ? "…" : ""}</td>
                      <td className="px-4 py-3 text-slate-500">{(e.learningOutcome ?? "—").slice(0, 60)}{(e.learningOutcome?.length ?? 0) > 60 ? "…" : ""}</td>
                      <td className="px-4 py-3">
                        <RowActions onView={() => setViewing(e)} onEdit={canManage ? () => setEditing(e) : undefined} onDelete={canManage ? () => setDeleting(e) : undefined} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {viewing && <EntryViewModal entry={viewing} onClose={() => setViewing(null)} />}
      {editing && <EntryEditModal entry={editing} onClose={() => setEditing(null)} onSaved={() => { setToast("Saved"); setEditing(null); load(); }} />}
      {deleting && (
        <ConfirmDialog
          title="Remove this week?"
          message={`Remove ${deleting.month ?? ""} ${deleting.week ?? ""} from the plan?`}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
          busy={busy}
        />
      )}
      {toast && <div role="status" className="fixed bottom-6 right-6 z-50 rounded-xl bg-night px-4 py-3 text-sm text-white shadow-lift">{toast}</div>}
    </div>
  );
}
