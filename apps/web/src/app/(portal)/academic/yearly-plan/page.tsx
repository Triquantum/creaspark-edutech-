"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, RowActions, Field, inputCls } from "@/components/ui/modal";

const MANAGE_ROLES = new Set(["SUPER_ADMIN", "ORG_ADMIN"]);

interface GradeRow { id: string; academicYear: string; gradeLabel: string; sortOrder: number; entryCount: number }
interface Me { role: string }
interface FilterOptions { academicYears: string[]; gradeLabels: string[]; subjects: string[]; months: string[]; weeks: string[] }
interface SchoolOpt { id: string; name: string }
interface Filters { schoolId: string; academicYear: string; gradeLabel: string; subject: string; month: string; week: string }
const EMPTY_FILTERS: Filters = { schoolId: "", academicYear: "", gradeLabel: "", subject: "", month: "", week: "" };

function fyYearOptions(count = 10): string[] {
  const base = new Date().getFullYear();
  return Array.from({ length: count }, (_, i) => `${base + i}-${base + i + 1}`);
}

function GradeDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const yearOptions = fyYearOptions();
  const [form, setForm] = useState({ academicYear: yearOptions[0], gradeLabel: "", sortOrder: "0" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/academic/yearly-plan/grades", {
        method: "POST",
        body: JSON.stringify({ academicYear: form.academicYear.trim(), gradeLabel: form.gradeLabel.trim(), sortOrder: Number(form.sortOrder) || 0 }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create yearly plan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New yearly plan" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field id="yp-year" label="Academic year">
          <select id="yp-year" required value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} className={inputCls}>
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </Field>
        <Field id="yp-grade" label="Grade / Class label">
          <input id="yp-grade" required value={form.gradeLabel} onChange={(e) => setForm({ ...form, gradeLabel: e.target.value })} className={inputCls} placeholder="e.g. Grade 5" />
        </Field>
        <Field id="yp-sort" label="Sort order" optional>
          <input id="yp-sort" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} className={inputCls} />
        </Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Create"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function YearlyPlanPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [showAdd, setShowAdd] = useState(false);
  const [deleting, setDeleting] = useState<GradeRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [schools, setSchools] = useState<SchoolOpt[]>([]);

  const load = useCallback(() => {
    setState("loading");
    const params = new URLSearchParams();
    if (filters.schoolId) params.set("schoolId", filters.schoolId);
    if (filters.academicYear) params.set("academicYear", filters.academicYear);
    if (filters.gradeLabel) params.set("gradeLabel", filters.gradeLabel);
    if (filters.subject) params.set("subject", filters.subject);
    if (filters.month) params.set("month", filters.month);
    if (filters.week) params.set("week", filters.week);
    const qs = params.toString();
    api<GradeRow[]>(`/academic/yearly-plan/grades${qs ? `?${qs}` : ""}`).then((r) => { setRows(r); setState("ready"); }).catch(() => setState("error"));
  }, [filters]);
  useEffect(() => { api<Me>("/auth/me").then(setMe).catch(() => {}); }, []);
  useEffect(() => { api<FilterOptions>("/academic/yearly-plan/grades/filter-options").then(setFilterOptions).catch(() => {}); }, []);
  useEffect(() => { api<SchoolOpt[]>("/academic/schools").then(setSchools).catch(() => {}); }, []);
  useEffect(load, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  const canManage = !!me && MANAGE_ROLES.has(me.role);
  const hasActiveFilters = Object.values(filters).some(Boolean);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/academic/yearly-plan/grades/${deleting.id}`, { method: "DELETE" });
      setToast("Yearly plan deleted");
      setDeleting(null);
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Academic</p>
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Yearly Plan</h1>
          <p className="mt-1 text-sm text-slate-500">Week-by-week curriculum plan by grade.</p>
        </div>
        {canManage && <Button onClick={() => setShowAdd(true)}>+ Add grade</Button>}
      </div>

      <Card className="flex flex-wrap items-end gap-3 p-4">
        <Field id="yp-f-school" label="School">
          <select id="yp-f-school" value={filters.schoolId} onChange={(e) => setFilters({ ...filters, schoolId: e.target.value })} className={inputCls}>
            <option value="">All schools</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field id="yp-f-year" label="FY Year">
          <select id="yp-f-year" value={filters.academicYear} onChange={(e) => setFilters({ ...filters, academicYear: e.target.value })} className={inputCls}>
            <option value="">All years</option>
            {filterOptions?.academicYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </Field>
        <Field id="yp-f-grade" label="Grade">
          <select id="yp-f-grade" value={filters.gradeLabel} onChange={(e) => setFilters({ ...filters, gradeLabel: e.target.value })} className={inputCls}>
            <option value="">All grades</option>
            {filterOptions?.gradeLabels.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
        <Field id="yp-f-subject" label="Subject">
          <select id="yp-f-subject" value={filters.subject} onChange={(e) => setFilters({ ...filters, subject: e.target.value })} className={inputCls}>
            <option value="">All subjects</option>
            {filterOptions?.subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field id="yp-f-month" label="Month">
          <select id="yp-f-month" value={filters.month} onChange={(e) => setFilters({ ...filters, month: e.target.value })} className={inputCls}>
            <option value="">All months</option>
            {filterOptions?.months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
        <Field id="yp-f-week" label="Week">
          <select id="yp-f-week" value={filters.week} onChange={(e) => setFilters({ ...filters, week: e.target.value })} className={inputCls}>
            <option value="">All weeks</option>
            {filterOptions?.weeks.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </Field>
        {hasActiveFilters && (
          <Button type="button" variant="ghost" onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</Button>
        )}
      </Card>

      {state === "error" && <p className="text-sm text-slate-500">Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.</p>}
      {state === "ready" && rows.length === 0 && (
        <p className="text-sm text-slate-500">{hasActiveFilters ? "No yearly plans match these filters." : "No yearly plans uploaded yet."}</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((g) => (
          <Card key={g.id} className="cursor-pointer p-5" onClick={() => router.push(`/academic/yearly-plan/${g.id}`)}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{g.academicYear}</p>
                <h2 className="mt-0.5 font-display text-lg font-semibold text-night dark:text-white">{g.gradeLabel}</h2>
                <p className="mt-1 text-xs text-slate-500">{g.entryCount} week{g.entryCount === 1 ? "" : "s"} planned</p>
              </div>
              {canManage && (
                <div onClick={(e) => e.stopPropagation()}>
                  <RowActions onView={() => router.push(`/academic/yearly-plan/${g.id}`)} onDelete={() => setDeleting(g)} />
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {showAdd && <GradeDialog onClose={() => setShowAdd(false)} onSaved={() => { setToast("Yearly plan created"); setShowAdd(false); load(); }} />}
      {deleting && (
        <ConfirmDialog
          title="Delete yearly plan?"
          message={`Permanently remove the ${deleting.academicYear} plan for ${deleting.gradeLabel}, including all ${deleting.entryCount} weeks?`}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
          busy={busy}
        />
      )}
      {toast && <div role="status" className="fixed bottom-6 right-6 z-50 rounded-xl bg-night px-4 py-3 text-sm text-white shadow-lift">{toast}</div>}
    </div>
  );
}
