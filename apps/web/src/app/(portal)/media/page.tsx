"use client";
import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, Field, inputCls } from "@/components/ui/modal";

interface SchoolOpt { id: string; name: string }
interface MediaRow {
  id: string; title: string; description: string | null;
  type: "PHOTO" | "VIDEO"; url: string; createdAt: string;
  school?: { name: string } | null;
}
interface Me { role: string }

const MANAGE_ROLES = new Set(["SUPER_ADMIN", "ORG_ADMIN", "SCHOOL_ADMIN", "TEACHER"]);
const READ_ROLES = new Set([...MANAGE_ROLES, "PARENT", "STUDENT"]);

async function uploadToMediaBucket(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
}

function UploadDialog({ schools, onClose, onSaved }: {
  schools: SchoolOpt[]; onClose: () => void; onSaved: () => void;
}) {
  const [schoolId, setSchoolId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (!schoolId && schools[0]) setSchoolId(schools[0].id); }, [schools, schoolId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) { setError("Choose a photo or video to upload."); return; }
    setSaving(true);
    try {
      const url = await uploadToMediaBucket(file);
      const type = file.type.startsWith("video/") ? "VIDEO" : "PHOTO";
      await api("/media", {
        method: "POST",
        body: JSON.stringify({ schoolId, title: title.trim(), description: description.trim() || undefined, type, url }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Add media" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {schools.length > 1 && (
          <Field id="mf-school" label="School">
            <select id="mf-school" required value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className={inputCls}>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        )}
        <Field id="mf-title" label="Title">
          <input id="mf-title" required value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Annual Day 2026" className={inputCls} />
        </Field>
        <Field id="mf-description" label="Description" optional>
          <textarea id="mf-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
            className={`${inputCls} h-auto py-2.5`} />
        </Field>
        <Field id="mf-file" label="Photo or video">
          <input id="mf-file" type="file" accept="image/*,video/*" required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-white" />
        </Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Uploading…" : "Upload"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function MediaPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [schools, setSchools] = useState<SchoolOpt[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<MediaRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const canManage = !!me && MANAGE_ROLES.has(me.role);
  const canView = !!me && READ_ROLES.has(me.role);

  useEffect(() => { api<Me>("/auth/me").then(setMe).catch(() => setMe(null)); }, []);

  function load() {
    setState("loading");
    api<MediaRow[]>("/media").then((r) => { setRows(r); setState("ready"); }).catch(() => setState("error"));
  }

  useEffect(() => { if (canView) load(); }, [canView]);
  useEffect(() => { if (canManage) api<SchoolOpt[]>("/academic/schools").then(setSchools).catch(() => setSchools([])); }, [canManage]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/media/${deleting.id}`, { method: "DELETE" });
      setToast("Deleted");
      setDeleting(null);
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not delete");
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  if (!me) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Media</h1>
        {canManage && <Button onClick={() => setUploading(true)}>Add media</Button>}
      </div>

      {!canView && (
        <Card><p className="text-sm text-slate-500">Media isn&apos;t available for your role.</p></Card>
      )}

      {canView && state === "error" && (
        <Card><p className="text-sm text-slate-500">Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.</p></Card>
      )}
      {canView && state === "ready" && rows.length === 0 && (
        <Card><p className="text-sm text-slate-500">No photos or videos yet.</p></Card>
      )}

      {rows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((m) => (
            <Card key={m.id} className="p-0 overflow-hidden">
              <div className="relative aspect-video bg-surface dark:bg-white/5">
                {m.type === "PHOTO" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt={m.title} className="h-full w-full object-cover" />
                ) : (
                  <video src={m.url} controls className="h-full w-full object-cover" />
                )}
                {m.type === "VIDEO" && (
                  <span className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white">
                    <Play size={12} fill="currentColor" />
                  </span>
                )}
              </div>
              <div className="p-4">
                <p className="font-medium text-night dark:text-white">{m.title}</p>
                {m.description && <p className="mt-1 text-sm text-slate-500">{m.description}</p>}
                <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                  <span>{m.school?.name ?? ""} · {new Date(m.createdAt).toLocaleDateString("en-IN")}</span>
                  {canManage && (
                    <button onClick={() => setDeleting(m)} className="font-medium text-danger hover:underline">Delete</button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {uploading && (
        <UploadDialog
          schools={schools}
          onClose={() => setUploading(false)}
          onSaved={() => { setToast("Media uploaded"); load(); }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this media?"
          message={`This permanently removes "${deleting.title}".`}
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
