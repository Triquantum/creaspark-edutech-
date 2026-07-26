"use client";
import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, Field, inputCls } from "@/components/ui/modal";
import { Calendar, CalendarEvent } from "@/components/ui/calendar";

interface School { id: string; name: string }
interface EventRow extends CalendarEvent { id: string; description?: string | null }

function EventDialog({ mode, initial, schools, defaultDate, onClose, onSaved }: {
  mode: "add" | "edit"; initial?: EventRow; schools: School[]; defaultDate?: string;
  onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    schoolId: "",
    title: initial?.title ?? "", description: initial?.description ?? "", location: initial?.location ?? "",
    startAt: initial ? initial.startAt.slice(0, 16) : defaultDate ? defaultDate.slice(0, 16) : "",
    endAt: initial?.endAt ? initial.endAt.slice(0, 16) : "",
  });
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim() || !form.startAt || (mode === "add" && !form.schoolId)) {
      setError("Title, school, and start date are required");
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        description: form.description.trim() || undefined, location: form.location.trim() || undefined,
        startAt: new Date(form.startAt).toISOString(),
        endAt: form.endAt ? new Date(form.endAt).toISOString() : undefined,
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
        <Field id="title" label="Title">
          <input id="title" className={inputCls} value={form.title} onChange={set("title")} placeholder="Graduation Day" />
        </Field>
        <Field id="location" label="Location" optional>
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
        <Field id="description" label="Description" optional>
          <textarea id="description" rows={3} className={`${inputCls} h-auto py-3`} value={form.description} onChange={set("description")} />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : mode === "add" ? "Create Event" : "Save changes"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function EventsPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [upcoming, setUpcoming] = useState<EventRow[]>([]);
  const [creating, setCreating] = useState<string | null>(null); // holds default date, or "" for now
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [deleting, setDeleting] = useState<EventRow | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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
          <p className="text-sm text-slate-500">School calendar and upcoming events.</p>
        </div>
        <Button onClick={() => setCreating("")}>+ New Event</Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Calendar key={refreshKey} onCreate={(date) => setCreating(date)} />
        </div>

        <Card>
          <h2 className="font-display font-semibold text-night dark:text-white">Upcoming</h2>
          {upcoming.length === 0 && <p className="mt-4 text-sm text-slate-500">No upcoming events.</p>}
          <ul className="mt-4 space-y-3">
            {upcoming.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-2 border-l-2 border-accent pl-3">
                <div>
                  <p className="text-sm font-medium text-night dark:text-white">{e.title}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(e.startAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    {e.location ? ` · ${e.location}` : ""}
                  </p>
                </div>
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
