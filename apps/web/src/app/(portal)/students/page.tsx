"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, RowActions, Field, inputCls } from "@/components/ui/modal";
import { BulkUploadModal, type BulkResult } from "@/components/students/bulk-upload-modal";
import { Pagination } from "@/components/ui/pagination";
import { StatCard } from "@/components/ui/stat-card";

interface StudentRow {
  id: string; admissionNo: string; registerNo: string; firstName: string; lastName: string;
  gender?: string | null; dob?: string | null; rollNo?: string | null; status?: string;
  sectionId?: string | null; userId?: string | null;
  section?: { name: string; class: { name: string } } | null;
  school?: { name: string } | null;
  guardians: { fullName: string; phone: string; relation?: string }[];
}
interface StudentDetail extends StudentRow {
  invoices: { invoiceNo: string; amount: string; status: string; dueDate: string }[];
  attendance: { date: string; status: string }[];
}
interface SectionOpt { id: string; label: string; schoolId: string }
interface SchoolOpt { id: string; name: string; tenantName?: string }
interface Me { role: string }
interface ClassOpt { id: string; name: string; schoolId: string; schoolName: string; sections: { id: string; name: string }[] }
interface StudentPage {
  items: StudentRow[]; total: number; matched: number; recentlyAdded: number; recentDays: number;
  page: number; pageSize: number; totalPages: number;
}
type SortKey = "fullName" | "admissionNo" | "registerNo" | "class";
const SORT_LABELS: Record<SortKey, string> = {
  admissionNo: "Admission no.", registerNo: "Register no.", fullName: "Name", class: "Class",
};
const countNumbers = (raw: string) => raw.split(/[\s,;]+/).filter(Boolean).length;

function SortableTh({ label, active, dir, onClick }: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void }) {
  return (
    <th className="px-4 py-3 font-medium" aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-night dark:hover:text-white">
        {label}
        <span aria-hidden className={active ? "text-primary" : "text-slate-300"}>{active ? (dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}

function StudentDialog({ mode, initial, schools, sections, onClose, onSaved }: {
  mode: "add" | "edit"; initial?: StudentRow; schools: SchoolOpt[]; sections: SectionOpt[];
  onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    admissionNo: initial?.admissionNo ?? "",
    firstName: initial?.firstName ?? "",
    lastName: initial?.lastName ?? "",
    schoolId: "",
    sectionId: initial?.sectionId ?? "",
    gender: initial?.gender ?? "",
    dob: initial?.dob ? initial.dob.slice(0, 10) : "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value, ...(k === "schoolId" && { sectionId: "" }) }));
  const sectionsForSchool = sections.filter((s) => s.schoolId === form.schoolId);

  // schools/sections are still fetching when this dialog can mount, so a
  // schoolId seeded at useState-init time can lock at "" forever — masked
  // because the <select> visually defaults to showing its first option
  // regardless. Backfill once the real data arrives (edit resolves the
  // student's existing section back to its school; add falls back to the
  // first school).
  useEffect(() => {
    if (form.schoolId) return;
    const fallback = initial?.sectionId
      ? sections.find((s) => s.id === initial.sectionId)?.schoolId
      : schools[0]?.id;
    if (fallback) setForm((f) => ({ ...f, schoolId: fallback }));
  }, [schools, sections, initial, form.schoolId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body = {
        ...(mode === "add" && { schoolId: form.schoolId }),
        sectionId: form.sectionId || undefined,
        admissionNo: form.admissionNo.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        ...(form.gender && { gender: form.gender }),
        ...(form.dob && { dob: form.dob }),
      };
      if (mode === "add") {
        await api("/students", { method: "POST", body: JSON.stringify(body) });
      } else {
        await api(`/students/${initial!.id}`, { method: "PATCH", body: JSON.stringify(body) });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save student");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={mode === "add" ? "Add student" : `Edit ${initial?.firstName} ${initial?.lastName}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field id="fs-first" label="First name">
            <input id="fs-first" required value={form.firstName} onChange={set("firstName")} className={inputCls} />
          </Field>
          <Field id="fs-last" label="Last name">
            <input id="fs-last" required value={form.lastName} onChange={set("lastName")} className={inputCls} />
          </Field>
        </div>
        <Field id="fs-adm" label="Admission no.">
          <input id="fs-adm" required value={form.admissionNo} onChange={set("admissionNo")} placeholder="ADM-1041" className={inputCls} />
        </Field>
        {mode === "add" ? (
          <Field id="fs-school" label="School">
            <select id="fs-school" required value={form.schoolId} onChange={set("schoolId")} className={inputCls}>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        ) : (
          <Field id="fs-school-ro" label="School">
            <p className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-500 dark:border-white/10">
              {initial?.school?.name ?? "—"}
            </p>
          </Field>
        )}
        <Field id="fs-sec" label="Class & section">
          <select id="fs-sec" required value={form.sectionId} onChange={set("sectionId")} className={inputCls}>
            <option value="" disabled>Select a division</option>
            {sectionsForSchool.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="fs-gender" label="Gender" optional>
            <select id="fs-gender" value={form.gender} onChange={set("gender")} className={inputCls}>
              <option value="">—</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option>
            </select>
          </Field>
          <Field id="fs-dob" label="Date of birth" optional>
            <input id="fs-dob" type="date" value={form.dob} onChange={set("dob")} className={inputCls} />
          </Field>
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : mode === "add" ? "Save student" : "Save changes"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function ViewStudent({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [creatingLogin, setCreatingLogin] = useState(false);
  const [loginResult, setLoginResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  useEffect(() => {
    api<StudentDetail>(`/students/${id}`).then(setDetail).catch(() => setFailed(true));
  }, [id]);

  async function createLogin() {
    setCreatingLogin(true);
    setLoginError(null);
    try {
      const res = await api<{ email: string; tempPassword: string }>(`/students/${id}/login`, { method: "POST" });
      setLoginResult(res);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Could not create login");
    } finally {
      setCreatingLogin(false);
    }
  }

  const statusColor: Record<string, string> = {
    PAID: "bg-success/10 text-success", PENDING: "bg-warning/10 text-warning",
    PARTIAL: "bg-accent/10 text-accent", OVERDUE: "bg-danger/10 text-danger",
  };

  return (
    <Modal title={detail ? `${detail.firstName} ${detail.lastName}` : "Student"} onClose={onClose} wide>
      {failed && <p className="text-sm text-slate-500">Couldn&apos;t load this student.</p>}
      {!detail && !failed && <p className="text-sm text-slate-500">Loading…</p>}
      {detail && (
        <div className="space-y-6 text-sm">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {[
              ["School", detail.school?.name ?? "—"],
              ["Admission no.", detail.admissionNo],
              ["Register no.", detail.registerNo],
              ["Class", detail.section ? `${detail.section.class.name} · ${detail.section.name}` : "—"],
              ["Roll no.", detail.rollNo ?? "—"],
              ["Gender", detail.gender ?? "—"],
              ["Date of birth", detail.dob ? new Date(detail.dob).toLocaleDateString("en-IN") : "—"],
              ["Status", detail.status ?? "ACTIVE"],
            ].map(([k, v]) => (
              <div key={k as string}>
                <dt className="text-xs uppercase tracking-wide text-slate-400">{k}</dt>
                <dd className="mt-0.5 font-medium text-night dark:text-white">{v}</dd>
              </div>
            ))}
          </dl>

          <div>
            <h3 className="mb-2 font-medium text-night dark:text-white">Student login</h3>
            {detail.userId ? (
              <p className="text-slate-500">This student can sign in with admission no. {detail.admissionNo}.</p>
            ) : loginResult ? (
              <p className="text-night dark:text-white">
                Login created — temporary password: <span className="font-mono font-semibold">{loginResult.tempPassword}</span>
                <span className="mt-1 block text-xs text-slate-500">
                  Shown once — the student can now sign in with admission no. {detail.admissionNo} and this password.
                </span>
              </p>
            ) : (
              <div>
                <button type="button" onClick={createLogin} disabled={creatingLogin}
                  className="text-sm font-medium text-primary hover:underline disabled:opacity-50">
                  {creatingLogin ? "Creating…" : "Create student login"}
                </button>
                {loginError && <p className="mt-1 text-sm text-danger">{loginError}</p>}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 font-medium text-night dark:text-white">Guardians</h3>
            {detail.guardians.length === 0 && <p className="text-slate-500">None on record.</p>}
            {detail.guardians.map((g) => (
              <p key={g.phone} className="text-slate-500">
                {g.fullName} {g.relation ? `(${g.relation})` : ""} · {g.phone}
              </p>
            ))}
          </div>

          <div>
            <h3 className="mb-2 font-medium text-night dark:text-white">Recent invoices</h3>
            {detail.invoices.length === 0 && <p className="text-slate-500">No invoices yet.</p>}
            {detail.invoices.map((inv) => (
              <div key={inv.invoiceNo} className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0 dark:border-white/5">
                <span className="font-mono text-xs text-slate-500">{inv.invoiceNo}</span>
                <span>₹{Number(inv.amount).toLocaleString("en-IN")}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[inv.status] ?? "bg-slate-100 text-slate-500"}`}>{inv.status}</span>
              </div>
            ))}
          </div>

          <div>
            <h3 className="mb-2 font-medium text-night dark:text-white">Attendance (last 30 records)</h3>
            <p className="text-slate-500">
              {detail.attendance.length === 0 ? "No attendance yet." : (() => {
                const present = detail.attendance.filter((a) => a.status === "PRESENT").length;
                return `${present}/${detail.attendance.length} present (${Math.round((present / detail.attendance.length) * 100)}%)`;
              })()}
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function StudentsPage() {
  return (
    <Suspense fallback={null}>
      <StudentsPageInner />
    </Suspense>
  );
}

function StudentsPageInner() {
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [schools, setSchools] = useState<SchoolOpt[]>([]);
  const [sections, setSections] = useState<SectionOpt[]>([]);
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [dialog, setDialog] = useState<{ mode: "add" } | { mode: "edit"; row: StudentRow } | null>(null);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<StudentRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [schoolIdFilter, setSchoolIdFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState<SortKey>("admissionNo");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [admissionNos, setAdmissionNos] = useState("");
  const [admissionDraft, setAdmissionDraft] = useState("");
  const [admissionPanelOpen, setAdmissionPanelOpen] = useState(false);
  const [meta, setMeta] = useState<Pick<StudentPage, "total" | "matched" | "recentlyAdded" | "recentDays" | "totalPages"> | null>(null);
  const [lastUpload, setLastUpload] = useState<BulkResult | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const load = useCallback(() => {
    setState("loading");
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sortBy, sortDir });
    if (q) params.set("q", q);
    if (schoolIdFilter) params.set("schoolId", schoolIdFilter);
    if (classId) params.set("classId", classId);
    if (sectionId) params.set("sectionId", sectionId);
    if (admissionNos) params.set("admissionNos", admissionNos);
    api<StudentPage>(`/students?${params.toString()}`)
      .then((r) => {
        // Filtering or deleting can leave the current page beyond the new last page.
        if (r.page > r.totalPages) { setPage(r.totalPages); return; }
        setRows(r.items); setMeta(r); setSelected(new Set()); setState("ready");
      })
      .catch(() => setState("error"));
    // reloadTick only exists to force a refetch when no other dependency changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, schoolIdFilter, classId, sectionId, admissionNos, page, pageSize, sortBy, sortDir, reloadTick]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { api<SchoolOpt[]>("/academic/schools").then(setSchools).catch(() => setSchools([])); }, []);
  useEffect(() => { api<SectionOpt[]>("/academic/sections").then(setSections).catch(() => setSections([])); }, []);
  useEffect(() => { api<Me>("/auth/me").then(setMe).catch(() => setMe(null)); }, []);
  useEffect(() => {
    const qs = schoolIdFilter ? `?schoolId=${encodeURIComponent(schoolIdFilter)}` : "";
    api<{ classes: ClassOpt[] }>(`/students/filter-options${qs}`).then((r) => setClasses(r.classes)).catch(() => setClasses([]));
  }, [schoolIdFilter]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  const isSuperAdmin = me?.role === "SUPER_ADMIN" || me?.role === "ORG_ADMIN";

  const sortedClasses = useMemo(
    () => [...classes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }) || a.schoolName.localeCompare(b.schoolName)),
    [classes],
  );
  const multiSchool = new Set(classes.map((c) => c.schoolId)).size > 1;
  const divisions = sortedClasses.find((c) => c.id === classId)?.sections ?? [];
  const filtersActive = Boolean(q.trim() || classId || sectionId || admissionNos);
  const admissionCount = countNumbers(admissionNos);

  function toggleSort(key: SortKey) {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(key); setSortDir("asc"); }
    setPage(1);
  }

  function clearFilters() {
    setQ(""); setClassId(""); setSectionId(""); setAdmissionNos(""); setAdmissionDraft("");
    setAdmissionPanelOpen(false); setPage(1);
  }

  function applyAdmissionNos() {
    setAdmissionNos(admissionDraft.trim());
    setAdmissionPanelOpen(false);
    setPage(1);
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/students/${deleting.id}`, { method: "DELETE" });
      setToast("Student deleted");
      setDeleting(null);
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not delete");
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  async function confirmBulkDelete() {
    const ids = Array.from(selected);
    setBusy(true);
    const results = await Promise.allSettled(ids.map((id) => api(`/students/${id}`, { method: "DELETE" })));
    const failed = results.filter((r) => r.status === "rejected").length;
    setToast(
      failed === 0
        ? `${ids.length} student${ids.length === 1 ? "" : "s"} deleted`
        : `${ids.length - failed} deleted, ${failed} failed (likely have payment history)`,
    );
    setBulkDeleting(false);
    setBusy(false);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Students</h1>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <Button variant="ghost" className="text-danger" onClick={() => setBulkDeleting(true)}>
              Delete {selected.size} selected
            </Button>
          )}
          <Button variant="ghost" onClick={() => setBulkUploadOpen(true)}>Bulk upload</Button>
          <Button onClick={() => setDialog({ mode: "add" })}>Add student</Button>
        </div>
      </div>

      {meta && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Total students" value={meta.total.toLocaleString("en-IN")} />
          <StatCard label={`Added in the last ${meta.recentDays} days`} value={meta.recentlyAdded.toLocaleString("en-IN")} />
          <StatCard
            label={filtersActive ? "Matching current filters" : "Showing all students"}
            value={meta.matched.toLocaleString("en-IN")}
          />
        </div>
      )}

      {lastUpload && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm">
          <p className="text-slate-600 dark:text-slate-300">
            <span className="font-medium text-night dark:text-white">Last upload ({lastUpload.schoolName}): </span>
            {lastUpload.created.toLocaleString("en-IN")} newly uploaded · {lastUpload.updated.toLocaleString("en-IN")} existing updated
            {lastUpload.errors.length > 0 && ` · ${lastUpload.errors.length} failed`} · {lastUpload.total.toLocaleString("en-IN")} students in the school now
          </p>
          <button type="button" onClick={() => setLastUpload(null)} className="text-xs font-medium text-primary hover:underline">Dismiss</button>
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 dark:border-white/5 p-4">
          <input
            value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Search by name or admission no." aria-label="Search students"
            className="h-10 w-full max-w-sm rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-4 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          {isSuperAdmin && (
            <select value={schoolIdFilter}
              onChange={(e) => { setSchoolIdFilter(e.target.value); setClassId(""); setSectionId(""); setPage(1); }}
              aria-label="Filter by school"
              className="h-10 max-w-xs rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-4 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20">
              <option value="">All schools</option>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}{s.tenantName ? ` — ${s.tenantName}` : ""}</option>)}
            </select>
          )}
          <select value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(""); setPage(1); }} aria-label="Filter by class"
            className="h-10 max-w-[12rem] rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-4 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20">
            <option value="">All classes</option>
            {sortedClasses.map((c) => <option key={c.id} value={c.id}>{multiSchool ? `${c.name} (${c.schoolName})` : c.name}</option>)}
          </select>
          <select value={sectionId} onChange={(e) => { setSectionId(e.target.value); setPage(1); }} aria-label="Filter by division"
            disabled={!classId}
            className="h-10 max-w-[10rem] rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-4 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50">
            <option value="">{classId ? "All divisions" : "Pick a class first"}</option>
            {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button type="button" onClick={() => { setAdmissionDraft(admissionNos); setAdmissionPanelOpen((o) => !o); }}
            aria-expanded={admissionPanelOpen}
            className={`h-10 rounded-xl border px-4 text-sm transition-colors ${admissionNos
              ? "border-primary bg-primary/5 font-medium text-primary"
              : "border-slate-200 text-slate-600 hover:bg-surface dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"}`}>
            Admission nos.{admissionCount > 0 ? ` (${admissionCount})` : ""}
          </button>

          <div className="ml-auto flex items-center gap-2">
            <label htmlFor="student-sort" className="text-xs text-slate-400">Sort by</label>
            <select id="student-sort" value={sortBy} onChange={(e) => { setSortBy(e.target.value as SortKey); setPage(1); }}
              className="h-10 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20">
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => <option key={k} value={k}>{SORT_LABELS[k]}</option>)}
            </select>
            <button type="button" onClick={() => { setSortDir((d) => (d === "asc" ? "desc" : "asc")); setPage(1); }}
              aria-label={`Sort direction: ${sortDir === "asc" ? "ascending" : "descending"}`}
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-600 hover:bg-surface dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">
              {sortDir === "asc" ? "A → Z" : "Z → A"}
            </button>
            {filtersActive && (
              <button type="button" onClick={clearFilters} className="px-2 text-sm font-medium text-primary hover:underline">Clear filters</button>
            )}
          </div>
        </div>

        {admissionPanelOpen && (
          <div className="space-y-2 border-b border-slate-100 bg-surface/50 p-4 dark:border-white/5 dark:bg-white/[0.02]">
            <label htmlFor="admission-filter" className="block text-xs font-medium text-slate-500">
              Paste admission numbers — separated by commas, spaces or one per line
            </label>
            <textarea id="admission-filter" rows={4} value={admissionDraft} onChange={(e) => setAdmissionDraft(e.target.value)}
              placeholder={"ADM-1001\nADM-1002, ADM-1010"}
              className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 font-mono text-xs outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-white/10" />
            <div className="flex items-center gap-2">
              <Button type="button" onClick={applyAdmissionNos}>Apply</Button>
              <Button type="button" variant="ghost" onClick={() => { setAdmissionDraft(""); setAdmissionNos(""); setAdmissionPanelOpen(false); setPage(1); }}>Clear</Button>
              <span className="text-xs text-slate-400">{countNumbers(admissionDraft)} number{countNumbers(admissionDraft) === 1 ? "" : "s"} (max 500)</span>
            </div>
          </div>
        )}

        {admissionCount > 0 && meta && state === "ready" && (
          <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500 dark:border-white/5">
            Found {meta.matched.toLocaleString("en-IN")} of {admissionCount.toLocaleString("en-IN")} admission number{admissionCount === 1 ? "" : "s"}
            {meta.matched < admissionCount && " — the rest don't exist (or are hidden by another filter)."}
          </p>
        )}

        {state === "error" && (
          <p className="p-6 text-sm text-slate-500">
            Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.
          </p>
        )}
        {state === "ready" && rows.length === 0 && (
          <p className="p-6 text-sm text-slate-500">{filtersActive ? "No students match these filters." : "No students yet."}</p>
        )}

        {rows.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="w-10 px-4 py-3 font-medium">
                  <input
                    type="checkbox" aria-label="Select all students"
                    checked={rows.length > 0 && selected.size === rows.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                {(["admissionNo", "registerNo", "fullName"] as SortKey[]).map((k) => (
                  <SortableTh key={k} label={SORT_LABELS[k]} active={sortBy === k} dir={sortDir} onClick={() => toggleSort(k)} />
                ))}
                {isSuperAdmin && <th className="px-4 py-3 font-medium">School</th>}
                <SortableTh label={SORT_LABELS.class} active={sortBy === "class"} dir={sortDir} onClick={() => toggleSort("class")} />
                <th className="px-4 py-3 font-medium">Primary guardian</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-slate-50 dark:border-white/5 transition-colors hover:bg-surface dark:hover:bg-white/5">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox" aria-label={`Select ${s.firstName} ${s.lastName}`}
                      checked={selected.has(s.id)} onChange={() => toggleSelected(s.id)}
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{s.admissionNo}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{s.registerNo}</td>
                  <td className="px-4 py-3 font-medium text-night dark:text-white">{s.firstName} {s.lastName}</td>
                  {isSuperAdmin && <td className="px-4 py-3 text-slate-500">{s.school?.name ?? "—"}</td>}
                  <td className="px-4 py-3">{s.section ? `${s.section.class.name} · ${s.section.name}` : "—"}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {s.guardians[0] ? `${s.guardians[0].fullName} · ${s.guardians[0].phone}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <RowActions
                      onView={() => setViewing(s.id)}
                      onEdit={() => setDialog({ mode: "edit", row: s })}
                      onDelete={() => setDeleting(s)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {meta && (
          <Pagination
            page={page} totalPages={meta.totalPages} pageSize={pageSize} matched={meta.matched}
            onPage={setPage}
            onPageSize={(n) => { setPageSize(n); setPage(1); }}
          />
        )}
      </Card>

      {dialog && (
        <StudentDialog
          mode={dialog.mode}
          initial={dialog.mode === "edit" ? dialog.row : undefined}
          schools={schools}
          sections={sections}
          onClose={() => setDialog(null)}
          onSaved={() => { setToast(dialog.mode === "add" ? "Student added" : "Changes saved"); setQ(""); load(); }}
        />
      )}
      {viewing && <ViewStudent id={viewing} onClose={() => setViewing(null)} />}
      {bulkUploadOpen && (
        <BulkUploadModal
          schools={schools}
          onClose={() => setBulkUploadOpen(false)}
          onDone={(result) => {
            setBulkUploadOpen(false);
            setLastUpload(result);
            setToast(`Bulk upload complete — ${result.created} new, ${result.updated} existing updated`);
            // Newest first, so the freshly uploaded students are right at the top (register no. is assigned in creation order).
            clearFilters();
            setSortBy("registerNo"); setSortDir("desc");
            setReloadTick((t) => t + 1);
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete student?"
          message={`This permanently removes ${deleting.firstName} ${deleting.lastName} (${deleting.admissionNo}) along with their attendance, results and unpaid invoices. Students with payment history can't be deleted — set them to Transferred/Alumni instead.`}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
          busy={busy}
        />
      )}
      {bulkDeleting && (
        <ConfirmDialog
          title={`Delete ${selected.size} selected students?`}
          message="This permanently removes each selected student along with their attendance, results and unpaid invoices. Students with payment history can't be deleted and will be reported as failed."
          onConfirm={confirmBulkDelete}
          onClose={() => setBulkDeleting(false)}
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
