import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Role } from "@educore/database";
import { randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { SupabaseAdminService } from "../../common/supabase/supabase-admin.service";
import { AuthUser } from "../../common/decorators/current-user.decorator";
import { CreateTeacherDto, UpdateTeacherDto } from "./teachers.dto";

@Injectable()
export class TeachersService {
  constructor(private prisma: PrismaService, private supabaseAdmin: SupabaseAdminService) {}

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

  async list(user: AuthUser, q?: string, schoolId?: string) {
    const scope = await this.readScope(user, schoolId);
    return this.prisma.user.findMany({
      where: {
        ...(scope.tenantId && { tenantId: scope.tenantId }),
        role: Role.TEACHER,
        ...(scope.schoolId && { staffProfile: { schoolId: scope.schoolId } }),
        ...(q && {
          OR: [
            { fullName: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { staffProfile: { employeeNo: { contains: q, mode: "insensitive" as const } } },
          ],
        }),
      },
      select: {
        id: true, fullName: true, email: true, phone: true, isActive: true,
        staffProfile: {
          select: {
            employeeNo: true, designation: true, department: true, joinDate: true,
            schoolId: true, school: { select: { name: true } },
          },
        },
      },
      orderBy: { fullName: "asc" },
      take: 100,
    });
  }

  /** Creates the login and staff profile; returns a temp password once if none was supplied. */
  async create(dto: CreateTeacherDto, user: AuthUser, actorId: string) {
    const { tenantId } = await this.resolveTenant(user, dto.schoolId);

    const school = await this.prisma.school.findFirst({ where: { id: dto.schoolId, tenantId } });
    if (!school) throw new NotFoundException("School not found in this tenant");

    const [emailTaken, empTaken] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: dto.email } }),
      this.prisma.staffProfile.findUnique({ where: { schoolId_employeeNo: { schoolId: dto.schoolId, employeeNo: dto.employeeNo } } }),
    ]);
    if (emailTaken) throw new ConflictException(`A user with email ${dto.email} already exists`);
    if (empTaken) throw new ConflictException(`Employee no. ${dto.employeeNo} already exists in this school`);

    const tempPassword = dto.password ?? `Cs@${randomBytes(4).toString("hex")}`;
    const authUser = await this.supabaseAdmin.createUser(dto.email, tempPassword, { role: Role.TEACHER, tenantId });

    const createdUser = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { id: authUser.id, tenantId, email: dto.email, phone: dto.phone, fullName: dto.fullName, role: Role.TEACHER },
      });
      await tx.staffProfile.create({
        data: {
          tenantId, schoolId: dto.schoolId, userId: u.id,
          employeeNo: dto.employeeNo, designation: dto.designation, department: dto.department,
        },
      });
      await tx.auditLog.create({
        data: { tenantId, userId: actorId, action: "teacher.create", entity: "User", entityId: u.id },
      });
      return u;
    });

    return {
      id: createdUser.id, fullName: createdUser.fullName, email: createdUser.email,
      // Returned exactly once so the admin can hand it over; never retrievable again.
      ...(dto.password ? {} : { tempPassword }),
    };
  }

  private async findTeacher(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, role: Role.TEACHER },
      include: { staffProfile: true },
    });
    if (!user) throw new NotFoundException("Teacher not found");
    return user;
  }

  async update(id: string, dto: UpdateTeacherDto, user: AuthUser, actorId: string) {
    const target = await this.findTeacher(id);
    // The target's own tenantId is already known from the fetched User row —
    // no need to re-derive it via resolveTenant()/schoolId, which used to
    // throw for Super Admin whenever the teacher had no staffProfile yet
    // (schoolId nowhere to resolve from). This also lets Super Admin edit
    // any teacher regardless of tenant, same as every other Teachers action.
    const tenantId = target.tenantId;

    if (dto.schoolId) {
      const school = await this.prisma.school.findFirst({ where: { id: dto.schoolId, tenantId } });
      if (!school) throw new NotFoundException("School not found in this teacher's organization");
    }
    if (!target.staffProfile && dto.schoolId && (!dto.employeeNo?.trim() || !dto.designation?.trim())) {
      throw new BadRequestException("Employee no. and designation are required to assign a school");
    }

    if (dto.email && dto.email !== target.email) {
      const clash = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (clash) throw new ConflictException(`A user with email ${dto.email} already exists`);
      await this.supabaseAdmin.updateEmail(id, dto.email);
    }

    const effSchoolId = dto.schoolId ?? target.staffProfile?.schoolId;
    const effEmployeeNo = dto.employeeNo ?? target.staffProfile?.employeeNo;
    const identityChanged = !!effSchoolId && !!effEmployeeNo
      && (effSchoolId !== target.staffProfile?.schoolId || effEmployeeNo !== target.staffProfile?.employeeNo);
    if (identityChanged) {
      const clash = await this.prisma.staffProfile.findUnique({
        where: { schoolId_employeeNo: { schoolId: effSchoolId!, employeeNo: effEmployeeNo! } },
      });
      if (clash && clash.userId !== id) throw new ConflictException(`Employee no. ${effEmployeeNo} already exists in this school`);
    }

    if (dto.isActive !== undefined) {
      await this.supabaseAdmin.setBanned(id, !dto.isActive);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          ...(dto.fullName !== undefined && { fullName: dto.fullName }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });
      if (target.staffProfile) {
        if (dto.employeeNo || dto.designation || dto.department !== undefined || dto.schoolId) {
          await tx.staffProfile.update({
            where: { userId: id },
            data: {
              ...(dto.employeeNo && { employeeNo: dto.employeeNo }),
              ...(dto.designation && { designation: dto.designation }),
              ...(dto.department !== undefined && { department: dto.department }),
              ...(dto.schoolId && { schoolId: dto.schoolId }),
            },
          });
        }
      } else if (dto.schoolId) {
        await tx.staffProfile.create({
          data: {
            tenantId, schoolId: dto.schoolId, userId: id,
            employeeNo: dto.employeeNo!.trim(), designation: dto.designation!.trim(), department: dto.department,
          },
        });
      }
      await tx.auditLog.create({
        data: { tenantId, userId: actorId, action: "teacher.update", entity: "User", entityId: id },
      });
    });
    return this.findTeacher(id);
  }

  /** Removes login + staff profile. Any real activity (messages, portion
   * reports, courses taught, announcement reads) must be preserved instead —
   * same rule StudentsService/PlatformService apply — so those are checked
   * before attempting the delete, not left to fail as a raw FK violation.
   * The check also runs before the Supabase Auth account is deleted, so a
   * blocked delete never leaves an orphaned Auth-deleted-but-DB-row-intact
   * teacher behind. */
  async remove(id: string, user: AuthUser, actorId: string) {
    const target = await this.findTeacher(id);
    // Same fix as update(): the target's tenantId is already known from the
    // fetched row, so there's no need to resolve one via schoolId — which
    // used to throw for Super Admin deleting a teacher with no staffProfile.
    const tenantId = target.tenantId;

    const counts = await this.prisma.user.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            messagesSent: true, messagesReceived: true, auditLogs: true,
            announcementReads: true, portionReportsSubmitted: true,
            portionReportsReviewed: true, coursesTaught: true,
          },
        },
      },
    });
    const blockers = Object.entries(counts?._count ?? {}).filter(([, count]) => count > 0).map(([key]) => key);
    if (blockers.length > 0) {
      throw new ConflictException(
        `${target.fullName} has activity on record (${blockers.join(", ")}) that must be preserved. Set them Inactive instead (Edit → Status).`,
      );
    }

    await this.supabaseAdmin.deleteUser(id);
    await this.prisma.$transaction([
      this.prisma.staffProfile.deleteMany({ where: { userId: id } }),
      this.prisma.user.delete({ where: { id } }),
      this.prisma.auditLog.create({
        data: {
          tenantId, userId: actorId, action: "teacher.delete", entity: "User", entityId: id,
          metadata: { email: target.email, name: target.fullName },
        },
      }),
    ]);
    return { deleted: true };
  }
}
