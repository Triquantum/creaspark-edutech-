"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, inputCls } from "@/components/ui/modal";

interface SchoolOpt { id: string; name: string }
interface ClassOpt { id: string; name: string; schoolId: string }
interface SectionOpt { id: string; name: string; classId: string; schoolId: string }
interface SubjectOpt { id: string; name: string }
interface TeacherOpt { id: string; fullName: string; staffProfile?: { schoolId?: string } | null }
interface Assignment {
  id: string;
  teacher: { id: string; fullName: string };
  subject: { id: string; name: string };
  section: { id: string; name: string; class: { id: string; name: string; school: { name: string } } };
}

const MANAGE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "COORDINATOR"];

let bulkRowKey = 0;
interface BulkRow { key: number; schoolId: string; classId: string; sectionId: string; subjectId: string; teacherId: string }
const blankBulkRow = (): BulkRow => ({ key: bulkRowKey++, schoolId: "", classId: "", sectionId: "", subjectId: "", teacherId: "" });

function BulkAssignModal({ schools, onClose, onDone }: {
  schools: SchoolOpt[]; onClose: () => void; onDone: (msg: string) => void;
}) {
  const [allClasses, setAllClasses] = useState<ClassOpt[]>([]);
  const [allSections, setAllSections] = useState<SectionOpt[]>([]);
  const [allSubjects, setAllSubjects] = useState<SubjectOpt[]>([]);
  const [allTeachers, setAllTeachers] = useState<TeacherOpt[]>([]);
  const [rows, setRows] = useState<BulkRow[]>([blankBulkRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<ClassOpt[]>("/academic/classes").then(setAllClasses).catch(() => setAllClasses([]));
    api<SectionOpt[]>("/academic/sections").then(setAllSections).catch(() => setAllSections([]));
    api<SubjectOpt[]>("/academic/subjects").then(setAllSubjects).catch(() => setAllSubjects([]));
    api<TeacherOpt[]>("/teachers").then(setAllTeachers).catch(() => setAllTeachers([]));
  }, []);

  function updateRow(key: number, patch: Partial<BulkRow>) {
    setRows((prev) => prev.map((r) => {
      if (r.key !== key) return r;
      const next = { ...r, ...patch };
      if (patch.schoolId !== undefined) { next.classId = ""; next.sectionId = ""; next.teacherId = ""; }
      if (patch.classId !== undefined) next.sectionId = "";
      return next;
    }));
  }

  async function saveAll(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const complete = rows.filter((r) => r.schoolId && r.sectionId && r.subjectId && r.teacherId);
    if (complete.length === 0) { setError("Fill in at least one complete row (school, class, division, subject and teacher)."); return; }
    setSaving(true);
    const results = await Promise.allSettled(
      complete.map((r) => api("/teacher-assignments", {
        method: "POST",
        body: JSON.stringify({ sectionId: r.sectionId, subjectId: r.subjectId, teacherId: r.teacherId }),
      })),
    );
    setSaving(false);
    const failed = results.filter((r) => r.status === "rejected").length;
    onDone(failed === 0
      ? `${complete.length} assignment${complete.length === 1 ? "" : "s"} saved`
      : `${complete.length - failed} saved, ${failed} failed`);
  }

  return (
    <Modal title="Bulk Assign" onClose={onClose} wide>
      <form onSubmit={saveAll} className="space-y-4">
        <p className="text-sm text-slate-500">Add as many rows as you need — each can target a different school, class, division and subject.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-2 py-2 font-medium">School</th>
                <th className="px-2 py-2 font-medium">Class</th>
                <th className="px-2 py-2 font-medium">Division</th>
                <th className="px-2 py-2 font-medium">Subject</th>
                <th className="px-2 py-2 font-medium">Teacher</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const classesForSchool = allClasses.filter((c) => c.schoolId === r.schoolId);
                const sectionsForClass = allSections.filter((s) => s.classId === r.classId);
                const teachersForSchool = allTeachers.filter((t) => t.staffProfile?.schoolId === r.schoolId);
                return (
                  <tr key={r.key} className="border-b border-slate-50 dark:border-white/5">
                    <td className="px-2 py-2">
                      <select value={r.schoolId} onChange={(e) => updateRow(r.key, { schoolId: e.target.value })} className={`${inputCls} h-10`} aria-label="School">
                        <option value="" disabled>School…</option>
                        {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <select value={r.classId} onChange={(e) => updateRow(r.key, { classId: e.target.value })} disabled={!r.schoolId} className={`${inputCls} h-10`} aria-label="Class">
                        <option value="" disabled>Class…</option>
                        {classesForSchool.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <select value={r.sectionId} onChange={(e) => updateRow(r.key, { sectionId: e.target.value })} disabled={!r.classId} className={`${inputCls} h-10`} aria-label="Division">
                        <option value="" disabled>Division…</option>
                        {sectionsForClass.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <select value={r.subjectId} onChange={(e) => updateRow(r.key, { subjectId: e.target.value })} className={`${inputCls} h-10`} aria-label="Subject">
                        <option value="" disabled>Subject…</option>
                        {allSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <select value={r.teacherId} onChange={(e) => updateRow(r.key, { teacherId: e.target.value })} disabled={!r.schoolId} className={`${inputCls} h-10`} aria-label="Teacher">
                        <option value="" disabled>Teacher…</option>
                        {teachersForSchool.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <button type="button" onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
                        aria-label="Remove row" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-danger/10 hover:text-danger">
                        <X size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Button type="button" variant="ghost" onClick={() => setRows((prev) => [...prev, blankBulkRow()])}>
          <Plus size={16} /> Add row
        </Button>

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save all"}</Button>
        </div>
      </form>
    </Modal>
  );
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
  // Draft teacher picks for the grid below, keyed by subjectId — kept
  // separate from `assignments` so each subject's pick stays independent
  // until Save is pressed, instead of writing to the server (and to every
  // other row's rendered value) on every single dropdown change.
  const [pending, setPending] = useState<Record<string, string>>({});
  const [savingGrid, setSavingGrid] = useState(false);
  // Same draft pattern for the "All Assignments" table, keyed by assignment.id.
  const [pendingAll, setPendingAll] = useState<Record<string, string>>({});
  const [savingAllTable, setSavingAllTable] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [removing, setRemoving] = useState<Assignment | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const canManage = myRole !== null && MANAGE_ROLES.includes(myRole);

  useEffect(() => { api<{ role: string }>("/auth/me").then((r) => setMyRole(r.role)).catch(() => setMyRole(null)); }, []);
  useEffect(() => { api<SchoolOpt[]>("/academic/schools").then(setSchools).catch(() => setSchools([])); }, []);
  useEffect(() => { if (!schoolId && schools[0]) setSchoolId(schools[0].id); }, [schools, schoolId]);

  function reloadAssignments() {
    if (!schoolId) { setAssignments([]); return; }
    api<Assignment[]>(`/teacher-assignments?schoolId=${schoolId}`).then(setAssignments).catch(() => setAssignments([]));
  }

  useEffect(() => {
    if (!schoolId) return;
    api<ClassOpt[]>(`/academic/classes?schoolId=${schoolId}`).then(setClasses).catch(() => setClasses([]));
    api<SectionOpt[]>(`/academic/sections?schoolId=${schoolId}`).then(setSections).catch(() => setSections([]));
    api<SubjectOpt[]>(`/academic/subjects?schoolId=${schoolId}`).then(setSubjects).catch(() => setSubjects([]));
    api<TeacherOpt[]>(`/teachers?schoolId=${schoolId}`).then(setTeachers).catch(() => setTeachers([]));
    reloadAssignments();
    setClassId(""); setSectionId("");
  }, [schoolId]);

  useEffect(() => { if (!classId && classes[0]) setClassId(classes[0].id); }, [classes, classId]);

  const sectionsForClass = sections.filter((s) => s.classId === classId);
  useEffect(() => { if (!sectionId && sectionsForClass[0]) setSectionId(sectionsForClass[0].id); }, [sectionsForClass, sectionId]);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  const currentAssignments = assignments.filter((a) => a.section.id === sectionId);

  // Re-seed the draft grid from the server's own truth whenever the division
  // changes (a fresh draft per division) or assignments are reloaded (e.g.
  // after Save) — never on every keystroke/selection, so in-progress picks
  // for other subjects in the same grid aren't wiped out mid-edit.
  useEffect(() => {
    const seed: Record<string, string> = {};
    for (const a of assignments) {
      if (a.section.id === sectionId) seed[a.subject.id] = a.teacher.id;
    }
    setPending(seed);
  }, [sectionId, assignments]);

  const gridChanges = subjects.filter((sub) => {
    const current = currentAssignments.find((a) => a.subject.id === sub.id);
    return (current?.teacher.id ?? "") !== (pending[sub.id] ?? "");
  });

  async function saveGrid() {
    if (gridChanges.length === 0) return;
    setSavingGrid(true);
    const results = await Promise.allSettled(
      gridChanges.map((sub) => {
        const current = currentAssignments.find((a) => a.subject.id === sub.id);
        const nextTeacherId = pending[sub.id] ?? "";
        return nextTeacherId
          ? api("/teacher-assignments", {
              method: "POST",
              body: JSON.stringify({ sectionId, subjectId: sub.id, teacherId: nextTeacherId }),
            })
          : api(`/teacher-assignments/${current!.id}`, { method: "DELETE" });
      }),
    );
    setSavingGrid(false);
    reloadAssignments();
    const failed = results.filter((r) => r.status === "rejected").length;
    const count = gridChanges.length;
    setToast(failed === 0
      ? `${count} change${count === 1 ? "" : "s"} saved`
      : `${count - failed} saved, ${failed} failed`);
  }

  // Draft picks for the "All Assignments" table, reset whenever the
  // underlying data is reloaded (e.g. after this table's own Save, or a
  // Bulk Assign) so it always starts from the server's own truth.
  useEffect(() => {
    const seed: Record<string, string> = {};
    for (const a of assignments) seed[a.id] = a.teacher.id;
    setPendingAll(seed);
  }, [assignments]);

  const allChanges = assignments.filter((a) => (pendingAll[a.id] ?? a.teacher.id) !== a.teacher.id);

  async function saveAllTable() {
    if (allChanges.length === 0) return;
    setSavingAllTable(true);
    const results = await Promise.allSettled(
      allChanges.map((a) => api("/teacher-assignments", {
        method: "POST",
        body: JSON.stringify({ sectionId: a.section.id, subjectId: a.subject.id, teacherId: pendingAll[a.id] }),
      })),
    );
    setSavingAllTable(false);
    reloadAssignments();
    const failed = results.filter((r) => r.status === "rejected").length;
    const count = allChanges.length;
    setToast(failed === 0
      ? `${count} change${count === 1 ? "" : "s"} saved`
      : `${count - failed} saved, ${failed} failed`);
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);
    try {
      await api(`/teacher-assignments/${removing.id}`, { method: "DELETE" });
      setAssignments((prev) => prev.filter((x) => x.id !== removing.id));
      setRemoving(null);
      setToast("Removed");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not remove");
      setRemoving(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Assign Subjects &amp; Teachers</h1>
          <p className="mt-1 text-sm text-slate-500">
            {canManage ? "Choose a school, class and division, then pick who teaches each subject." : "Read-only — you don't have permission to change assignments."}
          </p>
        </div>
        {canManage && <Button onClick={() => setBulkOpen(true)}><Plus size={16} /> Bulk Assign</Button>}
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
                const current = currentAssignments.find((a) => a.subject.id === sub.id);
                const changed = (current?.teacher.id ?? "") !== (pending[sub.id] ?? "");
                return (
                  <tr key={sub.id} className="border-b border-slate-50 dark:border-white/5">
                    <td className="px-4 py-3 font-medium text-night dark:text-white">
                      {sub.name}
                      {changed && <span className="ml-2 text-xs font-normal text-accent">Unsaved</span>}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={pending[sub.id] ?? ""}
                        onChange={(e) => setPending((prev) => ({ ...prev, [sub.id]: e.target.value }))}
                        disabled={savingGrid || !canManage}
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
        {canManage && sectionId && subjects.length > 0 && (
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-white/5 px-4 py-3">
            {gridChanges.length > 0 && (
              <span className="text-xs text-slate-500">
                {gridChanges.length} unsaved change{gridChanges.length === 1 ? "" : "s"}
              </span>
            )}
            <Button onClick={saveGrid} disabled={savingGrid || gridChanges.length === 0}>
              {savingGrid ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        )}
      </Card>

      <div>
        <h2 className="font-display text-lg font-semibold text-night dark:text-white">{myRole === "TEACHER" ? "My Assignments" : "All Assignments"}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {myRole === "TEACHER"
            ? "Every subject and class/division you're assigned to teach."
            : "Every subject-teacher assignment at this school, across all classes and divisions."}
        </p>
      </div>

      <Card className="p-0 overflow-hidden">
        {assignments.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">{myRole === "TEACHER" ? "No classes assigned to you yet." : "No assignments yet at this school."}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">Class</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Teacher</th>
                {canManage && <th className="px-4 py-3 text-right font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => {
                const changed = (pendingAll[a.id] ?? a.teacher.id) !== a.teacher.id;
                return (
                  <tr key={a.id} className="border-b border-slate-50 dark:border-white/5">
                    <td className="px-4 py-3 text-slate-500">{a.section.class.name} · {a.section.name}</td>
                    <td className="px-4 py-3 font-medium text-night dark:text-white">
                      {a.subject.name}
                      {changed && <span className="ml-2 text-xs font-normal text-accent">Unsaved</span>}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={pendingAll[a.id] ?? a.teacher.id}
                        onChange={(e) => setPendingAll((prev) => ({ ...prev, [a.id]: e.target.value }))}
                        disabled={savingAllTable || !canManage}
                        aria-label={`Teacher for ${a.subject.name} in ${a.section.class.name} ${a.section.name}`}
                        className={`${inputCls} h-10 max-w-xs`}
                      >
                        {teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                      </select>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setRemoving(a)} aria-label="Remove assignment" title="Remove"
                          className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-danger/10 hover:text-danger">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {canManage && assignments.length > 0 && (
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-white/5 px-4 py-3">
            {allChanges.length > 0 && (
              <span className="text-xs text-slate-500">
                {allChanges.length} unsaved change{allChanges.length === 1 ? "" : "s"}
              </span>
            )}
            <Button onClick={saveAllTable} disabled={savingAllTable || allChanges.length === 0}>
              {savingAllTable ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        )}
      </Card>

      {bulkOpen && (
        <BulkAssignModal
          schools={schools}
          onClose={() => setBulkOpen(false)}
          onDone={(msg) => { setBulkOpen(false); reloadAssignments(); setToast(msg); }}
        />
      )}

      {removing && (
        <ConfirmDialog
          title="Remove assignment?"
          message={`This unassigns ${removing.teacher.fullName} from ${removing.subject.name} in ${removing.section.class.name} · ${removing.section.name}.`}
          onConfirm={confirmRemove}
          onClose={() => setRemoving(null)}
          busy={busy}
        />
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 right-6 z-50 rounded-xl bg-night px-4 py-3 text-sm text-white shadow-lift">
          {toast}
        </div>
      )}
    </div>
  );
}
