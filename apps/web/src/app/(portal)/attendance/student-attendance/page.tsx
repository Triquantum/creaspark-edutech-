"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/ui/modal";

interface SchoolOpt { id: string; name: string }
interface ClassOpt { id: string; name: string; schoolId: string }
interface SectionOpt { id: string; name: string; classId: string; schoolId: string }
interface StudentRow { id: string; firstName: string; lastName: string; rollNo: string | null; admissionNo: string; photoUrl: string | null }
interface ExistingRecord { studentId: string; status: AttendanceStatus; note: string | null }

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "LEAVE";
const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: "PRESENT", label: "Present" },
  { value: "ABSENT", label: "Absent" },
  { value: "LATE", label: "Late" },
  { value: "HALF_DAY", label: "Half Day" },
  { value: "LEAVE", label: "Leave" },
];
const STATUS_STYLE: Record<AttendanceStatus, string> = {
  PRESENT: "text-success",
  ABSENT: "text-danger",
  LATE: "text-warning",
  HALF_DAY: "text-warning",
  LEAVE: "text-slate-400",
};

const MARK_ROLES = ["TEACHER", "SCHOOL_ADMIN", "COORDINATOR"];

const todayStr = () => new Date().toISOString().slice(0, 10);

async function fetchAllStudents(sectionId: string): Promise<StudentRow[]> {
  const all: StudentRow[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 20; i++) {
    const page = await api<{ items: StudentRow[]; nextCursor: string | null }>(
      `/students?sectionId=${sectionId}${cursor ? `&cursor=${cursor}` : ""}`,
    );
    all.push(...page.items);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return all;
}

function StudentAttendanceInner() {
  const params = useSearchParams();

  const [schools, setSchools] = useState<SchoolOpt[]>([]);
  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [sections, setSections] = useState<SectionOpt[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);

  const [schoolId, setSchoolId] = useState(params.get("schoolId") ?? "");
  const [classId, setClassId] = useState(params.get("classId") ?? "");
  const [sectionId, setSectionId] = useState(params.get("sectionId") ?? "");
  const [date, setDate] = useState(todayStr());

  const [draft, setDraft] = useState<Record<string, { status: AttendanceStatus; note: string }>>({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const canMark = myRole !== null && MARK_ROLES.includes(myRole);

  useEffect(() => { api<{ role: string }>("/auth/me").then((r) => setMyRole(r.role)).catch(() => setMyRole(null)); }, []);
  useEffect(() => { api<SchoolOpt[]>("/academic/schools").then(setSchools).catch(() => setSchools([])); }, []);
  useEffect(() => { if (!schoolId && schools[0]) setSchoolId(schools[0].id); }, [schools, schoolId]);

  useEffect(() => {
    if (!schoolId) return;
    api<ClassOpt[]>(`/academic/classes?schoolId=${schoolId}`).then(setClasses).catch(() => setClasses([]));
    api<SectionOpt[]>(`/academic/sections?schoolId=${schoolId}`).then(setSections).catch(() => setSections([]));
  }, [schoolId]);

  useEffect(() => { if (!classId && classes[0]) setClassId(classes[0].id); }, [classes, classId]);

  const sectionsForClass = sections.filter((s) => s.classId === classId);
  useEffect(() => { if (!sectionId && sectionsForClass[0]) setSectionId(sectionsForClass[0].id); }, [sectionsForClass, sectionId]);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  // Load the section's roster + that date's existing records together,
  // then seed the draft — students with no record yet default to Present
  // rather than showing blank, since that's the common case for a fresh day.
  useEffect(() => {
    if (!sectionId || !date) { setStudents([]); setDraft({}); return; }
    setLoadingStudents(true);
    Promise.all([
      fetchAllStudents(sectionId),
      api<ExistingRecord[]>(`/attendance/section?sectionId=${sectionId}&date=${date}`).catch(() => []),
    ]).then(([roster, existing]) => {
      setStudents(roster);
      const seed: Record<string, { status: AttendanceStatus; note: string }> = {};
      const byStudent = new Map(existing.map((r) => [r.studentId, r]));
      for (const s of roster) {
        const rec = byStudent.get(s.id);
        seed[s.id] = { status: rec?.status ?? "PRESENT", note: rec?.note ?? "" };
      }
      setDraft(seed);
    }).finally(() => setLoadingStudents(false));
  }, [sectionId, date]);

  async function save() {
    if (!sectionId || students.length === 0) return;
    setSaving(true);
    try {
      await api("/attendance/mark", {
        method: "POST",
        body: JSON.stringify({
          sectionId,
          date,
          entries: students.map((s) => ({
            studentId: s.id,
            status: draft[s.id]?.status ?? "PRESENT",
            note: draft[s.id]?.note || undefined,
          })),
        }),
      });
      setToast(`Attendance saved for ${students.length} student${students.length === 1 ? "" : "s"}`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not save attendance");
    } finally {
      setSaving(false);
    }
  }

  const counts = STATUS_OPTIONS.reduce<Record<AttendanceStatus, number>>((acc, o) => {
    acc[o.value] = students.filter((s) => (draft[s.id]?.status ?? "PRESENT") === o.value).length;
    return acc;
  }, {} as Record<AttendanceStatus, number>);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Attendance</p>
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Student Attendance</h1>
        <p className="mt-1 text-sm text-slate-500">
          {canMark ? "Choose a class and date, then mark each student." : "Read-only — you don't have permission to mark attendance."}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={schoolId} onChange={(e) => { setSchoolId(e.target.value); setClassId(""); setSectionId(""); }} aria-label="School" className={`${inputCls} max-w-xs`}>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(""); }} aria-label="Class" className={`${inputCls} max-w-xs`}>
          <option value="" disabled>Select a class…</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} aria-label="Division" disabled={!classId} className={`${inputCls} max-w-xs`}>
          <option value="" disabled>Select a division…</option>
          {sectionsForClass.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" className={`${inputCls} max-w-xs`} />
      </div>

      {sectionId && students.length > 0 && (
        <p className="text-sm text-slate-500">
          {counts.PRESENT} present · {counts.ABSENT} absent · {counts.LATE} late · {counts.HALF_DAY} half day · {counts.LEAVE} leave
        </p>
      )}

      <Card className="p-0 overflow-hidden">
        {!sectionId ? (
          <p className="p-6 text-sm text-slate-500">Choose a school, class and division to take attendance.</p>
        ) : loadingStudents ? (
          <p className="p-6 text-sm text-slate-500">Loading students…</p>
        ) : students.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No students registered in this division yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">Roll No.</th>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const row = draft[s.id] ?? { status: "PRESENT" as AttendanceStatus, note: "" };
                return (
                  <tr key={s.id} className="border-b border-slate-50 dark:border-white/5">
                    <td className="px-4 py-3 text-slate-500">{s.rollNo || s.admissionNo}</td>
                    <td className="px-4 py-3 font-medium text-night dark:text-white">{s.firstName} {s.lastName}</td>
                    <td className="px-4 py-3">
                      <select
                        value={row.status}
                        onChange={(e) => setDraft((prev) => ({ ...prev, [s.id]: { ...row, status: e.target.value as AttendanceStatus } }))}
                        disabled={!canMark}
                        aria-label={`Status for ${s.firstName} ${s.lastName}`}
                        className={`${inputCls} max-w-[10rem] font-medium ${STATUS_STYLE[row.status]}`}
                      >
                        {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={row.note}
                        onChange={(e) => setDraft((prev) => ({ ...prev, [s.id]: { ...row, note: e.target.value } }))}
                        disabled={!canMark}
                        placeholder="Optional note"
                        aria-label={`Note for ${s.firstName} ${s.lastName}`}
                        className={`${inputCls} max-w-xs`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {canMark && sectionId && students.length > 0 && (
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-white/5 px-4 py-3">
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Attendance"}</Button>
          </div>
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

export default function StudentAttendancePage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading…</p>}>
      <StudentAttendanceInner />
    </Suspense>
  );
}
