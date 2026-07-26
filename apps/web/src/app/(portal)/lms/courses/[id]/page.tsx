"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { LessonsTab, LessonRow } from "@/components/lms/lessons-tab";
import { AssignmentsTab, AssignmentRow } from "@/components/lms/assignments-tab";
import { QuizzesTab, QuizRow } from "@/components/lms/quizzes-tab";
import { ProgressTab } from "@/components/lms/progress-tab";

const MANAGER_ROLES = new Set(["TEACHER", "SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "COORDINATOR"]);
const TABS = ["Lessons", "Assignments", "Quizzes", "Progress"] as const;
type Tab = (typeof TABS)[number];

interface Me { role: string }
interface CourseDetail {
  id: string; title: string; description: string | null; status: string;
  teacher: { fullName: string }; subject: { name: string } | null; class: { name: string } | null;
  lessons: LessonRow[]; assignments: AssignmentRow[]; quizzes: QuizRow[];
}

export default function CourseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [tab, setTab] = useState<Tab>("Lessons");
  const [busy, setBusy] = useState(false);

  function load() {
    api<CourseDetail>(`/courses/${params.id}`).then(setCourse).catch(() => setCourse(null));
  }
  useEffect(() => {
    api<Me>("/auth/me").then(setMe).catch(() => setMe(null));
    load();
  }, [params.id]);

  const isManager = !!me && MANAGER_ROLES.has(me.role);

  async function togglePublish() {
    if (!course) return;
    setBusy(true);
    try {
      await api(`/courses/${course.id}`, { method: "PATCH", body: JSON.stringify({ status: course.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" }) });
      load();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!course || !confirm(`Delete "${course.title}"? This removes its lessons, assignments and quizzes too.`)) return;
    await api(`/courses/${course.id}`, { method: "DELETE" });
    router.push("/lms/courses");
  }

  if (!course) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
            {course.subject?.name ?? "General"} · {course.class?.name ?? "Whole school"}
          </p>
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">{course.title}</h1>
          {course.description && <p className="mt-1 text-sm text-slate-500">{course.description}</p>}
          <p className="mt-1 text-xs text-slate-400">by {course.teacher.fullName}</p>
        </div>
        {isManager && (
          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" onClick={togglePublish} disabled={busy}>
              {course.status === "PUBLISHED" ? "Unpublish" : "Publish"}
            </Button>
            <Button variant="danger" onClick={remove}>Delete</Button>
          </div>
        )}
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

      {tab === "Lessons" && <LessonsTab courseId={course.id} lessons={course.lessons} isManager={isManager} onChanged={load} />}
      {tab === "Assignments" && <AssignmentsTab courseId={course.id} assignments={course.assignments} isManager={isManager} onChanged={load} />}
      {tab === "Quizzes" && <QuizzesTab courseId={course.id} quizzes={course.quizzes} isManager={isManager} onChanged={load} />}
      {tab === "Progress" && <ProgressTab courseId={course.id} isManager={isManager} />}
    </div>
  );
}
