"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, apiBlob } from "@/lib/api";
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
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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
  attendance?: { present: boolean }[];
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

function EmailReportModal({ training, onClose, onSent }: { training: TrainingRow; onClose: () => void; onSent: () => void }) {
  const [toEmail, setToEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api(`/trainings/${training.id}/report/email`, { method: "POST", body: JSON.stringify({ toEmail }) });
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the report");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Email report · ${training.title}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-500">Sends the training details, feedback summary, and attendance roster as a PDF attachment.</p>
        <Field id="report-email-to" label="Recipient email">
          <input id="report-email-to" type="email" required value={toEmail} onChange={(e) => setToEmail(e.target.value)}
            placeholder="someone@example.com" className={inputCls} />
        </Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send"}</Button>
        </div>
      </form>
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
  const [emailReportFor, setEmailReportFor] = useState<TrainingRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterConductedBy, setFilterConductedBy] = useState("");

  const isSuperAdmin = me?.role === "SUPER_ADMIN";

  const subjectOptions = useMemo(
    () => [...new Set(rows.map((r) => r.subject).filter((s): s is string => !!s))].sort(),
    [rows],
  );
  const conductorOptions = useMemo(
    () => [...new Set(rows.map((r) => r.conductedBy.fullName))].sort(),
    [rows],
  );
  const filteredRows = useMemo(() => rows.filter((row) => {
    if (filterDate && toDateInput(row.conductedAt) !== filterDate) return false;
    if (filterMonth && String(new Date(row.conductedAt).getMonth() + 1).padStart(2, "0") !== filterMonth) return false;
    if (filterSubject && row.subject !== filterSubject) return false;
    if (filterStatus && row.status !== filterStatus) return false;
    if (filterConductedBy && row.conductedBy.fullName !== filterConductedBy) return false;
    return true;
  }), [rows, filterDate, filterMonth, filterSubject, filterStatus, filterConductedBy]);

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

  async function printReport(row: TrainingRow) {
    try {
      const blob = await apiBlob(`/trainings/${row.id}/report/pdf`);
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not generate the report");
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

      {rows.length > 0 && (
        <Card className="flex flex-wrap items-end gap-3 p-4">
          <Field id="tf-date" label="Date" optional>
            <input id="tf-date" type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className={inputCls} />
          </Field>
          <Field id="tf-month" label="Month" optional>
            <select id="tf-month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className={inputCls}>
              <option value="">All</option>
              {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
            </select>
          </Field>
          <Field id="tf-subject" label="Subject" optional>
            <select id="tf-subject" value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className={inputCls}>
              <option value="">All</option>
              {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field id="tf-status" label="Status" optional>
            <select id="tf-status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={inputCls}>
              <option value="">All</option>
              {TRAINING_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
          </Field>
          <Field id="tf-conductor" label="Conducted by" optional>
            <select id="tf-conductor" value={filterConductedBy} onChange={(e) => setFilterConductedBy(e.target.value)} className={inputCls}>
              <option value="">All</option>
              {conductorOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          {(filterDate || filterMonth || filterSubject || filterStatus || filterConductedBy) && (
            <Button
              type="button" variant="ghost"
              onClick={() => { setFilterDate(""); setFilterMonth(""); setFilterSubject(""); setFilterStatus(""); setFilterConductedBy(""); }}
            >
              Clear filters
            </Button>
          )}
        </Card>
      )}

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
        {state === "ready" && rows.length > 0 && filteredRows.length === 0 && (
          <p className="p-6 text-sm text-slate-500">No trainings match these filters.</p>
        )}
        {filteredRows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Audience</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Conducted by</th>
                  {!isSuperAdmin && <th className="px-4 py-3 font-medium">My attendance</th>}
                  <th className="px-4 py-3 font-medium">{isSuperAdmin ? "Responses" : "Feedback"}</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                    <td className="px-4 py-3 font-medium text-night dark:text-white">{row.title}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(row.conductedAt)}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {row.targetRoles.length === 0 ? "Everyone" : row.targetRoles.map(roleLabel).join(", ")}
                      {row.targetSchool && ` · ${row.targetSchool.name}`}
                      {row.targetClassIds.length > 0 && (
                        // Different schools can share the same grade name (e.g. "Grade 3" in
                        // several schools) -- targetClassIds itself holds distinct class IDs,
                        // but naively mapping id -> name would repeat that name once per school.
                        ` · ${[...new Set(row.targetClassIds.map((id) => classes.find((c) => c.id === id)?.name ?? id))].join(", ")}`
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
                    {!isSuperAdmin && (
                      <td className="px-4 py-3">
                        {(() => {
                          const present = row.attendance?.[0]?.present;
                          if (present === true) return <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">Present</span>;
                          if (present === false) return <span className="rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-medium text-danger">Absent</span>;
                          return <span className="text-slate-400">—</span>;
                        })()}
                      </td>
                    )}
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
                          <Button variant="ghost" onClick={() => printReport(row)}>Print / PDF</Button>
                          <Button variant="ghost" onClick={() => setEmailReportFor(row)}>Email report</Button>
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
      {emailReportFor && (
        <EmailReportModal
          training={emailReportFor} onClose={() => setEmailReportFor(null)}
          onSent={() => { setEmailReportFor(null); setToast("Report emailed"); }}
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
