import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, Role } from "@educore/database";
import { randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { SupabaseAdminService } from "../../common/supabase/supabase-admin.service";
import { AuthUser } from "../../common/decorators/current-user.decorator";
import { CreateUserDto, QueryUsersDto, UpdateUserDto } from "./users.dto";

const USER_LIST_SELECT = {
  id: true, fullName: true, email: true, phone: true, gender: true, role: true,
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

  /** Read-only scope: cross-tenant (every school) for SUPER_ADMIN/ORG_ADMIN
   * when no schoolId filter is given, else the caller's own tenant. Never
   * throws. ORG_ADMIN's cross-tenant access is view-only — write actions
   * (resolveTenant/assertCanAct below) stay confined to their own tenant. */
  private async readScope(user: AuthUser, schoolId?: string): Promise<{ tenantId?: string }> {
    if (user.role === Role.SUPER_ADMIN || user.role === Role.ORG_ADMIN) {
      if (!schoolId) return { tenantId: undefined };
      const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
      if (!school) throw new NotFoundException("School not found");
      return { tenantId: school.tenantId };
    }
    return { tenantId: currentTenant().tenantId };
  }

  /** For actions on an *existing* user: SUPER_ADMIN/ORG_ADMIN may act on any
   * tenant (the target already tells us which one) — ORG_ADMIN needs this to
   * reassign a user's school across tenants; everyone else is confined to
   * their own. */
  private assertCanAct(user: AuthUser, targetTenantId: string) {
    if (user.role === Role.SUPER_ADMIN || user.role === Role.ORG_ADMIN) return;
    if (targetTenantId !== currentTenant().tenantId) throw new NotFoundException("User not found");
  }

  /** Resolves a raw schoolIds[] (possibly containing the literal "ALL")
   * into a map of school id -> that school's own tenantId. For Super Admin
   * this spans every non-suspended school platform-wide, not just one
   * organization -- in this app's data, a registered school is typically
   * its own single-school tenant, so restricting "ALL"/explicit picks to
   * one tenant would defeat the point of a multi-school picker. Everyone
   * else stays confined to their own tenant. Each returned UserAccess row
   * is stamped with its OWN school's tenantId, not necessarily `tenantId`. */
  private async resolveSchoolIds(isSuperAdmin: boolean, tenantId: string, schoolIds: string[]): Promise<Map<string, string>> {
    if (schoolIds.includes("ALL")) {
      const all = await this.prisma.school.findMany({
        where: isSuperAdmin ? { tenant: { status: { not: "SUSPENDED" } } } : { tenantId },
        select: { id: true, tenantId: true },
      });
      return new Map(all.map((s) => [s.id, s.tenantId]));
    }
    const unique = [...new Set(schoolIds)];
    const schools = await this.prisma.school.findMany({
      where: { id: { in: unique }, ...(!isSuperAdmin && { tenantId }) },
      select: { id: true, tenantId: true },
    });
    if (schools.length !== unique.length) {
      throw new BadRequestException(isSuperAdmin ? "One or more schools no longer exist" : "One or more schools are outside this organization");
    }
    return new Map(schools.map((s) => [s.id, s.tenantId]));
  }

  /** Replaces this user's UserAccess rows with one per already-resolved
   * school -- a lightweight association (school + role + optional
   * department), not a StaffProfile move, matching Users' existing "plain
   * account management" scope (StaffProfile stays owned by Teachers/
   * Employees). Exactly one row ends up isPrimary -- the partial unique
   * index on UserAccess enforces at most one per user, so this must never
   * mark more than one true. */
  private async syncSchoolAccess(
    tx: Prisma.TransactionClient, userId: string,
    schoolTenants: Map<string, string>, primarySchoolId: string | undefined, department: string | undefined, role: Role,
  ) {
    const resolvedSchoolIds = [...schoolTenants.keys()];
    const primaryId = primarySchoolId && schoolTenants.has(primarySchoolId) ? primarySchoolId : resolvedSchoolIds[0];
    await tx.userAccess.deleteMany({ where: { userId } });
    await tx.userAccess.createMany({
      data: resolvedSchoolIds.map((schoolId) => ({
        userId, tenantId: schoolTenants.get(schoolId)!, schoolId, role, department, isPrimary: schoolId === primaryId, isActive: true,
      })),
    });
  }

  async list(user: AuthUser, query: QueryUsersDto) {
    const scope = await this.readScope(user, query.schoolId);
    const crossTenant = (user.role === Role.SUPER_ADMIN || user.role === Role.ORG_ADMIN) && !scope.tenantId;
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

    // Resolved before the transaction (read-only, mirrors resolveTenant()'s
    // own pre-transaction school lookup above) so a bad schoolIds[] fails
    // fast instead of after the Supabase Auth account already exists.
    const schoolTenants = dto.schoolIds?.length
      ? await this.resolveSchoolIds(user.role === Role.SUPER_ADMIN, tenantId, dto.schoolIds)
      : null;

    const tempPassword = dto.password ?? `Cs@${randomBytes(4).toString("hex")}`;
    const authUser = await this.supabaseAdmin.createUser(email, tempPassword, { role: dto.role, tenantId });

    const createdUser = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { id: authUser.id, tenantId, email, fullName: dto.fullName.trim(), phone: dto.phone, role: dto.role },
        select: USER_LIST_SELECT,
      });
      if (schoolTenants) {
        await this.syncSchoolAccess(tx, u.id, schoolTenants, dto.schoolId, dto.department, dto.role);
      } else if (dto.department && dto.schoolId) {
        await tx.userAccess.create({
          data: { userId: u.id, tenantId, schoolId: dto.schoolId, role: dto.role, department: dto.department, isPrimary: true, isActive: true },
        });
      }
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

    let newTenantId: string | undefined;
    if (dto.schoolId !== undefined) {
      if (user.role !== Role.SUPER_ADMIN && user.role !== Role.ORG_ADMIN) {
        throw new BadRequestException("Only Super Admin or Org Admin can reassign a user's school");
      }
      const school = await this.prisma.school.findUnique({ where: { id: dto.schoolId } });
      if (!school) throw new NotFoundException("School not found");
      newTenantId = school.tenantId;

      // Student/Guardian records carry their own schoolId/links that a
      // schoolId change here wouldn't touch — leaving them stale and
      // inconsistent with the new tenant. Redirect to the pages built for
      // that instead of silently half-moving the user.
      const links = await this.prisma.user.findUnique({
        where: { id },
        select: { studentLink: { select: { id: true } }, guardianLinks: { select: { id: true }, take: 1 } },
      });
      if (links?.studentLink || (links?.guardianLinks.length ?? 0) > 0) {
        throw new BadRequestException("Reassign this person's school from the Students or Parents page instead.");
      }
    }

    if (dto.role !== undefined || newTenantId !== undefined) {
      await this.supabaseAdmin.updateAppMetadata(id, {
        ...(dto.role !== undefined && { role: dto.role }),
        ...(newTenantId !== undefined && { tenantId: newTenantId }),
      });
    }
    if (dto.isActive !== undefined) {
      await this.supabaseAdmin.setBanned(id, !dto.isActive);
    }

    // Resolved before the transaction (same reasoning as create()) -- an
    // array-form $transaction below can't run an async resolver mid-batch.
    const schoolTenants = dto.schoolIds?.length
      ? await this.resolveSchoolIds(user.role === Role.SUPER_ADMIN, newTenantId ?? target.tenantId, dto.schoolIds)
      : null;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          ...(dto.fullName !== undefined && { fullName: dto.fullName.trim() }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.gender !== undefined && { gender: dto.gender }),
          ...(dto.role !== undefined && { role: dto.role }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(newTenantId !== undefined && { tenantId: newTenantId }),
        },
      }),
      // Keep a teacher/staff row's school pointer in sync with the move —
      // this is exactly the mismatch class (StaffProfile.schoolId under a
      // different tenant than User.tenantId) that broke teacher edits earlier.
      ...(newTenantId !== undefined
        ? [this.prisma.staffProfile.updateMany({
            where: { userId: id },
            data: { tenantId: newTenantId, schoolId: dto.schoolId! },
          })]
        : []),
      // Full-replace, same as create() -- Users doesn't expose per-grant
      // editing (that's Employees' job), so re-saving the whole list is
      // simplest and matches how this form always submits it.
      ...(schoolTenants
        ? (() => {
            const ids = [...schoolTenants.keys()];
            const primaryId = dto.schoolId && schoolTenants.has(dto.schoolId) ? dto.schoolId : ids[0];
            return [
              this.prisma.userAccess.deleteMany({ where: { userId: id } }),
              this.prisma.userAccess.createMany({
                data: ids.map((schoolId) => ({
                  userId: id, tenantId: schoolTenants.get(schoolId)!, schoolId,
                  role: dto.role ?? target.role, department: dto.department,
                  isPrimary: schoolId === primaryId, isActive: true,
                })),
              }),
            ];
          })()
        : []),
      this.prisma.auditLog.create({
        data: { tenantId: newTenantId ?? target.tenantId, userId: actorId, action: "user.update", entity: "User", entityId: id },
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

  /** Postgres delete runs first: if it fails (e.g. FK violation below), the
   * Supabase Auth identity is left untouched instead of being orphaned. */
  async remove(id: string, user: AuthUser, actorId: string) {
    if (id === actorId) throw new BadRequestException("You can't delete your own account");
    const target = await this.findUser(id);
    this.assertCanAct(user, target.tenantId);

    try {
      await this.prisma.$transaction([
        this.prisma.user.delete({ where: { id } }),
        this.prisma.auditLog.create({
          data: {
            tenantId: target.tenantId, userId: actorId, action: "user.delete", entity: "User", entityId: id,
            metadata: { email: target.email, name: target.fullName, role: target.role },
          },
        }),
      ]);
    } catch (error) {
      // P2003: this user still has related records (messages, portion
      // reports, assignments, audit history, ...) — none of those relations
      // cascade-delete on purpose, so surface a clear reason instead of a
      // raw 500 and instead of silently destroying that history.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new ConflictException(
          `${target.fullName} has related records (messages, portion reports, assignments, etc.) and can't be deleted. Set them to Inactive instead.`,
        );
      }
      throw error;
    }

    await this.supabaseAdmin.deleteUser(id);
    return { deleted: true };
  }
}
