"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, Field, inputCls } from "@/components/ui/modal";
import { api, apiBlob } from "@/lib/api";

interface Me { role: string }
interface Option { id: string; name: string }
interface PortionReport {
  id: string; period: "DAILY" | "WEEKLY"; periodDate: string;
  subjectId: string; classId: string | null; sectionId: string | null;
  chapterName: string | null; description: string | null; topicsCovered: string;
  percentComplete: number | null; status: "SUBMITTED" | "REVIEWED" | "FLAGGED";
  mode: "PRACTICAL" | "THEORY" | null; completionStatus: "PENDING" | "IN_PROGRESS" | "COMPLETED" | null;
  reviewNote: string | null;
  reviewComments: string | null;
  reviewRemarks: string | null;
  subject?: { name: string }; class?: { name: string } | null; section?: { name: string } | null;
  school?: { name: string } | null;
  teacher?: { fullName: string; email: string }; reviewer?: { fullName: string } | null;
}

const REVIEW_ROLES = new Set(["SUPER_ADMIN", "ORG_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "COORDINATOR"]);

const STATUS_STYLE: Record<PortionReport["status"], string> = {
  SUBMITTED: "bg-warning/15 text-warning",
  REVIEWED: "bg-success/15 text-success",
  FLAGGED: "bg-danger/15 text-danger",
};

function StatusBadge({ status }: { status: PortionReport["status"] }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[status]}`}>{status}</span>;
}

const COMPLETION_STYLE: Record<NonNullable<PortionReport["completionStatus"]>, string> = {
  PENDING: "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  IN_PROGRESS: "bg-accent/15 text-accent",
  COMPLETED: "bg-success/15 text-success",
};
const COMPLETION_LABEL: Record<NonNullable<PortionReport["completionStatus"]>, string> = {
  PENDING: "Pending", IN_PROGRESS: "In Progress", COMPLETED: "Completed",
};

function CompletionBadge({ status }: { status: PortionReport["completionStatus"] }) {
  if (!status) return <span className="text-slate-400">—</span>;
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${COMPLETION_STYLE[status]}`}>{COMPLETION_LABEL[status]}</span>;
}

function ModeBadge({ mode }: { mode: PortionReport["mode"] }) {
  if (!mode) return <span className="text-slate-400">—</span>;
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${mode === "PRACTICAL" ? "bg-primary/10 text-primary" : "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300"}`}>
      {mode === "PRACTICAL" ? "Practical (Lab)" : "Theory (Class)"}
    </span>
  );
}

interface FilterValues {
  subjectId: string; classId: string; month: string; year: string; completionStatus: string;
}
const BLANK_FILTERS: FilterValues = { subjectId: "", classId: "", month: "", year: "", completionStatus: "" };
const MONTH_OPTIONS = [
  { value: "1", label: "January" }, { value: "2", label: "February" }, { value: "3", label: "March" },
  { value: "4", label: "April" }, { value: "5", label: "May" }, { value: "6", label: "June" },
  { value: "7", label: "July" }, { value: "8", label: "August" }, { value: "9", label: "September" },
  { value: "10", label: "October" }, { value: "11", label: "November" }, { value: "12", label: "December" },
];

/** Shared by the teacher's own list and the reviewer's list. School/teacher
 * are reviewer-only dimensions (a teacher's own submissions are already
 * scoped to themself and their one school) — pass those two props only
 * from ReviewTable to opt them in. */
function PortionFilterBar({
  searchInput, onSearchInputChange, values, onChange, subjects, classes,
  schools, schoolId, onSchoolChange, teachers, teacherId, onTeacherChange,
}: {
  searchInput: string; onSearchInputChange: (v: string) => void;
  values: FilterValues; onChange: (next: FilterValues) => void;
  subjects: Option[]; classes: Option[];
  schools?: Option[]; schoolId?: string; onSchoolChange?: (v: string) => void;
  teachers?: Option[]; teacherId?: string; onTeacherChange?: (v: string) => void;
}) {
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];
  return (
    <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4 dark:border-white/5">
      <input
        value={searchInput} onChange={(e) => onSearchInputChange(e.target.value)}
        placeholder="Search chapter or topics…" aria-label="Search portion status"
        className={`${inputCls} max-w-[14rem]`}
      />
      {schools && (
        <select value={schoolId ?? ""} onChange={(e) => onSchoolChange?.(e.target.value)}
          aria-label="Filter by school" className={`${inputCls} max-w-[10rem]`}>
          <option value="">All schools</option>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
      {teachers && (
        <select value={teacherId ?? ""} onChange={(e) => onTeacherChange?.(e.target.value)}
          aria-label="Filter by teacher" className={`${inputCls} max-w-[10rem]`}>
          <option value="">All teachers</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}
      <select value={values.subjectId} onChange={(e) => onChange({ ...values, subjectId: e.target.value })}
        aria-label="Filter by subject" className={`${inputCls} max-w-[10rem]`}>
        <option value="">All subjects</option>
        {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <select value={values.classId} onChange={(e) => onChange({ ...values, classId: e.target.value })}
        aria-label="Filter by class" className={`${inputCls} max-w-[10rem]`}>
        <option value="">All classes</option>
        {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select value={values.month} onChange={(e) => onChange({ ...values, month: e.target.value })}
        aria-label="Filter by month" className={`${inputCls} max-w-[9rem]`}>
        <option value="">Any month</option>
        {MONTH_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>
      <select value={values.year} onChange={(e) => onChange({ ...values, year: e.target.value })}
        aria-label="Filter by year" className={`${inputCls} max-w-[7rem]`}>
        <option value="">Any year</option>
        {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
      </select>
      <select value={values.completionStatus} onChange={(e) => onChange({ ...values, completionStatus: e.target.value })}
        aria-label="Filter by portion status" className={`${inputCls} max-w-[11rem]`}>
        <option value="">Any portion status</option>
        <option value="PENDING">Pending</option>
        <option value="IN_PROGRESS">In Progress</option>
        <option value="COMPLETED">Completed</option>
      </select>
    </div>
  );
}

function SubmitForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [subjects, setSubjects] = useState<Option[]>([]);
  const [classes, setClasses] = useState<Option[]>([]);
  const [sections, setSections] = useState<(Option & { classId: string })[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [period, setPeriod] = useState<"DAILY" | "WEEKLY">("DAILY");
  const [periodDate, setPeriodDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [chapterName, setChapterName] = useState("");
  const [description, setDescription] = useState("");
  const [topicsCovered, setTopicsCovered] = useState("");
  const [percentComplete, setPercentComplete] = useState("");
  const [mode, setMode] = useState<"PRACTICAL" | "THEORY">("THEORY");
  const [completionStatus, setCompletionStatus] = useState<"PENDING" | "IN_PROGRESS" | "COMPLETED">("IN_PROGRESS");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Option[]>("/academic/subjects").then(setSubjects).catch(() => {});
    api<Option[]>("/academic/classes").then(setClasses).catch(() => {});
    api<(Option & { classId: string })[]>("/academic/sections").then(setSections).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/portion", {
        method: "POST",
        body: JSON.stringify({
          subjectId, classId: classId || undefined, sectionId: sectionId || undefined,
          period, periodDate, chapterName, description: description || undefined, topicsCovered,
          percentComplete: percentComplete ? Number(percentComplete) : undefined,
          mode, completionStatus,
        }),
      });
      setChapterName("");
      setDescription("");
      setTopicsCovered("");
      setPercentComplete("");
      setCompletionStatus("IN_PROGRESS");
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  }

  const sectionsForClass = sections.filter((s) => s.classId === classId);

  return (
    <Card>
      <h2 className="font-display font-semibold text-night dark:text-white">Submit portion status</h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="pf-subject" label="Subject">
            <select id="pf-subject" required value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={inputCls}>
              <option value="" disabled>Select subject</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field id="pf-period" label="Period">
            <select id="pf-period" value={period} onChange={(e) => setPeriod(e.target.value as "DAILY" | "WEEKLY")} className={inputCls}>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
            </select>
          </Field>
          <Field id="pf-class" label="Class" optional>
            <select id="pf-class" value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(""); }} className={inputCls}>
              <option value="">Any</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field id="pf-section" label="Division" optional>
            <select id="pf-section" value={sectionId} onChange={(e) => setSectionId(e.target.value)} className={inputCls} disabled={!classId}>
              <option value="">Any</option>
              {sectionsForClass.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field id="pf-date" label={period === "DAILY" ? "Date" : "Week starting"}>
            <input id="pf-date" type="date" required value={periodDate} onChange={(e) => setPeriodDate(e.target.value)} className={inputCls} />
          </Field>
          <Field id="pf-percent" label="Syllabus complete (%)" optional>
            <input id="pf-percent" type="number" min={0} max={100} value={percentComplete}
              onChange={(e) => setPercentComplete(e.target.value)} placeholder="e.g. 65" className={inputCls} />
          </Field>
          <Field id="pf-chapter" label="Chapter / Portion name">
            <input id="pf-chapter" required value={chapterName} onChange={(e) => setChapterName(e.target.value)}
              placeholder="e.g. Chapter 4 — Fractions" className={inputCls} />
          </Field>
          <Field id="pf-mode" label="Mode">
            <select id="pf-mode" value={mode} onChange={(e) => setMode(e.target.value as "PRACTICAL" | "THEORY")} className={inputCls}>
              <option value="THEORY">Theory (from Class)</option>
              <option value="PRACTICAL">Practical (on Lab)</option>
            </select>
          </Field>
          <Field id="pf-completion" label="Portion status">
            <select id="pf-completion" value={completionStatus}
              onChange={(e) => setCompletionStatus(e.target.value as "PENDING" | "IN_PROGRESS" | "COMPLETED")} className={inputCls}>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </Field>
        </div>
        <Field id="pf-description" label="Chapter description" optional>
          <textarea id="pf-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="What this chapter covers overall" className={`${inputCls} h-auto py-2.5`} />
        </Field>
        <Field id="pf-topics" label="Topics covered">
          <textarea id="pf-topics" required rows={3} value={topicsCovered} onChange={(e) => setTopicsCovered(e.target.value)}
            placeholder="What was taught in this period" className={`${inputCls} h-auto py-2.5`} />
        </Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit"}</Button>
      </form>
    </Card>
  );
}

function MyReports({ reloadKey }: { reloadKey: number }) {
  const [reports, setReports] = useState<PortionReport[]>([]);
  const [subjects, setSubjects] = useState<Option[]>([]);
  const [classes, setClasses] = useState<Option[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<FilterValues>(BLANK_FILTERS);
  const [viewing, setViewing] = useState<PortionReport | null>(null);

  useEffect(() => {
    api<Option[]>("/academic/subjects").then(setSubjects).catch(() => {});
    api<Option[]>("/academic/classes").then(setClasses).catch(() => {});
  }, []);

  useEffect(() => { const t = setTimeout(() => setQ(searchInput.trim()), 250); return () => clearTimeout(t); }, [searchInput]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (filters.subjectId) params.set("subjectId", filters.subjectId);
    if (filters.classId) params.set("classId", filters.classId);
    if (filters.month) params.set("month", filters.month);
    if (filters.year) params.set("year", filters.year);
    if (filters.completionStatus) params.set("completionStatus", filters.completionStatus);
    api<PortionReport[]>(`/portion/mine?${params.toString()}`).then(setReports).catch(() => setReports([]));
  }, [q, filters, reloadKey]);

  return (
    <Card className="p-0 overflow-hidden">
      <div className="border-b border-slate-100 p-4 dark:border-white/5">
        <h2 className="font-display font-semibold text-night dark:text-white">My submissions</h2>
      </div>
      <PortionFilterBar
        searchInput={searchInput} onSearchInputChange={setSearchInput}
        values={filters} onChange={setFilters}
        subjects={subjects} classes={classes}
      />
      {reports.length === 0 ? (
        <p className="p-6 text-sm text-slate-500">No submissions match these filters.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr className="border-b border-slate-100 dark:border-white/5">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Subject</th>
              <th className="px-4 py-3 font-medium">Chapter</th>
              <th className="px-4 py-3 font-medium">%</th>
              <th className="px-4 py-3 font-medium">Mode</th>
              <th className="px-4 py-3 font-medium">Portion status</th>
              <th className="px-4 py-3 font-medium">Review status</th>
              <th className="px-4 py-3 text-right font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                <td className="px-4 py-3 text-slate-500">{new Date(r.periodDate).toLocaleDateString("en-IN")} · {r.period === "DAILY" ? "Day" : "Week"}</td>
                <td className="px-4 py-3 font-medium text-night dark:text-white">{r.subject?.name ?? "—"}</td>
                <td className="px-4 py-3 max-w-[10rem] truncate text-slate-500" title={r.chapterName ?? undefined}>{r.chapterName ?? "—"}</td>
                <td className="px-4 py-3 text-night dark:text-white">{r.percentComplete ?? "—"}</td>
                <td className="px-4 py-3"><ModeBadge mode={r.mode} /></td>
                <td className="px-4 py-3"><CompletionBadge status={r.completionStatus} /></td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" className="h-8 px-3 text-xs" onClick={() => setViewing(r)}>View</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {viewing && (
        <Modal title={viewing.chapterName ?? viewing.subject?.name ?? "Submission"} onClose={() => setViewing(null)}>
          <div className="flex items-center gap-2 flex-wrap">
            <ModeBadge mode={viewing.mode} />
            <CompletionBadge status={viewing.completionStatus} />
            <StatusBadge status={viewing.status} />
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            {viewing.description && (
              <div>
                <dt className="font-medium text-night dark:text-white">Chapter description</dt>
                <dd className="mt-1 text-slate-500">{viewing.description}</dd>
              </div>
            )}
            <div>
              <dt className="font-medium text-night dark:text-white">Topics covered</dt>
              <dd className="mt-1 text-slate-500">{viewing.topicsCovered}</dd>
            </div>
            <div>
              <dt className="font-medium text-night dark:text-white">Review note</dt>
              <dd className="mt-1 text-slate-500">{viewing.reviewNote ?? "No review note yet."}</dd>
            </div>
            <div>
              <dt className="font-medium text-night dark:text-white">Comments</dt>
              <dd className="mt-1 text-slate-500">{viewing.reviewComments ?? "No comments yet."}</dd>
            </div>
            <div>
              <dt className="font-medium text-night dark:text-white">Remarks</dt>
              <dd className="mt-1 text-slate-500">{viewing.reviewRemarks ?? "No remarks yet."}</dd>
            </div>
          </dl>
        </Modal>
      )}
    </Card>
  );
}

function ReviewTable({ role }: { role: string }) {
  const isSuperAdmin = role === "SUPER_ADMIN";
  const [reports, setReports] = useState<PortionReport[]>([]);
  const [subjects, setSubjects] = useState<Option[]>([]);
  const [classes, setClasses] = useState<Option[]>([]);
  const [sections, setSections] = useState<(Option & { classId: string })[]>([]);
  const [schools, setSchools] = useState<Option[]>([]);
  const [teachers, setTeachers] = useState<Option[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<FilterValues>(BLANK_FILTERS);
  const [schoolId, setSchoolId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [reviewing, setReviewing] = useState<PortionReport | null>(null);
  const [note, setNote] = useState("");
  const [comments, setComments] = useState("");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editing, setEditing] = useState<PortionReport | null>(null);
  const [editSubjectId, setEditSubjectId] = useState("");
  const [editClassId, setEditClassId] = useState("");
  const [editSectionId, setEditSectionId] = useState("");
  const [editPeriod, setEditPeriod] = useState<"DAILY" | "WEEKLY">("DAILY");
  const [editPeriodDate, setEditPeriodDate] = useState("");
  const [editChapterName, setEditChapterName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTopicsCovered, setEditTopicsCovered] = useState("");
  const [editPercentComplete, setEditPercentComplete] = useState("");
  const [editMode, setEditMode] = useState<"PRACTICAL" | "THEORY">("THEORY");
  const [editCompletionStatus, setEditCompletionStatus] = useState<"PENDING" | "IN_PROGRESS" | "COMPLETED">("IN_PROGRESS");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<PortionReport | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    api<Option[]>("/academic/subjects").then(setSubjects).catch(() => {});
    api<Option[]>("/academic/classes").then(setClasses).catch(() => {});
    api<Option[]>("/academic/schools").then(setSchools).catch(() => {});
    api<{ id: string; fullName: string }[]>("/teachers?activeOnly=true")
      .then((rows) => setTeachers(rows.map((t) => ({ id: t.id, name: t.fullName }))))
      .catch(() => {});
    if (isSuperAdmin) api<(Option & { classId: string })[]>("/academic/sections").then(setSections).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { const t = setTimeout(() => setQ(searchInput.trim()), 250); return () => clearTimeout(t); }, [searchInput]);

  // Shared by the list fetch and the Print/Email report actions, so the
  // report always matches exactly what's currently filtered on screen.
  function buildParams(): URLSearchParams {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (schoolId) params.set("schoolId", schoolId);
    if (teacherId) params.set("teacherId", teacherId);
    if (filters.subjectId) params.set("subjectId", filters.subjectId);
    if (filters.classId) params.set("classId", filters.classId);
    if (filters.month) params.set("month", filters.month);
    if (filters.year) params.set("year", filters.year);
    if (filters.completionStatus) params.set("completionStatus", filters.completionStatus);
    return params;
  }

  useEffect(() => {
    api<PortionReport[]>(`/portion?${buildParams().toString()}`).then(setReports).catch(() => setReports([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, schoolId, teacherId, filters, reloadKey]);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  async function printReport() {
    try {
      const blob = await apiBlob(`/portion/report/pdf?${buildParams().toString()}`);
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not generate the report");
    }
  }

  async function sendReportEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setEmailBusy(true);
    try {
      const body: Record<string, string> = { toEmail: emailTo };
      for (const [key, value] of buildParams().entries()) body[key] = value;
      await api("/portion/report/email", { method: "POST", body: JSON.stringify(body) });
      setEmailing(false);
      setEmailTo("");
      setToast(`Report emailed to ${emailTo}`);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Could not send the report");
    } finally {
      setEmailBusy(false);
    }
  }

  async function act(status: "REVIEWED" | "FLAGGED") {
    if (!reviewing) return;
    setBusy(true);
    try {
      await api(`/portion/${reviewing.id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ status, reviewNote: note || undefined, comments: comments || undefined, remarks: remarks || undefined }),
      });
      setReviewing(null);
      setNote("");
      setComments("");
      setRemarks("");
      setReloadKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  function openEdit(r: PortionReport) {
    setEditError(null);
    setEditing(r);
    setEditSubjectId(r.subjectId ?? "");
    setEditClassId(r.classId ?? "");
    setEditSectionId(r.sectionId ?? "");
    setEditPeriod(r.period);
    setEditPeriodDate(r.periodDate.slice(0, 10));
    setEditChapterName(r.chapterName ?? "");
    setEditDescription(r.description ?? "");
    setEditTopicsCovered(r.topicsCovered);
    setEditPercentComplete(r.percentComplete != null ? String(r.percentComplete) : "");
    setEditMode(r.mode ?? "THEORY");
    setEditCompletionStatus(r.completionStatus ?? "IN_PROGRESS");
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setEditError(null);
    setEditBusy(true);
    try {
      await api(`/portion/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          subjectId: editSubjectId || undefined, classId: editClassId || undefined, sectionId: editSectionId || undefined,
          period: editPeriod, periodDate: editPeriodDate, chapterName: editChapterName || undefined,
          description: editDescription || undefined, topicsCovered: editTopicsCovered,
          percentComplete: editPercentComplete ? Number(editPercentComplete) : undefined,
          mode: editMode, completionStatus: editCompletionStatus,
        }),
      });
      setEditing(null);
      setReloadKey((k) => k + 1);
      setToast("Submission updated");
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Could not save changes");
    } finally {
      setEditBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api(`/portion/${deleting.id}`, { method: "DELETE" });
      setDeleting(null);
      setReloadKey((k) => k + 1);
      setToast("Submission deleted");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setDeleteBusy(false);
    }
  }

  const editSectionsForClass = sections.filter((s) => s.classId === editClassId);

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 dark:border-white/5">
        <h2 className="font-display font-semibold text-night dark:text-white">Portion status reports</h2>
        <div className="flex gap-2">
          <Button variant="ghost" className="h-8 px-3 text-xs" onClick={printReport} disabled={reports.length === 0}>
            Print / Download PDF
          </Button>
          <Button variant="ghost" className="h-8 px-3 text-xs" onClick={() => setEmailing(true)} disabled={reports.length === 0}>
            Email report
          </Button>
        </div>
      </div>
      <PortionFilterBar
        searchInput={searchInput} onSearchInputChange={setSearchInput}
        values={filters} onChange={setFilters}
        subjects={subjects} classes={classes}
        schools={schools} schoolId={schoolId} onSchoolChange={setSchoolId}
        teachers={teachers} teacherId={teacherId} onTeacherChange={setTeacherId}
      />
      {reports.length === 0 ? (
        <p className="p-6 text-sm text-slate-500">No submissions match these filters.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr className="border-b border-slate-100 dark:border-white/5">
              <th className="px-4 py-3 font-medium">Teacher</th>
              <th className="px-4 py-3 font-medium">School</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Subject / Class</th>
              <th className="px-4 py-3 font-medium">Chapter</th>
              <th className="px-4 py-3 font-medium">Topics</th>
              <th className="px-4 py-3 font-medium">%</th>
              <th className="px-4 py-3 font-medium">Mode</th>
              <th className="px-4 py-3 font-medium">Portion status</th>
              <th className="px-4 py-3 font-medium">Review status</th>
              <th className="px-4 py-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                <td className="px-4 py-3 font-medium text-night dark:text-white">{r.teacher?.fullName ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500">{r.school?.name ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(r.periodDate).toLocaleDateString("en-IN")} · {r.period === "DAILY" ? "Day" : "Week"}</td>
                <td className="px-4 py-3 text-slate-500">{r.subject?.name}{r.class ? ` · ${r.class.name}` : ""}{r.section ? ` ${r.section.name}` : ""}</td>
                <td className="px-4 py-3 max-w-[10rem] truncate text-slate-500" title={r.chapterName ?? undefined}>{r.chapterName ?? "—"}</td>
                <td className="px-4 py-3 max-w-xs truncate text-slate-500" title={r.topicsCovered}>{r.topicsCovered}</td>
                <td className="px-4 py-3 text-night dark:text-white">{r.percentComplete ?? "—"}</td>
                <td className="px-4 py-3"><ModeBadge mode={r.mode} /></td>
                <td className="px-4 py-3"><CompletionBadge status={r.completionStatus} /></td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                  <Button variant="ghost" className="h-8 px-3 text-xs" onClick={() => {
                    setReviewing(r); setNote(r.reviewNote ?? ""); setComments(r.reviewComments ?? ""); setRemarks(r.reviewRemarks ?? "");
                  }}>
                    {r.status === "SUBMITTED" ? "Review" : "Update"}
                  </Button>
                  {isSuperAdmin && (
                    <>
                      <Button variant="ghost" className="h-8 px-3 text-xs" onClick={() => openEdit(r)}>Edit</Button>
                      <Button variant="ghost" className="h-8 px-3 text-xs !text-danger" onClick={() => setDeleting(r)}>Delete</Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {reviewing && (
        <Modal title={`Review — ${reviewing.teacher?.fullName ?? "report"}`} onClose={() => setReviewing(null)}>
          {reviewing.chapterName && (
            <div className="mb-3 flex items-center gap-2 flex-wrap">
              <p className="font-medium text-night dark:text-white">{reviewing.chapterName}</p>
              <ModeBadge mode={reviewing.mode} />
              <CompletionBadge status={reviewing.completionStatus} />
            </div>
          )}
          {reviewing.description && <p className="mb-2 text-sm text-slate-500">{reviewing.description}</p>}
          <p className="text-sm leading-relaxed text-slate-500">{reviewing.topicsCovered}</p>
          <div className="mt-4 space-y-4">
            <Field id="review-note" label="Review note" optional>
              <textarea id="review-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Feedback for the teacher" className={`${inputCls} h-auto py-2.5`} />
            </Field>
            <Field id="review-comments" label="Comments" optional>
              <textarea id="review-comments" rows={2} value={comments} onChange={(e) => setComments(e.target.value)}
                placeholder="Comments visible to the teacher" className={`${inputCls} h-auto py-2.5`} />
            </Field>
            <Field id="review-remarks" label="Remarks" optional>
              <textarea id="review-remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)}
                placeholder="Remarks visible to the teacher" className={`${inputCls} h-auto py-2.5`} />
            </Field>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="danger" disabled={busy} onClick={() => act("FLAGGED")}>Flag</Button>
            <Button disabled={busy} onClick={() => act("REVIEWED")}>{busy ? "Saving…" : "Mark reviewed"}</Button>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal title={`Edit submission — ${editing.teacher?.fullName ?? "report"}`} onClose={() => setEditing(null)} wide>
          <form onSubmit={submitEdit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="ef-subject" label="Subject">
                <select id="ef-subject" required value={editSubjectId} onChange={(e) => setEditSubjectId(e.target.value)} className={inputCls}>
                  <option value="" disabled>Select subject</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field id="ef-period" label="Period">
                <select id="ef-period" value={editPeriod} onChange={(e) => setEditPeriod(e.target.value as "DAILY" | "WEEKLY")} className={inputCls}>
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                </select>
              </Field>
              <Field id="ef-class" label="Class" optional>
                <select id="ef-class" value={editClassId} onChange={(e) => { setEditClassId(e.target.value); setEditSectionId(""); }} className={inputCls}>
                  <option value="">Any</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field id="ef-section" label="Division" optional>
                <select id="ef-section" value={editSectionId} onChange={(e) => setEditSectionId(e.target.value)} className={inputCls} disabled={!editClassId}>
                  <option value="">Any</option>
                  {editSectionsForClass.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field id="ef-date" label={editPeriod === "DAILY" ? "Date" : "Week starting"}>
                <input id="ef-date" type="date" required value={editPeriodDate} onChange={(e) => setEditPeriodDate(e.target.value)} className={inputCls} />
              </Field>
              <Field id="ef-percent" label="Syllabus complete (%)" optional>
                <input id="ef-percent" type="number" min={0} max={100} value={editPercentComplete}
                  onChange={(e) => setEditPercentComplete(e.target.value)} placeholder="e.g. 65" className={inputCls} />
              </Field>
              <Field id="ef-chapter" label="Chapter / Portion name">
                <input id="ef-chapter" value={editChapterName} onChange={(e) => setEditChapterName(e.target.value)}
                  placeholder="e.g. Chapter 4 — Fractions" className={inputCls} />
              </Field>
              <Field id="ef-mode" label="Mode">
                <select id="ef-mode" value={editMode} onChange={(e) => setEditMode(e.target.value as "PRACTICAL" | "THEORY")} className={inputCls}>
                  <option value="THEORY">Theory (from Class)</option>
                  <option value="PRACTICAL">Practical (on Lab)</option>
                </select>
              </Field>
              <Field id="ef-completion" label="Portion status">
                <select id="ef-completion" value={editCompletionStatus}
                  onChange={(e) => setEditCompletionStatus(e.target.value as "PENDING" | "IN_PROGRESS" | "COMPLETED")} className={inputCls}>
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </Field>
            </div>
            <Field id="ef-description" label="Chapter description" optional>
              <textarea id="ef-description" rows={2} value={editDescription} onChange={(e) => setEditDescription(e.target.value)}
                placeholder="What this chapter covers overall" className={`${inputCls} h-auto py-2.5`} />
            </Field>
            <Field id="ef-topics" label="Topics covered">
              <textarea id="ef-topics" required rows={3} value={editTopicsCovered} onChange={(e) => setEditTopicsCovered(e.target.value)}
                placeholder="What was taught in this period" className={`${inputCls} h-auto py-2.5`} />
            </Field>
            {editError && <p role="alert" className="text-sm text-danger">{editError}</p>}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" disabled={editBusy}>{editBusy ? "Saving…" : "Save"}</Button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this submission?"
          message={`This permanently removes ${deleting.teacher?.fullName ?? "this"}'s ${deleting.chapterName ? `"${deleting.chapterName}" ` : ""}submission. This cannot be undone.`}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
          busy={deleteBusy}
        />
      )}

      {emailing && (
        <Modal title="Email report" onClose={() => setEmailing(false)}>
          <form onSubmit={sendReportEmail} className="space-y-4">
            <p className="text-sm text-slate-500">
              Sends the {reports.length} currently filtered record{reports.length === 1 ? "" : "s"} as a PDF attachment.
            </p>
            <Field id="email-to" label="Recipient email">
              <input id="email-to" type="email" required value={emailTo} onChange={(e) => setEmailTo(e.target.value)}
                placeholder="someone@example.com" className={inputCls} />
            </Field>
            {emailError && <p role="alert" className="text-sm text-danger">{emailError}</p>}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setEmailing(false)}>Cancel</Button>
              <Button type="submit" disabled={emailBusy}>{emailBusy ? "Sending…" : "Send"}</Button>
            </div>
          </form>
        </Modal>
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 right-6 z-50 rounded-xl bg-night px-4 py-3 text-sm text-white shadow-lift">
          {toast}
        </div>
      )}
    </Card>
  );
}

export default function PortionStatusPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => { api<Me>("/auth/me").then(setMe).catch(() => setMe(null)); }, []);

  const isReviewer = !!me && REVIEW_ROLES.has(me.role);
  const isSubmitter = !!me && (me.role === "TEACHER" || me.role === "TRAINER");

  if (!me) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Portion Status</h1>
        <p className="text-sm text-slate-500">
          {isSubmitter ? "Track and submit how much of the syllabus you've covered." : "Review teachers' syllabus-coverage submissions."}
        </p>
      </div>

      {isSubmitter && (
        <div className="grid gap-6 lg:grid-cols-2">
          <SubmitForm onSubmitted={() => setReloadKey((k) => k + 1)} />
          <MyReports reloadKey={reloadKey} />
        </div>
      )}

      {isReviewer && <ReviewTable role={me.role} />}

      {!isSubmitter && !isReviewer && (
        <p className="text-sm text-slate-500">Portion status tracking isn&apos;t available for your role.</p>
      )}
    </div>
  );
}
