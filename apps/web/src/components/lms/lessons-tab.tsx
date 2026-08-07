"use client";
import { useState } from "react";
import { Pencil, Trash2, CheckCircle2, Circle } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, Field, inputCls } from "@/components/ui/modal";

export interface LessonRow {
  id: string; title: string; content: string | null; videoUrl: string | null; order: number; completed?: boolean;
}
export interface ContentContext { subjectId: string; schoolId?: string; classId?: string }

function LessonFormModal({ context, initial, onClose, onSaved }: {
  context: ContentContext; initial?: LessonRow; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: initial?.title ?? "", content: initial?.content ?? "", videoUrl: initial?.videoUrl ?? "", order: initial?.order ?? 0,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const body = { title: form.title.trim(), content: form.content.trim() || undefined, videoUrl: form.videoUrl.trim() || undefined, order: form.order };
      if (initial) {
        await api(`/lessons/${initial.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await api("/lessons", { method: "POST", body: JSON.stringify({ ...context, ...body }) });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save lesson");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={initial ? "Edit lesson" : "New lesson"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field id="l-title" label="Title">
          <input id="l-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
        </Field>
        <Field id="l-content" label="Content" optional>
          <textarea id="l-content" rows={5} className={`${inputCls} h-auto py-3`} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
        </Field>
        <Field id="l-video" label="Video URL" optional>
          <input id="l-video" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} className={inputCls} placeholder="https://…" />
        </Field>
        <Field id="l-order" label="Order">
          <input id="l-order" type="number" min={0} value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} className={inputCls} />
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

export function LessonsTab({ context, lessons, isManager, onChanged }: {
  context: ContentContext; lessons: LessonRow[]; isManager: boolean; onChanged: () => void;
}) {
  const [editing, setEditing] = useState<LessonRow | "new" | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function remove(id: string) {
    if (!confirm("Delete this lesson?")) return;
    await api(`/lessons/${id}`, { method: "DELETE" });
    onChanged();
  }

  async function complete(id: string) {
    await api(`/lessons/${id}/complete`, { method: "POST" });
    onChanged();
  }

  return (
    <div className="space-y-3">
      {isManager && (
        <div className="flex justify-end">
          <Button onClick={() => setEditing("new")}>+ Add lesson</Button>
        </div>
      )}
      {lessons.length === 0 ? (
        <Card><p className="text-sm text-slate-500">No lessons yet.</p></Card>
      ) : (
        lessons.map((l) => (
          <Card key={l.id} className="p-0 overflow-hidden">
            <button onClick={() => setOpen(open === l.id ? null : l.id)} className="flex w-full items-center gap-3 p-4 text-left">
              {!isManager && (
                l.completed
                  ? <CheckCircle2 size={18} className="shrink-0 text-success" />
                  : <Circle size={18} className="shrink-0 text-slate-300" />
              )}
              <span className="flex-1 font-medium text-night dark:text-white">{l.title}</span>
              {isManager && (
                <span className="flex gap-1">
                  <button onClick={(e) => { e.stopPropagation(); setEditing(l); }} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-accent/10 hover:text-accent">
                    <Pencil size={14} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); remove(l.id); }} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-danger/10 hover:text-danger">
                    <Trash2 size={14} />
                  </button>
                </span>
              )}
            </button>
            {open === l.id && (
              <div className="border-t border-slate-100 p-4 dark:border-white/5">
                {l.content && <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{l.content}</p>}
                {l.videoUrl && <a href={l.videoUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-primary hover:underline">Watch video</a>}
                {!isManager && !l.completed && (
                  <div className="mt-3">
                    <Button onClick={() => complete(l.id)}>Mark complete</Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        ))
      )}
      {editing && (
        <LessonFormModal
          context={context} initial={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }}
        />
      )}
    </div>
  );
}
