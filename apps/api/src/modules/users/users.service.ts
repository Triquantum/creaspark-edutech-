import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Role } from "@educore/database";
import { randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { SupabaseAdminService } from "../../common/supabase/supabase-admin.service";
import { AuthUser } from "../../common/decorators/current-user.decorator";
import { CreateUserDto, QueryUsersDto, UpdateUserDto } from "./users.dto";

const USER_LIST_SELECT = {
  id: true, fullName: true, email: true, phone: true, role: true,
  isActive: true, lastLoginAt: true, createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private supabaseAdmin: SupabaseAdminService) {}

  /** SUPER_ADMIN has no real school of their own; tenantId for a *new* login
   * is resolved from an explicit schoolId instead of currentTenant() —
   * throws if missing. */
  private async resolveTenant(user: AuthUser, schoolId?: string): Promise<{ tenantId: string }> {
    if (user.role === Role.SUPER_ADMIN) {
      if (!schoolId) throw new BadRequestException("schoolId is required for Super Admin");
      const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
      if (!school) throw new NotFoundException("School not found");
      return { tenantId: school.tenantId };
    }
    return { tenantId: currentTenant().tenantId };
  }

  /** Read-only scope: cross-tenant (every school) for SUPER_ADMIN when no
   * schoolId filter is given, else the caller's own tenant. Never throws. */
  private async readScope(user: AuthUser, schoolId?: string): Promise<{ tenantId?: string }> {
    if (user.role === Role.SUPER_ADMIN) {
      if (!schoolId) return { tenantId: undefined };
      const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
      if (!school) throw new NotFoundException("School not found");
      return { tenantId: school.tenantId };
    }
    return { tenantId: currentTenant().tenantId };
  }

  /** For actions on an *existing* user: SUPER_ADMIN may act on any tenant
   * (the target already tells us which one); everyone else is confined to
   * their own. */
  private assertCanAct(user: AuthUser, targetTenantId: string) {
    if (user.role === Role.SUPER_ADMIN) return;
    if (targetTenantId !== currentTenant().tenantId) throw new NotFoundException("User not found");
  }

  async list(user: AuthUser, query: QueryUsersDto) {
    const scope = await this.readScope(user, query.schoolId);
    const crossTenant = user.role === Role.SUPER_ADMIN && !scope.tenantId;
    return this.prisma.user.findMany({
      where: {
        ...(scope.tenantId && { tenantId: scope.tenantId }),
        ...(query.role && { role: query.role }),
        ...(query.q && {
          OR: [
            { fullName: { contains: query.q, mode: "insensitive" as const } },
            { email: { contains: query.q, mode: "insensitive" as const } },
          ],
        }),
      },
      select: crossTenant ? { ...USER_LIST_SELECT, tenant: { select: { name: true } } } : USER_LIST_SELECT,
      orderBy: { fullName: "asc" },
      take: 200,
    });
  }

  /** Registers a login for any role; returns a temp password once if none was supplied. */
  async create(dto: CreateUserDto, user: AuthUser, actorId: string) {
    const { tenantId } = await this.resolveTenant(user, dto.schoolId);
    const email = dto.email.trim().toLowerCase();

    const taken = await this.prisma.user.findUnique({ where: { email } });
    if (taken) throw new ConflictException(`A user with email ${email} already exists`);

    const tempPassword = dto.password ?? `Cs@${randomBytes(4).toString("hex")}`;
    const authUser = await this.supabaseAdmin.createUser(email, tempPassword, { role: dto.role, tenantId });

    const createdUser = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { id: authUser.id, tenantId, email, fullName: dto.fullName.trim(), phone: dto.phone, role: dto.role },
        select: USER_LIST_SELECT,
      });
      await tx.auditLog.create({
        data: { tenantId, userId: actorId, action: "user.register", entity: "User", entityId: u.id, metadata: { role: dto.role } },
      });
      return u;
    });

    return {
      ...createdUser,
      // Returned exactly once so the admin can hand it over; never retrievable again.
      ...(dto.password ? {} : { tempPassword }),
    };
  }

  private async findUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { ...USER_LIST_SELECT, tenantId: true } });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async update(id: string, dto: UpdateUserDto, user: AuthUser, actorId: string) {
    const target = await this.findUser(id);
    this.assertCanAct(user, target.tenantId);

    if (dto.role !== undefined) {
      await this.supabaseAdmin.updateAppMetadata(id, { role: dto.role });
    }
    if (dto.isActive !== undefined) {
      await this.supabaseAdmin.setBanned(id, !dto.isActive);
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          ...(dto.fullName !== undefined && { fullName: dto.fullName.trim() }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.role !== undefined && { role: dto.role }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      }),
      this.prisma.auditLog.create({
        data: { tenantId: target.tenantId, userId: actorId, action: "user.update", entity: "User", entityId: id },
      }),
    ]);
    return this.findUser(id);
  }

  /** Sets a fresh temp password via Supabase so a locked-out user can sign in again. */
  async resetPassword(id: string, user: AuthUser, actorId: string) {
    const target = await this.findUser(id);
    this.assertCanAct(user, target.tenantId);
    const tempPassword = `Cs@${randomBytes(4).toString("hex")}`;

    await this.supabaseAdmin.setPassword(id, tempPassword);
    await this.prisma.auditLog.create({
      data: { tenantId: target.tenantId, userId: actorId, action: "user.reset-password", entity: "User", entityId: id },
    });
    return { tempPassword };
  }

  async remove(id: string, user: AuthUser, actorId: string) {
    if (id === actorId) throw new BadRequestException("You can't delete your own account");
    const target = await this.findUser(id);
    this.assertCanAct(user, target.tenantId);

    await this.supabaseAdmin.deleteUser(id);
    await this.prisma.$transaction([
      this.prisma.user.delete({ where: { id } }),
      this.prisma.auditLog.create({
        data: {
          tenantId: target.tenantId, userId: actorId, action: "user.delete", entity: "User", entityId: id,
          metadata: { email: target.email, name: target.fullName, role: target.role },
        },
      }),
    ]);
    return { deleted: true };
  }
}
