"use client";
import { useCallback, useEffect, useState } from "react";
import { api, apiBlob } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog, RowActions, Field, inputCls } from "@/components/ui/modal";

const EMPLOYEE_ROLES = [
  "SUPER_ADMIN", "ORG_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "COORDINATOR",
  "TEACHER", "TRAINER", "ACCOUNTANT", "RECEPTION", "LIBRARIAN", "TRANSPORT_MANAGER", "HR",
  "INVENTORY_MANAGER", "HOSTEL_WARDEN", "SECURITY",
] as const;

function roleLabel(role: string) {
  return role.toLowerCase().split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

interface EmployeeRow {
  id: string; fullName: string; email: string; phone?: string | null; role: string; isActive: boolean;
  staffProfile?: {
    employeeNo: string; designation: string; department?: string | null; joinDate?: string;
    employmentType?: string; salaryPaidBy?: string; salary?: number | string | null;
    schoolId?: string; school?: { name: string } | null;
  } | null;
  userAccess?: {
    id: string; role: string; designation?: string | null; department?: string | null;
    isPrimary: boolean; schoolId?: string | null; school?: { name: string } | null;
  }[];
}
interface SchoolOpt { id: string; name: string }
interface DeptOpt { id: string; name: string }
interface ExtraGrant { id?: string; schoolId: string; role: string; designation: string; department: string }

/** One additional (school, role) grant row -- fetches its own department
 * list since each row can point at a different school. */
function GrantRow({ grant, schools, onChange, onRemove }: {
  grant: ExtraGrant; schools: SchoolOpt[]; onChange: (g: ExtraGrant) => void; onRemove: () => void;
}) {
  const [departments, setDepartments] = useState<DeptOpt[]>([]);
  useEffect(() => {
    if (!grant.schoolId) { setDepartments([]); return; }
    api<DeptOpt[]>(`/academic/departments?schoolId=${grant.schoolId}`).then(setDepartments).catch(() => setDepartments([]));
  }, [grant.schoolId]);

  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-end gap-2 rounded-xl border border-slate-200 p-3 dark:border-white/10">
      <div>
        <label className="mb-1 block text-xs text-slate-500">School</label>
        <select value={grant.schoolId} onChange={(e) => onChange({ ...grant, schoolId: e.target.value })} className={`${inputCls} h-9`}>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Role</label>
        <select value={grant.role} onChange={(e) => onChange({ ...grant, role: e.target.value })} className={`${inputCls} h-9`}>
          {EMPLOYEE_ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Designation</label>
        <input value={grant.designation} onChange={(e) => onChange({ ...grant, designation: e.target.value })}
          placeholder="Guest Faculty" className={`${inputCls} h-9`} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Department</label>
        <select value={grant.department} onChange={(e) => onChange({ ...grant, department: e.target.value })} className={`${inputCls} h-9`}>
          <option value="">None</option>
          {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
      </div>
      <button type="button" aria-label="Remove grant" onClick={onRemove}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-black/5 hover:text-danger dark:hover:bg-white/10">
        ×
      </button>
    </div>
  );
}

function EmployeeDialog({ mode, initial, schools, schoolsError, onClose, onSaved }: {
  mode: "add" | "edit"; initial?: EmployeeRow; schools: SchoolOpt[]; schoolsError: string | null;
  onClose: () => void; onSaved: (tempPassword?: string) => void;
}) {
  const [form, setForm] = useState({
    fullName: initial?.fullName ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    role: initial?.role ?? "ACCOUNTANT",
    employeeNo: initial?.staffProfile?.employeeNo ?? "",
    designation: initial?.staffProfile?.designation ?? "",
    department: initial?.staffProfile?.department ?? "",
    employmentType: initial?.staffProfile?.employmentType ?? "PERMANENT",
    salaryPaidBy: initial?.staffProfile?.salaryPaidBy ?? "SCHOOL",
    salary: initial?.staffProfile?.salary != null ? String(initial.staffProfile.salary) : "",
    schoolId: "",
    isActive: initial ? String(initial.isActive) : "true",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<DeptOpt[]>([]);
  const [multiAccess, setMultiAccess] = useState(() => (initial?.userAccess?.length ?? 0) > 1);
  const [assignAllSchools, setAssignAllSchools] = useState(false);
  const [extraGrants, setExtraGrants] = useState<ExtraGrant[]>(() =>
    (initial?.userAccess ?? []).filter((a) => !a.isPrimary).map((a) => ({
      id: a.id, schoolId: a.schoolId ?? "", role: a.role, designation: a.designation ?? "", department: a.department ?? "",
    })),
  );
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (form.schoolId) return;
    const fallback = mode === "edit" ? initial?.staffProfile?.schoolId : schools[0]?.id;
    if (fallback) setForm((f) => ({ ...f, schoolId: fallback }));
  }, [schools, form.schoolId, initial, mode]);

  // Refetches whenever the selected school changes -- department names are
  // scoped per school, so the option list must track the School field above it.
  useEffect(() => {
    if (!form.schoolId) { setDepartments([]); return; }
    api<DeptOpt[]>(`/academic/departments?schoolId=${form.schoolId}`)
      .then(setDepartments)
      .catch(() => setDepartments([]));
  }, [form.schoolId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      // Single school (neither box checked) stays today's exact behavior --
      // grants omitted entirely. "All schools" sends one sentinel grant the
      // server expands to every school in this employee's tenant. Multiple
      // schools sends the primary plus each manually added row.
      const primaryGrant = {
        schoolId: form.schoolId, role: form.role, designation: form.designation.trim(),
        ...(form.department && { department: form.department.trim() }),
        employeeNo: form.employeeNo.trim(), isPrimary: true,
      };
      const grants = assignAllSchools
        ? [primaryGrant, { schoolId: "ALL", role: form.role, ...(form.department && { department: form.department.trim() }) }]
        : multiAccess && extraGrants.length > 0
          ? [
              primaryGrant,
              ...extraGrants.map((g) => ({
                ...(g.id && { id: g.id }),
                schoolId: g.schoolId, role: g.role,
                ...(g.designation.trim() && { designation: g.designation.trim() }),
                ...(g.department && { department: g.department }),
              })),
            ]
          : undefined;
      const common = {
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        ...(form.phone && { phone: form.phone.trim() }),
        role: form.role,
        employeeNo: form.employeeNo.trim(),
        designation: form.designation.trim(),
        ...(form.department && { department: form.department.trim() }),
        employmentType: form.employmentType,
        salaryPaidBy: form.salaryPaidBy,
        ...(form.salary.trim() && { salary: Number(form.salary) }),
        ...(grants && { grants }),
      };
      if (mode === "add") {
        const res = await api<{ tempPassword?: string }>("/employees", {
          method: "POST",
          body: JSON.stringify({ ...common, schoolId: form.schoolId }),
        });
        onSaved(res.tempPassword);
      } else {
        await api(`/employees/${initial!.id}`, {
          method: "PATCH",
          body: JSON.stringify({ ...common, schoolId: form.schoolId, isActive: form.isActive === "true" }),
        });
        onSaved();
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save employee");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={mode === "add" ? "Add employee" : `Edit ${initial?.fullName}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field id="fe-name" label="Full name">
          <input id="fe-name" required value={form.fullName} onChange={set("fullName")} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="fe-email" label="Email">
            <input id="fe-email" type="email" required value={form.email} onChange={set("email")} className={inputCls} />
          </Field>
          <Field id="fe-phone" label="Phone" optional>
            <input id="fe-phone" value={form.phone ?? ""} onChange={set("phone")} inputMode="tel" className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field id="fe-role" label="Role">
            <select id="fe-role" value={form.role} onChange={set("role")} className={inputCls}>
              {EMPLOYEE_ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </select>
          </Field>
          <Field id="fe-emp" label="Employee no.">
            <input id="fe-emp" required value={form.employeeNo} onChange={set("employeeNo")} placeholder="EMP-014" className={inputCls} />
          </Field>
        </div>
        <Field id="fe-school" label="School">
          <select id="fe-school" required value={form.schoolId} onChange={set("schoolId")} className={inputCls}>
            {schools.length === 0 && <option value="" disabled>{schoolsError ? "Unavailable" : "Loading schools…"}</option>}
            {schools.length > 0 && !form.schoolId && <option value="" disabled>Select a school</option>}
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {schools.length === 0 && (
            <p className="mt-1 text-xs text-danger">
              {schoolsError ?? "Still loading — if this doesn't fill in, reload the page."}
            </p>
          )}
        </Field>
        {mode === "edit" && (
          <Field id="fe-active" label="Status">
            <select id="fe-active" value={form.isActive} onChange={set("isActive")} className={inputCls}>
              <option value="true">Active</option>
              <option value="false">Inactive (blocks sign-in)</option>
            </select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field id="fe-desig" label="Designation">
            <input id="fe-desig" required value={form.designation} onChange={set("designation")} placeholder="Accounts Officer" className={inputCls} />
          </Field>
          <Field id="fe-dept" label="Department" optional>
            <select id="fe-dept" value={form.department ?? ""} onChange={set("department")} className={inputCls}>
              <option value="">No department</option>
              {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
              {form.department && !departments.some((d) => d.name === form.department) && (
                <option value={form.department}>{form.department}</option>
              )}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field id="fe-emptype" label="Employee type">
            <select id="fe-emptype" value={form.employmentType} onChange={set("employmentType")} className={inputCls}>
              <option value="PERMANENT">Permanent</option>
              <option value="TEMPORARY">Temporary</option>
            </select>
          </Field>
          <Field id="fe-salary" label="Salary paid by">
            <select id="fe-salary" value={form.salaryPaidBy} onChange={set("salaryPaidBy")} className={inputCls}>
              <option value="SCHOOL">School</option>
              <option value="COMPANY">Company</option>
            </select>
          </Field>
        </div>
        <Field id="fe-salary-amt" label="Monthly gross salary (₹)" optional>
          <input id="fe-salary-amt" type="number" min="0" step="0.01" value={form.salary} onChange={set("salary")}
            placeholder="45000" className={inputCls} />
        </Field>

        <label className="flex items-center gap-2 text-sm text-night dark:text-white">
          <input
            type="checkbox" checked={assignAllSchools} className="accent-primary"
            onChange={(e) => {
              setAssignAllSchools(e.target.checked);
              if (e.target.checked) { setMultiAccess(false); setExtraGrants([]); }
            }}
          />
          Assign to all schools / institutes / colleges / centers
        </label>

        {!assignAllSchools && (
          <label className="flex items-center gap-2 text-sm text-night dark:text-white">
            <input
              type="checkbox" checked={multiAccess} className="accent-primary"
              onChange={(e) => { setMultiAccess(e.target.checked); if (!e.target.checked) setExtraGrants([]); }}
            />
            This person also works at specific other schools/roles
          </label>
        )}

        {multiAccess && !assignAllSchools && (
          <div className="space-y-2">
            {extraGrants.map((g, i) => (
              <GrantRow
                key={g.id ?? i} grant={g} schools={schools}
                onChange={(next) => setExtraGrants((rows) => rows.map((r, idx) => (idx === i ? next : r)))}
                onRemove={() => setExtraGrants((rows) => rows.filter((_, idx) => idx !== i))}
              />
            ))}
            <button
              type="button"
              onClick={() => setExtraGrants((rows) => [...rows, { schoolId: schools[0]?.id ?? "", role: "TEACHER", designation: "", department: "" }])}
              className="text-xs font-medium text-primary hover:underline"
            >
              + Add another school/role
            </button>
          </div>
        )}

        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : mode === "add" ? "Save employee" : "Save changes"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function SalaryCertificateModal({ employee, onClose }: { employee: EmployeeRow; onClose: () => void }) {
  const [refNo, setRefNo] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [signatoryName, setSignatoryName] = useState("");
  const [signatoryDesignation, setSignatoryDesignation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const blob = await apiBlob(`/employees/${employee.id}/salary-certificate`, {
        method: "POST",
        body: JSON.stringify({
          ...(refNo.trim() && { refNo: refNo.trim() }),
          ...(date && { date }),
          signatoryName: signatoryName.trim(),
          signatoryDesignation: signatoryDesignation.trim(),
        }),
      });
      window.open(URL.createObjectURL(blob), "_blank");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the certificate");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Salary certificate — ${employee.fullName}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field id="sc-ref" label="Reference no." optional>
            <input id="sc-ref" value={refNo} onChange={(e) => setRefNo(e.target.value)} placeholder="HR/SC/0001" className={inputCls} />
          </Field>
          <Field id="sc-date" label="Date">
            <input id="sc-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Field id="sc-signame" label="Signatory name">
          <input id="sc-signame" required value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} className={inputCls} />
        </Field>
        <Field id="sc-sigdesig" label="Signatory designation">
          <input id="sc-sigdesig" required value={signatoryDesignation} onChange={(e) => setSignatoryDesignation(e.target.value)}
            placeholder="HR Manager" className={inputCls} />
        </Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Generating…" : "Generate PDF"}</Button>
        </div>
      </form>
    </Modal>
  );
}

interface SlipLine { label: string; amount: string }

/** One earnings/deductions row -- shared by both lists in SalarySlipModal. */
function SlipLineRow({ line, onChange, onRemove }: { line: SlipLine; onChange: (l: SlipLine) => void; onRemove: () => void }) {
  return (
    <div className="flex items-end gap-2">
      <input value={line.label} onChange={(e) => onChange({ ...line, label: e.target.value })}
        placeholder="Basic Salary" className={`${inputCls} h-9 flex-1`} />
      <input type="number" min="0" step="0.01" value={line.amount} onChange={(e) => onChange({ ...line, amount: e.target.value })}
        placeholder="0.00" className={`${inputCls} h-9 w-28`} />
      <button type="button" aria-label="Remove line" onClick={onRemove}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-black/5 hover:text-danger dark:hover:bg-white/10">
        ×
      </button>
    </div>
  );
}

function SalarySlipModal({ employee, onClose }: { employee: EmployeeRow; onClose: () => void }) {
  const [period, setPeriod] = useState(() => new Date().toLocaleString("en-IN", { month: "long", year: "numeric" }));
  const [earnings, setEarnings] = useState<SlipLine[]>(() => [
    { label: "Basic Salary", amount: employee.staffProfile?.salary != null ? String(employee.staffProfile.salary) : "" },
  ]);
  const [deductions, setDeductions] = useState<SlipLine[]>([]);
  const [paymentMode, setPaymentMode] = useState<"BANK_TRANSFER" | "CASH">("BANK_TRANSFER");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const validEarnings = earnings.filter((l) => l.label.trim() && l.amount.trim());
    if (!validEarnings.length) { setError("Add at least one earnings line"); return; }
    setError(null);
    setBusy(true);
    try {
      const blob = await apiBlob(`/employees/${employee.id}/salary-slip`, {
        method: "POST",
        body: JSON.stringify({
          period: period.trim(),
          paymentMode,
          earnings: validEarnings.map((l) => ({ label: l.label.trim(), amount: Number(l.amount) })),
          deductions: deductions.filter((l) => l.label.trim() && l.amount.trim())
            .map((l) => ({ label: l.label.trim(), amount: Number(l.amount) })),
        }),
      });
      window.open(URL.createObjectURL(blob), "_blank");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the salary slip");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Salary slip — ${employee.fullName}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field id="ss-period" label="Pay period">
            <input id="ss-period" required value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="August 2026" className={inputCls} />
          </Field>
          <Field id="ss-paymode" label="Payment mode">
            <select id="ss-paymode" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as "BANK_TRANSFER" | "CASH")} className={inputCls}>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="CASH">Hand cash</option>
            </select>
          </Field>
        </div>

        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Earnings</p>
          <div className="space-y-2">
            {earnings.map((l, i) => (
              <SlipLineRow key={i} line={l}
                onChange={(next) => setEarnings((rows) => rows.map((r, idx) => (idx === i ? next : r)))}
                onRemove={() => setEarnings((rows) => rows.filter((_, idx) => idx !== i))}
              />
            ))}
            <button type="button" onClick={() => setEarnings((rows) => [...rows, { label: "", amount: "" }])}
              className="text-xs font-medium text-primary hover:underline">
              + Add earning
            </button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Deductions</p>
          <div className="space-y-2">
            {deductions.map((l, i) => (
              <SlipLineRow key={i} line={l}
                onChange={(next) => setDeductions((rows) => rows.map((r, idx) => (idx === i ? next : r)))}
                onRemove={() => setDeductions((rows) => rows.filter((_, idx) => idx !== i))}
              />
            ))}
            <button type="button" onClick={() => setDeductions((rows) => [...rows, { label: "", amount: "" }])}
              className="text-xs font-medium text-primary hover:underline">
              + Add deduction
            </button>
          </div>
        </div>

        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Generating…" : "Generate PDF"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function EmployeePage() {
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [schools, setSchools] = useState<SchoolOpt[]>([]);
  const [q, setQ] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [dialog, setDialog] = useState<{ mode: "add" } | { mode: "edit"; row: EmployeeRow } | null>(null);
  const [viewing, setViewing] = useState<EmployeeRow | null>(null);
  const [deleting, setDeleting] = useState<EmployeeRow | null>(null);
  const [certFor, setCertFor] = useState<EmployeeRow | null>(null);
  const [slipFor, setSlipFor] = useState<EmployeeRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [schoolsError, setSchoolsError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const canManage = role !== null && ["SUPER_ADMIN", "SCHOOL_ADMIN", "HR"].includes(role);
  const canDelete = role !== null && ["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(role);

  const load = useCallback(() => {
    setState("loading");
    api<EmployeeRow[]>(`/employees${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      .then((r) => { setRows(r); setState("ready"); })
      .catch((err) => { setLoadError(err instanceof Error ? err.message : "Could not load employees"); setState("error"); });
  }, [q]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { api<{ role: string }>("/auth/me").then((r) => setRole(r.role)).catch(() => setRole(null)); }, []);
  useEffect(() => {
    api<SchoolOpt[]>("/academic/schools")
      .then((r) => { setSchools(r); setSchoolsError(r.length === 0 ? "No schools are registered yet." : null); })
      .catch((err) => { setSchools([]); setSchoolsError(err instanceof Error ? err.message : "Could not load schools"); });
  }, []);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/employees/${deleting.id}`, { method: "DELETE" });
      setToast("Employee deleted");
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
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">HR</p>
          <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Employee</h1>
        </div>
        {canManage && <Button onClick={() => setDialog({ mode: "add" })}>Add employee</Button>}
      </div>

      {notice && (
        <Card className="border border-accent/30 bg-accent/5">
          <p className="text-sm text-night dark:text-white">{notice}</p>
          <p className="mt-1 text-xs text-slate-500">Shown once — share it with the employee; they can change it after first sign-in.</p>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="border-b border-slate-100 dark:border-white/5 p-4">
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email or employee no." aria-label="Search employees"
            className="h-10 w-full max-w-sm rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-4 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>

        {state === "error" && (
          <p className="p-6 text-sm text-danger">{loadError ?? "Could not load employees."}</p>
        )}
        {state === "ready" && rows.length === 0 && (
          <p className="p-6 text-sm text-slate-500">No employees match this search.</p>
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <th className="px-4 py-3 font-medium">Employee no.</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">School</th>
                  <th className="px-4 py-3 font-medium">Designation</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50 dark:border-white/5 transition-colors hover:bg-surface dark:hover:bg-white/5">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{t.staffProfile?.employeeNo ?? "—"}</td>
                    <td className="px-4 py-3 font-medium text-night dark:text-white">{t.fullName}</td>
                    <td className="px-4 py-3 text-slate-500">{roleLabel(t.role)}</td>
                    <td className="px-4 py-3 text-slate-500">{t.staffProfile?.school?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      {t.staffProfile?.designation ?? "—"}
                      {t.staffProfile?.department && <span className="text-slate-400"> · {t.staffProfile.department}</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{t.email}{t.phone ? ` · ${t.phone}` : ""}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium
                        ${t.isActive ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                        {t.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canManage && t.staffProfile && (
                          <>
                            <button onClick={() => setCertFor(t)} title="Salary certificate" aria-label="Salary certificate"
                              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-black/5 hover:text-night dark:hover:bg-white/10 dark:hover:text-white transition-colors">
                              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h6"/></svg>
                            </button>
                            <button onClick={() => setSlipFor(t)} title="Salary slip" aria-label="Salary slip"
                              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-black/5 hover:text-night dark:hover:bg-white/10 dark:hover:text-white transition-colors">
                              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h5M8 16h8"/></svg>
                            </button>
                          </>
                        )}
                        <RowActions
                          onView={() => setViewing(t)}
                          onEdit={canManage ? () => setDialog({ mode: "edit", row: t }) : undefined}
                          onDelete={canDelete ? () => setDeleting(t) : undefined}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {dialog && (
        <EmployeeDialog
          mode={dialog.mode}
          initial={dialog.mode === "edit" ? dialog.row : undefined}
          schools={schools}
          schoolsError={schoolsError}
          onClose={() => setDialog(null)}
          onSaved={(tempPassword) => {
            if (dialog.mode === "add") {
              setNotice(tempPassword ? `✓ Employee added. Temporary password: ${tempPassword}` : "✓ Employee added.");
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
              ["Employee no.", viewing.staffProfile?.employeeNo ?? "—"],
              ["Role", roleLabel(viewing.role)],
              ["School", viewing.staffProfile?.school?.name ?? "—"],
              ["Status", viewing.isActive ? "Active" : "Inactive"],
              ["Designation", viewing.staffProfile?.designation ?? "—"],
              ["Department", viewing.staffProfile?.department ?? "—"],
              ["Employee type", viewing.staffProfile?.employmentType ? roleLabel(viewing.staffProfile.employmentType) : "—"],
              ["Salary paid by", viewing.staffProfile?.salaryPaidBy ? roleLabel(viewing.staffProfile.salaryPaidBy) : "—"],
              ["Monthly salary", viewing.staffProfile?.salary != null ? `₹${Number(viewing.staffProfile.salary).toLocaleString("en-IN")}` : "—"],
              ["Email", viewing.email],
              ["Phone", viewing.phone ?? "—"],
              ["Joined", viewing.staffProfile?.joinDate ? new Date(viewing.staffProfile.joinDate).toLocaleDateString("en-IN") : "—"],
            ].map(([k, v]) => (
              <div key={k as string}>
                <dt className="text-xs uppercase tracking-wide text-slate-400">{k}</dt>
                <dd className="mt-0.5 font-medium text-night dark:text-white">{v}</dd>
              </div>
            ))}
          </dl>
          {viewing.userAccess && viewing.userAccess.length > 1 && (
            <div className="mt-5 border-t border-slate-100 pt-4 dark:border-white/5">
              <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Roles &amp; schools</p>
              <div className="space-y-1.5 text-sm">
                {viewing.userAccess.map((a) => (
                  <div key={a.id} className="flex items-center gap-2">
                    <span className="font-medium text-night dark:text-white">{roleLabel(a.role)}</span>
                    <span className="text-slate-400">at {a.school?.name ?? "—"}</span>
                    {a.designation && <span className="text-slate-400">· {a.designation}</span>}
                    {a.isPrimary && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">Primary</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal>
      )}

      {certFor && <SalaryCertificateModal employee={certFor} onClose={() => setCertFor(null)} />}
      {slipFor && <SalarySlipModal employee={slipFor} onClose={() => setSlipFor(null)} />}

      {deleting && (
        <ConfirmDialog
          title="Delete employee?"
          message={`This removes ${deleting.fullName}'s login and staff profile permanently. If they might return, set them Inactive instead (Edit → Status).`}
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
