"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, RowActions, Field, inputCls } from "@/components/ui/modal";

const ROLES = [
  "SUPER_ADMIN", "ORG_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "COORDINATOR",
  "TEACHER", "TRAINER", "ACCOUNTANT", "RECEPTION", "LIBRARIAN", "TRANSPORT_MANAGER", "HR",
  "INVENTORY_MANAGER", "HOSTEL_WARDEN", "SECURITY", "PARENT", "STUDENT", "GUEST",
] as const;

const ACCESS_ROLES = new Set(["SCHOOL_ADMIN", "ORG_ADMIN", "PRINCIPAL", "HR"]);
const CAN_MANAGE = new Set(["SCHOOL_ADMIN", "ORG_ADMIN"]);

function roleLabel(role: string) {
  return role.toLowerCase().split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

interface UserRow {
  id: string; fullName: string; email: string; phone?: string | null; role: string;
  isActive: boolean; lastLoginAt?: string | null; createdAt: string;
}
interface Me { id: string; role: string }

function RegisterDialog({ mode, initial, onClose, onSaved }: {
  mode: "add" | "edit"; initial?: UserRow;
  onClose: () => void; onSaved: (tempPassword?: string) => void;
}) {
  const [form, setForm] = useState({
    fullName: initial?.fullName ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    role: initial?.role ?? "TEACHER",
    password: "",
    isActive: initial ? String(initial.isActive) : "true",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetPw, setResetPw] = useState<string | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (mode === "add") {
        const res = await api<{ tempPassword?: string }>("/users", {
          method: "POST",
          body: JSON.stringify({
            fullName: form.fullName.trim(),
            email: form.email.trim().toLowerCase(),
            ...(form.phone && { phone: form.phone.trim() }),
            role: form.role,
            ...(form.password && { password: form.password }),
          }),
        });
        onSaved(res.tempPassword);
      } else {
        await api(`/users/${initial!.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            fullName: form.fullName.trim(),
            ...(form.phone !== undefined && { phone: form.phone.trim() || null }),
            role: form.role,
            isActive: form.isActive === "true",
          }),
        });
        onSaved();
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save user");
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword() {
    if (!initial) return;
    setResetting(true);
    setError(null);
    try {
      const res = await api<{ tempPassword: string }>(`/users/${initial.id}/reset-password`, { method: "POST" });
      setResetPw(res.tempPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setResetting(false);
    }
  }

  return (
    <Modal title={mode === "add" ? "Register user" : `Edit ${initial?.fullName}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field id="u-name" label="Full name">
          <input id="u-name" required value={form.fullName} onChange={set("fullName")} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="u-email" label="Email">
            <input id="u-email" type="email" required disabled={mode === "edit"}
              value={form.email} onChange={set("email")} className={`${inputCls} disabled:opacity-60`} />
          </Field>
          <Field id="u-phone" label="Phone" optional>
            <input id="u-phone" value={form.phone ?? ""} onChange={set("phone")} inputMode="tel" className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field id="u-role" label="Role">
            <select id="u-role" required value={form.role} onChange={set("role")} className={inputCls}>
              {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </select>
          </Field>
          {mode === "edit" ? (
            <Field id="u-active" label="Status">
              <select id="u-active" value={form.isActive} onChange={set("isActive")} className={inputCls}>
                <option value="true">Active</option>
                <option value="false">Inactive (blocks sign-in)</option>
              </select>
            </Field>
          ) : (
            <Field id="u-pw" label="Password" optional>
              <input id="u-pw" type="text" value={form.password} onChange={set("password")}
                placeholder="Leave blank to auto-generate" className={inputCls} />
            </Field>
          )}
        </div>

        {mode === "edit" && (
          <div className="rounded-xl border border-slate-100 dark:border-white/10 p-3">
            {resetPw ? (
              <p className="text-sm text-night dark:text-white">
                New temporary password: <span className="font-mono font-semibold">{resetPw}</span>
              </p>
            ) : (
              <button type="button" onClick={resetPassword} disabled={resetting}
                className="text-sm font-medium text-primary hover:underline disabled:opacity-50">
                {resetting ? "Generating…" : "Reset password"}
              </button>
            )}
          </div>
        )}

        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : mode === "add" ? "Register user" : "Save changes"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function UsersPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [q, setQ] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [dialog, setDialog] = useState<{ mode: "add" } | { mode: "edit"; row: UserRow } | null>(null);
  const [viewing, setViewing] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { api<Me>("/auth/me").then(setMe).catch(() => setMe(null)); }, []);

  const load = useCallback(() => {
    if (!me) return;
    if (!ACCESS_ROLES.has(me.role)) { setState("forbidden"); return; }
    setState("loading");
    api<UserRow[]>(`/users${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      .then((r) => { setRows(r); setState("ready"); })
      .catch(() => setState("error"));
  }, [q, me]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/users/${deleting.id}`, { method: "DELETE" });
      setToast("User deleted");
      setDeleting(null);
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not delete");
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  if (state === "forbidden") {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Users</h1>
        <Card><p className="text-sm text-slate-500">Your role doesn&apos;t have access to user management.</p></Card>
      </div>
    );
  }

  const canManage = me ? CAN_MANAGE.has(me.role) : false;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Users</h1>
        {canManage && <Button onClick={() => setDialog({ mode: "add" })}>Register user</Button>}
      </div>

      {notice && (
        <Card className="border border-accent/30 bg-accent/5">
          <p className="text-sm text-night dark:text-white">{notice}</p>
          <p className="mt-1 text-xs text-slate-500">Shown once — share it with the user; they can change it after first sign-in.</p>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="border-b border-slate-100 dark:border-white/5 p-4">
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or email" aria-label="Search users"
            className="h-10 w-full max-w-sm rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-4 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>

        {state === "error" && (
          <p className="p-6 text-sm text-slate-500">
            Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.
          </p>
        )}
        {state === "ready" && rows.length === 0 && (
          <p className="p-6 text-sm text-slate-500">No users match this search.</p>
        )}

        {rows.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last login</th>
                {canManage && <th className="px-4 py-3 text-right font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-b border-slate-50 dark:border-white/5 transition-colors hover:bg-surface dark:hover:bg-white/5">
                  <td className="px-4 py-3 font-medium text-night dark:text-white">{u.fullName}</td>
                  <td className="px-4 py-3 text-slate-500">{u.email}</td>
                  <td className="px-4 py-3">{roleLabel(u.role)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium
                      ${u.isActive ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("en-IN") : "Never"}</td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <RowActions
                        onView={() => setViewing(u)}
                        onEdit={() => setDialog({ mode: "edit", row: u })}
                        onDelete={() => setDeleting(u)}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {dialog && (
        <RegisterDialog
          mode={dialog.mode}
          initial={dialog.mode === "edit" ? dialog.row : undefined}
          onClose={() => setDialog(null)}
          onSaved={(tempPassword) => {
            if (dialog.mode === "add") {
              setNotice(tempPassword ? `✓ User registered. Temporary password: ${tempPassword}` : "✓ User registered.");
            } else {
              setToast("Changes saved");
            }
            setQ(""); load();
          }}
        />
      )}

      {viewing && (
        <Modal title={viewing.fullName} onClose={() => setViewing(null)}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {[
              ["Role", roleLabel(viewing.role)],
              ["Status", viewing.isActive ? "Active" : "Inactive"],
              ["Email", viewing.email],
              ["Phone", viewing.phone ?? "—"],
              ["Last login", viewing.lastLoginAt ? new Date(viewing.lastLoginAt).toLocaleString("en-IN") : "Never"],
              ["Created", new Date(viewing.createdAt).toLocaleDateString("en-IN")],
            ].map(([k, v]) => (
              <div key={k as string}>
                <dt className="text-xs uppercase tracking-wide text-slate-400">{k}</dt>
                <dd className="mt-0.5 font-medium text-night dark:text-white">{v}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete user?"
          message={`This permanently removes ${deleting.fullName}'s login (${deleting.email}). They will no longer be able to sign in.`}
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
