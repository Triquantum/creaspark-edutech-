import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { AuthUser } from "../../common/decorators/current-user.decorator";
import { resolveViewableStudentId } from "../../common/access/student-access";
import { CreateExamDto, RecordResultsDto } from "./exams.dto";

function gradeFor(percentage: number): string {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B";
  if (percentage >= 60) return "C";
  if (percentage >= 50) return "D";
  return "F";
}

@Injectable()
export class ExamsService {
  constructor(private prisma: PrismaService) {}

  list() {
    const { tenantId } = currentTenant();
    return this.prisma.exam.findMany({
      where: { tenantId },
      include: { subjects: { include: { subject: true } } },
      orderBy: { startDate: "desc" },
    });
  }

  async create(dto: CreateExamDto, actorId: string) {
    const { tenantId } = currentTenant();
    const exam = await this.prisma.exam.create({
      data: {
        tenantId, schoolIdRef: dto.schoolId, name: dto.name,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        subjects: { create: dto.subjects.map((s) => ({ subjectId: s.subjectId, maxMarks: s.maxMarks ?? 100 })) },
      },
      include: { subjects: { include: { subject: true } } },
    });
    await this.prisma.auditLog.create({
      data: { tenantId, userId: actorId, action: "exam.create", entity: "Exam", entityId: exam.id },
    });
    return exam;
  }

  async recordResults(dto: RecordResultsDto, actorId: string) {
    const { tenantId } = currentTenant();
    const examSubject = await this.prisma.examSubject.findFirst({ where: { id: dto.examSubjectId, exam: { tenantId } } });
    if (!examSubject) throw new NotFoundException("Exam subject not found");

    await this.prisma.$transaction(
      dto.entries.map((e) => {
        const percentage = (e.marks / examSubject.maxMarks) * 100;
        return this.prisma.examResult.upsert({
          where: { examSubjectId_studentId: { examSubjectId: dto.examSubjectId, studentId: e.studentId } },
          update: { marks: e.marks, grade: gradeFor(percentage), remark: e.remark },
          create: {
            tenantId, examSubjectId: dto.examSubjectId, studentId: e.studentId,
            marks: e.marks, grade: gradeFor(percentage), remark: e.remark,
          },
        });
      }),
    );
    await this.prisma.auditLog.create({
      data: {
        tenantId, userId: actorId, action: "exam.results.record", entity: "ExamSubject",
        entityId: dto.examSubjectId, metadata: { count: dto.entries.length },
      },
    });
    return { recorded: dto.entries.length };
  }

  async progress(user: AuthUser, requestedStudentId?: string) {
    const studentId = await resolveViewableStudentId(this.prisma, user, requestedStudentId);
    const { tenantId } = currentTenant();

    const results = await this.prisma.examResult.findMany({
      where: { tenantId, studentId },
      include: { examSubject: { include: { subject: true, exam: true } } },
      orderBy: { examSubject: { exam: { startDate: "desc" } } },
    });

    const bySubject = new Map<string, typeof results>();
    for (const r of results) {
      const key = r.examSubject.subjectId;
      if (!bySubject.has(key)) bySubject.set(key, []);
      bySubject.get(key)!.push(r);
    }

    const subjects = [...bySubject.entries()].map(([subjectId, rows]) => {
      const withPct = rows.map((r) => ({
        examName: r.examSubject.exam.name,
        date: r.examSubject.exam.startDate,
        marks: Number(r.marks),
        maxMarks: r.examSubject.maxMarks,
        percentage: Math.round((Number(r.marks) / r.examSubject.maxMarks) * 1000) / 10,
        grade: r.grade,
      }));
      const avg = withPct.reduce((s, row) => s + row.percentage, 0) / withPct.length;
      const trend = withPct.length >= 2 ? (withPct[0].percentage >= withPct[1].percentage ? "up" : "down") : "flat";
      return {
        subjectId,
        subjectName: rows[0].examSubject.subject.name,
        averagePercentage: Math.round(avg * 10) / 10,
        grade: gradeFor(avg),
        trend,
        recent: withPct.slice(0, 5),
      };
    });

    const overallAvg = subjects.length
      ? subjects.reduce((s, row) => s + row.averagePercentage, 0) / subjects.length
      : null;

    return {
      studentId,
      overall: overallAvg === null ? null : { averagePercentage: Math.round(overallAvg * 10) / 10, grade: gradeFor(overallAvg) },
      subjects,
    };
  }
}
