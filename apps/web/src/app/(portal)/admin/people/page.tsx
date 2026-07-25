"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Users, Pencil } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, Field, inputCls } from "@/components/ui/modal";

const ACCESS_ROLES = new Set(["SUPER_ADMIN"]);
const TABS = ["Students", "Teachers", "Parents"] as const;
type Tab = (typeof TABS)[number];
const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;

interface Me { role: string }
interface Institution { id: string; name: string; institutionType: string }
interface StudentRow {
  id: string; firstName: string; lastName: string; admissionNo: string; rollNo: string | null; gender: string | null;
  section: { name: string; class: { name: string } } | null;
}
interface TeacherRow { id: string; fullName: string; email: string; phone: string | null; gender: string | null; isActive: boolean; tenant?: { name: string } }
interface ParentRow { id: string; fullName: string; email: string; phone: string | null; gender: string | null; isActive: boolean }

function GenderSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      <option value="">Unspecified</option>
      {GENDERS.map((g) => <option key={g} value={g}>{g.charAt(0) + g.slice(1).toLowerCase()}</option>)}
    </select>
  );
}

function InstitutionSelect({ institutions, value, onChange }: { institutions: Institution[]; value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} max-w-xs`}>
      <option value="">All institutions</option>
      {institutions.map((i) => (
        <option key={i.id} value={i.id}>{i.name} ({i.institutionType.charAt(0) + i.institutionType.slice(1).toLowerCase()})</option>
      ))}
    </select>
  );
}

function StudentEditModal({ row, onClose, onSaved }: { row: StudentRow; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    firstName: row.firstName, lastName: row.lastName, admissionNo: row.admissionNo, rollNo: row.rollNo ?? "", gender: row.gender ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api(`/students/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...form, gender: form.gender || undefined }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Edit student" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field id="pe-fn" label="First name">
            <input id="pe-fn" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inputCls} />
          </Field>
          <Field id="pe-ln" label="Last name">
            <input id="pe-ln" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field id="pe-adm" label="Admission no.">
            <input id="pe-adm" required value={form.admissionNo} onChange={(e) => setForm({ ...form, admissionNo: e.target.value })} className={inputCls} />
          </Field>
          <Field id="pe-roll" label="Roll no." optional>
            <input id="pe-roll" value={form.rollNo} onChange={(e) => setForm({ ...form, rollNo: e.target.value })} className={inputCls} />
          </Field>
        </div>
        <Field id="pe-gender" label="Gender" optional>
          <GenderSelect value={form.gender} onChange={(v) => setForm({ ...form, gender: v })} />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function PersonEditModal({ title, endpoint, row, onClose, onSaved }: {
  title: string; endpoint: string; row: { id: string; fullName: string; phone: string | null; gender: string | null; isActive: boolean };
  onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ fullName: row.fullName, phone: row.phone ?? "", gender: row.gender ?? "", isActive: row.isActive });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api(`${endpoint}/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...form, gender: form.gender || undefined }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field id="pe-name" label="Full name">
          <input id="pe-name" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className={inputCls} />
        </Field>
        <Field id="pe-gender" label="Gender" optional>
          <GenderSelect value={form.gender} onChange={(v) => setForm({ ...form, gender: v })} />
        </Field>
        <Field id="pe-phone" label="Phone" optional>
          <input id="pe-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-night dark:text-white">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="accent-primary" />
          Active
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function PeopleDirectoryPage() {
  return (
    <Suspense fallback={null}>
      <PeopleDirectory />
    </Suspense>
  );
}

function PeopleDirectory() {
  const searchParams = useSearchParams();
  const [me, setMe] = useState<Me | null>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    api<Me>("/auth/me").then(setMe).catch(() => setMe(null)).finally(() => setChecked(true));
  }, []);

  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(TABS.includes(initialTab as Tab) ? (initialTab as Tab) : "Students");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [parents, setParents] = useState<ParentRow[]>([]);
  const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null);
  const [editingTeacher, setEditingTeacher] = useState<TeacherRow | null>(null);
  const [editingParent, setEditingParent] = useState<ParentRow | null>(null);

  useEffect(() => {
    if (me && ACCESS_ROLES.has(me.role)) {
      api<Institution[]>("/platform/schools").then(setInstitutions).catch(() => {});
    }
  }, [me]);

  function reload() {
    const params = new URLSearchParams();
    if (schoolId) params.set("schoolId", schoolId);
    if (q) params.set("q", q);
    const qs = params.toString() ? `?${params.toString()}` : "";
    if (tab === "Students") {
      api<{ items: StudentRow[] }>(`/students${qs}`).then((r) => setStudents(r.items)).catch(() => setStudents([]));
    } else if (tab === "Teachers") {
      const p2 = new URLSearchParams(params); p2.set("role", "TEACHER");
      api<TeacherRow[]>(`/users?${p2.toString()}`).then(setTeachers).catch(() => setTeachers([]));
    } else {
      api<ParentRow[]>(`/parents${qs}`).then(setParents).catch(() => setParents([]));
    }
  }
  useEffect(() => { if (me && ACCESS_ROLES.has(me.role)) reload(); }, [me, tab, schoolId, q]);

  if (!checked) return null;
  if (!me || !ACCESS_ROLES.has(me.role)) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">People Directory</h1>
        <Card><p className="text-sm text-slate-500">Your role doesn&apos;t have access to the people directory.</p></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Administrator</p>
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">People Directory</h1>
        <p className="mt-1 text-sm text-slate-500">Every student, teacher and parent across every school, college and institute.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/5">
          {TABS.map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === t ? "bg-white text-night shadow-sm dark:bg-white/10 dark:text-white" : "text-slate-500 dark:text-slate-400"
              }`}>
              {t}
            </button>
          ))}
        </div>
        <InstitutionSelect institutions={institutions} value={schoolId} onChange={setSchoolId} />
        <form onSubmit={(e) => { e.preventDefault(); setQ(searchInput.trim()); }} className="flex gap-2">
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search by name…" className={inputCls} />
          <Button type="submit" variant="ghost">Search</Button>
        </form>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 p-4 dark:border-white/5">
          <Users size={16} className="text-primary" />
          <h2 className="font-display font-semibold text-night dark:text-white">{tab}</h2>
        </div>

        {tab === "Students" && (
          students.length === 0 ? <p className="p-6 text-sm text-slate-500">No students found.</p> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Admission No.</th>
                  <th className="px-4 py-3 font-medium">Class</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                    <td className="px-4 py-3 font-medium text-night dark:text-white">{s.firstName} {s.lastName}</td>
                    <td className="px-4 py-3 text-slate-500">{s.admissionNo}</td>
                    <td className="px-4 py-3 text-slate-500">{s.section ? `${s.section.class.name} · ${s.section.name}` : "Unassigned"}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setEditingStudent(s)} aria-label="Edit student"
                        className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-accent/10 hover:text-accent">
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {tab === "Teachers" && (
          teachers.length === 0 ? <p className="p-6 text-sm text-slate-500">No teachers found.</p> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                    <td className="px-4 py-3 font-medium text-night dark:text-white">{t.fullName}</td>
                    <td className="px-4 py-3 text-slate-500">{t.email}</td>
                    <td className="px-4 py-3 text-slate-500">{t.isActive ? "Active" : "Inactive"}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setEditingTeacher(t)} aria-label="Edit teacher"
                        className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-accent/10 hover:text-accent">
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {tab === "Parents" && (
          parents.length === 0 ? <p className="p-6 text-sm text-slate-500">No parents found.</p> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {parents.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                    <td className="px-4 py-3 font-medium text-night dark:text-white">{p.fullName}</td>
                    <td className="px-4 py-3 text-slate-500">{p.email}</td>
                    <td className="px-4 py-3 text-slate-500">{p.isActive ? "Active" : "Inactive"}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setEditingParent(p)} aria-label="Edit parent"
                        className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-accent/10 hover:text-accent">
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </Card>

      {editingStudent && (
        <StudentEditModal row={editingStudent} onClose={() => setEditingStudent(null)}
          onSaved={() => { setEditingStudent(null); reload(); }} />
      )}
      {editingTeacher && (
        <PersonEditModal title="Edit teacher" endpoint="/users" row={editingTeacher} onClose={() => setEditingTeacher(null)}
          onSaved={() => { setEditingTeacher(null); reload(); }} />
      )}
      {editingParent && (
        <PersonEditModal title="Edit parent" endpoint="/parents" row={editingParent} onClose={() => setEditingParent(null)}
          onSaved={() => { setEditingParent(null); reload(); }} />
      )}
    </div>
  );
}
