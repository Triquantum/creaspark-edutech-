"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, RowActions, Field, inputCls } from "@/components/ui/modal";

interface Me { role: string }
interface HolidayRow {
  id: string; subject: string; description: string | null; remarks: string | null;
  startDate: string; endDate: string; images: string[];
  createdBy: { fullName: string }; createdAt: string;
}

const MANAGE_ROLES = ["SUPER_ADMIN", "ORG_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "COORDINATOR"];

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtRange(start: string, end: string) {
  return start === end || fmtDate(start) === fmtDate(end) ? fmtDate(start) : `${fmtDate(start)} – ${fmtDate(end)}`;
}

function HolidayDialog({ mode, initial, onClose, onSaved }: {
  mode: "add" | "edit"; initial?: HolidayRow; onClose: () => void; onSaved: () => void;
}) {
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate.slice(0, 10) ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate.slice(0, 10) ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [remarks, setRemarks] = useState(initial?.remarks ?? "");
  const [existingImages, setExistingImages] = useState<string[]>(initial?.images ?? []);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function pickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    setNewFiles((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /** Uploads straight to Supabase Storage from the browser -- the caller
   * already holds a valid Supabase session, same convention as the school
   * logo uploader on the Register School page. */
  async function uploadImages(): Promise<string[]> {
    const urls: string[] = [];
    for (const file of newFiles) {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("holiday-images").upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (uploadErr) throw new Error(`Image upload failed: ${uploadErr.message}`);
      urls.push(supabase.storage.from("holiday-images").getPublicUrl(path).data.publicUrl);
    }
    return urls;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const uploadedUrls = await uploadImages();
      const body = {
        subject: subject.trim(), startDate, endDate,
        description: description.trim() || undefined, remarks: remarks.trim() || undefined,
        images: [...existingImages, ...uploadedUrls],
      };
      if (mode === "add") {
        await api("/holidays", { method: "POST", body: JSON.stringify(body) });
      } else {
        await api(`/holidays/${initial!.id}`, { method: "PATCH", body: JSON.stringify(body) });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save holiday");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={mode === "add" ? "Add holiday" : `Edit ${initial?.subject}`} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <Field id="hol-subject" label="Subject">
          <input id="hol-subject" required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Onam Vacation" className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="hol-start" label="Start date">
            <input id="hol-start" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
          </Field>
          <Field id="hol-end" label="End date">
            <input id="hol-end" type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Field id="hol-desc" label="Description" optional>
          <textarea id="hol-desc" rows={3} className={`${inputCls} h-auto py-3`} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field id="hol-remarks" label="Remarks" optional>
          <textarea id="hol-remarks" rows={2} className={`${inputCls} h-auto py-3`} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </Field>

        <div>
          <p className="mb-1.5 text-sm font-medium">Images <span className="text-slate-400">(optional, multiple)</span></p>
          <div className="flex flex-wrap gap-2">
            {existingImages.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <div key={url} className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button type="button" aria-label="Remove image"
                  onClick={() => setExistingImages((prev) => prev.filter((u) => u !== url))}
                  className="absolute right-0 top-0 grid h-5 w-5 place-items-center rounded-bl-lg bg-night/70 text-xs text-white">
                  ×
                </button>
              </div>
            ))}
            {newFiles.map((file, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <div key={i} className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
                <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
                <button type="button" aria-label="Remove image"
                  onClick={() => setNewFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute right-0 top-0 grid h-5 w-5 place-items-center rounded-bl-lg bg-night/70 text-xs text-white">
                  ×
                </button>
              </div>
            ))}
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="grid h-16 w-16 place-items-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400 hover:border-accent hover:text-accent dark:border-white/20">
              + Add
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={pickFiles} className="hidden" />
        </div>

        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function HolidayPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [rows, setRows] = useState<HolidayRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [dialog, setDialog] = useState<{ mode: "add" } | { mode: "edit"; row: HolidayRow } | null>(null);
  const [viewing, setViewing] = useState<HolidayRow | null>(null);
  const [deleting, setDeleting] = useState<HolidayRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const canManage = !!me && MANAGE_ROLES.includes(me.role);

  const load = useCallback(() => {
    setState("loading");
    api<HolidayRow[]>("/holidays").then((r) => { setRows(r); setState("ready"); }).catch(() => setState("error"));
  }, []);

  useEffect(() => { api<Me>("/auth/me").then(setMe).catch(() => setMe(null)); }, []);
  useEffect(load, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/holidays/${deleting.id}`, { method: "DELETE" });
      setToast("Holiday deleted");
      setDeleting(null);
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not delete");
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Announcement</p>
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Holiday</h1>
        </div>
        {canManage && <Button onClick={() => setDialog({ mode: "add" })}>+ Add holiday</Button>}
      </div>

      <Card className="p-0 overflow-hidden">
        {state === "error" && (
          <p className="p-6 text-sm text-slate-500">
            Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.
          </p>
        )}
        {state === "ready" && rows.length === 0 && <p className="p-6 text-sm text-slate-500">No holidays added yet.</p>}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <th className="px-4 py-3 font-medium">Subject</th>
                  <th className="px-4 py-3 font-medium">Dates</th>
                  <th className="px-4 py-3 font-medium">Images</th>
                  <th className="px-4 py-3 font-medium">Created By</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                    <td className="px-4 py-3 font-medium text-night dark:text-white">{row.subject}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtRange(row.startDate, row.endDate)}</td>
                    <td className="px-4 py-3 text-slate-500">{row.images.length > 0 ? `${row.images.length} image${row.images.length > 1 ? "s" : ""}` : "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{row.createdBy.fullName}</td>
                    <td className="px-4 py-3">
                      <RowActions
                        onView={() => setViewing(row)}
                        onEdit={canManage ? () => setDialog({ mode: "edit", row }) : undefined}
                        onDelete={canManage ? () => setDeleting(row) : undefined}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {dialog && (
        <HolidayDialog
          mode={dialog.mode} initial={dialog.mode === "edit" ? dialog.row : undefined}
          onClose={() => setDialog(null)}
          onSaved={() => { setDialog(null); setToast(dialog.mode === "add" ? "Holiday added" : "Changes saved"); load(); }}
        />
      )}

      {viewing && (
        <Modal title={viewing.subject} onClose={() => setViewing(null)}>
          <div className="space-y-3 text-sm">
            <div><p className="text-xs uppercase tracking-wide text-slate-400">Dates</p><p className="mt-0.5 font-medium text-night dark:text-white">{fmtRange(viewing.startDate, viewing.endDate)}</p></div>
            {viewing.description && <div><p className="text-xs uppercase tracking-wide text-slate-400">Description</p><p className="mt-0.5 whitespace-pre-wrap text-slate-600 dark:text-slate-300">{viewing.description}</p></div>}
            {viewing.remarks && <div><p className="text-xs uppercase tracking-wide text-slate-400">Remarks</p><p className="mt-0.5 whitespace-pre-wrap text-slate-600 dark:text-slate-300">{viewing.remarks}</p></div>}
            {viewing.images.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Images</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {viewing.images.map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <a key={url} href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt="" className="h-20 w-20 rounded-lg object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            <div><p className="text-xs uppercase tracking-wide text-slate-400">Created by</p><p className="mt-0.5 font-medium text-night dark:text-white">{viewing.createdBy.fullName}</p></div>
          </div>
          <div className="mt-5 flex justify-end"><Button variant="ghost" onClick={() => setViewing(null)}>Close</Button></div>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete holiday?"
          message={`Permanently remove "${deleting.subject}"?`}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
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
