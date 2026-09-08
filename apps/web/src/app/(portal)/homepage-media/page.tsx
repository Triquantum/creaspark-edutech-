"use client";
import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, Field, inputCls } from "@/components/ui/modal";

type Section = "GALLERY" | "HERO_VIDEO" | "STORY_PHOTO";

interface HomepageMediaRow {
  id: string; section: Section; type: "PHOTO" | "VIDEO";
  title: string | null; url: string; sortOrder: number; createdAt: string;
}
interface Me { role: string }

const SECTION_LABEL: Record<Section, string> = {
  GALLERY: "Homepage Gallery",
  HERO_VIDEO: "Hero Background Video",
  STORY_PHOTO: "Our Story Photo",
};

async function uploadToHomepageMediaBucket(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `homepage-media/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
}

function UploadDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [section, setSection] = useState<Section>("GALLERY");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) { setError("Choose a photo or video to upload."); return; }
    setSaving(true);
    try {
      const url = await uploadToHomepageMediaBucket(file);
      const type = file.type.startsWith("video/") ? "VIDEO" : "PHOTO";
      await api("/homepage-media", {
        method: "POST",
        body: JSON.stringify({ section, type, title: title.trim() || undefined, url }),
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
    <Modal title="Add homepage media" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field id="hm-section" label="Where does this appear?">
          <select id="hm-section" value={section} onChange={(e) => setSection(e.target.value as Section)} className={inputCls}>
            {Object.entries(SECTION_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <Field id="hm-title" label="Title / caption" optional>
          <input id="hm-title" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Robotics workshop" className={inputCls} />
        </Field>
        <Field id="hm-file" label="Photo or video">
          <input id="hm-file" type="file" accept="image/*,video/*" required
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

export default function HomepageMediaPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [rows, setRows] = useState<HomepageMediaRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<HomepageMediaRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const canManage = me?.role === "SUPER_ADMIN";

  useEffect(() => { api<Me>("/auth/me").then(setMe).catch(() => setMe(null)); }, []);

  function load() {
    setState("loading");
    api<HomepageMediaRow[]>("/homepage-media").then((r) => { setRows(r); setState("ready"); }).catch(() => setState("error"));
  }

  useEffect(() => { if (canManage) load(); }, [canManage]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/homepage-media/${deleting.id}`, { method: "DELETE" });
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
        <div>
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Website Gallery</h1>
          <p className="mt-1 text-sm text-slate-500">Photos and videos shown on the public marketing website.</p>
        </div>
        {canManage && <Button onClick={() => setUploading(true)}>Add media</Button>}
      </div>

      {!canManage && (
        <Card><p className="text-sm text-slate-500">Website Gallery is only available to Super Admin.</p></Card>
      )}

      {canManage && state === "error" && (
        <Card><p className="text-sm text-slate-500">Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.</p></Card>
      )}
      {canManage && state === "ready" && rows.length === 0 && (
        <Card><p className="text-sm text-slate-500">No homepage media yet.</p></Card>
      )}

      {rows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((m) => (
            <Card key={m.id} className="p-0 overflow-hidden">
              <div className="relative aspect-video bg-surface dark:bg-white/5">
                {m.type === "PHOTO" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt={m.title ?? ""} className="h-full w-full object-cover" />
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
                <p className="font-medium text-night dark:text-white">{m.title || SECTION_LABEL[m.section]}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                  <span>{SECTION_LABEL[m.section]} · {new Date(m.createdAt).toLocaleDateString("en-IN")}</span>
                  <button onClick={() => setDeleting(m)} className="font-medium text-danger hover:underline">Delete</button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {uploading && (
        <UploadDialog
          onClose={() => setUploading(false)}
          onSaved={() => { setToast("Media uploaded"); load(); }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this media?"
          message={`This permanently removes "${deleting.title || SECTION_LABEL[deleting.section]}" from the website.`}
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
