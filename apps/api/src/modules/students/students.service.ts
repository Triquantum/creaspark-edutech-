import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { CreateStudentDto, QueryStudentsDto, UpdateStudentDto } from "./dto/create-student.dto";

const PAGE = 25;

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  async list(query: QueryStudentsDto) {
    const { tenantId } = currentTenant();
    const where = {
      tenantId,
      ...(query.sectionId && { sectionId: query.sectionId }),
      ...(query.q && {
        OR: [
          { firstName: { contains: query.q, mode: "insensitive" as const } },
          { lastName: { contains: query.q, mode: "insensitive" as const } },
          { admissionNo: { contains: query.q, mode: "insensitive" as const } },
        ],
      }),
    };
    const [items, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        take: PAGE + 1,
        ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        include: { section: { include: { class: true } }, guardians: { where: { isPrimary: true } } },
      }),
      this.prisma.student.count({ where: { tenantId } }),
    ]);
    const nextCursor = items.length > PAGE ? items.pop()!.id : null;
    return { items, nextCursor, total };
  }

  async get(id: string) {
    const { tenantId } = currentTenant();
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId },
      include: {
        section: { include: { class: true } },
        guardians: true,
        invoices: { orderBy: { dueDate: "desc" }, take: 5, include: { payments: true } },
        attendance: { orderBy: { date: "desc" }, take: 30 },
      },
    });
    if (!student) throw new NotFoundException("Student not found");
    return student;
  }

  async create(dto: CreateStudentDto, actorId: string) {
    const { tenantId } = currentTenant();

    const school = await this.prisma.school.findFirst({ where: { id: dto.schoolId, tenantId } });
    if (!school) throw new NotFoundException("School not found in this tenant");
    if (dto.sectionId) {
      const section = await this.prisma.section.findFirst({
        where: { id: dto.sectionId, tenantId, class: { schoolId: dto.schoolId } },
      });
      if (!section) throw new NotFoundException("Division not found in this school");
    }

    const student = await this.prisma.student.create({
      data: { ...dto, dob: dto.dob ? new Date(dto.dob) : undefined, tenantId },
    });
    await this.prisma.auditLog.create({
      data: { tenantId, userId: actorId, action: "student.create", entity: "Student", entityId: student.id },
    });
    return student;
  }

  async update(id: string, dto: UpdateStudentDto, actorId: string) {
    const { tenantId } = currentTenant();
    const existing = await this.prisma.student.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Student not found");

    if (dto.admissionNo && dto.admissionNo !== existing.admissionNo) {
      const clash = await this.prisma.student.findUnique({
        where: { schoolId_admissionNo: { schoolId: existing.schoolId, admissionNo: dto.admissionNo } },
      });
      if (clash) throw new ConflictException(`Admission no. ${dto.admissionNo} already exists`);
    }
    if (dto.sectionId) {
      const section = await this.prisma.section.findFirst({
        where: { id: dto.sectionId, tenantId, class: { schoolId: existing.schoolId } },
      });
      if (!section) throw new NotFoundException("Division not found in this school");
    }

    const student = await this.prisma.student.update({
      where: { id },
      data: { ...dto, dob: dto.dob ? new Date(dto.dob) : undefined },
    });
    await this.prisma.auditLog.create({
      data: { tenantId, userId: actorId, action: "student.update", entity: "Student", entityId: id },
    });
    return student;
  }

  /**
   * Deletes a student and their academic records (attendance, results,
   * unpaid invoices, guardians). Blocked if any payment exists — financial
   * history must be preserved; mark the student TRANSFERRED/ALUMNI instead.
   */
  async remove(id: string, actorId: string) {
    const { tenantId } = currentTenant();
    const existing = await this.prisma.student.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Student not found");

    const paymentCount = await this.prisma.payment.count({ where: { invoice: { studentId: id } } });
    if (paymentCount > 0) {
      throw new ConflictException(
        "This student has payment records which must be preserved. Set their status to Transferred or Alumni instead of deleting.",
      );
    }

    await this.prisma.$transaction([
      this.prisma.attendanceRecord.deleteMany({ where: { studentId: id } }),
      this.prisma.examResult.deleteMany({ where: { studentId: id } }),
      this.prisma.feeInvoice.deleteMany({ where: { studentId: id } }),
      this.prisma.student.delete({ where: { id } }), // guardians cascade
      this.prisma.auditLog.create({
        data: {
          tenantId, userId: actorId, action: "student.delete", entity: "Student", entityId: id,
          metadata: { admissionNo: existing.admissionNo, name: `${existing.firstName} ${existing.lastName}` },
        },
      }),
    ]);
    return { deleted: true };
  }
}
