"use client";
import { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "./button";

export function Modal({ title, onClose, children, wide = false }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-night/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label={title}
        className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-lift dark:bg-[#16213A]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-night dark:text-white">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10">
            <X size={17} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = "Delete", onConfirm, onClose, busy = false }: {
  title: string; message: string; confirmLabel?: string; onConfirm: () => void; onClose: () => void; busy?: boolean;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm leading-relaxed text-slate-500">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm} disabled={busy}>{busy ? "Deleting…" : confirmLabel}</Button>
      </div>
    </Modal>
  );
}

export function RowActions({ onView, onEdit, onDelete }: { onView: () => void; onEdit: () => void; onDelete: () => void }) {
  const cls = "grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-black/5 hover:text-night dark:hover:bg-white/10 dark:hover:text-white transition-colors";
  return (
    <div className="flex justify-end gap-1">
      <button onClick={onView} aria-label="View" title="View" className={cls}>
        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
      <button onClick={onEdit} aria-label="Edit" title="Edit" className={cls}>
        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
      </button>
      <button onClick={onDelete} aria-label="Delete" title="Delete" className={`${cls} hover:!text-danger`}>
        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
      </button>
    </div>
  );
}

export const inputCls =
  "h-11 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

export function Field({ id, label, optional, children }: {
  id: string; label: string; optional?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}{optional && <span className="text-slate-400"> (optional)</span>}
      </label>
      {children}
    </div>
  );
}
