"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Field, inputCls } from "@/components/ui/modal";

interface Me { role: string }
interface Application {
  id: string; fromDate: string; toDate: string; days: number; reason: string; status: string;
  leaveType: { id: string; name: string };
  applicant?: { fullName: string; role: string };
  reviewedBy?: { fullName: string } | null;
  reviewRemarks?: string | null;
}

const MANAGE_ROLES = ["SUPER_ADMIN", "ORG_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "COORDINATOR", "HR", "FINANCE_HR_ADMIN"];
const STATUS_COLOR: Record<string, string> = {
  PENDING: "text-amber-600 dark:text-amber-400",
  APPROVED: "text-emerald-600 dark:text-emerald-400",
  REJECTED: "text-danger",
  CANCELLED: "text-slate-400",
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function ReviewDialog({ application, onClose, onReviewed }: {
  application: Application; onClose: () => void; onReviewed: () => void;
}) {
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function review(status: "APPROVED" | "REJECTED") {
    setBusy(true);
    setError(null);
    try {
      await api(`/leave/applications/${application.id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ status, ...(remarks.trim() && { reviewRemarks: remarks.trim() }) }),
      });
      onReviewed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not review application");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-night/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lift dark:bg-[#16213A]" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-1 font-display text-lg font-semibold text-night dark:text-white">
          {application.applicant?.fullName} — {application.leaveType.name}
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          {fmtDate(application.fromDate)} – {fmtDate(application.toDate)} ({application.days} day{application.days > 1 ? "s" : ""})
        </p>
        <p className="mb-4 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{application.reason}</p>
        <Field id="review-remarks" label="Remarks" optional>
          <textarea id="review-remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} className={`${inputCls} h-auto py-2.5`} />
        </Field>
        {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="danger" onClick={() => review("REJECTED")} disabled={busy}>Reject</Button>
          <Button onClick={() => review("APPROVED")} disabled={busy}>{busy ? "Saving…" : "Approve"}</Button>
        </div>
      </div>
    </div>
  );
}

export default function LeaveApplicationsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [forReview, setForReview] = useState<Application[]>([]);
  const [mine, setMine] = useState<Application[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [reviewing, setReviewing] = useState<Application | null>(null);
  const [withdrawing, setWithdrawing] = useState<Application | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const canManage = !!me && MANAGE_ROLES.includes(me.role);

  const load = useCallback((role: string | null) => {
    setState("loading");
    Promise.all([
      role && MANAGE_ROLES.includes(role) ? api<Application[]>("/leave/applications?status=PENDING") : Promise.resolve([]),
      api<Application[]>("/leave/applications/mine"),
    ])
      .then(([review, own]) => { setForReview(review); setMine(own); setState("ready"); })
      .catch(() => setState("error"));
  }, []);

  useEffect(() => {
    api<Me>("/auth/me").then((r) => { setMe(r); load(r.role); }).catch(() => { setMe(null); load(null); });
  }, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  async function confirmWithdraw() {
    if (!withdrawing) return;
    setBusy(true);
    try {
      await api(`/leave/applications/${withdrawing.id}`, { method: "DELETE" });
      setToast("Application withdrawn");
      setWithdrawing(null);
      load(me?.role ?? null);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not withdraw");
      setWithdrawing(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Leave Application</p>
        <h1 className="font-display text-2xl font-semibold text-night dark:text-white">Leave Applications</h1>
      </div>

      {state === "error" && (
        <Card className="p-6">
          <p className="text-sm text-slate-500">
            Couldn&apos;t reach the API. Start it with <code>docker compose up</code>, then reload.
          </p>
        </Card>
      )}

      {canManage && state === "ready" && (
        <Card className="p-0 overflow-hidden">
          <div className="border-b border-slate-100 p-4 dark:border-white/5">
            <h2 className="text-sm font-semibold text-night dark:text-white">Pending review</h2>
          </div>
          {forReview.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">Nothing pending review.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <th className="px-4 py-3 font-medium">Staff</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Dates</th>
                  <th className="px-4 py-3 font-medium">Days</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {forReview.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                    <td className="px-4 py-3 font-medium text-night dark:text-white">{a.applicant?.fullName}</td>
                    <td className="px-4 py-3 text-slate-500">{a.leaveType.name}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(a.fromDate)} – {fmtDate(a.toDate)}</td>
                    <td className="px-4 py-3 text-slate-500">{a.days}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" onClick={() => setReviewing(a)}>Review</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {state === "ready" && (
        <Card className="p-0 overflow-hidden">
          <div className="border-b border-slate-100 p-4 dark:border-white/5">
            <h2 className="text-sm font-semibold text-night dark:text-white">My applications</h2>
          </div>
          {mine.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No applications submitted yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-100 dark:border-white/5">
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Dates</th>
                  <th className="px-4 py-3 font-medium">Days</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mine.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50 last:border-0 dark:border-white/5">
                    <td className="px-4 py-3 font-medium text-night dark:text-white">{a.leaveType.name}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(a.fromDate)} – {fmtDate(a.toDate)}</td>
                    <td className="px-4 py-3 text-slate-500">{a.days}</td>
                    <td className={`px-4 py-3 font-medium ${STATUS_COLOR[a.status] ?? ""}`}>{a.status}</td>
                    <td className="px-4 py-3 text-right">
                      {a.status === "PENDING" && (
                        <Button variant="ghost" onClick={() => setWithdrawing(a)}>Withdraw</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {reviewing && (
        <ReviewDialog
          application={reviewing}
          onClose={() => setReviewing(null)}
          onReviewed={() => { setReviewing(null); setToast("Application reviewed"); load(me?.role ?? null); }}
        />
      )}

      {withdrawing && (
        <ConfirmDialog
          title="Withdraw application?"
          message={`Withdraw your ${withdrawing.leaveType.name} application for ${fmtDate(withdrawing.fromDate)} – ${fmtDate(withdrawing.toDate)}?`}
          confirmLabel="Withdraw"
          onConfirm={confirmWithdraw}
          onClose={() => setWithdrawing(null)}
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
