"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { api, auth } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, inputCls, ConfirmDialog, RowActions } from "@/components/ui/modal";
import { SchoolEditModal } from "@/components/platform/school-edit-modal";

const ACCESS_ROLES = new Set(["SUPER_ADMIN"]);
const TYPES = ["COLLEGE", "INSTITUTE"] as const;

interface Me { role: string }
interface InstitutionRow {
  id: string; name: string; institutionType: string; slug: string; plan: string; status: string; createdAt: string;
  students: number; teachers: number; parents: number;
}
interface PlatformSummary { schools: InstitutionRow[] }

export default function RegisterInstitutePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    api<Me>("/auth/me").then(setMe).catch(() => setMe(null)).finally(() => setChecked(true));
  }, []);

  const [form, setForm] = useState({
    institutionType: "COLLEGE" as (typeof TYPES)[number],
    schoolName: "", schoolCode: "", adminFullName: "", adminEmail: "", adminPassword: "", confirm: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ name: string; slug: string; email: string } | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const [institutions, setInstitutions] = useState<InstitutionRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<InstitutionRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function loadInstitutions() {
    api<PlatformSummary>("/platform/summary")
      .then((r) => setInstitutions(r.schools.filter((s) => s.institutionType !== "SCHOOL")))
      .catch(() => {});
  }
  useEffect(() => { if (me && ACCESS_ROLES.has(me.role)) loadInstitutions(); }, [me]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.adminPassword !== form.confirm) {
      setError("Passwords don't match");
      return;
    }
    setSaving(true);
    try {
      const email = form.adminEmail.trim().toLowerCase();
      const res = await auth.registerSchool({
        schoolName: form.schoolName.trim(),
        schoolCode: form.schoolCode.trim(),
        adminFullName: form.adminFullName.trim(),
        adminEmail: email,
        adminPassword: form.adminPassword,
        institutionType: form.institutionType,
      });
      setResult({ name: res.tenant.name, slug: res.tenant.slug, email });
      setForm({ institutionType: form.institutionType, schoolName: "", schoolCode: "", adminFullName: "", adminEmail: "", adminPassword: "", confirm: "" });
      loadInstitutions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register institution");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await api(`/platform/schools/${deleting.id}`, { method: "DELETE" });
      setDeleting(null);
      loadInstitutions();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  }

  if (!checked) return null;

  if (!me || !ACCESS_ROLES.has(me.role)) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Colleges &amp; Institutes</h1>
        <Card><p className="text-sm text-slate-500">Your role doesn&apos;t have access to institution registration.</p></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Administrator</p>
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Colleges &amp; Institutes</h1>
        <p className="mt-1 text-sm text-slate-500">Register a college or institute — each gets its own students and teachers, isolated from every other institution.</p>
      </div>

      {result && (
        <Card className="border border-success/30 bg-success/5">
          <p className="text-sm text-night dark:text-white">
            ✓ <span className="font-medium">{result.name}</span> (code &quot;{result.slug}&quot;) is registered.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Its admin can sign in now with {result.email} and the password you set.
          </p>
        </Card>
      )}

      <Card className="max-w-xl">
        <form onSubmit={submit} className="space-y-4">
          <Field id="ri-type" label="Institution type">
            <select id="ri-type" value={form.institutionType} onChange={set("institutionType")} className={inputCls}>
              {TYPES.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
            </select>
          </Field>
          <Field id="ri-name" label="Name">
            <input id="ri-name" required value={form.schoolName} onChange={set("schoolName")} className={inputCls} />
          </Field>
          <Field id="ri-code" label="Code">
            <input id="ri-code" required value={form.schoolCode} onChange={set("schoolCode")}
              placeholder="e.g. sunrise-college" className={inputCls} />
            <p className="mt-1 text-xs text-slate-400">Letters, numbers and dashes — identifies this institution internally.</p>
          </Field>
          <Field id="ri-admin-name" label="Admin name">
            <input id="ri-admin-name" required value={form.adminFullName} onChange={set("adminFullName")} className={inputCls} />
          </Field>
          <Field id="ri-admin-email" label="Admin email">
            <input id="ri-admin-email" type="email" required value={form.adminEmail} onChange={set("adminEmail")} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="ri-pw" label="Admin password">
              <input id="ri-pw" type="password" required minLength={8} value={form.adminPassword} onChange={set("adminPassword")} className={inputCls} />
            </Field>
            <Field id="ri-pw2" label="Confirm password">
              <input id="ri-pw2" type="password" required minLength={8} value={form.confirm} onChange={set("confirm")} className={inputCls} />
            </Field>
          </div>

          {error && <p role="alert" className="text-sm text-danger">{error}</p>}

          <div className="flex justify-end pt-1">
            <Button type="submit" disabled={saving}>{saving ? "Registering…" : "Register institution"}</Button>
          </div>
        </form>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 p-4 dark:border-white/5">
          <Building2 size={16} className="text-primary" />
          <h2 className="font-display font-semibold text-night dark:text-white">Registered Colleges &amp; Institutes</h2>
        </div>
        {institutions.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">None registered yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Students</th>
                <th className="px-4 py-3 text-right font-medium">Teachers</th>
                <th className="px-4 py-3 text-right font-medium">Parents</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {institutions.map((s) => (
                <tr key={s.id} className="border-b border-slate-50 last:border-0 dark:border-white/5 transition-colors hover:bg-surface dark:hover:bg-white/5">
                  <td className="px-4 py-3 font-medium text-night dark:text-white">{s.name}</td>
                  <td className="px-4 py-3 text-slate-500">{s.institutionType.charAt(0) + s.institutionType.slice(1).toLowerCase()}</td>
                  <td className="px-4 py-3 text-slate-500">{s.status}</td>
                  <td className="px-4 py-3 text-right text-night dark:text-white">{s.students}</td>
                  <td className="px-4 py-3 text-right text-night dark:text-white">{s.teachers}</td>
                  <td className="px-4 py-3 text-right text-night dark:text-white">{s.parents}</td>
                  <td className="px-4 py-3">
                    <RowActions
                      onView={() => router.push(`/admin/schools/${s.id}`)}
                      onEdit={() => setEditingId(s.id)}
                      onDelete={() => setDeleting(s)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {editingId && (
        <SchoolEditModal schoolId={editingId} onClose={() => setEditingId(null)}
          onSaved={() => { setEditingId(null); loadInstitutions(); }} />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete institution?"
          message={deleteError ?? `This permanently removes "${deleting.name}". Institutions with students or staff on record can't be deleted — set their status to Suspended instead.`}
          onConfirm={confirmDelete}
          onClose={() => { setDeleting(null); setDeleteError(null); }}
          busy={busy}
        />
      )}
    </div>
  );
}
