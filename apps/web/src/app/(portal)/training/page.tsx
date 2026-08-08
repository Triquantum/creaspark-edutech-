"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, Field, inputCls } from "@/components/ui/modal";

const ROLES = [
  "SUPER_ADMIN", "ORG_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "COORDINATOR",
  "TEACHER", "TRAINER", "ACCOUNTANT", "RECEPTION", "LIBRARIAN", "TRANSPORT_MANAGER", "HR",
  "INVENTORY_MANAGER", "HOSTEL_WARDEN", "SECURITY", "PARENT", "STUDENT", "GUEST",
] as const;

function roleLabel(role: string) {
  return role.toLowerCase().split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

interface Me { id: string; role: string }
interface SchoolOpt { id: string; name: string }
interface TrainingRow {
  id: string; title: string; description: string | null; conductedAt: string;
  targetRoles: string[]; targetSchool: { name: string } | null;
  conductedBy: { fullName: string };
  _count?: { feedback: number };
  feedback?: { id: string }[];
}
interface FeedbackResponse {
  id: string; contentRating: number; trainerRating: number; usefulnessRating: number; overallRating: number;
  comments: string | null; submittedAt: string;
  respondent: { fullName: string; role: string };
}
interface FeedbackSummary {
  responses: FeedbackResponse[];
  averages: { content: number | null; trainer: number | null; usefulness: number | null; overall: number | null };
}

function NewTrainingModal({ schools, onClose, onSaved }: { schools: SchoolOpt[]; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [conductedAt, setConductedAt] = useState("");
  const [targetRoles, setTargetRoles] = useState<Set<string>>(new Set());
  const [targetSchoolId, setTargetSchoolId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleRole(r: string) {
    setTargetRoles((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r); else next.add(r);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/trainings", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(), description: description.trim() || undefined,
          conductedAt: new Date(conductedAt).toISOString(),
          targetRoles: [...targetRoles], targetSchoolId: targetSchoolId || undefined,
        }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create training");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New training" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <Field id="tr-title" label="Title">
          <input id="tr-title" required value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </Field>
        <Field id="tr-desc" label="Description" optional>
          <textarea id="tr-desc" rows={3} className={`${inputCls} h-auto py-3`} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field id="tr-date" label="Conducted on">
            <input id="tr-date" type="date" required value={conductedAt} onChange={(e) => setConductedAt(e.target.value)} className={inputCls} />
          </Field>
          <Field id="tr-school" label="School" optional>
            <select id="tr-school" value={targetSchoolId} onChange={(e) => setTargetSchoolId(e.target.value)} className={inputCls}>
              <option value="">All schools</option>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium">Target roles <span className="text-slate-400">(none selected = everyone)</span></p>
          <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 p-3 dark:border-white/10">
            {ROLES.map((r) => {
              const active = targetRoles.has(r);
              return (
                <button
                  key={r} type="button" onClick={() => toggleRole(r)} aria-pressed={active}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors
                    ${active ? "border-accent bg-accent text-white" : "border-slate-200 bg-white text-slate-600 hover:border-accent/50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"}`}
                >
                  {roleLabel(r)}
                </button>
              );
            })}
          </div>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create training"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function FeedbackFormModal({ training, existing, onClose, onSaved }: {
  training: TrainingRow; existing: FeedbackResponse | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    contentRating: existing?.contentRating ?? 5, trainerRating: existing?.trainerRating ?? 5,
    usefulnessRating: existing?.usefulnessRating ?? 5, overallRating: existing?.overallRating ?? 5,
    comments: existing?.comments ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api(`/trainings/${training.id}/feedback`, {
        method: "POST",
        body: JSON.stringify({ ...form, comments: form.comments.trim() || undefined }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit feedback");
    } finally {
      setBusy(false);
    }
  }

  const questions: [string, "contentRating" | "trainerRating" | "usefulnessRating" | "overallRating"][] = [
    ["Content quality", "contentRating"],
    ["Trainer effectiveness", "trainerRating"],
    ["Usefulness / relevance", "usefulnessRating"],
    ["Overall satisfaction", "overallRating"],
  ];

  return (
    <Modal title={`Feedback · ${training.title}`} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-5">
        {questions.map(([label, key]) => (
          <div key={key}>
            <p className="mb-1.5 text-sm font-medium">{label}</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n} type="button" onClick={() => setForm({ ...form, [key]: n })}
                  aria-pressed={form[key] === n}
                  className={`grid h-10 w-10 place-items-center rounded-xl border text-sm font-medium transition-colors
                    ${form[key] === n ? "border-accent bg-accent text-white" : "border-slate-200 bg-white text-slate-600 hover:border-accent/50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
        <Field id="fb-comments" label="Comments" optional>
          <textarea id="fb-comments" rows={3} className={`${inputCls} h-auto py-3`} value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Submitting…" : existing ? "Update feedback" : "Submit feedback"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function FeedbackSummaryModal({ training, onClose }: { training: TrainingRow; onClose: () => void }) {
  const [data, setData] = useState<FeedbackSummary | null>(null);

  useEffect(() => {
    api<FeedbackSummary>(`/trainings/${training.id}/feedback`).then(setData).catch(() => setData({ responses: [], averages: { content: null, trainer: null, usefulness: null, overall: null } }));
  }, [training.id]);

  return (
    <Modal title={`Responses · ${training.title}`} onClose={onClose} wide>
      {!data ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {[["Content", data.averages.content], ["Trainer", data.averages.trainer], ["Usefulness", data.averages.usefulness], ["Overall", data.averages.overall]].map(([label, val]) => (
              <div key={label as string} className="rounded-xl border border-slate-100 p-3 text-center dark:border-white/10">
                <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-1 font-display text-xl font-semibold text-night dark:text-white">{val ?? "—"}</p>
              </div>
            ))}
          </div>
          {data.responses.length === 0 ? (
            <p className="text-sm text-slate-500">No responses yet.</p>
          ) : (
            <div className="space-y-2">
              {data.responses.map((r) => (
                <div key={r.id} className="rounded-xl border border-slate-100 p-3 text-sm dark:border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-night dark:text-white">{r.respondent.fullName} <span className="text-xs text-slate-400">({roleLabel(r.respondent.role)})</span></span>
                    <span className="text-xs text-slate-400">{fmtDate(r.submittedAt)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Content {r.contentRating} · Trainer {r.trainerRating} · Usefulness {r.usefulnessRating} · Overall {r.overallRating}
                  </p>
                  {r.comments && <p className="mt-1 text-slate-600 dark:text-slate-300">{r.comments}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function TrainingPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [schools, setSchools] = useState<SchoolOpt[]>([]);
  const [rows, setRows] = useState<TrainingRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [creating, setCreating] = useState(false);
  const [feedbackFor, setFeedbackFor] = useState<{ training: TrainingRow; existing: FeedbackResponse | null } | null>(null);
  const [summaryFor, setSummaryFor] = useState<TrainingRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const isSuperAdmin = me?.role === "SUPER_ADMIN";

  const load = useCallback(() => {
    setState("loading");
    api<TrainingRow[]>("/trainings").then((r) => { setRows(r); setState("ready"); }).catch(() => setState("error"));
  }, []);

  useEffect(() => {
    api<Me>("/auth/me").then(setMe).catch(() => setMe(null));
    api<SchoolOpt[]>("/academic/schools").then(setSchools).catch(() => setSchools([]));
  }, []);
  useEffect(load, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  async function openFeedback(row: TrainingRow) {
    const existing = await api<FeedbackResponse | null>(`/trainings/${row.id}/my-feedback`).catch(() => null);
    setFeedbackFor({ training: row, existing });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Training</p>
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Training &amp; Feedback</h1>
        </div>
        {isSuperAdmin && <Button onClick={() => setCreating(true)}>+ New training</Button>}
      </div>

      <Card className="p-0 overflow-hidden">
        {state === "error" && (
          <p className="p-6 text-sm text-slate-500">
            Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.
          </p>
        )}
        {state === "ready" && rows.length === 0 && (
          <p className="p-6 text-sm text-slate-500">
            {isSuperAdmin ? "No trainings created yet." : "No trainings assigned to you yet."}
          </p>
        )}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Audience</th>
                  <th className="px-4 py-3 font-medium">Conducted by</th>
                  <th className="px-4 py-3 font-medium">{isSuperAdmin ? "Responses" : "Status"}</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                    <td className="px-4 py-3 font-medium text-night dark:text-white">{row.title}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(row.conductedAt)}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {row.targetRoles.length === 0 ? "Everyone" : row.targetRoles.map(roleLabel).join(", ")}
                      {row.targetSchool && ` · ${row.targetSchool.name}`}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{row.conductedBy.fullName}</td>
                    <td className="px-4 py-3">
                      {isSuperAdmin ? (
                        <span className="text-slate-500">{row._count?.feedback ?? 0}</span>
                      ) : (row.feedback?.length ?? 0) > 0 ? (
                        <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">Submitted</span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isSuperAdmin ? (
                        <Button variant="ghost" onClick={() => setSummaryFor(row)}>View responses</Button>
                      ) : (
                        <Button variant="ghost" onClick={() => openFeedback(row)}>
                          {(row.feedback?.length ?? 0) > 0 ? "Edit feedback" : "Give feedback"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {creating && (
        <NewTrainingModal schools={schools} onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); setToast("Training created"); load(); }} />
      )}
      {feedbackFor && (
        <FeedbackFormModal
          training={feedbackFor.training} existing={feedbackFor.existing}
          onClose={() => setFeedbackFor(null)}
          onSaved={() => { setFeedbackFor(null); setToast("Feedback submitted"); load(); }}
        />
      )}
      {summaryFor && <FeedbackSummaryModal training={summaryFor} onClose={() => setSummaryFor(null)} />}

      {toast && (
        <div role="status" className="fixed bottom-6 right-6 z-50 rounded-xl bg-night px-4 py-3 text-sm text-white shadow-lift">
          {toast}
        </div>
      )}
    </div>
  );
}
