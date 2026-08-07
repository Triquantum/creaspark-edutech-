"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { inputCls } from "@/components/ui/modal";
import { LessonsTab, LessonRow } from "@/components/lms/lessons-tab";
import { AssignmentsTab, AssignmentRow } from "@/components/lms/assignments-tab";
import { QuizzesTab, QuizRow } from "@/components/lms/quizzes-tab";
import { ProgressTab } from "@/components/lms/progress-tab";

const MANAGER_ROLES = new Set(["TEACHER", "SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "COORDINATOR"]);
const TABS = ["Lessons", "Assignments", "Quizzes", "Progress"] as const;
type Tab = (typeof TABS)[number];

interface Me { role: string }
interface SchoolOpt { id: string; name: string }
interface ClassOpt { id: string; name: string; schoolId: string }
interface SubjectRow { id: string; name: string; schools: SchoolOpt[] }

export default function SubjectContentPage() {
  const params = useParams<{ id: string }>();
  const [me, setMe] = useState<Me | null>(null);
  const [subject, setSubject] = useState<SubjectRow | null>(null);
  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [classId, setClassId] = useState("");
  const [tab, setTab] = useState<Tab>("Lessons");

  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);

  useEffect(() => { api<Me>("/auth/me").then(setMe).catch(() => setMe(null)); }, []);
  useEffect(() => {
    api<SubjectRow[]>("/academic/subjects").then((rows) => setSubject(rows.find((s) => s.id === params.id) ?? null)).catch(() => setSubject(null));
  }, [params.id]);
  useEffect(() => { if (subject?.schools[0] && !schoolId) setSchoolId(subject.schools[0].id); }, [subject, schoolId]);
  useEffect(() => {
    if (!schoolId) { setClasses([]); return; }
    api<ClassOpt[]>(`/academic/classes?schoolId=${schoolId}`).then(setClasses).catch(() => setClasses([]));
    setClassId("");
  }, [schoolId]);

  const context = schoolId ? { subjectId: params.id, schoolId, classId: classId || undefined } : null;

  function load() {
    if (!context) return;
    const params_ = new URLSearchParams({ subjectId: context.subjectId, schoolId: context.schoolId, ...(context.classId && { classId: context.classId }) });
    api<LessonRow[]>(`/lessons?${params_.toString()}`).then(setLessons).catch(() => setLessons([]));
    api<AssignmentRow[]>(`/assignments?${params_.toString()}`).then(setAssignments).catch(() => setAssignments([]));
    api<QuizRow[]>(`/quizzes?${params_.toString()}`).then(setQuizzes).catch(() => setQuizzes([]));
  }
  useEffect(load, [context?.subjectId, context?.schoolId, context?.classId]);

  const isManager = !!me && MANAGER_ROLES.has(me.role);

  if (!subject) return null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/academic/subject" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-night dark:hover:text-white">
          <ArrowLeft size={15} /> Back to Subjects
        </Link>
        <p className="mt-2 text-xs font-medium uppercase tracking-widest text-slate-400">Subject content</p>
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">{subject.name}</h1>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} aria-label="School" className={`${inputCls} max-w-xs`}>
          {subject.schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={classId} onChange={(e) => setClassId(e.target.value)} aria-label="Class" className={`${inputCls} max-w-xs`}>
          <option value="">Whole school</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
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

      {context && (
        <>
          {tab === "Lessons" && <LessonsTab context={context} lessons={lessons} isManager={isManager} onChanged={load} />}
          {tab === "Assignments" && <AssignmentsTab context={context} assignments={assignments} isManager={isManager} onChanged={load} />}
          {tab === "Quizzes" && <QuizzesTab context={context} quizzes={quizzes} isManager={isManager} onChanged={load} />}
          {tab === "Progress" && <ProgressTab context={context} isManager={isManager} />}
        </>
      )}
    </div>
  );
}
