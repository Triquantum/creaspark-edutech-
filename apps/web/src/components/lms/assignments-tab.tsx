"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, Field, inputCls } from "@/components/ui/modal";

export interface AssignmentRow {
  id: string; title: string; description: string | null; dueDate: string | null; maxMarks: number | null;
}
interface SubmissionRow {
  studentId: string; content: string | null; attachmentUrl: string | null; status: string; marksAwarded: number | null; feedback: string | null;
  student: { firstName: string; lastName: string; admissionNo: string };
}
interface MySubmission { content: string | null; attachmentUrl: string | null; status: string; marksAwarded: number | null; feedback: string | null }

function CreateAssignmentModal({ courseId, onClose, onSaved }: { courseId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ title: "", description: "", dueDate: "", maxMarks: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/assignments", {
        method: "POST",
        body: JSON.stringify({
          courseId, title: form.title.trim(), description: form.description.trim() || undefined,
          dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
          maxMarks: form.maxMarks ? Number(form.maxMarks) : undefined,
        }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create assignment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New assignment" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field id="a-title" label="Title">
          <input id="a-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
        </Field>
        <Field id="a-desc" label="Description" optional>
          <textarea id="a-desc" rows={3} className={`${inputCls} h-auto py-3`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="a-due" label="Due date" optional>
            <input id="a-due" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={inputCls} />
          </Field>
          <Field id="a-marks" label="Max marks" optional>
            <input id="a-marks" type="number" min={1} value={form.maxMarks} onChange={(e) => setForm({ ...form, maxMarks: e.target.value })} className={inputCls} />
          </Field>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create assignment"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function SubmitModal({ assignmentId, existing, onClose, onSaved }: {
  assignmentId: string; existing: MySubmission | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ content: existing?.content ?? "", attachmentUrl: existing?.attachmentUrl ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api(`/assignments/${assignmentId}/submit`, {
        method: "POST",
        body: JSON.stringify({ content: form.content.trim() || undefined, attachmentUrl: form.attachmentUrl.trim() || undefined }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Submit assignment" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field id="s-content" label="Answer" optional>
          <textarea id="s-content" rows={5} className={`${inputCls} h-auto py-3`} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
        </Field>
        <Field id="s-link" label="Attachment link" optional>
          <input id="s-link" value={form.attachmentUrl} onChange={(e) => setForm({ ...form, attachmentUrl: e.target.value })} className={inputCls} placeholder="https://…" />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function GradeModal({ assignmentId, submission, maxMarks, onClose, onSaved }: {
  assignmentId: string; submission: SubmissionRow; maxMarks: number | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ marksAwarded: submission.marksAwarded ?? 0, feedback: submission.feedback ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api(`/assignments/${assignmentId}/submissions/${submission.studentId}/grade`, {
        method: "PATCH", body: JSON.stringify(form),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not grade");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Grade ${submission.student.firstName} ${submission.student.lastName}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {submission.content && <p className="rounded-xl bg-surface p-3 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">{submission.content}</p>}
        <Field id="g-marks" label={`Marks${maxMarks ? ` (out of ${maxMarks})` : ""}`}>
          <input id="g-marks" type="number" min={0} max={maxMarks ?? undefined} value={form.marksAwarded}
            onChange={(e) => setForm({ ...form, marksAwarded: Number(e.target.value) })} className={inputCls} />
        </Field>
        <Field id="g-feedback" label="Feedback" optional>
          <textarea id="g-feedback" rows={3} className={`${inputCls} h-auto py-3`} value={form.feedback} onChange={(e) => setForm({ ...form, feedback: e.target.value })} />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save grade"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function AssignmentDetail({ assignment, isManager, onClose, onChanged }: {
  assignment: AssignmentRow; isManager: boolean; onClose: () => void; onChanged: () => void;
}) {
  const [submissions, setSubmissions] = useState<SubmissionRow[] | null>(null);
  const [mySubmission, setMySubmission] = useState<MySubmission | null | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [grading, setGrading] = useState<SubmissionRow | null>(null);

  function load() {
    api<{ submissions?: SubmissionRow[]; mySubmission?: MySubmission | null }>(`/assignments/${assignment.id}`).then((r) => {
      setSubmissions(r.submissions ?? null);
      setMySubmission(r.mySubmission ?? null);
    });
  }
  useEffect(load, [assignment.id]);

  return (
    <Modal title={assignment.title} onClose={onClose} wide>
      <div className="space-y-4">
        {assignment.description && <p className="text-sm text-slate-600 dark:text-slate-300">{assignment.description}</p>}
        <p className="text-xs text-slate-400">
          {assignment.dueDate ? `Due ${new Date(assignment.dueDate).toLocaleDateString("en-IN")}` : "No due date"}
          {assignment.maxMarks ? ` · ${assignment.maxMarks} marks` : ""}
        </p>

        {isManager ? (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-night dark:text-white">Submissions</h4>
            {!submissions || submissions.length === 0 ? (
              <p className="text-sm text-slate-500">No submissions yet.</p>
            ) : submissions.map((s) => (
              <div key={s.studentId} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-sm dark:border-white/10">
                <span>{s.student.firstName} {s.student.lastName} <span className="text-slate-400">({s.student.admissionNo})</span></span>
                <span className="flex items-center gap-2">
                  <span className={s.status === "GRADED" ? "text-success" : "text-slate-400"}>
                    {s.status === "GRADED" ? `${s.marksAwarded}/${assignment.maxMarks ?? "—"}` : s.status}
                  </span>
                  <Button variant="ghost" onClick={() => setGrading(s)}>{s.status === "GRADED" ? "Edit grade" : "Grade"}</Button>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-100 p-3 dark:border-white/10">
            {mySubmission === undefined ? null : mySubmission ? (
              <div className="text-sm">
                <p className="text-slate-600 dark:text-slate-300">{mySubmission.content || "(no text answer)"}</p>
                <p className="mt-2 text-xs font-medium">
                  {mySubmission.status === "GRADED" ? `Graded: ${mySubmission.marksAwarded}/${assignment.maxMarks ?? "—"}` : `Status: ${mySubmission.status}`}
                </p>
                {mySubmission.feedback && <p className="mt-1 text-xs text-slate-400">Feedback: {mySubmission.feedback}</p>}
                <div className="mt-3"><Button variant="ghost" onClick={() => setSubmitting(true)}>Resubmit</Button></div>
              </div>
            ) : (
              <Button onClick={() => setSubmitting(true)}>Submit assignment</Button>
            )}
          </div>
        )}
      </div>

      {submitting && (
        <SubmitModal assignmentId={assignment.id} existing={mySubmission ?? null} onClose={() => setSubmitting(false)}
          onSaved={() => { setSubmitting(false); load(); onChanged(); }} />
      )}
      {grading && (
        <GradeModal assignmentId={assignment.id} submission={grading} maxMarks={assignment.maxMarks} onClose={() => setGrading(null)}
          onSaved={() => { setGrading(null); load(); onChanged(); }} />
      )}
    </Modal>
  );
}

export function AssignmentsTab({ courseId, assignments, isManager, onChanged }: {
  courseId: string; assignments: AssignmentRow[]; isManager: boolean; onChanged: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<AssignmentRow | null>(null);

  return (
    <div className="space-y-3">
      {isManager && (
        <div className="flex justify-end">
          <Button onClick={() => setCreating(true)}>+ Add assignment</Button>
        </div>
      )}
      {assignments.length === 0 ? (
        <Card><p className="text-sm text-slate-500">No assignments yet.</p></Card>
      ) : (
        assignments.map((a) => (
          <Card key={a.id} className="cursor-pointer" onClick={() => setViewing(a)}>
            <p className="font-medium text-night dark:text-white">{a.title}</p>
            <p className="mt-1 text-xs text-slate-400">
              {a.dueDate ? `Due ${new Date(a.dueDate).toLocaleDateString("en-IN")}` : "No due date"}{a.maxMarks ? ` · ${a.maxMarks} marks` : ""}
            </p>
          </Card>
        ))
      )}
      {creating && (
        <CreateAssignmentModal courseId={courseId} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); onChanged(); }} />
      )}
      {viewing && (
        <AssignmentDetail assignment={viewing} isManager={isManager} onClose={() => setViewing(null)} onChanged={onChanged} />
      )}
    </div>
  );
}
