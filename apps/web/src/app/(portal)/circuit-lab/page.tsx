"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, Field, inputCls } from "@/components/ui/modal";

const WOKWI_URL = "https://wokwi.com/projects/new/arduino-uno";
const PICSIMLAB_URL = "https://lcgamboa.github.io/js/picsimlab_wasm.html";

type Simulator = "WOKWI" | "PICSIMLAB";

interface Me { id: string; role: string }
interface ProjectRow {
  id: string; title: string; simulator: Simulator; projectUrl: string | null; notes: string | null;
  feedback: string | null; reviewedAt: string | null; createdAt: string;
  student?: { firstName: string; lastName: string; admissionNo: string };
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function SaveProjectModal({ simulator, onClose, onSaved }: {
  simulator: Simulator; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ title: "", projectUrl: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/circuit-lab", {
        method: "POST",
        body: JSON.stringify({
          title: form.title.trim(), simulator,
          projectUrl: form.projectUrl.trim() || undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save project");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Save your project" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field id="cp-title" label="Project title">
          <input id="cp-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
        </Field>
        {simulator === "WOKWI" ? (
          <Field id="cp-link" label="Wokwi project link">
            <input
              id="cp-link" value={form.projectUrl} onChange={(e) => setForm({ ...form, projectUrl: e.target.value })}
              className={inputCls} placeholder="https://wokwi.com/projects/…"
            />
          </Field>
        ) : (
          <>
            <Field id="cp-notes" label="What did you build?">
              <textarea id="cp-notes" rows={4} className={`${inputCls} h-auto py-3`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <Field id="cp-link2" label="Link" optional>
              <input id="cp-link2" value={form.projectUrl} onChange={(e) => setForm({ ...form, projectUrl: e.target.value })} className={inputCls} placeholder="https://…" />
            </Field>
          </>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save project"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function ReviewModal({ project, onClose, onSaved }: {
  project: ProjectRow; onClose: () => void; onSaved: () => void;
}) {
  const [feedback, setFeedback] = useState(project.feedback ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api(`/circuit-lab/${project.id}/review`, {
        method: "PATCH", body: JSON.stringify({ feedback: feedback.trim() || undefined }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save feedback");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={project.title} onClose={onClose}>
      <div className="space-y-4">
        {project.projectUrl && (
          <a href={project.projectUrl} target="_blank" rel="noreferrer" className="text-sm text-accent underline">Open project link</a>
        )}
        {project.notes && <p className="text-sm text-slate-600 dark:text-slate-300">{project.notes}</p>}
        <form onSubmit={submit} className="space-y-4">
          <Field id="rv-feedback" label="Feedback" optional>
            <textarea id="rv-feedback" rows={3} className={`${inputCls} h-auto py-3`} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save feedback"}</Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

export default function CircuitLabPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<Simulator>("WOKWI");
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState<ProjectRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const isStudent = me?.role === "STUDENT";

  const load = useCallback(() => {
    setState("loading");
    api<ProjectRow[]>("/circuit-lab").then((r) => { setRows(r); setState("ready"); }).catch(() => setState("error"));
  }, []);

  useEffect(() => { api<Me>("/auth/me").then(setMe).catch(() => setMe(null)); }, []);
  useEffect(load, [load]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const iframeUrl = tab === "WOKWI" ? WOKWI_URL : PICSIMLAB_URL;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Virtual Class</p>
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Virtual Class</h1>
        </div>
      </div>

      <Card>
        <h3 className="font-semibold text-night dark:text-white">How to use Virtual Class</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
          <li>
            <strong>Circuit Lab (Wokwi)</strong> — write code and build a circuit together, then run the simulation right here.
            Create a free account at wokwi.com, save your project there, then paste the project link below so your teacher can review it.
          </li>
          <li>
            <strong>Advanced Hardware Lab (PICSimLab)</strong> — a more advanced board-level simulator. It doesn&apos;t include a
            code editor, so you&apos;ll need firmware compiled elsewhere (e.g. Arduino IDE) before loading it here. Describe
            what you built in the notes field, since PICSimLab has no save link.
          </li>
        </ol>
      </Card>

      {isStudent && (
        <>
          <div className="flex gap-2">
            <button
              onClick={() => setTab("WOKWI")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${tab === "WOKWI" ? "bg-accent text-white" : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"}`}
            >
              Circuit Lab
            </button>
            <button
              onClick={() => setTab("PICSIMLAB")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${tab === "PICSIMLAB" ? "bg-accent text-white" : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"}`}
            >
              Advanced Hardware Lab
            </button>
          </div>

          <Card className="overflow-hidden p-0">
            <iframe
              key={tab} src={iframeUrl} className="h-[600px] w-full border-0"
              title={tab === "WOKWI" ? "Wokwi circuit simulator" : "PICSimLab hardware simulator"}
            />
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => setSaving(true)}>Save this project</Button>
          </div>
        </>
      )}

      <Card className="overflow-hidden p-0">
        {state === "error" && (
          <p className="p-6 text-sm text-slate-500">
            Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.
          </p>
        )}
        {state === "ready" && rows.length === 0 && (
          <p className="p-6 text-sm text-slate-500">{isStudent ? "No projects saved yet." : "No student projects yet."}</p>
        )}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <th className="px-4 py-3 font-medium">Title</th>
                  {!isStudent && <th className="px-4 py-3 font-medium">Student</th>}
                  <th className="px-4 py-3 font-medium">Simulator</th>
                  <th className="px-4 py-3 font-medium">Saved</th>
                  <th className="px-4 py-3 font-medium">Feedback</th>
                  {!isStudent && <th className="px-4 py-3 text-right font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                    <td className="px-4 py-3 font-medium text-night dark:text-white">
                      {row.projectUrl ? (
                        <a href={row.projectUrl} target="_blank" rel="noreferrer" className="text-accent underline">{row.title}</a>
                      ) : row.title}
                    </td>
                    {!isStudent && (
                      <td className="px-4 py-3 text-slate-500">
                        {row.student ? `${row.student.firstName} ${row.student.lastName}` : "—"}
                      </td>
                    )}
                    <td className="px-4 py-3 text-slate-500">{row.simulator === "WOKWI" ? "Circuit Lab" : "Advanced Hardware Lab"}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(row.createdAt)}</td>
                    <td className="px-4 py-3">
                      {row.feedback ? <span className="text-slate-600 dark:text-slate-300">{row.feedback}</span> : <span className="text-slate-400">—</span>}
                    </td>
                    {!isStudent && (
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" onClick={() => setReviewing(row)}>{row.feedback ? "Edit feedback" : "Review"}</Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {saving && (
        <SaveProjectModal simulator={tab} onClose={() => setSaving(false)} onSaved={() => { setSaving(false); setToast("Project saved"); load(); }} />
      )}
      {reviewing && (
        <ReviewModal project={reviewing} onClose={() => setReviewing(null)} onSaved={() => { setReviewing(null); setToast("Feedback saved"); load(); }} />
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 right-6 z-50 rounded-xl bg-night px-4 py-3 text-sm text-white shadow-lift">
          {toast}
        </div>
      )}
    </div>
  );
}
