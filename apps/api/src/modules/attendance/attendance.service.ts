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
}
