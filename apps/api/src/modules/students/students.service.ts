import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Role } from "@educore/database";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { AuthUser } from "../../common/decorators/current-user.decorator";
import { CreateStudentDto, QueryStudentsDto, UpdateStudentDto } from "./dto/create-student.dto";

const PAGE = 25;

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  /** SUPER_ADMIN has no real school of their own; tenantId is resolved from
   * an explicit schoolId instead of currentTenant(). Writes always require
   * one — throws if missing. */
  private async resolveTenant(user: AuthUser, schoolId?: string): Promise<{ tenantId: string; schoolId?: string }> {
    if (user.role === Role.SUPER_ADMIN) {
      if (!schoolId) throw new BadRequestException("schoolId is required for Super Admin");
      const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
      if (!school) throw new NotFoundException("School not found");
      return { tenantId: school.tenantId, schoolId: school.id };
    }
    const { tenantId } = currentTenant();
    return { tenantId, schoolId };
  }

  /** Read-only scope: cross-tenant (all schools) for SUPER_ADMIN when no
   * schoolId filter is given, else the caller's own tenant. Never throws. */
  private async readScope(user: AuthUser, schoolId?: string): Promise<{ tenantId?: string; schoolId?: string }> {
    if (user.role === Role.SUPER_ADMIN) return { schoolId };
    const { tenantId } = currentTenant();
    return { tenantId, schoolId };
  }

  async list(user: AuthUser, query: QueryStudentsDto) {
    const scope = await this.readScope(user, query.schoolId);
    const where = {
      ...(scope.tenantId && { tenantId: scope.tenantId }),
      ...(scope.schoolId && { schoolId: scope.schoolId }),
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
      this.prisma.student.count({ where: { ...(scope.tenantId && { tenantId: scope.tenantId }), ...(scope.schoolId && { schoolId: scope.schoolId }) } }),
    ]);
    const nextCursor = items.length > PAGE ? items.pop()!.id : null;
    return { items, nextCursor, total };
  }

  async get(user: AuthUser, id: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        section: { include: { class: true } },
        guardians: true,
        invoices: { orderBy: { dueDate: "desc" }, take: 5, include: { payments: true } },
        attendance: { orderBy: { date: "desc" }, take: 30 },
      },
    });
    if (!student) throw new NotFoundException("Student not found");
    if (user.role !== Role.SUPER_ADMIN && student.tenantId !== currentTenant().tenantId) {
      throw new NotFoundException("Student not found");
    }
    return student;
  }

  async create(dto: CreateStudentDto, user: AuthUser, actorId: string) {
    const { tenantId } = await this.resolveTenant(user, dto.schoolId);

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

  async update(id: string, dto: UpdateStudentDto, user: AuthUser, actorId: string) {
    const existing = await this.prisma.student.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Student not found");
    const { tenantId } = await this.resolveTenant(user, existing.schoolId);
    if (existing.tenantId !== tenantId) throw new NotFoundException("Student not found");

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
  async remove(id: string, user: AuthUser, actorId: string) {
    const existing = await this.prisma.student.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Student not found");
    const { tenantId } = await this.resolveTenant(user, existing.schoolId);
    if (existing.tenantId !== tenantId) throw new NotFoundException("Student not found");

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
