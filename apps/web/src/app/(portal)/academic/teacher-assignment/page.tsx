"use client";
import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, RowActions, inputCls } from "@/components/ui/modal";

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
    api<TeacherOpt[]>("/teachers?activeOnly=true").then(setAllTeachers).catch(() => setAllTeachers([]));
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

/** Per-division editor, opened from a row's View/Edit action — the old
 * division-picker-then-grid flow required three dropdowns before any
 * current assignment was even visible; this opens straight from the row
 * that was clicked and shows every subject's current teacher at once,
 * matching the Subjects page's table-of-badges-then-modal-to-edit pattern. */
function AssignmentEditorModal({ title, sectionId, subjects, teachers, assignments, canManage, onClose, onSaved }: {
  title: string; sectionId: string; subjects: SubjectOpt[]; teachers: TeacherOpt[]; assignments: Assignment[];
  canManage: boolean; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const [pending, setPending] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const a of assignments) seed[a.subject.id] = a.teacher.id;
    return seed;
  });
  const [saving, setSaving] = useState(false);

  const changes = subjects.filter((sub) => {
    const current = assignments.find((a) => a.subject.id === sub.id);
    return (current?.teacher.id ?? "") !== (pending[sub.id] ?? "");
  });

  async function save() {
    if (changes.length === 0) return;
    setSaving(true);
    const results = await Promise.allSettled(
      changes.map((sub) => {
        const current = assignments.find((a) => a.subject.id === sub.id);
        const nextTeacherId = pending[sub.id] ?? "";
        return nextTeacherId
          ? api("/teacher-assignments", {
              method: "POST",
              body: JSON.stringify({ sectionId, subjectId: sub.id, teacherId: nextTeacherId }),
            })
          : api(`/teacher-assignments/${current!.id}`, { method: "DELETE" });
      }),
    );
    setSaving(false);
    const failed = results.filter((r) => r.status === "rejected").length;
    onSaved(failed === 0
      ? `${changes.length} change${changes.length === 1 ? "" : "s"} saved`
      : `${changes.length - failed} saved, ${failed} failed`);
  }

  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="space-y-4">
        {subjects.length === 0 ? (
          <p className="text-sm text-slate-500">No subjects registered for this school yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
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
                          disabled={saving || !canManage}
                          aria-label={`Teacher for ${sub.name}`}
                          className={`${inputCls} h-10`}
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
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          {changes.length > 0 && (
            <span className="text-xs text-slate-500">{changes.length} unsaved change{changes.length === 1 ? "" : "s"}</span>
          )}
          <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
          {canManage && (
            <Button type="button" onClick={save} disabled={saving || changes.length === 0}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          )}
        </div>
      </div>
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
  const [editingSection, setEditingSection] = useState<SectionOpt | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
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
    api<TeacherOpt[]>(`/teachers?schoolId=${schoolId}&activeOnly=true`).then(setTeachers).catch(() => setTeachers([]));
    reloadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  const divisions = sections
    .map((s) => ({ section: s, className: classes.find((c) => c.id === s.classId)?.name ?? "—" }))
    .sort((a, b) => a.className.localeCompare(b.className) || a.section.name.localeCompare(b.section.name));

  // Teachers get a flat list of just their own assignments (the backend
  // already scopes /teacher-assignments to the caller for this role) rather
  // than the admin-facing school/division browser below, which would show
  // every subject at the school as "Unassigned" except the ones this
  // teacher happens to teach — misleading for someone who isn't managing
  // the whole school's roster.
  if (myRole === "TEACHER") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">My Assignments</h1>
          <p className="mt-1 text-sm text-slate-500">Every subject and class/division you&apos;re assigned to teach.</p>
        </div>
        <Card className="p-0 overflow-hidden">
          {assignments.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No classes assigned to you yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <th className="px-4 py-3 font-medium">Class</th>
                  <th className="px-4 py-3 font-medium">Subject</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50 dark:border-white/5">
                    <td className="px-4 py-3 text-slate-500">{a.section.class.name} · {a.section.name}</td>
                    <td className="px-4 py-3 font-medium text-night dark:text-white">{a.subject.name}</td>
                  </tr>
                ))}
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Assign Subjects &amp; Teachers</h1>
          <p className="mt-1 text-sm text-slate-500">
            {canManage ? "Pick a school, then open a class/division to assign who teaches each subject." : "Read-only — you don't have permission to change assignments."}
          </p>
        </div>
        {canManage && <Button onClick={() => setBulkOpen(true)}><Plus size={16} /> Bulk Assign</Button>}
      </div>

      <select
        value={schoolId} onChange={(e) => setSchoolId(e.target.value)}
        aria-label="School" className={`${inputCls} max-w-xs`}
      >
        {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      <Card className="p-0 overflow-hidden">
        {divisions.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No classes or divisions registered for this school yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">Class</th>
                <th className="px-4 py-3 font-medium">Division</th>
                <th className="px-4 py-3 font-medium">Subjects</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {divisions.map(({ section, className }) => {
                const sectionAssignments = assignments.filter((a) => a.section.id === section.id);
                return (
                  <tr key={section.id} className="border-b border-slate-50 dark:border-white/5 transition-colors hover:bg-surface dark:hover:bg-white/5">
                    <td className="px-4 py-3 font-medium text-night dark:text-white">{className}</td>
                    <td className="px-4 py-3 text-slate-500">{section.name}</td>
                    <td className="px-4 py-3">
                      {subjects.length === 0 ? (
                        <span className="text-slate-400">No subjects</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {subjects.map((sub) => {
                            const assigned = sectionAssignments.find((a) => a.subject.id === sub.id);
                            return (
                              <span
                                key={sub.id}
                                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                  assigned ? "bg-accent/10 text-accent" : "bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500"
                                }`}
                              >
                                {sub.name}{assigned ? ` — ${assigned.teacher.fullName}` : " — Unassigned"}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <RowActions
                        onView={() => setEditingSection(section)}
                        onEdit={canManage ? () => setEditingSection(section) : undefined}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {editingSection && (
        <AssignmentEditorModal
          title={`${classes.find((c) => c.id === editingSection.classId)?.name ?? "—"} · ${editingSection.name}`}
          sectionId={editingSection.id}
          subjects={subjects}
          teachers={teachers}
          assignments={assignments.filter((a) => a.section.id === editingSection.id)}
          canManage={canManage}
          onClose={() => setEditingSection(null)}
          onSaved={(msg) => { setEditingSection(null); reloadAssignments(); setToast(msg); }}
        />
      )}

      {bulkOpen && (
        <BulkAssignModal
          schools={schools}
          onClose={() => setBulkOpen(false)}
          onDone={(msg) => { setBulkOpen(false); reloadAssignments(); setToast(msg); }}
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
