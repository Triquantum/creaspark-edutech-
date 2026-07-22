"use client";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, Field, inputCls } from "@/components/ui/modal";
import { Calendar, CalendarEvent } from "@/components/ui/calendar";

interface School { id: string; name: string }
interface EventRow extends CalendarEvent { id: string; description?: string | null }

function CreateEventDialog({ schools, defaultDate, onClose, onSaved }: {
  schools: School[]; defaultDate?: string; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    schoolId: schools[0]?.id ?? "",
    title: "", description: "", location: "",
    startAt: defaultDate ? defaultDate.slice(0, 16) : "",
    endAt: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim() || !form.startAt || !form.schoolId) { setError("Title, school, and start date are required"); return; }
    setSaving(true);
    try {
      await api("/events", {
        method: "POST",
        body: JSON.stringify({
          schoolId: form.schoolId, title: form.title.trim(),
          description: form.description.trim() || undefined, location: form.location.trim() || undefined,
          startAt: new Date(form.startAt).toISOString(),
          endAt: form.endAt ? new Date(form.endAt).toISOString() : undefined,
        }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New Event" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {schools.length > 1 && (
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
          <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create Event"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function EventsPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [upcoming, setUpcoming] = useState<EventRow[]>([]);
  const [creating, setCreating] = useState<string | null>(null); // holds default date, or "" for now
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
                <button onClick={() => setDeleting(e)} aria-label="Delete event"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-danger/10 hover:text-danger">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {creating !== null && (
        <CreateEventDialog
          schools={schools}
          defaultDate={creating || undefined}
          onClose={() => setCreating(null)}
          onSaved={() => { setCreating(null); setRefreshKey((k) => k + 1); }}
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
