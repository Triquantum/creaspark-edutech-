"use client";

export const PAGE_SIZES = [25, 50, 100];

/** 1 … 4 5 6 … 20 — always keeps first, last and the neighbours of the current page. */
function pageList(page: number, totalPages: number): (number | "gap-start" | "gap-end")[] {
  const keep = new Set<number>([1, totalPages]);
  for (let p = page - 1; p <= page + 1; p++) if (p > 1 && p < totalPages) keep.add(p);
  if (page <= 3) { keep.add(2); keep.add(3); }
  if (page >= totalPages - 2) { keep.add(totalPages - 1); keep.add(totalPages - 2); }
  const sorted = Array.from(keep).filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | "gap-start" | "gap-end")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(i === 1 ? "gap-start" : "gap-end");
    out.push(p);
  });
  return out;
}

const btnCls =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export function Pagination({ page, totalPages, pageSize, matched, noun = "students", onPage, onPageSize }: {
  page: number; totalPages: number; pageSize: number; matched: number; noun?: string;
  onPage: (p: number) => void; onPageSize: (n: number) => void;
}) {
  const from = matched === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, matched);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500 dark:border-white/5">
      <span>
        Showing {from.toLocaleString("en-IN")}–{to.toLocaleString("en-IN")} of {matched.toLocaleString("en-IN")} {noun}
      </span>

      <nav aria-label="Pagination" className="flex flex-wrap items-center gap-1.5">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}
          className={`${btnCls} border-slate-200 hover:bg-surface dark:border-white/10 dark:hover:bg-white/5`}>
          Previous
        </button>
        {pageList(page, totalPages).map((p) =>
          typeof p === "string" ? (
            <span key={p} className="px-1 text-slate-400">…</span>
          ) : (
            <button key={p} type="button" onClick={() => onPage(p)} aria-current={p === page ? "page" : undefined}
              className={`${btnCls} ${p === page
                ? "border-primary bg-primary font-medium text-white"
                : "border-slate-200 hover:bg-surface dark:border-white/10 dark:hover:bg-white/5"}`}>
              {p}
            </button>
          ),
        )}
        <button type="button" disabled={page >= totalPages} onClick={() => onPage(page + 1)}
          className={`${btnCls} border-slate-200 hover:bg-surface dark:border-white/10 dark:hover:bg-white/5`}>
          Next
        </button>
      </nav>

      <div className="flex items-center gap-3">
        <span>Page {page} of {totalPages}</span>
        <label className="flex items-center gap-2">
          <span className="sr-only">Rows per page</span>
          <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} aria-label="Rows per page"
            className="h-9 rounded-lg border border-slate-200 bg-transparent px-2 text-sm outline-none focus:border-accent dark:border-white/10">
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}
