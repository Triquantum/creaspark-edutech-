"use client";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, Field, inputCls } from "@/components/ui/modal";
import type { ContentContext } from "./lessons-tab";

export interface QuizRow { id: string; title: string; description: string | null; _count?: { questions: number } }
interface Question { id: string; questionText: string; type: string; options: string[] | null; marks: number; correctAnswer?: string | null }
interface Attempt { score: number | null }

function CreateQuizModal({ context, onClose, onSaved }: { context: ContentContext; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ title: "", description: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/quizzes", { method: "POST", body: JSON.stringify({ ...context, title: form.title.trim(), description: form.description.trim() || undefined }) });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create quiz");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New quiz" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field id="q-title" label="Title">
          <input id="q-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
        </Field>
        <Field id="q-desc" label="Description" optional>
          <textarea id="q-desc" rows={3} className={`${inputCls} h-auto py-3`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create quiz"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function AddQuestionForm({ quizId, onAdded }: { quizId: string; onAdded: () => void }) {
  const [form, setForm] = useState({ questionText: "", type: "MCQ", options: ["", "", "", ""], correctAnswer: "", marks: 1 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const options = form.type === "MCQ" ? form.options.map((o) => o.trim()).filter(Boolean) : undefined;
      await api(`/quizzes/${quizId}/questions`, {
        method: "POST",
        body: JSON.stringify({ questionText: form.questionText.trim(), type: form.type, options, correctAnswer: form.correctAnswer.trim() || undefined, marks: form.marks }),
      });
      setForm({ questionText: "", type: "MCQ", options: ["", "", "", ""], correctAnswer: "", marks: 1 });
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add question");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-dashed border-slate-200 p-4 dark:border-white/10">
      <Field id="qq-text" label="Question">
        <input id="qq-text" required value={form.questionText} onChange={(e) => setForm({ ...form, questionText: e.target.value })} className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="qq-type" label="Type">
          <select id="qq-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputCls}>
            <option value="MCQ">Multiple choice</option>
            <option value="SHORT_ANSWER">Short answer</option>
          </select>
        </Field>
        <Field id="qq-marks" label="Marks">
          <input id="qq-marks" type="number" min={1} value={form.marks} onChange={(e) => setForm({ ...form, marks: Number(e.target.value) })} className={inputCls} />
        </Field>
      </div>
      {form.type === "MCQ" && (
        <div className="space-y-2">
          {form.options.map((o, i) => (
            <input key={i} value={o} placeholder={`Option ${i + 1}`} className={inputCls}
              onChange={(e) => setForm({ ...form, options: form.options.map((v, j) => (j === i ? e.target.value : v)) })} />
          ))}
          <Field id="qq-correct" label="Correct answer" optional>
            <select id="qq-correct" value={form.correctAnswer} onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })} className={inputCls}>
              <option value="">Select…</option>
              {form.options.filter(Boolean).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" disabled={busy} variant="ghost">{busy ? "Adding…" : "+ Add question"}</Button>
    </form>
  );
}

function ManageQuizModal({ quiz, onClose, onChanged }: { quiz: QuizRow; onClose: () => void; onChanged: () => void }) {
  const [questions, setQuestions] = useState<Question[]>([]);

  function load() {
    api<{ questions: Question[] }>(`/quizzes/${quiz.id}`).then((r) => setQuestions(r.questions));
  }
  useEffect(load, [quiz.id]);

  async function remove(id: string) {
    await api(`/quiz-questions/${id}`, { method: "DELETE" });
    load();
    onChanged();
  }

  return (
    <Modal title={`Manage: ${quiz.title}`} onClose={onClose} wide>
      <div className="space-y-3">
        {questions.map((q) => (
          <div key={q.id} className="flex items-start justify-between gap-2 rounded-xl border border-slate-100 p-3 text-sm dark:border-white/10">
            <div>
              <p className="font-medium text-night dark:text-white">{q.questionText} <span className="text-xs text-slate-400">({q.marks} mark{q.marks === 1 ? "" : "s"})</span></p>
              {q.options && <p className="mt-1 text-xs text-slate-400">Options: {q.options.join(", ")} — correct: {q.correctAnswer}</p>}
            </div>
            <button onClick={() => remove(q.id)} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-danger/10 hover:text-danger">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <AddQuestionForm quizId={quiz.id} onAdded={() => { load(); onChanged(); }} />
      </div>
    </Modal>
  );
}

function TakeQuizModal({ quizId, onClose, onSaved }: { quizId: string; onClose: () => void; onSaved: () => void }) {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [myAttempt, setMyAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ questions: Question[]; myAttempt: Attempt | null }>(`/quizzes/${quizId}`).then((r) => {
      setQuestions(r.questions);
      setMyAttempt(r.myAttempt);
    });
  }, [quizId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api(`/quizzes/${quizId}/attempt`, { method: "POST", body: JSON.stringify({ answers }) });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit quiz");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Quiz" onClose={onClose} wide>
      {!questions ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : myAttempt ? (
        <p className="text-sm text-night dark:text-white">You've already taken this quiz. Score: {myAttempt.score ?? "—"}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {questions.map((q, i) => (
            <div key={q.id}>
              <p className="mb-2 text-sm font-medium text-night dark:text-white">{i + 1}. {q.questionText}</p>
              {q.type === "MCQ" && q.options ? (
                <div className="space-y-1.5">
                  {q.options.map((o) => (
                    <label key={o} className="flex items-center gap-2 text-sm">
                      <input type="radio" name={q.id} value={o} checked={answers[q.id] === o}
                        onChange={() => setAnswers({ ...answers, [q.id]: o })} className="accent-primary" />
                      {o}
                    </label>
                  ))}
                </div>
              ) : (
                <input value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} className={inputCls} />
              )}
            </div>
          ))}
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit quiz"}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export function QuizzesTab({ context, quizzes, isManager, onChanged }: {
  context: ContentContext; quizzes: QuizRow[]; isManager: boolean; onChanged: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState<QuizRow | null>(null);
  const [taking, setTaking] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {isManager && (
        <div className="flex justify-end">
          <Button onClick={() => setCreating(true)}>+ Add quiz</Button>
        </div>
      )}
      {quizzes.length === 0 ? (
        <Card><p className="text-sm text-slate-500">No quizzes yet.</p></Card>
      ) : (
        quizzes.map((q) => (
          <Card key={q.id} className="cursor-pointer" onClick={() => (isManager ? setManaging(q) : setTaking(q.id))}>
            <p className="font-medium text-night dark:text-white">{q.title}</p>
            {q._count && <p className="mt-1 text-xs text-slate-400">{q._count.questions} question{q._count.questions === 1 ? "" : "s"}</p>}
          </Card>
        ))
      )}
      {creating && <CreateQuizModal context={context} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); onChanged(); }} />}
      {managing && <ManageQuizModal quiz={managing} onClose={() => setManaging(null)} onChanged={onChanged} />}
      {taking && <TakeQuizModal quizId={taking} onClose={() => setTaking(null)} onSaved={() => { setTaking(null); onChanged(); }} />}
    </div>
  );
}
