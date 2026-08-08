"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { api, auth } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, inputCls } from "@/components/ui/modal";

const ACCESS_ROLES = new Set(["SUPER_ADMIN"]);
const TYPES = ["COLLEGE", "INSTITUTE", "CENTRE", "COMPANY"] as const;

interface Me { role: string }

export default function RegisterInstitutePage() {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register institution");
    } finally {
      setSaving(false);
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
            Its admin can sign in now with {result.email} and the password you set. See it in{" "}
            <Link href="/admin/registered-institutes" className="text-primary hover:underline">View Registered Institutes</Link>.
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

      <p className="text-sm text-slate-500">
        <Link href="/admin/registered-institutes" className="inline-flex items-center gap-1.5 text-primary hover:underline">
          <Building2 size={14} /> View Registered Institutes
        </Link>
      </p>
    </div>
  );
}
