import { Injectable } from "@nestjs/common";
import { AttendanceStatus } from "@educore/database";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { AuthUser } from "../../common/decorators/current-user.decorator";
import { resolveViewableStudentId } from "../../common/access/student-access";

const MONTHS_BACK = 3;

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function rate(percentage: number): string {
  if (percentage >= 95) return "Excellent";
  if (percentage >= 85) return "Good";
  if (percentage >= 70) return "Fair";
  return "Needs attention";
}

function insightFor(name: string, percentage: number, absent: number, late: number): string {
  const lead =
    percentage >= 95 ? `${name} has excellent attendance this month!`
    : percentage >= 85 ? `${name} has good attendance this month.`
    : percentage >= 70 ? `${name}'s attendance needs attention this month.`
    : `${name} has poor attendance this month — please follow up.`;
  const detail = [
    absent > 0 ? `${absent} absence${absent === 1 ? "" : "s"}` : null,
    late > 0 ? `${late} late arrival${late === 1 ? "" : "s"}` : null,
  ].filter(Boolean).join(", ");
  return detail ? `${lead} ${detail} recorded.` : lead;
}

export interface MarkAttendanceInput {
  sectionId: string;
  date: string; // yyyy-mm-dd
  entries: { studentId: string; status: AttendanceStatus; note?: string }[];
}

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  async markSection(input: MarkAttendanceInput, markedBy: string) {
    const { tenantId } = currentTenant();
    const date = new Date(input.date);
    await this.prisma.$transaction(
      input.entries.map((e) =>
        this.prisma.attendanceRecord.upsert({
          where: { studentId_date: { studentId: e.studentId, date } },
          update: { status: e.status, note: e.note, markedBy },
          create: { tenantId, sectionId: input.sectionId, studentId: e.studentId, date, status: e.status, note: e.note, markedBy },
        }),
      ),
    );
    return { marked: input.entries.length };
  }

  async sectionSummary(sectionId: string, from: string, to: string) {
    const { tenantId } = currentTenant();
    const grouped = await this.prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: { tenantId, sectionId, date: { gte: new Date(from), lte: new Date(to) } },
      _count: true,
    });
    return grouped.map((g) => ({ status: g.status, count: g._count }));
  }

  /** Tenant-wide attendance for today, across every section — used by the dashboard. */
  async todaySummary() {
    const { tenantId } = currentTenant();
    const today = new Date(new Date().toISOString().slice(0, 10));
    const grouped = await this.prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: { tenantId, date: today },
      _count: true,
    });
    const total = grouped.reduce((sum, g) => sum + g._count, 0);
    const present = grouped.find((g) => g.status === "PRESENT")?._count ?? 0;
    return { total, present, percentage: total > 0 ? Math.round((present / total) * 100) : null };
  }

  /** Daily records + a rolling monthly comparison + a plain-language insight, for one student. */
  async studentMonthly(user: AuthUser, requestedStudentId: string | undefined, month?: string) {
    const studentId = await resolveViewableStudentId(this.prisma, user, requestedStudentId);
    const { tenantId } = currentTenant();

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      select: { firstName: true },
    });

    const anchor = month ? new Date(`${month}-01T00:00:00.000Z`) : new Date();
    const rangeStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - (MONTHS_BACK - 1), 1));
    const rangeEnd = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));

    const records = await this.prisma.attendanceRecord.findMany({
      where: { tenantId, studentId, date: { gte: rangeStart, lt: rangeEnd } },
      orderBy: { date: "desc" },
      select: { date: true, status: true, note: true },
    });

    const byMonth = new Map<string, typeof records>();
    for (const r of records) {
      const key = monthKey(r.date);
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key)!.push(r);
    }

    const currentKey = monthKey(anchor);
    const monthlyComparison = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, rows]) => {
        const present = rows.filter((r) => r.status === "PRESENT").length;
        const percentage = rows.length ? Math.round((present / rows.length) * 1000) / 10 : 0;
        return { month: key, label: monthLabel(key), percentage, rating: rate(percentage) };
      });

    const currentRows = byMonth.get(currentKey) ?? [];
    const present = currentRows.filter((r) => r.status === "PRESENT").length;
    const absent = currentRows.filter((r) => r.status === "ABSENT").length;
    const late = currentRows.filter((r) => r.status === "LATE").length;
    const percentage = currentRows.length ? Math.round((present / currentRows.length) * 1000) / 10 : 0;

    return {
      studentId,
      month: currentKey,
      summary: { total: currentRows.length, present, absent, late, percentage },
      monthlyComparison,
      daily: currentRows.map((r) => ({ date: r.date, status: r.status, note: r.note })),
      insight: currentRows.length
        ? insightFor(student?.firstName ?? "This student", percentage, absent, late)
        : `No attendance records yet for ${monthLabel(currentKey)}.`,
    };
  }
}
