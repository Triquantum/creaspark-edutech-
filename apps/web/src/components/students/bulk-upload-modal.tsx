"use client";
import { useState } from "react";
import * as XLSX from "xlsx";
import { api } from "@/lib/api";
import { Modal, Field, inputCls } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

interface SchoolOpt { id: string; name: string; tenantName?: string }
interface ParsedRow {
  admissionNo: string; firstName: string; lastName: string;
  gender?: string; dob?: string; className?: string; sectionName?: string;
}
interface BulkResult { created: number; updated: number; errors: { row: number; admissionNo: string; message: string }[] }

const TEMPLATE_HEADERS = ["Admission No", "First Name", "Last Name", "Gender", "Date of Birth (YYYY-MM-DD)", "Class", "Division"];

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ["ADM-1001", "Asha", "Rao", "FEMALE", "2015-06-12", "Grade 5", "A"]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Students");
  XLSX.writeFile(wb, "student-bulk-upload-template.xlsx");
}

function normalizeGender(v: unknown): string | undefined {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "MALE" || s === "M") return "MALE";
  if (s === "FEMALE" || s === "F") return "FEMALE";
  if (s === "OTHER" || s === "O") return "OTHER";
  return undefined;
}

function parseWorkbook(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        const rows = raw
          .map((r): ParsedRow => ({
            admissionNo: String(r["Admission No"] ?? r["admissionNo"] ?? "").trim(),
            firstName: String(r["First Name"] ?? r["firstName"] ?? "").trim(),
            lastName: String(r["Last Name"] ?? r["lastName"] ?? "").trim(),
            gender: normalizeGender(r["Gender"] ?? r["gender"]),
            dob: (() => {
              const v = r["Date of Birth (YYYY-MM-DD)"] ?? r["Date of Birth"] ?? r["dob"];
              if (!v) return undefined;
              if (v instanceof Date) return v.toISOString().slice(0, 10);
              return String(v).trim() || undefined;
            })(),
            className: String(r["Class"] ?? r["className"] ?? "").trim() || undefined,
            sectionName: String(r["Division"] ?? r["Section"] ?? r["sectionName"] ?? "").trim() || undefined,
          }))
          .filter((r) => r.admissionNo && r.firstName && r.lastName);
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export function BulkUploadModal({ schools, onClose, onDone }: {
  schools: SchoolOpt[]; onClose: () => void; onDone: () => void;
}) {
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? "");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setResult(null);
    setFileName(file.name);
    try {
      const parsed = await parseWorkbook(file);
      if (parsed.length === 0) {
        throw new Error("No valid rows found — check the Admission No/First Name/Last Name columns are filled in.");
      }
      setRows(parsed);
    } catch (err) {
      setRows([]);
      setParseError(err instanceof Error ? err.message : "Could not read this file");
    }
  }

  async function upload() {
    if (!schoolId || rows.length === 0) return;
    setUploading(true);
    setParseError(null);
    try {
      const res = await api<BulkResult>("/students/bulk", { method: "POST", body: JSON.stringify({ schoolId, rows }) });
      setResult(res);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal title="Bulk upload students" onClose={onClose} wide>
      <div className="space-y-4">
        <Field id="bu-school" label="School">
          <select id="bu-school" required value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className={inputCls}>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}{s.tenantName ? ` (${s.tenantName})` : ""}</option>)}
          </select>
        </Field>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-slate-200 p-4 dark:border-white/10">
          <div>
            <p className="text-sm font-medium text-night dark:text-white">Upload spreadsheet</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Columns: Admission No, First Name, Last Name, Gender, Date of Birth, Class, Division. Existing admission numbers are updated; new ones are created.
            </p>
          </div>
          <button type="button" onClick={downloadTemplate} className="shrink-0 text-xs font-medium text-primary hover:underline">
            Download template
          </button>
        </div>

        <input type="file" accept=".xlsx,.xls,.csv" onChange={pickFile}
          className="block text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:opacity-90" />

        {parseError && <p className="text-sm text-danger">{parseError}</p>}

        {rows.length > 0 && !result && (
          <div className="rounded-xl border border-slate-100 dark:border-white/10">
            <p className="border-b border-slate-100 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-400 dark:border-white/10">
              {fileName} — {rows.length} row{rows.length === 1 ? "" : "s"} ready
            </p>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr><th className="px-4 py-2 font-medium">Admission no.</th><th className="px-4 py-2 font-medium">Name</th><th className="px-4 py-2 font-medium">Class</th></tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-t border-slate-50 dark:border-white/5">
                      <td className="px-4 py-2 font-mono text-xs text-slate-500">{r.admissionNo}</td>
                      <td className="px-4 py-2">{r.firstName} {r.lastName}</td>
                      <td className="px-4 py-2 text-slate-500">{r.className ? `${r.className}${r.sectionName ? ` · ${r.sectionName}` : ""}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 20 && <p className="p-3 text-xs text-slate-400">+{rows.length - 20} more row(s) not shown.</p>}
            </div>
          </div>
        )}

        {result && (
          <div className="rounded-xl border border-success/30 bg-success/5 p-4 text-sm">
            <p className="font-medium text-night dark:text-white">
              {result.created} created, {result.updated} updated{result.errors.length ? `, ${result.errors.length} failed` : ""}.
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-danger">
                {result.errors.map((e) => (
                  <li key={e.row}>Row {e.row} ({e.admissionNo || "—"}): {e.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={result ? onDone : onClose}>{result ? "Close" : "Cancel"}</Button>
          {!result && (
            <Button type="button" onClick={upload} disabled={uploading || rows.length === 0 || !schoolId}>
              {uploading ? "Uploading…" : `Upload ${rows.length || ""} student${rows.length === 1 ? "" : "s"}`}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
