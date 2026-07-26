"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, Field, inputCls } from "@/components/ui/modal";

interface Me { role: string }
interface Subject { id: string; name: string }
interface ClassRow { id: string; name: string }
interface CourseRow {
  id: string; title: string; description: string | null; status: string;
  teacher?: { fullName: string }; subject: { name: string } | null; class: { name: string } | null;
  _count: { lessons: number };
}

function CreateCourseModal({ subjects, classes, onClose, onSaved }: {
  subjects: Subject[]; classes: ClassRow[]; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ title: "", description: "", subjectId: "", classId: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/courses", {
        method: "POST",
        body: JSON.stringify({
          title: form.title.trim(), description: form.description.trim() || undefined,
          subjectId: form.subjectId || undefined, classId: form.classId || undefined,
        }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create course");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New course" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field id="c-title" label="Title">
          <input id="c-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
        </Field>
        <Field id="c-desc" label="Description" optional>
          <textarea id="c-desc" rows={3} className={`${inputCls} h-auto py-3`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="c-subject" label="Subject" optional>
            <select id="c-subject" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })} className={inputCls}>
              <option value="">None</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field id="c-class" label="Class" optional>
            <select id="c-class" value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })} className={inputCls}>
              <option value="">Whole school</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create course"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function CoursesPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [creating, setCreating] = useState(false);

  function load() {
    api<CourseRow[]>("/courses").then(setCourses).catch(() => setCourses([]));
  }
  useEffect(() => {
    api<Me>("/auth/me").then(setMe).catch(() => setMe(null));
    load();
  }, []);
  useEffect(() => {
    if (me?.role === "TEACHER") {
      api<Subject[]>("/academic/subjects").then(setSubjects).catch(() => {});
      api<ClassRow[]>("/academic/classes").then(setClasses).catch(() => {});
    }
  }, [me]);

  const isTeacher = me?.role === "TEACHER";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Courses</h1>
          <p className="text-sm text-slate-500">{isTeacher ? "Courses you teach." : "Courses available to you."}</p>
        </div>
        {isTeacher && <Button onClick={() => setCreating(true)}>+ New course</Button>}
      </div>

      {courses.length === 0 ? (
        <Card><p className="text-sm text-slate-500">No courses yet.</p></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <Link key={c.id} href={`/lms/courses/${c.id}`}>
              <Card className="h-full transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lift">
                <div className="flex items-start justify-between gap-2">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <GraduationCap size={18} />
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    c.status === "PUBLISHED" ? "bg-success/10 text-success" : "bg-slate-100 text-slate-500 dark:bg-white/10"
                  }`}>{c.status}</span>
                </div>
                <h3 className="mt-3 font-display font-semibold text-night dark:text-white">{c.title}</h3>
                {c.description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{c.description}</p>}
                <p className="mt-3 text-xs text-slate-400">
                  {c.subject?.name ?? "General"} · {c.class?.name ?? "Whole school"} · {c._count.lessons} lesson{c._count.lessons === 1 ? "" : "s"}
                </p>
                {c.teacher && <p className="mt-1 text-xs text-slate-400">by {c.teacher.fullName}</p>}
              </Card>
            </Link>
          ))}
        </div>
      )}

      {creating && (
        <CreateCourseModal subjects={subjects} classes={classes} onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); load(); }} />
      )}
    </div>
  );
}
