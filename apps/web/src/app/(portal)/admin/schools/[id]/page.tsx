"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

interface SchoolDetail {
  school: {
    id: string; name: string; code: string; board: string; city: string | null; state: string | null;
    phone: string | null; email: string | null; tenantName: string; plan: string; status: string;
  };
  students: { id: string; name: string; admissionNo: string; status: string; classLabel: string }[];
  teachers: { id: string; name: string; email: string; isActive: boolean; employeeNo: string; designation: string; department: string }[];
  parents: { id: string; name: string; phone: string; email: string | null; relation: string; studentName: string }[];
  classes: { id: string; name: string; sectionCount: number }[];
  subjects: { id: string; name: string; code: string | null }[];
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-white/5">
        <h2 className="font-display font-semibold text-night dark:text-white">{title}</h2>
        <span className="text-xs text-slate-400">{count}</span>
      </div>
      {children}
    </Card>
  );
}

export default function SchoolDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<SchoolDetail | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api<SchoolDetail>(`/platform/schools/${params.id}`).then(setData).catch(() => setError(true));
  }, [params.id]);

  if (error) return <p className="text-sm text-slate-500">Couldn&apos;t load this school.</p>;
  if (!data) return null;

  const { school, students, teachers, parents, classes, subjects } = data;

  return (
    <div className="space-y-6">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary">
        <ArrowLeft size={15} /> Back to dashboard
      </Link>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-slate-400">{school.tenantName}</p>
            <h1 className="font-display text-2xl font-semibold text-night dark:text-white">{school.name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {school.code} · {school.board}{school.city ? ` · ${school.city}${school.state ? `, ${school.state}` : ""}` : ""}
            </p>
          </div>
          <div className="text-right text-sm text-slate-500">
            <p>{school.plan} plan · {school.status}</p>
            {school.phone && <p>{school.phone}</p>}
            {school.email && <p>{school.email}</p>}
          </div>
        </div>
      </Card>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Card><p className="text-xs uppercase tracking-wide text-slate-400">Students</p><p className="mt-1 text-2xl font-semibold text-night dark:text-white">{students.length}</p></Card>
        <Card><p className="text-xs uppercase tracking-wide text-slate-400">Teachers</p><p className="mt-1 text-2xl font-semibold text-night dark:text-white">{teachers.length}</p></Card>
        <Card><p className="text-xs uppercase tracking-wide text-slate-400">Parents</p><p className="mt-1 text-2xl font-semibold text-night dark:text-white">{parents.length}</p></Card>
        <Card><p className="text-xs uppercase tracking-wide text-slate-400">Classes</p><p className="mt-1 text-2xl font-semibold text-night dark:text-white">{classes.length}</p></Card>
      </div>

      <Section title="Students" count={students.length}>
        {students.length === 0 ? <p className="p-6 text-sm text-slate-500">No students yet.</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Admission No.</th>
                <th className="px-4 py-3 font-medium">Class</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                  <td className="px-4 py-3 font-medium text-night dark:text-white">{s.name}</td>
                  <td className="px-4 py-3 text-slate-500">{s.admissionNo}</td>
                  <td className="px-4 py-3 text-slate-500">{s.classLabel}</td>
                  <td className="px-4 py-3 text-slate-500">{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Teachers" count={teachers.length}>
        {teachers.length === 0 ? <p className="p-6 text-sm text-slate-500">No teachers yet.</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Designation</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                  <td className="px-4 py-3 font-medium text-night dark:text-white">{t.name}</td>
                  <td className="px-4 py-3 text-slate-500">{t.email}</td>
                  <td className="px-4 py-3 text-slate-500">{t.designation}</td>
                  <td className="px-4 py-3 text-slate-500">{t.department}</td>
                  <td className="px-4 py-3 text-slate-500">{t.isActive ? "Active" : "Inactive"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Parents / Guardians" count={parents.length}>
        {parents.length === 0 ? <p className="p-6 text-sm text-slate-500">No guardians yet.</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Relation</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Child</th>
              </tr>
            </thead>
            <tbody>
              {parents.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                  <td className="px-4 py-3 font-medium text-night dark:text-white">{p.name}</td>
                  <td className="px-4 py-3 text-slate-500">{p.relation}</td>
                  <td className="px-4 py-3 text-slate-500">{p.phone}</td>
                  <td className="px-4 py-3 text-slate-500">{p.studentName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Classes & Subjects" count={classes.length + subjects.length}>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Classes</p>
            {classes.length === 0 ? <p className="text-sm text-slate-500">None yet.</p> : (
              <ul className="space-y-1.5 text-sm">
                {classes.map((c) => (
                  <li key={c.id} className="flex justify-between text-night dark:text-white">
                    <span>{c.name}</span><span className="text-slate-400">{c.sectionCount} division{c.sectionCount === 1 ? "" : "s"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Subjects</p>
            {subjects.length === 0 ? <p className="text-sm text-slate-500">None yet.</p> : (
              <ul className="space-y-1.5 text-sm text-night dark:text-white">
                {subjects.map((s) => <li key={s.id}>{s.name}{s.code ? ` (${s.code})` : ""}</li>)}
              </ul>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}
