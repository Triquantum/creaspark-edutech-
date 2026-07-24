"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, Field, inputCls } from "@/components/ui/modal";
import { api } from "@/lib/api";

interface Me { role: string }
interface Option { id: string; name: string }
interface PortionReport {
  id: string; period: "DAILY" | "WEEKLY"; periodDate: string; topicsCovered: string;
  percentComplete: number | null; status: "SUBMITTED" | "REVIEWED" | "FLAGGED";
  reviewNote: string | null;
  subject?: { name: string }; class?: { name: string } | null; section?: { name: string } | null;
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

function SubmitForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [subjects, setSubjects] = useState<Option[]>([]);
  const [classes, setClasses] = useState<Option[]>([]);
  const [sections, setSections] = useState<(Option & { classId: string })[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [period, setPeriod] = useState<"DAILY" | "WEEKLY">("DAILY");
  const [periodDate, setPeriodDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [topicsCovered, setTopicsCovered] = useState("");
  const [percentComplete, setPercentComplete] = useState("");
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
          period, periodDate, topicsCovered,
          percentComplete: percentComplete ? Number(percentComplete) : undefined,
        }),
      });
      setTopicsCovered("");
      setPercentComplete("");
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
        </div>
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

function MyReports({ reports }: { reports: PortionReport[] }) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="border-b border-slate-100 p-4 dark:border-white/5">
        <h2 className="font-display font-semibold text-night dark:text-white">My submissions</h2>
      </div>
      {reports.length === 0 ? (
        <p className="p-6 text-sm text-slate-500">No submissions yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr className="border-b border-slate-100 dark:border-white/5">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Subject</th>
              <th className="px-4 py-3 font-medium">Topics</th>
              <th className="px-4 py-3 font-medium">%</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Review note</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                <td className="px-4 py-3 text-slate-500">{new Date(r.periodDate).toLocaleDateString("en-IN")} · {r.period === "DAILY" ? "Day" : "Week"}</td>
                <td className="px-4 py-3 font-medium text-night dark:text-white">{r.subject?.name ?? "—"}</td>
                <td className="px-4 py-3 max-w-xs truncate text-slate-500" title={r.topicsCovered}>{r.topicsCovered}</td>
                <td className="px-4 py-3 text-night dark:text-white">{r.percentComplete ?? "—"}</td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3 text-slate-500">{r.reviewNote ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function ReviewTable({ reports, onReviewed }: { reports: PortionReport[]; onReviewed: () => void }) {
  const [reviewing, setReviewing] = useState<PortionReport | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function act(status: "REVIEWED" | "FLAGGED") {
    if (!reviewing) return;
    setBusy(true);
    try {
      await api(`/portion/${reviewing.id}/review`, { method: "PATCH", body: JSON.stringify({ status, reviewNote: note || undefined }) });
      setReviewing(null);
      setNote("");
      onReviewed();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="border-b border-slate-100 p-4 dark:border-white/5">
        <h2 className="font-display font-semibold text-night dark:text-white">Portion status reports</h2>
      </div>
      {reports.length === 0 ? (
        <p className="p-6 text-sm text-slate-500">Nothing submitted yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr className="border-b border-slate-100 dark:border-white/5">
              <th className="px-4 py-3 font-medium">Teacher</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Subject / Class</th>
              <th className="px-4 py-3 font-medium">Topics</th>
              <th className="px-4 py-3 font-medium">%</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                <td className="px-4 py-3 font-medium text-night dark:text-white">{r.teacher?.fullName ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(r.periodDate).toLocaleDateString("en-IN")} · {r.period === "DAILY" ? "Day" : "Week"}</td>
                <td className="px-4 py-3 text-slate-500">{r.subject?.name}{r.class ? ` · ${r.class.name}` : ""}{r.section ? ` ${r.section.name}` : ""}</td>
                <td className="px-4 py-3 max-w-xs truncate text-slate-500" title={r.topicsCovered}>{r.topicsCovered}</td>
                <td className="px-4 py-3 text-night dark:text-white">{r.percentComplete ?? "—"}</td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" className="h-8 px-3 text-xs" onClick={() => { setReviewing(r); setNote(r.reviewNote ?? ""); }}>
                    {r.status === "SUBMITTED" ? "Review" : "Update"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {reviewing && (
        <Modal title={`Review — ${reviewing.teacher?.fullName ?? "report"}`} onClose={() => setReviewing(null)}>
          <p className="text-sm leading-relaxed text-slate-500">{reviewing.topicsCovered}</p>
          <div className="mt-4">
            <Field id="review-note" label="Review note" optional>
              <textarea id="review-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Feedback for the teacher" className={`${inputCls} h-auto py-2.5`} />
            </Field>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="danger" disabled={busy} onClick={() => act("FLAGGED")}>Flag</Button>
            <Button disabled={busy} onClick={() => act("REVIEWED")}>{busy ? "Saving…" : "Mark reviewed"}</Button>
          </div>
        </Modal>
      )}
    </Card>
  );
}

export default function PortionStatusPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [mine, setMine] = useState<PortionReport[]>([]);
  const [all, setAll] = useState<PortionReport[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => { api<Me>("/auth/me").then(setMe).catch(() => setMe(null)); }, []);

  const isReviewer = !!me && REVIEW_ROLES.has(me.role);
  const isSubmitter = !!me && (me.role === "TEACHER" || me.role === "TRAINER");

  useEffect(() => {
    if (isSubmitter) api<PortionReport[]>("/portion/mine").then(setMine).catch(() => {});
  }, [isSubmitter, reloadKey]);

  useEffect(() => {
    if (isReviewer) api<PortionReport[]>("/portion").then(setAll).catch(() => {});
  }, [isReviewer, reloadKey]);

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
          <MyReports reports={mine} />
        </div>
      )}

      {isReviewer && <ReviewTable reports={all} onReviewed={() => setReloadKey((k) => k + 1)} />}

      {!isSubmitter && !isReviewer && (
        <p className="text-sm text-slate-500">Portion status tracking isn&apos;t available for your role.</p>
      )}
    </div>
  );
}
