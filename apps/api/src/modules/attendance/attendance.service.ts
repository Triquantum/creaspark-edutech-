import { Injectable } from "@nestjs/common";
import { AttendanceStatus } from "@educore/database";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";

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
}
