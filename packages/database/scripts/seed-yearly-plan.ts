/**
 * One-time idempotent import of the FY 2026-2027 Yearly Plan spreadsheets
 * (Class2/Grade1/Grade3-9.xlsx). Column layout genuinely differs per file
 * (order, presence of Subject/Values/Digital Content, trailing spaces in
 * headers) -- each file gets an explicit column-index map rather than a
 * generic header-name matcher, verified against the real header rows.
 *
 * Re-running is safe: upsert on (academicYear, gradeLabel) deletes and
 * recreates that grade's entries, so a corrected source file can be
 * re-imported without leaving stale duplicate weeks behind.
 */
import { PrismaClient } from "../generated/client";
import XLSX from "C:/Users/ADMIN/Desktop/work/New folder/creaspark-educore/apps/web/node_modules/xlsx";

const prisma = new PrismaClient();
const SOURCE_DIR = "C:/Users/ADMIN/Desktop/year plan";
const ACADEMIC_YEAR = "2026-2027";

interface ColMap {
  term?: number; month?: number; week?: number; workingDays?: number; instructedDays?: number;
  subject?: number; unitChapter?: number; topic?: number; learningOutcome?: number; activity?: number;
  sdg?: number; skills?: number; values?: number; digitalContent?: number; assessment?: number; remarks?: number;
}
interface FileConfig { file: string; gradeLabel: string; sortOrder: number; cols: ColMap }

const FILES: FileConfig[] = [
  { file: "Grade1.xlsx", gradeLabel: "Grade 1", sortOrder: 1, cols: {
    month: 0, week: 1, workingDays: 2, instructedDays: 3, unitChapter: 4, topic: 5,
    learningOutcome: 6, activity: 7, sdg: 8, skills: 9, values: 10, assessment: 11, remarks: 12,
  } },
  { file: "Class2.xlsx", gradeLabel: "Class 2", sortOrder: 2, cols: {
    month: 0, week: 2, unitChapter: 3, topic: 4, learningOutcome: 5, activity: 6, sdg: 7, skills: 8, values: 9, assessment: 10,
  } },
  { file: "Grade3.xlsx", gradeLabel: "Grade 3", sortOrder: 3, cols: {
    term: 0, month: 1, week: 2, workingDays: 3, instructedDays: 4, subject: 5, unitChapter: 6,
    learningOutcome: 7, activity: 8, sdg: 9, skills: 10, assessment: 11, remarks: 12,
  } },
  { file: "Grade4.xlsx", gradeLabel: "Grade 4", sortOrder: 4, cols: {
    term: 0, month: 1, week: 2, workingDays: 3, instructedDays: 4, subject: 5, unitChapter: 8,
    learningOutcome: 9, activity: 10, sdg: 11, skills: 12, values: 13, assessment: 14, remarks: 15,
  } },
  { file: "Grade5.xlsx", gradeLabel: "Grade 5", sortOrder: 5, cols: {
    term: 0, month: 1, week: 2, workingDays: 3, instructedDays: 4, subject: 5, unitChapter: 6,
    learningOutcome: 7, sdg: 8, skills: 9, activity: 10, values: 11, assessment: 12, remarks: 13,
  } },
  { file: "Grade6.xlsx", gradeLabel: "Grade 6", sortOrder: 6, cols: {
    term: 0, month: 1, week: 2, workingDays: 3, instructedDays: 4, subject: 5, unitChapter: 6,
    learningOutcome: 7, activity: 8, sdg: 9, skills: 10, values: 11, assessment: 12, remarks: 13,
  } },
  { file: "Grade7.xlsx", gradeLabel: "Grade 7", sortOrder: 7, cols: {
    term: 0, month: 1, week: 2, workingDays: 3, instructedDays: 4, subject: 5, unitChapter: 6,
    learningOutcome: 7, activity: 8, sdg: 9, skills: 10, digitalContent: 11, values: 12, assessment: 13, remarks: 14,
  } },
  { file: "Grade8.xlsx", gradeLabel: "Grade 8", sortOrder: 8, cols: {
    term: 0, month: 1, week: 2, workingDays: 3, instructedDays: 4, subject: 5, unitChapter: 6,
    learningOutcome: 7, activity: 8, sdg: 9, skills: 10, values: 11, assessment: 12, remarks: 13,
  } },
  { file: "Grade9.xlsx", gradeLabel: "Grade 9", sortOrder: 9, cols: {
    term: 0, month: 1, week: 2, workingDays: 3, instructedDays: 4, subject: 5, unitChapter: 6,
    learningOutcome: 7, activity: 8, sdg: 9, skills: 10, values: 11, assessment: 12, remarks: 13,
  } },
];

// Grouping columns whose blank cells mean "same as the row above" (a merged
// cell in the source spreadsheet) -- Week/Topic/Learning Outcome etc. are
// never forward-filled since they genuinely differ every row.
const FORWARD_FILL: (keyof ColMap)[] = ["term", "month", "subject", "unitChapter"];

function cellStr(row: unknown[], idx?: number): string | null {
  if (idx === undefined) return null;
  const v = row[idx];
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
function cellInt(row: unknown[], idx?: number): number | null {
  const s = cellStr(row, idx);
  if (s === null) return null;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

async function importFile(cfg: FileConfig, createdById: string) {
  const wb = XLSX.readFile(`${SOURCE_DIR}/${cfg.file}`);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const dataRows = rows.slice(1); // drop header row

  const lastSeen: Partial<Record<keyof ColMap, string>> = {};
  const entries: {
    rowIndex: number; term: string | null; month: string | null; week: string | null;
    workingDays: number | null; instructedDays: number | null; subject: string | null; unitChapter: string | null;
    learningOutcome: string | null; activity: string | null; sdgMapping: string | null; skills: string | null;
    values: string | null; digitalContent: string | null; assessment: string | null; remarks: string | null;
  }[] = [];

  let rowIndex = 0;
  for (const row of dataRows) {
    const isBlank = row.every((c) => String(c ?? "").trim() === "");
    if (isBlank) continue;

    for (const key of FORWARD_FILL) {
      const raw = cellStr(row, cfg.cols[key]);
      if (raw !== null) lastSeen[key] = raw;
    }
    const term = lastSeen.term ?? null;
    const month = lastSeen.month ?? cellStr(row, cfg.cols.month);
    const subject = lastSeen.subject ?? cellStr(row, cfg.cols.subject);
    const unitChapterRaw = lastSeen.unitChapter ?? cellStr(row, cfg.cols.unitChapter);
    const topic = cellStr(row, cfg.cols.topic);
    const unitChapter = unitChapterRaw && topic ? `${unitChapterRaw} — ${topic}` : unitChapterRaw ?? topic;

    entries.push({
      rowIndex: rowIndex++,
      term, month, week: cellStr(row, cfg.cols.week),
      workingDays: cellInt(row, cfg.cols.workingDays), instructedDays: cellInt(row, cfg.cols.instructedDays),
      subject, unitChapter,
      learningOutcome: cellStr(row, cfg.cols.learningOutcome), activity: cellStr(row, cfg.cols.activity),
      sdgMapping: cellStr(row, cfg.cols.sdg), skills: cellStr(row, cfg.cols.skills),
      values: cellStr(row, cfg.cols.values), digitalContent: cellStr(row, cfg.cols.digitalContent),
      assessment: cellStr(row, cfg.cols.assessment), remarks: cellStr(row, cfg.cols.remarks),
    });
  }

  const grade = await prisma.yearlyPlanGrade.upsert({
    where: { academicYear_gradeLabel: { academicYear: ACADEMIC_YEAR, gradeLabel: cfg.gradeLabel } },
    update: { sortOrder: cfg.sortOrder, sourceFile: cfg.file },
    create: { academicYear: ACADEMIC_YEAR, gradeLabel: cfg.gradeLabel, sortOrder: cfg.sortOrder, sourceFile: cfg.file, createdById },
  });
  // Re-importable: replace this grade's entries wholesale rather than
  // trying to diff-merge row-by-row against a re-uploaded spreadsheet.
  await prisma.yearlyPlanEntry.deleteMany({ where: { gradeId: grade.id } });
  await prisma.yearlyPlanEntry.createMany({ data: entries.map((e) => ({ ...e, gradeId: grade.id })) });

  console.log(`${cfg.gradeLabel}: imported ${entries.length} weeks from ${cfg.file}`);
}

async function main() {
  const actor = await prisma.user.findUnique({ where: { email: "arjunpm369@gmail.com" }, select: { id: true } });
  if (!actor) throw new Error("Could not find actor (Arjun PM) to attribute the import to");

  for (const cfg of FILES) {
    await importFile(cfg, actor.id);
  }
  console.log(`\nDone. Imported ${FILES.length} grades for ${ACADEMIC_YEAR}.`);
}

main().finally(() => prisma.$disconnect());
