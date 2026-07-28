"use client";
import { useEffect, useRef, useState } from "react";
import { FileText, Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, Field, inputCls } from "@/components/ui/modal";
import { Calendar, CalendarEvent } from "@/components/ui/calendar";

interface School { id: string; name: string }
interface Me { role: string }
const MANAGE_ROLES = new Set(["SUPER_ADMIN", "ORG_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "COORDINATOR", "TEACHER"]);
const CATEGORIES = ["COMPETITION", "CONFERENCE", "EXHIBITION", "GENERAL"] as const;
function categoryLabel(c: string) {
  return c === "GENERAL" ? "Event" : c.charAt(0) + c.slice(1).toLowerCase();
}
interface EventRow extends CalendarEvent {
  id: string; description?: string | null; category: string;
  photoUrl?: string | null; pdfUrl?: string | null; registrationDeadline?: string | null;
}

/** Uploads straight to Supabase Storage from the browser, same pattern as
 * the school-logo uploader — the caller already holds a valid session. */
async function uploadToEventMedia(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("event-media").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return supabase.storage.from("event-media").getPublicUrl(path).data.publicUrl;
}

function EventDialog({ mode, initial, schools, defaultDate, onClose, onSaved }: {
  mode: "add" | "edit"; initial?: EventRow; schools: School[]; defaultDate?: string;
  onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    schoolId: "",
    title: initial?.title ?? "", category: initial?.category ?? "GENERAL",
    description: initial?.description ?? "", location: initial?.location ?? "",
    startAt: initial ? initial.startAt.slice(0, 16) : defaultDate ? defaultDate.slice(0, 16) : "",
    endAt: initial?.endAt ? initial.endAt.slice(0, 16) : "",
    registrationDeadline: initial?.registrationDeadline ? initial.registrationDeadline.slice(0, 16) : "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(initial?.photoUrl ?? null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfName, setPdfName] = useState<string | null>(initial?.pdfUrl ? "Current PDF attached" : null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // schools is still fetching when this dialog can mount, so a schoolId
  // seeded at useState-init time can lock at "" forever — the <select>
  // shows the first option regardless, masking that the real value never
  // got set. Backfill once schools actually arrives.
  useEffect(() => {
    if (!form.schoolId && schools[0]) setForm((f) => ({ ...f, schoolId: schools[0].id }));
  }, [schools, form.schoolId]);

  function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file && !file.type.startsWith("image/")) { setError("Choose an image file for the photo"); return; }
    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }
  function pickPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file && file.type !== "application/pdf") { setError("Choose a PDF file"); return; }
    setPdfFile(file);
    setPdfName(file?.name ?? null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim() || !form.startAt || (mode === "add" && !form.schoolId)) {
      setError("Title, school, and start date are required");
      return;
    }
    setSaving(true);
    try {
      const [photoUrl, pdfUrl] = await Promise.all([
        photoFile ? uploadToEventMedia(photoFile) : Promise.resolve(undefined),
        pdfFile ? uploadToEventMedia(pdfFile) : Promise.resolve(undefined),
      ]);
      const body = {
        title: form.title.trim(), category: form.category,
        description: form.description.trim() || undefined, location: form.location.trim() || undefined,
        startAt: new Date(form.startAt).toISOString(),
        endAt: form.endAt ? new Date(form.endAt).toISOString() : undefined,
        registrationDeadline: form.registrationDeadline ? new Date(form.registrationDeadline).toISOString() : undefined,
        ...(photoUrl && { photoUrl }),
        ...(pdfUrl && { pdfUrl }),
      };
      if (mode === "add") {
        await api("/events", { method: "POST", body: JSON.stringify({ ...body, schoolId: form.schoolId }) });
      } else {
        await api(`/events/${initial!.id}`, { method: "PATCH", body: JSON.stringify(body) });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save event");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={mode === "add" ? "New Event" : "Edit Event"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {mode === "add" && schools.length > 1 && (
          <Field id="schoolId" label="School">
            <select id="schoolId" className={inputCls} value={form.schoolId} onChange={set("schoolId")}>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field id="title" label="Title">
            <input id="title" className={inputCls} value={form.title} onChange={set("title")} placeholder="Inter-School Robotics Meet" />
          </Field>
          <Field id="category" label="Category">
            <select id="category" className={inputCls} value={form.category} onChange={set("category")}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
            </select>
          </Field>
        </div>
        <Field id="location" label="Place" optional>
          <input id="location" className={inputCls} value={form.location} onChange={set("location")} placeholder="Main Auditorium" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field id="startAt" label="Starts">
            <input id="startAt" type="datetime-local" className={inputCls} value={form.startAt} onChange={set("startAt")} />
          </Field>
          <Field id="endAt" label="Ends" optional>
            <input id="endAt" type="datetime-local" className={inputCls} value={form.endAt} onChange={set("endAt")} />
          </Field>
        </div>
        <Field id="registrationDeadline" label="Last date of registration" optional>
          <input id="registrationDeadline" type="datetime-local" className={inputCls}
            value={form.registrationDeadline} onChange={set("registrationDeadline")} />
        </Field>
        <Field id="description" label="Description / more details" optional>
          <textarea id="description" rows={3} className={`${inputCls} h-auto py-3`} value={form.description} onChange={set("description")} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field id="photo" label="Photo" optional>
            <div className="flex items-center gap-3">
              {photoPreview ? (
                <img src={photoPreview} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-slate-200 dark:ring-white/10" />
              ) : (
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-surface text-[10px] text-slate-400 dark:bg-white/5">None</div>
              )}
              <input id="photo" ref={photoInputRef} type="file" accept="image/*" onChange={pickPhoto}
                className="block text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-primary file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:opacity-90" />
            </div>
          </Field>
          <Field id="pdf" label="PDF (brochure/details)" optional>
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-surface text-slate-400 dark:bg-white/5">
                <FileText size={18} />
              </div>
              <div>
                <input id="pdf" ref={pdfInputRef} type="file" accept="application/pdf" onChange={pickPdf}
                  className="block text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-primary file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:opacity-90" />
                {pdfName && <p className="mt-1 truncate text-xs text-slate-400">{pdfName}</p>}
              </div>
            </div>
          </Field>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : mode === "add" ? "Create Event" : "Save changes"}</Button>
        </div>
      </form>
    </Modal>
  );
}

const CATEGORY_BADGE: Record<string, string> = {
  COMPETITION: "bg-accent/10 text-accent",
  CONFERENCE: "bg-primary/10 text-primary",
  EXHIBITION: "bg-success/10 text-success",
  GENERAL: "bg-slate-200/60 text-slate-500 dark:bg-white/10 dark:text-slate-300",
};

export default function EventsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [upcoming, setUpcoming] = useState<EventRow[]>([]);
  const [creating, setCreating] = useState<string | null>(null); // holds default date, or "" for now
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [deleting, setDeleting] = useState<EventRow | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const canManage = !!me && MANAGE_ROLES.has(me.role);

  useEffect(() => {
    api<Me>("/auth/me").then(setMe).catch(() => setMe(null));
  }, []);
  useEffect(() => {
    api<School[]>("/academic/schools").then(setSchools).catch(() => setSchools([]));
  }, []);
  useEffect(() => {
    api<EventRow[]>("/events").then(setUpcoming).catch(() => setUpcoming([]));
  }, [refreshKey]);

  async function remove() {
    if (!deleting) return;
    await api(`/events/${deleting.id}`, { method: "DELETE" });
    setDeleting(null);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Events</h1>
          <p className="text-sm text-slate-500">Competitions, conferences, exhibitions, and the school calendar.</p>
        </div>
        {canManage && <Button onClick={() => setCreating("")}>+ New Event</Button>}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Calendar key={refreshKey} onCreate={canManage ? (date) => setCreating(date) : undefined} />
        </div>

        <Card>
          <h2 className="font-display font-semibold text-night dark:text-white">Upcoming</h2>
          {upcoming.length === 0 && <p className="mt-4 text-sm text-slate-500">No upcoming events.</p>}
          <ul className="mt-4 space-y-4">
            {upcoming.map((e) => (
              <li key={e.id} className="flex items-start gap-3 border-l-2 border-accent pl-3">
                {e.photoUrl ? (
                  <img src={e.photoUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-slate-200 dark:ring-white/10" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-night dark:text-white">{e.title}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_BADGE[e.category] ?? CATEGORY_BADGE.GENERAL}`}>
                      {categoryLabel(e.category)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {new Date(e.startAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    {e.location ? ` · ${e.location}` : ""}
                  </p>
                  {e.registrationDeadline && (
                    <p className="mt-0.5 text-xs text-danger">
                      Register by {new Date(e.registrationDeadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                  )}
                  {e.pdfUrl && (
                    <a href={e.pdfUrl} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <FileText size={11} /> View PDF
                    </a>
                  )}
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => setEditing(e)} aria-label="Edit event"
                      className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-accent/10 hover:text-accent">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDeleting(e)} aria-label="Delete event"
                      className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-danger/10 hover:text-danger">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {creating !== null && (
        <EventDialog
          mode="add"
          schools={schools}
          defaultDate={creating || undefined}
          onClose={() => setCreating(null)}
          onSaved={() => { setCreating(null); setRefreshKey((k) => k + 1); }}
        />
      )}
      {editing && (
        <EventDialog
          mode="edit"
          initial={editing}
          schools={schools}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setRefreshKey((k) => k + 1); }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete event"
          message={`Delete "${deleting.title}"? This can't be undone.`}
          onConfirm={remove}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
