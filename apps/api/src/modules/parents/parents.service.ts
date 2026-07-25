import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Role } from "@educore/database";
import { randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { SupabaseAdminService } from "../../common/supabase/supabase-admin.service";
import { AuthUser } from "../../common/decorators/current-user.decorator";
import { CreateParentDto, QueryParentsDto, UpdateParentDto } from "./parents.dto";

const PARENT_SELECT = {
  id: true, fullName: true, email: true, phone: true, isActive: true, lastLoginAt: true,
  guardianLinks: {
    select: {
      relation: true, isPrimary: true,
      student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } },
    },
  },
} as const;

@Injectable()
export class ParentsService {
  constructor(private prisma: PrismaService, private supabaseAdmin: SupabaseAdminService) {}

  /** SUPER_ADMIN has no real school of their own; tenantId for a *new*
   * login is resolved from an explicit schoolId instead of currentTenant(). */
  private async resolveTenant(user: AuthUser, schoolId?: string): Promise<{ tenantId: string }> {
    if (user.role === Role.SUPER_ADMIN) {
      if (!schoolId) throw new BadRequestException("schoolId is required for Super Admin");
      const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
      if (!school) throw new NotFoundException("School not found");
      return { tenantId: school.tenantId };
    }
    return { tenantId: currentTenant().tenantId };
  }

  /** For actions on an *existing* parent: SUPER_ADMIN may act on any
   * tenant; everyone else is confined to their own. */
  private assertCanAct(user: AuthUser, targetTenantId: string) {
    if (user.role === Role.SUPER_ADMIN) return;
    if (targetTenantId !== currentTenant().tenantId) throw new NotFoundException("Parent not found");
  }

  async list(user: AuthUser, query: QueryParentsDto) {
    const crossTenant = user.role === Role.SUPER_ADMIN && !query.schoolId;
    const tenantId = crossTenant ? undefined : (await this.resolveTenant(user, query.schoolId)).tenantId;
    return this.prisma.user.findMany({
      where: {
        ...(tenantId && { tenantId }),
        role: Role.PARENT,
        ...(query.schoolId && { guardianLinks: { some: { student: { schoolId: query.schoolId } } } }),
        ...(query.q && {
          OR: [
            { fullName: { contains: query.q, mode: "insensitive" as const } },
            { email: { contains: query.q, mode: "insensitive" as const } },
          ],
        }),
      },
      select: crossTenant ? { ...PARENT_SELECT, tenant: { select: { name: true } } } : PARENT_SELECT,
      orderBy: { fullName: "asc" },
      take: 200,
    });
  }

  /** Creates the login and links it to one or more students; returns a temp password once if none was supplied. */
  async create(dto: CreateParentDto, actorId: string) {
    const { tenantId } = currentTenant();
    const email = dto.email.trim().toLowerCase();

    const taken = await this.prisma.user.findUnique({ where: { email } });
    if (taken) throw new ConflictException(`A user with email ${email} already exists`);

    const studentIds = dto.students.map((s) => s.studentId);
    const students = await this.prisma.student.findMany({ where: { id: { in: studentIds }, tenantId } });
    if (students.length !== new Set(studentIds).size) {
      throw new NotFoundException("One or more selected students could not be found");
    }

    const tempPassword = dto.password ?? `Cs@${randomBytes(4).toString("hex")}`;
    const authUser = await this.supabaseAdmin.createUser(email, tempPassword, { role: Role.PARENT, tenantId });

    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { id: authUser.id, tenantId, email, fullName: dto.fullName.trim(), phone: dto.phone, role: Role.PARENT },
      });
      await tx.guardian.createMany({
        data: dto.students.map((s) => ({
          tenantId, studentId: s.studentId, userId: u.id,
          relation: s.relation?.trim() || "Guardian",
          fullName: dto.fullName.trim(), phone: dto.phone, isPrimary: s.isPrimary ?? false,
        })),
      });
      await tx.auditLog.create({
        data: { tenantId, userId: actorId, action: "parent.create", entity: "User", entityId: u.id, metadata: { studentIds } },
      });
      return u;
    });

    return {
      id: user.id, fullName: user.fullName, email: user.email,
      // Returned exactly once so the admin can hand it over; never retrievable again.
      ...(dto.password ? {} : { tempPassword }),
    };
  }

  private async findParent(id: string, user: AuthUser) {
    const found = await this.prisma.user.findFirst({ where: { id, role: Role.PARENT }, select: { ...PARENT_SELECT, tenantId: true } });
    if (!found) throw new NotFoundException("Parent not found");
    this.assertCanAct(user, found.tenantId);
    return found;
  }

  async update(id: string, dto: UpdateParentDto, user: AuthUser, actorId: string) {
    const target = await this.findParent(id, user);
    const tenantId = target.tenantId;

    if (dto.isActive !== undefined) {
      await this.supabaseAdmin.setBanned(id, !dto.isActive);
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          ...(dto.fullName !== undefined && { fullName: dto.fullName }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      }),
      // Keep the guardian contact rows shown on student records in sync.
      ...(dto.fullName !== undefined || dto.phone !== undefined
        ? [this.prisma.guardian.updateMany({
            where: { userId: id },
            data: {
              ...(dto.fullName !== undefined && { fullName: dto.fullName }),
              ...(dto.phone !== undefined && { phone: dto.phone }),
            },
          })]
        : []),
      this.prisma.auditLog.create({
        data: { tenantId, userId: actorId, action: "parent.update", entity: "User", entityId: id },
      }),
    ]);
    return this.findParent(id, user);
  }

  /** Removes the login but keeps the guardian contact entries on students (name/phone/relation stay on record). */
  async remove(id: string, user: AuthUser, actorId: string) {
    const target = await this.findParent(id, user);
    const tenantId = target.tenantId;

    await this.supabaseAdmin.deleteUser(id);
    await this.prisma.$transaction([
      this.prisma.guardian.updateMany({ where: { userId: id }, data: { userId: null } }),
      this.prisma.user.delete({ where: { id } }),
      this.prisma.auditLog.create({
        data: {
          tenantId, userId: actorId, action: "parent.delete", entity: "User", entityId: id,
          metadata: { email: target.email, name: target.fullName },
        },
      }),
    ]);
    return { deleted: true };
  }
}
