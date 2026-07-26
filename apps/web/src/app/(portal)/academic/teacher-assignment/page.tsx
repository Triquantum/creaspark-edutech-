"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { inputCls } from "@/components/ui/modal";

interface SchoolOpt { id: string; name: string }
interface ClassOpt { id: string; name: string; schoolId: string }
interface SectionOpt { id: string; name: string; classId: string; schoolId: string }
interface SubjectOpt { id: string; name: string }
interface TeacherOpt { id: string; fullName: string }
interface Assignment {
  id: string;
  teacher: { id: string; fullName: string };
  subject: { id: string; name: string };
  section: { id: string };
}

export default function TeacherAssignmentPage() {
  const [schools, setSchools] = useState<SchoolOpt[]>([]);
  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [sections, setSections] = useState<SectionOpt[]>([]);
  const [subjects, setSubjects] = useState<SubjectOpt[]>([]);
  const [teachers, setTeachers] = useState<TeacherOpt[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [schoolId, setSchoolId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [savingSubjectId, setSavingSubjectId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { api<SchoolOpt[]>("/academic/schools").then(setSchools).catch(() => setSchools([])); }, []);
  useEffect(() => { if (!schoolId && schools[0]) setSchoolId(schools[0].id); }, [schools, schoolId]);

  useEffect(() => {
    if (!schoolId) return;
    api<ClassOpt[]>(`/academic/classes?schoolId=${schoolId}`).then(setClasses).catch(() => setClasses([]));
    api<SectionOpt[]>(`/academic/sections?schoolId=${schoolId}`).then(setSections).catch(() => setSections([]));
    api<SubjectOpt[]>(`/academic/subjects?schoolId=${schoolId}`).then(setSubjects).catch(() => setSubjects([]));
    api<TeacherOpt[]>(`/teachers?schoolId=${schoolId}`).then(setTeachers).catch(() => setTeachers([]));
    setClassId(""); setSectionId("");
  }, [schoolId]);

  useEffect(() => { if (!classId && classes[0]) setClassId(classes[0].id); }, [classes, classId]);

  const sectionsForClass = sections.filter((s) => s.classId === classId);
  useEffect(() => { if (!sectionId && sectionsForClass[0]) setSectionId(sectionsForClass[0].id); }, [sectionsForClass, sectionId]);

  useEffect(() => {
    if (!sectionId) { setAssignments([]); return; }
    api<Assignment[]>(`/teacher-assignments?sectionId=${sectionId}`).then(setAssignments).catch(() => setAssignments([]));
  }, [sectionId]);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  async function assign(subjectId: string, teacherId: string) {
    if (!teacherId) return unassign(subjectId);
    setSavingSubjectId(subjectId);
    try {
      const a = await api<Assignment>("/teacher-assignments", {
        method: "POST",
        body: JSON.stringify({ sectionId, subjectId, teacherId }),
      });
      setAssignments((prev) => [...prev.filter((x) => x.subject.id !== subjectId), a]);
      setToast("Saved");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSavingSubjectId(null);
    }
  }

  async function unassign(subjectId: string) {
    const existing = assignments.find((a) => a.subject.id === subjectId);
    if (!existing) return;
    setSavingSubjectId(subjectId);
    try {
      await api(`/teacher-assignments/${existing.id}`, { method: "DELETE" });
      setAssignments((prev) => prev.filter((x) => x.id !== existing.id));
      setToast("Unassigned");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not remove");
    } finally {
      setSavingSubjectId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Assign Subjects &amp; Teachers</h1>
        <p className="mt-1 text-sm text-slate-500">Choose a school, class and division, then pick who teaches each subject.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={schoolId} onChange={(e) => setSchoolId(e.target.value)}
          aria-label="School" className={`${inputCls} max-w-xs`}
        >
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select
          value={classId} onChange={(e) => setClassId(e.target.value)}
          aria-label="Class" className={`${inputCls} max-w-xs`}
        >
          <option value="" disabled>Select a class…</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={sectionId} onChange={(e) => setSectionId(e.target.value)}
          aria-label="Division" disabled={!classId} className={`${inputCls} max-w-xs`}
        >
          <option value="" disabled>Select a division…</option>
          {sectionsForClass.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <Card className="p-0 overflow-hidden">
        {!sectionId ? (
          <p className="p-6 text-sm text-slate-500">Choose a school, class and division to assign teachers.</p>
        ) : subjects.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No subjects registered for this school yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Teacher</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((sub) => {
                const current = assignments.find((a) => a.subject.id === sub.id);
                return (
                  <tr key={sub.id} className="border-b border-slate-50 dark:border-white/5">
                    <td className="px-4 py-3 font-medium text-night dark:text-white">{sub.name}</td>
                    <td className="px-4 py-3">
                      <select
                        value={current?.teacher.id ?? ""}
                        onChange={(e) => assign(sub.id, e.target.value)}
                        disabled={savingSubjectId === sub.id}
                        aria-label={`Teacher for ${sub.name}`}
                        className={`${inputCls} max-w-xs`}
                      >
                        <option value="">Unassigned</option>
                        {teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {toast && (
        <div role="status" className="fixed bottom-6 right-6 z-50 rounded-xl bg-night px-4 py-3 text-sm text-white shadow-lift">
          {toast}
        </div>
      )}
    </div>
  );
}
