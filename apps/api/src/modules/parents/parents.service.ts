import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Role } from "@educore/database";
import { randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { SupabaseAdminService } from "../../common/supabase/supabase-admin.service";
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

  async list(query: QueryParentsDto) {
    const { tenantId } = currentTenant();
    return this.prisma.user.findMany({
      where: {
        tenantId,
        role: Role.PARENT,
        ...(query.q && {
          OR: [
            { fullName: { contains: query.q, mode: "insensitive" as const } },
            { email: { contains: query.q, mode: "insensitive" as const } },
          ],
        }),
      },
      select: PARENT_SELECT,
      orderBy: { fullName: "asc" },
      take: 100,
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

  private async findParent(id: string) {
    const { tenantId } = currentTenant();
    const user = await this.prisma.user.findFirst({ where: { id, tenantId, role: Role.PARENT }, select: PARENT_SELECT });
    if (!user) throw new NotFoundException("Parent not found");
    return user;
  }

  async update(id: string, dto: UpdateParentDto, actorId: string) {
    const { tenantId } = currentTenant();
    await this.findParent(id);

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
    return this.findParent(id);
  }

  /** Removes the login but keeps the guardian contact entries on students (name/phone/relation stay on record). */
  async remove(id: string, actorId: string) {
    const { tenantId } = currentTenant();
    const user = await this.findParent(id);

    await this.supabaseAdmin.deleteUser(id);
    await this.prisma.$transaction([
      this.prisma.guardian.updateMany({ where: { userId: id }, data: { userId: null } }),
      this.prisma.user.delete({ where: { id } }),
      this.prisma.auditLog.create({
        data: {
          tenantId, userId: actorId, action: "parent.delete", entity: "User", entityId: id,
          metadata: { email: user.email, name: user.fullName },
        },
      }),
    ]);
    return { deleted: true };
  }
}
