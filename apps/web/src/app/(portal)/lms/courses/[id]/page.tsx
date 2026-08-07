"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { LessonsTab, LessonRow, ContentContext } from "@/components/lms/lessons-tab";
import { AssignmentsTab, AssignmentRow } from "@/components/lms/assignments-tab";
import { QuizzesTab, QuizRow } from "@/components/lms/quizzes-tab";
import { ProgressTab } from "@/components/lms/progress-tab";

const TABS = ["Lessons", "Assignments", "Quizzes", "My Progress"] as const;
type Tab = (typeof TABS)[number];

interface Me { role: string }
interface SubjectRow { id: string; name: string }

export default function MyLearningSubjectPage() {
  const params = useParams<{ id: string }>();
  const [me, setMe] = useState<Me | null>(null);
  const [subject, setSubject] = useState<SubjectRow | null>(null);
  const [tab, setTab] = useState<Tab>("Lessons");
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);

  useEffect(() => { api<Me>("/auth/me").then(setMe).catch(() => setMe(null)); }, []);
  useEffect(() => {
    api<SubjectRow[]>("/academic/subjects").then((rows) => setSubject(rows.find((s) => s.id === params.id) ?? null)).catch(() => setSubject(null));
  }, [params.id]);

  const context: ContentContext = { subjectId: params.id };

  function load() {
    const qs = `?subjectId=${params.id}`;
    api<LessonRow[]>(`/lessons${qs}`).then(setLessons).catch(() => setLessons([]));
    api<AssignmentRow[]>(`/assignments${qs}`).then(setAssignments).catch(() => setAssignments([]));
    api<QuizRow[]>(`/quizzes${qs}`).then(setQuizzes).catch(() => setQuizzes([]));
  }
  useEffect(load, [params.id]);

  useEffect(() => {
    if (me?.role === "STUDENT") {
      api("/lessons/view", { method: "POST", body: JSON.stringify({ subjectId: params.id }) }).catch(() => {});
    }
  }, [me, params.id]);

  if (!subject) return null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/lms/courses" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-night dark:hover:text-white">
          <ArrowLeft size={15} /> Back to My Learning
        </Link>
        <p className="mt-2 text-xs font-medium uppercase tracking-widest text-slate-400">My Learning</p>
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">{subject.name}</h1>
      </div>

      <div className="flex w-fit gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/5">
        {TABS.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? "bg-white text-night shadow-sm dark:bg-white/10 dark:text-white" : "text-slate-500 dark:text-slate-400"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Lessons" && <LessonsTab context={context} lessons={lessons} isManager={false} onChanged={load} />}
      {tab === "Assignments" && <AssignmentsTab context={context} assignments={assignments} isManager={false} onChanged={load} />}
      {tab === "Quizzes" && <QuizzesTab context={context} quizzes={quizzes} isManager={false} onChanged={load} />}
      {tab === "My Progress" && <ProgressTab context={context} isManager={false} />}
    </div>
  );
}
