"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { type LucideIcon } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { ConfirmDialog, RowActions } from "@/components/ui/modal";
import { SchoolEditModal } from "@/components/platform/school-edit-modal";

export interface InstitutionRow {
  id: string; name: string; institutionType: string; plan: string; status: string; createdAt: string;
  students: number; teachers: number; parents: number; logoUrl?: string | null;
}
interface PlatformSummary { schools: InstitutionRow[] }

/** Self-fetching table of School rows (School/College/Institute all share
 * one underlying model — see institutionType). Used wherever a filtered
 * view of registered institutions is needed: Dashboard's overview, the
 * dedicated Registered Schools page, and the Registered Colleges &
 * Institutes page. */
export function InstitutionsTable({ title, icon: Icon, typeFilter, emptyMessage }: {
  title: string; icon: LucideIcon; typeFilter: (institutionType: string) => boolean; emptyMessage: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<InstitutionRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<InstitutionRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function load() {
    api<PlatformSummary>("/platform/summary")
      .then((r) => setRows(r.schools.filter((s) => typeFilter(s.institutionType))))
      .catch(() => {});
  }
  useEffect(load, []);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await api(`/platform/schools/${deleting.id}`, { method: "DELETE" });
      setDeleting(null);
      load();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 p-4 dark:border-white/5">
        <Icon size={16} className="text-primary" />
        <h2 className="font-display font-semibold text-night dark:text-white">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="p-6 text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr className="border-b border-slate-100 dark:border-white/5">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Students</th>
              <th className="px-4 py-3 text-right font-medium">Teachers</th>
              <th className="px-4 py-3 text-right font-medium">Parents</th>
              <th className="px-4 py-3 font-medium">Registered</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-slate-50 last:border-0 dark:border-white/5 transition-colors hover:bg-surface dark:hover:bg-white/5">
                <td className="px-4 py-3 font-medium text-night dark:text-white">
                  <span className="flex items-center gap-2.5">
                    {s.logoUrl ? (
                      <img src={s.logoUrl} alt="" className="h-7 w-7 shrink-0 rounded-lg object-cover ring-1 ring-slate-200 dark:ring-white/10" />
                    ) : (
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface text-[10px] font-semibold text-slate-400 dark:bg-white/5">
                        {s.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    {s.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{s.institutionType.charAt(0) + s.institutionType.slice(1).toLowerCase()}</td>
                <td className="px-4 py-3 text-slate-500">{s.plan}</td>
                <td className="px-4 py-3 text-slate-500">{s.status}</td>
                <td className="px-4 py-3 text-right text-night dark:text-white">{s.students}</td>
                <td className="px-4 py-3 text-right text-night dark:text-white">{s.teachers}</td>
                <td className="px-4 py-3 text-right text-night dark:text-white">{s.parents}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(s.createdAt).toLocaleDateString("en-IN")}</td>
                <td className="px-4 py-3">
                  <RowActions
                    onView={() => router.push(`/admin/schools/${s.id}`)}
                    onEdit={() => setEditingId(s.id)}
                    onDelete={() => setDeleting(s)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editingId && (
        <SchoolEditModal schoolId={editingId} onClose={() => setEditingId(null)}
          onSaved={() => { setEditingId(null); load(); }} />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete institution?"
          message={deleteError ?? `This permanently removes "${deleting.name}". Institutions with students or staff on record can't be deleted — set their status to Suspended instead.`}
          onConfirm={confirmDelete}
          onClose={() => { setDeleting(null); setDeleteError(null); }}
          busy={busy}
        />
      )}
    </Card>
  );
}
