"use client";
import { useEffect, useRef, useState } from "react";
import { Modal, Field, inputCls } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";

export const BOARDS = ["CBSE", "ICSE", "IB", "IGCSE", "STATE", "OTHER"] as const;
export const PLANS = ["STARTER", "GROWTH", "ENTERPRISE"] as const;
export const STATUSES = ["ACTIVE", "SUSPENDED", "TRIAL"] as const;
export const INSTITUTION_TYPES = ["SCHOOL", "COLLEGE", "INSTITUTE", "CENTRE", "COMPANY"] as const;

export interface SchoolFull {
  id: string; name: string; code: string; institutionType: string; board: string;
  address: string | null; city: string | null; state: string | null; country: string | null; pincode: string | null;
  phone: string | null; email: string | null; logoUrl: string | null;
  plan: string; status: string;
}
export type SchoolForm = {
  name: string; code: string; institutionType: string; board: string;
  address: string; city: string; state: string; country: string; pincode: string;
  phone: string; email: string; logoUrl: string; plan: string; status: string;
};

export function toSchoolForm(s: SchoolFull): SchoolForm {
  return {
    name: s.name, code: s.code, institutionType: s.institutionType, board: s.board,
    address: s.address ?? "", city: s.city ?? "", state: s.state ?? "", country: s.country ?? "", pincode: s.pincode ?? "",
    phone: s.phone ?? "", email: s.email ?? "", logoUrl: s.logoUrl ?? "",
    plan: s.plan, status: s.status,
  };
}

/** Shared edit form for any School row (Schools, Colleges, Institutes all
 * share this one model — see institutionType). Used by the Super Admin
 * dashboard's Registered Schools table and the Colleges/Institutes page. */
export function SchoolEditModal({ schoolId, onClose, onSaved }: { schoolId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<SchoolForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ school: SchoolFull }>(`/platform/schools/${schoolId}`).then((r) => setForm(toSchoolForm(r.school))).catch(() => setError("Could not load school"));
  }, [schoolId]);

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

  /** Uploads straight to Supabase Storage from the browser, same as
   * register-school — the Super Admin already holds a valid Supabase
   * session, so no backend endpoint is needed just to shuttle the file. */
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
    if (!form) return;
    setError(null);
    setBusy(true);
    try {
      const logoUrl = await uploadLogo();
      await api(`/platform/schools/${schoolId}`, {
        method: "PATCH",
        body: JSON.stringify({ ...form, ...(logoUrl && { logoUrl }) }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Edit institution" onClose={onClose} wide>
      {!form ? (
        <p className="text-sm text-slate-500">{error ?? "Loading…"}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="se-name" label="Name">
              <input id="se-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
            </Field>
            <Field id="se-code" label="Code">
              <input id="se-code" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={inputCls} />
            </Field>
            <Field id="se-logo" label="Logo" optional>
              <div className="flex items-center gap-4">
                {logoPreview || form.logoUrl ? (
                  <img src={logoPreview ?? form.logoUrl} alt="Logo preview" className="h-16 w-16 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-white/10" />
                ) : (
                  <div className="grid h-16 w-16 place-items-center rounded-xl bg-surface text-xs text-slate-400 dark:bg-white/5">No logo</div>
                )}
                <div>
                  <input id="se-logo" ref={fileInputRef} type="file" accept="image/*" onChange={pickLogo}
                    className="block text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:opacity-90" />
                  {logoError && <p className="mt-1 text-xs text-danger">{logoError}</p>}
                </div>
              </div>
            </Field>
            <Field id="se-type" label="Institution type">
              <select id="se-type" value={form.institutionType} onChange={(e) => setForm({ ...form, institutionType: e.target.value })} className={inputCls}>
                {INSTITUTION_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
              </select>
            </Field>
            <Field id="se-board" label="Board" optional>
              <select id="se-board" value={form.board} onChange={(e) => setForm({ ...form, board: e.target.value })} className={inputCls}>
                {BOARDS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
            <Field id="se-address" label="Address" optional>
              <input id="se-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls} />
            </Field>
            <Field id="se-city" label="City / Place" optional>
              <input id="se-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputCls} />
            </Field>
            <Field id="se-state" label="State" optional>
              <input id="se-state" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className={inputCls} />
            </Field>
            <Field id="se-country" label="Country" optional>
              <input id="se-country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className={inputCls} />
            </Field>
            <Field id="se-pincode" label="Pincode" optional>
              <input id="se-pincode" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} className={inputCls} />
            </Field>
            <Field id="se-phone" label="Contact number" optional>
              <input id="se-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
            </Field>
            <Field id="se-email" label="Email" optional>
              <input id="se-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
            </Field>
            <Field id="se-plan" label="Plan">
              <select id="se-plan" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} className={inputCls}>
                {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field id="se-status" label="Status">
              <select id="se-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
