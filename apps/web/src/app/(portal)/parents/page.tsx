"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, RowActions, Field, inputCls } from "@/components/ui/modal";

interface StudentLink { relation: string; isPrimary: boolean; student: { id: string; firstName: string; lastName: string; admissionNo: string } }
interface ParentRow {
  id: string; fullName: string; email: string; phone?: string | null; isActive: boolean;
  lastLoginAt?: string | null; guardianLinks: StudentLink[];
}
interface StudentPick { id: string; label: string }
interface ChildPick { studentId: string; label: string; relation: string; isPrimary: boolean }

function StudentPicker({ excludeIds, onPick }: { excludeIds: string[]; onPick: (s: StudentPick) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StudentPick[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      api<{ items: { id: string; firstName: string; lastName: string; admissionNo: string }[] }>(`/students?q=${encodeURIComponent(q)}`)
        .then((r) => setResults(
          r.items.filter((s) => !excludeIds.includes(s.id))
            .map((s) => ({ id: s.id, label: `${s.firstName} ${s.lastName} · ${s.admissionNo}` })),
        ))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q, excludeIds]);

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search student by name or admission no."
        aria-label="Search students to link"
        className={`${inputCls} h-9`}
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-11 z-20 max-h-56 overflow-y-auto rounded-xl border border-slate-100 bg-white shadow-lift dark:border-white/10 dark:bg-[#16213A]">
          {results.length === 0 && <p className="p-3 text-sm text-slate-500">No matches.</p>}
          {results.map((r) => (
            <button key={r.id} type="button"
              onClick={() => { onPick(r); setQ(""); setResults([]); setOpen(false); }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-surface dark:hover:bg-white/5">
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ParentDialog({ mode, initial, onClose, onSaved }: {
  mode: "add" | "edit"; initial?: ParentRow; onClose: () => void; onSaved: (tempPassword?: string) => void;
}) {
  const [form, setForm] = useState({
    fullName: initial?.fullName ?? "", email: initial?.email ?? "", phone: initial?.phone ?? "",
    password: "", isActive: initial ? String(initial.isActive) : "true",
  });
  const [children, setChildren] = useState<ChildPick[]>(
    initial?.guardianLinks.map((g) => ({
      studentId: g.student.id, label: `${g.student.firstName} ${g.student.lastName} · ${g.student.admissionNo}`,
      relation: g.relation, isPrimary: g.isPrimary,
    })) ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "add" && children.length === 0) {
      setError("Link at least one student");
      return;
    }
    setSaving(true);
    try {
      if (mode === "add") {
        const res = await api<{ tempPassword?: string }>("/parents", {
          method: "POST",
          body: JSON.stringify({
            fullName: form.fullName.trim(),
            email: form.email.trim().toLowerCase(),
            phone: form.phone.trim(),
            students: children.map((c) => ({ studentId: c.studentId, relation: c.relation, isPrimary: c.isPrimary })),
            ...(form.password && { password: form.password }),
          }),
        });
        onSaved(res.tempPassword);
      } else {
        await api(`/parents/${initial!.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            fullName: form.fullName.trim(), phone: form.phone.trim(), isActive: form.isActive === "true",
          }),
        });
        onSaved();
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save parent");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={mode === "add" ? "Register parent" : `Edit ${initial?.fullName}`} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <Field id="pt-name" label="Full name">
          <input id="pt-name" required value={form.fullName} onChange={set("fullName")} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="pt-email" label="Email">
            <input id="pt-email" type="email" required disabled={mode === "edit"}
              value={form.email} onChange={set("email")} className={`${inputCls} disabled:opacity-60`} />
          </Field>
          <Field id="pt-phone" label="Phone">
            <input id="pt-phone" required value={form.phone} onChange={set("phone")} inputMode="tel" className={inputCls} />
          </Field>
        </div>

        {mode === "edit" && (
          <Field id="pt-active" label="Status">
            <select id="pt-active" value={form.isActive} onChange={set("isActive")} className={inputCls}>
              <option value="true">Active</option>
              <option value="false">Inactive (blocks sign-in)</option>
            </select>
          </Field>
        )}

        {mode === "add" && (
          <Field id="pt-pw" label="Password" optional>
            <input id="pt-pw" value={form.password} onChange={set("password")}
              placeholder="Leave blank to auto-generate" className={inputCls} />
          </Field>
        )}

        <div>
          <span className="mb-1.5 block text-sm font-medium">Children</span>
          {children.length === 0 && <p className="mb-2 text-sm text-slate-500">No students linked yet.</p>}
          <div className="space-y-2">
            {children.map((c, i) => (
              <div key={c.studentId} className="flex items-center gap-2 rounded-xl border border-slate-100 dark:border-white/10 p-2">
                <span className="flex-1 text-sm text-night dark:text-white">{c.label}</span>
                <select value={c.relation} disabled={mode === "edit"}
                  onChange={(e) => setChildren((rs) => rs.map((r, idx) => idx === i ? { ...r, relation: e.target.value } : r))}
                  className="h-9 rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-2 text-sm disabled:opacity-60">
                  {["Father", "Mother", "Guardian"].map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                {mode === "add" && (
                  <button type="button" aria-label="Remove"
                    onClick={() => setChildren((rs) => rs.filter((_, idx) => idx !== i))}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-black/5 hover:text-danger dark:hover:bg-white/10">
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {mode === "add" && (
            <div className="mt-2">
              <StudentPicker
                excludeIds={children.map((c) => c.studentId)}
                onPick={(s) => setChildren((rs) => [...rs, { studentId: s.id, label: s.label, relation: "Guardian", isPrimary: rs.length === 0 }])}
              />
            </div>
          )}
        </div>

        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : mode === "add" ? "Register parent" : "Save changes"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ParentsPage() {
  const [rows, setRows] = useState<ParentRow[]>([]);
  const [q, setQ] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [dialog, setDialog] = useState<{ mode: "add" } | { mode: "edit"; row: ParentRow } | null>(null);
  const [viewing, setViewing] = useState<ParentRow | null>(null);
  const [deleting, setDeleting] = useState<ParentRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    setState("loading");
    api<ParentRow[]>(`/parents${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      .then((r) => { setRows(r); setState("ready"); })
      .catch(() => setState("error"));
  }, [q]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/parents/${deleting.id}`, { method: "DELETE" });
      setToast("Parent deleted");
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
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Parents</h1>
        <Button onClick={() => setDialog({ mode: "add" })}>Register parent</Button>
      </div>

      {notice && (
        <Card className="border border-accent/30 bg-accent/5">
          <p className="text-sm text-night dark:text-white">{notice}</p>
          <p className="mt-1 text-xs text-slate-500">Shown once — share it with the parent; they can change it after first sign-in.</p>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="border-b border-slate-100 dark:border-white/5 p-4">
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or email" aria-label="Search parents"
            className="h-10 w-full max-w-sm rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-4 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>

        {state === "error" && (
          <p className="p-6 text-sm text-slate-500">
            Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.
          </p>
        )}
        {state === "ready" && rows.length === 0 && (
          <p className="p-6 text-sm text-slate-500">No parents match this search.</p>
        )}

        {rows.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Children</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 dark:border-white/5 transition-colors hover:bg-surface dark:hover:bg-white/5">
                  <td className="px-4 py-3 font-medium text-night dark:text-white">{p.fullName}</td>
                  <td className="px-4 py-3 text-slate-500">{p.email}{p.phone ? ` · ${p.phone}` : ""}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {p.guardianLinks.length === 0 ? "—" : p.guardianLinks.map((g) => `${g.student.firstName} ${g.student.lastName}`).join(", ")}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium
                      ${p.isActive ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <RowActions
                      onView={() => setViewing(p)}
                      onEdit={() => setDialog({ mode: "edit", row: p })}
                      onDelete={() => setDeleting(p)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {dialog && (
        <ParentDialog
          mode={dialog.mode}
          initial={dialog.mode === "edit" ? dialog.row : undefined}
          onClose={() => setDialog(null)}
          onSaved={(tempPassword) => {
            if (dialog.mode === "add") {
              setNotice(tempPassword ? `✓ Parent registered. Temporary password: ${tempPassword}` : "✓ Parent registered.");
            } else {
              setToast("Changes saved");
            }
            setQ(""); load();
          }}
        />
      )}

      {viewing && (
        <Modal title={viewing.fullName} onClose={() => setViewing(null)}>
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              {[
                ["Status", viewing.isActive ? "Active" : "Inactive"],
                ["Email", viewing.email],
                ["Phone", viewing.phone ?? "—"],
                ["Last login", viewing.lastLoginAt ? new Date(viewing.lastLoginAt).toLocaleString("en-IN") : "Never"],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">{k}</dt>
                  <dd className="mt-0.5 font-medium text-night dark:text-white">{v}</dd>
                </div>
              ))}
            </dl>
            <div>
              <h3 className="mb-2 font-medium text-night dark:text-white">Children</h3>
              {viewing.guardianLinks.length === 0 && <p className="text-slate-500">None linked.</p>}
              {viewing.guardianLinks.map((g) => (
                <p key={g.student.id} className="text-slate-500">
                  {g.student.firstName} {g.student.lastName} ({g.student.admissionNo}) — {g.relation}{g.isPrimary ? " · Primary" : ""}
                </p>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete parent?"
          message={`This removes ${deleting.fullName}'s login. Their guardian contact info stays on the linked students' records.`}
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
