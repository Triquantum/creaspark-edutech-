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
interface ClassOpt { id: string; name: string; schoolId: string; schoolName: string }
const TRAINING_STATUSES = ["SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED"] as const;
type TrainingStatusValue = (typeof TRAINING_STATUSES)[number];

function statusLabel(status: string) {
  return status[0] + status.slice(1).toLowerCase();
}
function statusBadgeCls(status: string) {
  switch (status) {
    case "ONGOING": return "bg-accent/10 text-accent";
    case "COMPLETED": return "bg-success/10 text-success";
    case "CANCELLED": return "bg-danger/10 text-danger";
    default: return "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300";
  }
}

interface TrainingRow {
  id: string; title: string; description: string | null; subject: string | null;
  venue: string | null; duration: string | null; resourcePerson: string | null; agenda: string | null;
  status: TrainingStatusValue;
  conductedAt: string;
  targetRoles: string[]; targetSchoolId: string | null; targetSchool: { name: string } | null;
  targetClassIds: string[];
  conductedBy: { fullName: string };
  _count?: { feedback: number };
  feedback?: { id: string }[];
}
interface AttendanceRow {
  userId: string; fullName: string; role: string; schoolName: string | null;
  present: boolean | null; markedAt: string | null;
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

function toDateInput(iso: string) {
  return iso.slice(0, 10);
}

function TrainingFormModal({ schools, classes, existing, onClose, onSaved }: {
  schools: SchoolOpt[]; classes: ClassOpt[]; existing?: TrainingRow; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [subject, setSubject] = useState(existing?.subject ?? "");
  const [status, setStatus] = useState<TrainingStatusValue>(existing?.status ?? "SCHEDULED");
  const [venue, setVenue] = useState(existing?.venue ?? "");
  const [duration, setDuration] = useState(existing?.duration ?? "");
  const [resourcePerson, setResourcePerson] = useState(existing?.resourcePerson ?? "");
  const [agenda, setAgenda] = useState(existing?.agenda ?? "");
  const [conductedAt, setConductedAt] = useState(existing ? toDateInput(existing.conductedAt) : "");
  const [targetRoles, setTargetRoles] = useState<Set<string>>(new Set(existing?.targetRoles ?? []));
  const [targetSchoolId, setTargetSchoolId] = useState(existing?.targetSchoolId ?? "");
  const [classMode, setClassMode] = useState<"ALL" | "SPECIFIC">((existing?.targetClassIds.length ?? 0) > 0 ? "SPECIFIC" : "ALL");
  const [targetClassIds, setTargetClassIds] = useState<Set<string>>(new Set(existing?.targetClassIds ?? []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleClasses = targetSchoolId ? classes.filter((c) => c.schoolId === targetSchoolId) : classes;

  function toggleRole(r: string) {
    setTargetRoles((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r); else next.add(r);
      return next;
    });
  }

  function toggleClass(id: string) {
    setTargetClassIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const body = {
        title: title.trim(), description: description.trim() || undefined,
        subject: subject.trim() || undefined, status,
        venue: venue.trim() || undefined, duration: duration.trim() || undefined,
        resourcePerson: resourcePerson.trim() || undefined, agenda: agenda.trim() || undefined,
        conductedAt: new Date(conductedAt).toISOString(),
        targetRoles: [...targetRoles], targetSchoolId: targetSchoolId || undefined,
        targetClassIds: classMode === "SPECIFIC" ? [...targetClassIds] : [],
      };
      if (existing) {
        await api(`/trainings/${existing.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await api("/trainings", { method: "POST", body: JSON.stringify(body) });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not ${existing ? "update" : "create"} training`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={existing ? `Edit training · ${existing.title}` : "New training"} onClose={onClose} wide>
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
        <div className="grid grid-cols-2 gap-4">
          <Field id="tr-subject" label="Subject" optional>
            <input id="tr-subject" placeholder="e.g. Classroom Management" value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} />
          </Field>
          <Field id="tr-status" label="Status">
            <select id="tr-status" value={status} onChange={(e) => setStatus(e.target.value as TrainingStatusValue)} className={inputCls}>
              {TRAINING_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field id="tr-venue" label="Venue" optional>
            <input id="tr-venue" value={venue} onChange={(e) => setVenue(e.target.value)} className={inputCls} />
          </Field>
          <Field id="tr-duration" label="Duration" optional>
            <input id="tr-duration" placeholder="e.g. 9am - 1pm" value={duration} onChange={(e) => setDuration(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Field id="tr-resource-person" label="Resource person / Trainer" optional>
          <input id="tr-resource-person" value={resourcePerson} onChange={(e) => setResourcePerson(e.target.value)} className={inputCls} />
        </Field>
        <Field id="tr-agenda" label="Agenda" optional>
          <textarea id="tr-agenda" rows={3} className={`${inputCls} h-auto py-3`} value={agenda} onChange={(e) => setAgenda(e.target.value)} />
        </Field>
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
        <div>
          <p className="mb-1.5 text-sm font-medium">
            Applicable grades / classes
            <span className="text-slate-400"> (controls which teachers see this in Attendance)</span>
          </p>
          <div className="mb-2 flex gap-2">
            <button
              type="button" onClick={() => setClassMode("ALL")} aria-pressed={classMode === "ALL"}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors
                ${classMode === "ALL" ? "border-accent bg-accent text-white" : "border-slate-200 bg-white text-slate-600 hover:border-accent/50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"}`}
            >
              All classes
            </button>
            <button
              type="button" onClick={() => setClassMode("SPECIFIC")} aria-pressed={classMode === "SPECIFIC"}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors
                ${classMode === "SPECIFIC" ? "border-accent bg-accent text-white" : "border-slate-200 bg-white text-slate-600 hover:border-accent/50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"}`}
            >
              Specific classes
            </button>
          </div>
          {classMode === "SPECIFIC" && (
            <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 p-3 dark:border-white/10">
              {visibleClasses.length === 0 ? (
                <p className="text-sm text-slate-400">No classes found{targetSchoolId ? " for the selected school" : ""}.</p>
              ) : (
                visibleClasses.map((c) => {
                  const active = targetClassIds.has(c.id);
                  return (
                    <button
                      key={c.id} type="button" onClick={() => toggleClass(c.id)} aria-pressed={active}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors
                        ${active ? "border-accent bg-accent text-white" : "border-slate-200 bg-white text-slate-600 hover:border-accent/50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"}`}
                    >
                      {c.name}{!targetSchoolId && ` · ${c.schoolName}`}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>
            {busy ? (existing ? "Saving…" : "Creating…") : existing ? "Save changes" : "Create training"}
          </Button>
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

function AttendanceModal({ training, onClose, onSaved }: { training: TrainingRow; onClose: () => void; onSaved: () => void }) {
  const [rows, setRows] = useState<AttendanceRow[] | null>(null);
  const [marks, setMarks] = useState<Map<string, boolean>>(new Map());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<AttendanceRow[]>(`/trainings/${training.id}/attendance`).then((r) => {
      setRows(r);
      setMarks(new Map(r.filter((row) => row.present !== null).map((row) => [row.userId, row.present as boolean])));
    }).catch(() => setRows([]));
  }, [training.id]);

  function setMark(userId: string, present: boolean) {
    setMarks((prev) => new Map(prev).set(userId, present));
  }

  async function save() {
    setError(null);
    setBusy(true);
    try {
      await api(`/trainings/${training.id}/attendance`, {
        method: "POST",
        body: JSON.stringify({ records: [...marks.entries()].map(([userId, present]) => ({ userId, present })) }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save attendance");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Attendance · ${training.title}`} onClose={onClose} wide>
      {!rows ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">No one is targeted by this training yet.</p>
      ) : (
        <div className="space-y-4">
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {rows.map((row) => {
              const mark = marks.get(row.userId);
              return (
                <div key={row.userId} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-sm dark:border-white/10">
                  <div>
                    <p className="font-medium text-night dark:text-white">{row.fullName}</p>
                    <p className="text-xs text-slate-400">{roleLabel(row.role)}{row.schoolName && ` · ${row.schoolName}`}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button" onClick={() => setMark(row.userId, true)} aria-pressed={mark === true}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors
                        ${mark === true ? "border-success bg-success text-white" : "border-slate-200 bg-white text-slate-600 hover:border-success/50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"}`}
                    >
                      Present
                    </button>
                    <button
                      type="button" onClick={() => setMark(row.userId, false)} aria-pressed={mark === false}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors
                        ${mark === false ? "border-danger bg-danger text-white" : "border-slate-200 bg-white text-slate-600 hover:border-danger/50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"}`}
                    >
                      Absent
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
            <Button type="button" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save attendance"}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function TrainingPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [schools, setSchools] = useState<SchoolOpt[]>([]);
  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [rows, setRows] = useState<TrainingRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [creating, setCreating] = useState(false);
  const [editingFor, setEditingFor] = useState<TrainingRow | null>(null);
  const [feedbackFor, setFeedbackFor] = useState<{ training: TrainingRow; existing: FeedbackResponse | null } | null>(null);
  const [summaryFor, setSummaryFor] = useState<TrainingRow | null>(null);
  const [attendanceFor, setAttendanceFor] = useState<TrainingRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const isSuperAdmin = me?.role === "SUPER_ADMIN";

  const load = useCallback(() => {
    setState("loading");
    api<TrainingRow[]>("/trainings").then((r) => { setRows(r); setState("ready"); }).catch(() => setState("error"));
  }, []);

  useEffect(() => {
    api<Me>("/auth/me").then(setMe).catch(() => setMe(null));
    api<SchoolOpt[]>("/academic/schools").then(setSchools).catch(() => setSchools([]));
    api<ClassOpt[]>("/academic/classes").then(setClasses).catch(() => setClasses([]));
  }, []);
  useEffect(load, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  async function openFeedback(row: TrainingRow) {
    const existing = await api<FeedbackResponse | null>(`/trainings/${row.id}/my-feedback`).catch(() => null);
    setFeedbackFor({ training: row, existing });
  }

  async function changeStatus(row: TrainingRow, status: TrainingStatusValue) {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status } : r)));
    try {
      await api(`/trainings/${row.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    } catch {
      load();
    }
  }

  async function deleteTraining(row: TrainingRow) {
    if (!window.confirm(`Delete "${row.title}"? This also removes its attendance and feedback records.`)) return;
    try {
      await api(`/trainings/${row.id}`, { method: "DELETE" });
      setToast("Training deleted");
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not delete training");
    }
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
                  <th className="px-4 py-3 font-medium">Status</th>
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
                      {row.targetClassIds.length > 0 && (
                        ` · ${row.targetClassIds.map((id) => classes.find((c) => c.id === id)?.name ?? id).join(", ")}`
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isSuperAdmin ? (
                        <select
                          value={row.status} onChange={(e) => changeStatus(row, e.target.value as TrainingStatusValue)}
                          className={`rounded-full border-0 px-2.5 py-0.5 text-xs font-medium ${statusBadgeCls(row.status)}`}
                        >
                          {TRAINING_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                        </select>
                      ) : (
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeCls(row.status)}`}>{statusLabel(row.status)}</span>
                      )}
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
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" onClick={() => setAttendanceFor(row)}>Attendance</Button>
                          <Button variant="ghost" onClick={() => setSummaryFor(row)}>View responses</Button>
                          <Button variant="ghost" onClick={() => setEditingFor(row)}>Edit</Button>
                          <Button variant="ghost" className="text-danger" onClick={() => deleteTraining(row)}>Delete</Button>
                        </div>
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
        <TrainingFormModal schools={schools} classes={classes} onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); setToast("Training created"); load(); }} />
      )}
      {editingFor && (
        <TrainingFormModal schools={schools} classes={classes} existing={editingFor} onClose={() => setEditingFor(null)}
          onSaved={() => { setEditingFor(null); setToast("Training updated"); load(); }} />
      )}
      {feedbackFor && (
        <FeedbackFormModal
          training={feedbackFor.training} existing={feedbackFor.existing}
          onClose={() => setFeedbackFor(null)}
          onSaved={() => { setFeedbackFor(null); setToast("Feedback submitted"); load(); }}
        />
      )}
      {summaryFor && <FeedbackSummaryModal training={summaryFor} onClose={() => setSummaryFor(null)} />}
      {attendanceFor && (
        <AttendanceModal
          training={attendanceFor} onClose={() => setAttendanceFor(null)}
          onSaved={() => { setAttendanceFor(null); setToast("Attendance saved"); }}
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
