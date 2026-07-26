"use client";
import { useEffect, useRef, useState } from "react";
import { api, auth } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, inputCls } from "@/components/ui/modal";

const ACCESS_ROLES = new Set(["SUPER_ADMIN"]);

interface Me { role: string }

export default function RegisterSchoolPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    api<Me>("/auth/me").then(setMe).catch(() => setMe(null)).finally(() => setChecked(true));
  }, []);

  const [form, setForm] = useState({ schoolName: "", schoolCode: "", adminFullName: "", adminEmail: "", adminPassword: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ name: string; slug: string; email: string } | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function pickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setLogoError(null);
    if (file && !file.type.startsWith("image/")) {
      setLogoError("Choose an image file");
      return;
    }
    setLogoFile(file);
    setLogoPreview(file ? URL.createObjectURL(file) : null);
  }

  function clearLogo() {
    setLogoFile(null);
    setLogoPreview(null);
    setLogoError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /** Uploads straight to Supabase Storage from the browser — the Super
   * Admin already holds a valid Supabase session, so no backend endpoint
   * is needed just to shuttle the file through. */
  async function uploadLogo(): Promise<string | undefined> {
    if (!logoFile) return undefined;
    const ext = logoFile.name.split(".").pop() ?? "png";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from("school-logos").upload(path, logoFile, {
      contentType: logoFile.type, upsert: false,
    });
    if (uploadErr) throw new Error(`Logo upload failed: ${uploadErr.message}`);
    return supabase.storage.from("school-logos").getPublicUrl(path).data.publicUrl;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.adminPassword !== form.confirm) {
      setError("Passwords don't match");
      return;
    }
    setSaving(true);
    try {
      const logoUrl = await uploadLogo();
      const email = form.adminEmail.trim().toLowerCase();
      const res = await auth.registerSchool({
        schoolName: form.schoolName.trim(),
        schoolCode: form.schoolCode.trim(),
        adminFullName: form.adminFullName.trim(),
        adminEmail: email,
        adminPassword: form.adminPassword,
        logoUrl,
      });
      setResult({ name: res.tenant.name, slug: res.tenant.slug, email });
      setForm({ schoolName: "", schoolCode: "", adminFullName: "", adminEmail: "", adminPassword: "", confirm: "" });
      clearLogo();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register school");
    } finally {
      setSaving(false);
    }
  }

  if (!checked) return null;

  if (!me || !ACCESS_ROLES.has(me.role)) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Register School</h1>
        <Card><p className="text-sm text-slate-500">Your role doesn&apos;t have access to school registration.</p></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Administrator</p>
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Register School</h1>
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
          <Field id="rs-name" label="School name">
            <input id="rs-name" required value={form.schoolName} onChange={set("schoolName")} className={inputCls} />
          </Field>
          <Field id="rs-code" label="School code">
            <input id="rs-code" required value={form.schoolCode} onChange={set("schoolCode")}
              placeholder="e.g. sunrise-public" className={inputCls} />
            <p className="mt-1 text-xs text-slate-400">Letters, numbers and dashes — identifies this school internally.</p>
          </Field>
          <Field id="rs-logo" label="School logo" optional>
            <div className="flex items-center gap-4">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo preview" className="h-16 w-16 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-white/10" />
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-xl bg-surface text-xs text-slate-400 dark:bg-white/5">No logo</div>
              )}
              <div>
                <input id="rs-logo" ref={fileInputRef} type="file" accept="image/*" onChange={pickLogo}
                  className="block text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:opacity-90" />
                {logoFile && (
                  <button type="button" onClick={clearLogo} className="mt-1 text-xs text-danger hover:underline">Remove</button>
                )}
                {logoError && <p className="mt-1 text-xs text-danger">{logoError}</p>}
              </div>
            </div>
          </Field>
          <Field id="rs-admin-name" label="Admin name">
            <input id="rs-admin-name" required value={form.adminFullName} onChange={set("adminFullName")} className={inputCls} />
          </Field>
          <Field id="rs-admin-email" label="Admin email">
            <input id="rs-admin-email" type="email" required value={form.adminEmail} onChange={set("adminEmail")} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="rs-pw" label="Admin password">
              <input id="rs-pw" type="password" required minLength={8} value={form.adminPassword} onChange={set("adminPassword")} className={inputCls} />
            </Field>
            <Field id="rs-pw2" label="Confirm password">
              <input id="rs-pw2" type="password" required minLength={8} value={form.confirm} onChange={set("confirm")} className={inputCls} />
            </Field>
          </div>

          {error && <p role="alert" className="text-sm text-danger">{error}</p>}

          <div className="flex justify-end pt-1">
            <Button type="submit" disabled={saving}>{saving ? "Registering…" : "Register school"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
