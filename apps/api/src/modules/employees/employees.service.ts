import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EmploymentType, Prisma, Role, SalaryPaidBy } from "@educore/database";
import { randomBytes } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import PDFDocument from "pdfkit";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { SupabaseAdminService } from "../../common/supabase/supabase-admin.service";
import { AuthUser } from "../../common/decorators/current-user.decorator";
import { CreateEmployeeDto, GrantDto, SalaryCertificateDto, SalarySlipDto, UpdateEmployeeDto } from "./employees.dto";

const NON_STAFF_ROLES: Role[] = [Role.STUDENT, Role.PARENT, Role.GUEST];

// Bundled build-time assets (see nest-cli.json's compilerOptions.assets) --
// not user-uploaded files, so no fetch-arbitrary-URL risk like School.logoUrl.
const WATERMARK_LOGO_PATH = join(__dirname, "assets", "creaspark-logo.jpeg");
const SEAL_PATH = join(__dirname, "assets", "seal-main.png");
const DESIGNATED_PARTNER_SEAL_PATH = join(__dirname, "assets", "designated-partner-seal.png");

/** Generalized version of TeachersService covering every staff role (not
 * just TEACHER, which keeps its own dedicated page) -- an HR-facing
 * directory of who's employed, their designation/department/employee no.,
 * not a duplicate of the Users page's plain account management. */
@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService, private supabaseAdmin: SupabaseAdminService) {}

  private assetCache = new Map<string, Buffer | null>();

  /** Lazily read once per warm instance, not once per request -- bundled
   * assets never change between requests. Cached failure (null) so a
   * missing file doesn't retry a disk read on every certificate. */
  private loadAsset(path: string): Buffer | null {
    if (!this.assetCache.has(path)) {
      try {
        this.assetCache.set(path, readFileSync(path));
      } catch {
        this.assetCache.set(path, null);
      }
    }
    return this.assetCache.get(path) ?? null;
  }

  /** Faint, centered background mark -- drawn before any other content so
   * text and rules sit on top of it, matching a standard letterhead
   * watermark. Silently skipped if the bundled asset is missing rather than
   * failing certificate generation over a cosmetic detail. */
  private drawWatermark(doc: PDFKit.PDFDocument) {
    const logo = this.loadAsset(WATERMARK_LOGO_PATH);
    if (!logo) return;
    const size = 340;
    const x = (doc.page.width - size) / 2;
    const y = (doc.page.height - size) / 2;
    doc.opacity(0.1).image(logo, x, y, { width: size, height: size }).opacity(1);
  }

  /** Round company seal plus the smaller "For Creaspark LLP / Designated
   * Partner" stamp, placed over the signature block the same way a physical
   * certificate is stamped -- the seal overlapping the signature area, the
   * designation stamp just below it. Positions are relative to where the
   * signature block started (sigTopY), not the current doc.y, so this can
   * run after the signature text without fighting its own layout. */
  private drawSignatureSeals(doc: PDFKit.PDFDocument, sigLeftX: number, sigTopY: number) {
    const seal = this.loadAsset(SEAL_PATH);
    const sealSize = 92;
    const sealX = sigLeftX + 150;
    const sealY = sigTopY - 8;
    if (seal) doc.image(seal, sealX, sealY, { width: sealSize, height: sealSize });

    const dpSeal = this.loadAsset(DESIGNATED_PARTNER_SEAL_PATH);
    if (dpSeal) doc.image(dpSeal, sealX + 4, sealY + sealSize - 12, { width: sealSize - 10 });
  }

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

  /** Read-only scope: cross-tenant (all schools) for SUPER_ADMIN/ORG_ADMIN
   * when no schoolId filter is given, else the caller's own tenant. */
  private async readScope(user: AuthUser, schoolId?: string): Promise<{ tenantId?: string; schoolId?: string }> {
    if (user.role === Role.SUPER_ADMIN || user.role === Role.ORG_ADMIN) return { schoolId };
    const { tenantId } = currentTenant();
    return { tenantId, schoolId };
  }

  async list(user: AuthUser, q?: string, schoolId?: string, activeOnly?: string) {
    const scope = await this.readScope(user, schoolId);
    return this.prisma.user.findMany({
      where: {
        ...(scope.tenantId && { tenantId: scope.tenantId }),
        role: { notIn: NON_STAFF_ROLES },
        ...(scope.schoolId && { staffProfile: { schoolId: scope.schoolId } }),
        ...(activeOnly === "true" && { isActive: true }),
        ...(q && {
          OR: [
            { fullName: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { staffProfile: { employeeNo: { contains: q, mode: "insensitive" as const } } },
          ],
        }),
      },
      select: {
        id: true, fullName: true, email: true, phone: true, role: true, isActive: true,
        staffProfile: {
          select: {
            employeeNo: true, designation: true, department: true, joinDate: true,
            employmentType: true, salaryPaidBy: true, salary: true,
            schoolId: true, school: { select: { name: true } },
          },
        },
        userAccess: {
          where: { isActive: true },
          select: { id: true, role: true, designation: true, department: true, isPrimary: true, schoolId: true, school: { select: { name: true } } },
          orderBy: { isPrimary: "desc" },
        },
      },
      orderBy: { fullName: "asc" },
      take: 200,
    });
  }

  /** Read-only audit trail of every salary slip actually generated -- who
   * printed whose slip, and when. Same cross-tenant visibility rule as
   * list(): SUPER_ADMIN/ORG_ADMIN see every tenant, everyone else only
   * their own. */
  async salarySlipLogs(user: AuthUser) {
    const crossTenant = user.role === Role.SUPER_ADMIN || user.role === Role.ORG_ADMIN;
    return this.prisma.salarySlipLog.findMany({
      where: { ...(!crossTenant && { tenantId: currentTenant().tenantId }) },
      select: {
        id: true, period: true, createdAt: true,
        employee: { select: { id: true, fullName: true, staffProfile: { select: { employeeNo: true } } } },
        generatedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
  }

  /** Creates the login and staff profile; returns a temp password once if none was supplied. */
  async create(dto: CreateEmployeeDto, user: AuthUser, actorId: string) {
    if (NON_STAFF_ROLES.includes(dto.role)) throw new BadRequestException("Choose a staff role for an employee");
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
    const authUser = await this.supabaseAdmin.createUser(dto.email, tempPassword, { role: dto.role, tenantId });

    const createdUser = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { id: authUser.id, tenantId, email: dto.email, phone: dto.phone, fullName: dto.fullName, role: dto.role },
      });
      await tx.staffProfile.create({
        data: {
          tenantId, schoolId: dto.schoolId, userId: u.id,
          employeeNo: dto.employeeNo, designation: dto.designation, department: dto.department,
          ...(dto.employmentType && { employmentType: dto.employmentType }),
          ...(dto.salaryPaidBy && { salaryPaidBy: dto.salaryPaidBy }),
          ...(dto.salary !== undefined && { salary: dto.salary }),
        },
      });
      // Mirrors the StaffProfile above as this person's primary grant --
      // see UserAccess in schema.prisma. Additional (school, role) grants
      // are a later phase; every employee gets exactly one primary row here.
      await tx.userAccess.create({
        data: {
          userId: u.id, tenantId, schoolId: dto.schoolId, role: dto.role,
          designation: dto.designation, department: dto.department, employeeNo: dto.employeeNo,
          isPrimary: true, isActive: true,
        },
      });
      // Any extra grants beyond the primary above -- the primary always
      // comes from the top-level fields (that's what the Supabase Auth
      // account was just created with), so a grants[] entry matching the
      // same (schoolId, role) is skipped rather than double-inserted.
      const extra = (dto.grants ?? []).filter((g) => !(g.schoolId === dto.schoolId && g.role === dto.role));
      if (extra.length) await this.createExtraGrants(tx, u.id, tenantId, user.role === Role.SUPER_ADMIN, extra);
      await tx.auditLog.create({
        data: { tenantId, userId: actorId, action: "employee.create", entity: "User", entityId: u.id },
      });
      return u;
    }, { timeout: 20000 });

    return {
      id: createdUser.id, fullName: createdUser.fullName, email: createdUser.email,
      // Returned exactly once so the admin can hand it over; never retrievable again.
      ...(dto.password ? {} : { tempPassword }),
    };
  }

  private async findEmployee(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, role: { notIn: NON_STAFF_ROLES } },
      include: {
        staffProfile: true,
        userAccess: { where: { isActive: true }, include: { school: { select: { name: true } } }, orderBy: { isPrimary: "desc" } },
      },
    });
    if (!user) throw new NotFoundException("Employee not found");
    return user;
  }

  /** For actions on an *existing* employee: SUPER_ADMIN may act across any
   * tenant; everyone else is confined to their own -- same pattern as
   * UsersService.assertCanAct(). */
  private assertCanAct(user: AuthUser, targetTenantId: string) {
    if (user.role === Role.SUPER_ADMIN) return;
    if (targetTenantId !== currentTenant().tenantId) throw new NotFoundException("Employee not found");
  }

  async update(id: string, dto: UpdateEmployeeDto, user: AuthUser, actorId: string) {
    const target = await this.findEmployee(id);
    this.assertCanAct(user, target.tenantId);
    // The target's own tenantId is already known from the fetched User row —
    // same fix as TeachersService.update() so Super Admin can edit any
    // employee regardless of tenant without needing a schoolId to resolve one.
    const tenantId = target.tenantId;

    if (dto.role && NON_STAFF_ROLES.includes(dto.role)) throw new BadRequestException("Choose a staff role for an employee");
    if (!dto.grants && dto.schoolId) {
      const school = await this.prisma.school.findFirst({ where: { id: dto.schoolId, tenantId } });
      if (!school) throw new NotFoundException("School not found in this employee's organization");
    }
    if (!dto.grants && !target.staffProfile && dto.schoolId && (!dto.employeeNo?.trim() || !dto.designation?.trim())) {
      throw new BadRequestException("Employee no. and designation are required to assign a school");
    }

    if (dto.email && dto.email !== target.email) {
      const clash = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (clash) throw new ConflictException(`A user with email ${dto.email} already exists`);
      await this.supabaseAdmin.updateEmail(id, dto.email);
    }

    // The grants[] path below fully owns role/school/designation/department/
    // employeeNo -- the single-field identity-clash check only applies when
    // editing the old way (top-level fields, no grants[] supplied).
    if (!dto.grants) {
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
    }

    if (dto.isActive !== undefined) {
      await this.supabaseAdmin.setBanned(id, !dto.isActive);
    }

    let primaryRoleChangedTo: Role | null = null;

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          ...(dto.fullName !== undefined && { fullName: dto.fullName }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(!dto.grants && dto.role !== undefined && { role: dto.role }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });

      if (dto.grants) {
        primaryRoleChangedTo = await this.syncGrants(
          tx, id, tenantId, user.role === Role.SUPER_ADMIN, dto.grants, dto.isActive ?? target.isActive, target.role,
          { employmentType: dto.employmentType, salaryPaidBy: dto.salaryPaidBy, salary: dto.salary },
        );
      } else {
        if (target.staffProfile) {
          if (dto.employeeNo || dto.designation || dto.department !== undefined || dto.schoolId
              || dto.employmentType || dto.salaryPaidBy || dto.salary !== undefined) {
            await tx.staffProfile.update({
              where: { userId: id },
              data: {
                ...(dto.employeeNo && { employeeNo: dto.employeeNo }),
                ...(dto.designation && { designation: dto.designation }),
                ...(dto.department !== undefined && { department: dto.department }),
                ...(dto.schoolId && { schoolId: dto.schoolId }),
                ...(dto.employmentType && { employmentType: dto.employmentType }),
                ...(dto.salaryPaidBy && { salaryPaidBy: dto.salaryPaidBy }),
                ...(dto.salary !== undefined && { salary: dto.salary }),
              },
            });
          }
        } else if (dto.schoolId) {
          await tx.staffProfile.create({
            data: {
              tenantId, schoolId: dto.schoolId, userId: id,
              employeeNo: dto.employeeNo!.trim(), designation: dto.designation!.trim(), department: dto.department,
              ...(dto.employmentType && { employmentType: dto.employmentType }),
              ...(dto.salaryPaidBy && { salaryPaidBy: dto.salaryPaidBy }),
              ...(dto.salary !== undefined && { salary: dto.salary }),
            },
          });
        }

        // Keeps the primary UserAccess grant in sync with whatever just
        // changed on User/StaffProfile above -- same mirroring as create().
        const primaryAccess = await tx.userAccess.findFirst({ where: { userId: id, isPrimary: true } });
        if (primaryAccess) {
          await tx.userAccess.update({
            where: { id: primaryAccess.id },
            data: {
              ...(dto.role !== undefined && { role: dto.role }),
              ...(dto.schoolId !== undefined && { schoolId: dto.schoolId }),
              ...(dto.employeeNo !== undefined && { employeeNo: dto.employeeNo }),
              ...(dto.designation !== undefined && { designation: dto.designation }),
              ...(dto.department !== undefined && { department: dto.department }),
              ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            },
          });
        } else if (dto.schoolId) {
          await tx.userAccess.create({
            data: {
              userId: id, tenantId, schoolId: dto.schoolId, role: dto.role ?? target.role,
              designation: dto.designation!.trim(), department: dto.department, employeeNo: dto.employeeNo!.trim(),
              isPrimary: true, isActive: target.isActive,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: { tenantId, userId: actorId, action: "employee.update", entity: "User", entityId: id },
      });
    }, { timeout: 20000 });

    // Supabase's JWT app_metadata.role is the actual thing driving login
    // permissions -- must be pushed whenever the primary grant's role
    // changes, same as dto.role already implicitly required for the
    // single-field path (see the pre-existing gap noted in employees.dto.ts
    // history; grants[] editing must not ship with a silently-broken role
    // change, so it's fixed here explicitly).
    if (primaryRoleChangedTo) {
      await this.supabaseAdmin.updateAppMetadata(id, { role: primaryRoleChangedTo });
    } else if (!dto.grants && dto.role !== undefined && dto.role !== target.role) {
      await this.supabaseAdmin.updateAppMetadata(id, { role: dto.role });
    }

    return this.findEmployee(id);
  }

  /** Expands any grant whose schoolId is the literal "ALL" into one grant
   * per eligible school -- resolved server-side (not client-side) since
   * only the server reliably knows which schools exist. For Super Admin
   * that's every non-suspended school platform-wide -- in this app's data,
   * every registered school is typically its own single-school tenant, so
   * "ALL" restricted to one tenant would only ever match one school; for
   * everyone else it stays scoped to their own tenant. Explicit grants win
   * over an ALL-expanded duplicate of the same (school, role). */
  private async expandAllSentinel(
    tx: Prisma.TransactionClient, isSuperAdmin: boolean, tenantId: string, grants: GrantDto[],
  ): Promise<GrantDto[]> {
    const sentinels = grants.filter((g) => g.schoolId === "ALL");
    if (!sentinels.length) return grants;
    const explicit = grants.filter((g) => g.schoolId !== "ALL");
    const eligibleSchools = await tx.school.findMany({
      where: isSuperAdmin ? { tenant: { status: { not: "SUSPENDED" } } } : { tenantId },
      select: { id: true },
    });
    const covered = new Set(explicit.map((g) => `${g.schoolId}::${g.role}`));
    const expanded = [...explicit];
    for (const sentinel of sentinels) {
      for (const school of eligibleSchools) {
        const key = `${school.id}::${sentinel.role}`;
        if (covered.has(key)) continue;
        covered.add(key);
        expanded.push({ ...sentinel, id: undefined, schoolId: school.id, isPrimary: false });
      }
    }
    return expanded;
  }

  /** Validates every listed school exists (any tenant for Super Admin, the
   * given tenant otherwise) and returns each school's own tenantId -- each
   * UserAccess row is stamped with ITS school's tenant, not necessarily the
   * employee's own, since Super Admin can grant access at schools that are
   * entirely separate organizations from the employee's home tenant. */
  private async resolveGrantSchoolTenants(
    tx: Prisma.TransactionClient, isSuperAdmin: boolean, tenantId: string, schoolIds: string[],
  ): Promise<Map<string, string>> {
    const schools = await tx.school.findMany({
      where: { id: { in: schoolIds }, ...(!isSuperAdmin && { tenantId }) },
      select: { id: true, tenantId: true },
    });
    if (schools.length !== schoolIds.length) {
      throw new BadRequestException(isSuperAdmin ? "One or more schools no longer exist" : "One or more schools are outside this employee's organization");
    }
    return new Map(schools.map((s) => [s.id, s.tenantId]));
  }

  /** Creates UserAccess rows beyond the primary one create() already made --
   * used only when CreateEmployeeDto.grants includes extra entries. */
  private async createExtraGrants(
    tx: Prisma.TransactionClient, userId: string, tenantId: string, isSuperAdmin: boolean, rawGrants: GrantDto[],
  ) {
    const grants = await this.expandAllSentinel(tx, isSuperAdmin, tenantId, rawGrants);
    const schoolIds = [...new Set(grants.map((g) => g.schoolId))];
    const schoolTenants = await this.resolveGrantSchoolTenants(tx, isSuperAdmin, tenantId, schoolIds);
    for (const g of grants) {
      await tx.userAccess.create({
        data: {
          userId, tenantId: schoolTenants.get(g.schoolId)!, schoolId: g.schoolId, role: g.role,
          designation: g.designation, department: g.department, employeeNo: g.employeeNo,
          isPrimary: false, isActive: true,
        },
      });
    }
  }

  /** Replaces this employee's entire grant list with `grants`, validates
   * exactly one isPrimary, and syncs User.role/StaffProfile from whichever
   * grant ends up primary. The primary grant's school must stay within the
   * employee's own tenant for real staff -- moving tenant is a separate
   * "reassign" operation (see UsersService.update's schoolId handling), not
   * something grants[] does silently. Exception: SUPER_ADMIN has no real
   * home organization to protect (they already bypass tenant scoping
   * everywhere), so a SUPER_ADMIN primary grant may point at any school --
   * the check below only applies when the primary grant's own role isn't
   * SUPER_ADMIN. Non-primary grants may span other tenants when the actor
   * is Super Admin. Returns the new primary role when it differs from
   * `currentRole`, so the caller can push it to Supabase's app_metadata
   * after the transaction commits. */
  private async syncGrants(
    tx: Prisma.TransactionClient, userId: string, tenantId: string, isSuperAdmin: boolean,
    rawGrants: GrantDto[], isActive: boolean, currentRole: Role,
    staffFields: { employmentType?: EmploymentType; salaryPaidBy?: SalaryPaidBy; salary?: number },
  ): Promise<Role | null> {
    const grants = await this.expandAllSentinel(tx, isSuperAdmin, tenantId, rawGrants);
    if (!grants.length) throw new BadRequestException("At least one role/school grant is required");
    if (grants.some((g) => NON_STAFF_ROLES.includes(g.role))) throw new BadRequestException("Choose a staff role for every grant");

    const primaryFlags = grants.filter((g) => g.isPrimary);
    if (primaryFlags.length > 1) throw new BadRequestException("Only one grant can be marked primary");
    const primaryIndex = primaryFlags.length === 1 ? grants.findIndex((g) => g.isPrimary) : 0;
    const primaryGrant = grants[primaryIndex];
    if (!primaryGrant.employeeNo?.trim() || !primaryGrant.designation?.trim()) {
      throw new BadRequestException("The primary grant needs an employee no. and designation");
    }

    const schoolIds = [...new Set(grants.map((g) => g.schoolId))];
    const schoolTenants = await this.resolveGrantSchoolTenants(tx, isSuperAdmin, tenantId, schoolIds);
    const primaryTenantId = schoolTenants.get(primaryGrant.schoolId)!;
    if (primaryGrant.role !== Role.SUPER_ADMIN && primaryTenantId !== tenantId) {
      throw new BadRequestException("The primary grant's school must be in this employee's own organization");
    }

    const seen = new Set<string>();
    for (const g of grants) {
      const key = `${g.schoolId}::${g.role}`;
      if (seen.has(key)) throw new BadRequestException("Each role/school combination can only appear once");
      seen.add(key);
    }

    const empNoClash = await tx.staffProfile.findUnique({
      where: { schoolId_employeeNo: { schoolId: primaryGrant.schoolId, employeeNo: primaryGrant.employeeNo.trim() } },
    });
    if (empNoClash && empNoClash.userId !== userId) {
      throw new ConflictException(`Employee no. ${primaryGrant.employeeNo} already exists in this school`);
    }

    const existing = await tx.userAccess.findMany({ where: { userId } });
    const keepIds = new Set(grants.filter((g) => g.id).map((g) => g.id!));
    const toDeleteIds = existing.filter((e) => !keepIds.has(e.id)).map((e) => e.id);
    if (toDeleteIds.length) await tx.userAccess.deleteMany({ where: { id: { in: toDeleteIds } } });

    for (let i = 0; i < grants.length; i++) {
      const g = grants[i];
      const data = {
        tenantId: schoolTenants.get(g.schoolId)!, schoolId: g.schoolId, role: g.role,
        designation: g.designation, department: g.department, employeeNo: g.employeeNo,
        isPrimary: i === primaryIndex, isActive,
      };
      if (g.id) {
        await tx.userAccess.update({ where: { id: g.id }, data });
      } else {
        await tx.userAccess.create({ data: { userId, ...data } });
      }
    }

    await tx.user.update({ where: { id: userId }, data: { role: primaryGrant.role } });
    await tx.staffProfile.upsert({
      where: { userId },
      create: {
        tenantId: primaryTenantId, userId, schoolId: primaryGrant.schoolId,
        employeeNo: primaryGrant.employeeNo.trim(), designation: primaryGrant.designation.trim(), department: primaryGrant.department,
        ...(staffFields.employmentType && { employmentType: staffFields.employmentType }),
        ...(staffFields.salaryPaidBy && { salaryPaidBy: staffFields.salaryPaidBy }),
        ...(staffFields.salary !== undefined && { salary: staffFields.salary }),
      },
      update: {
        tenantId: primaryTenantId, schoolId: primaryGrant.schoolId,
        employeeNo: primaryGrant.employeeNo.trim(), designation: primaryGrant.designation.trim(), department: primaryGrant.department,
        ...(staffFields.employmentType && { employmentType: staffFields.employmentType }),
        ...(staffFields.salaryPaidBy && { salaryPaidBy: staffFields.salaryPaidBy }),
        ...(staffFields.salary !== undefined && { salary: staffFields.salary }),
      },
    });

    return primaryGrant.role !== currentRole ? primaryGrant.role : null;
  }

  /** Removes login + staff profile. Any real activity (messages, portion
   * reports, LMS content authored, announcement reads, tasks assigned/
   * created) must be preserved instead — same rule TeachersService applies
   * — so those are checked before attempting the delete. */
  async remove(id: string, user: AuthUser, actorId: string) {
    const target = await this.findEmployee(id);
    this.assertCanAct(user, target.tenantId);
    const tenantId = target.tenantId;

    const counts = await this.prisma.user.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            messagesSent: true, messagesReceived: true, auditLogs: true,
            announcementReads: true, portionReportsSubmitted: true,
            portionReportsReviewed: true, teacherAssignments: true,
            lessonsAuthored: true, assignmentsAuthored: true, quizzesAuthored: true,
            taskAssignments: true, tasksCreated: true, tasksUpdated: true,
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

    try {
      await this.prisma.$transaction([
        this.prisma.staffProfile.deleteMany({ where: { userId: id } }),
        this.prisma.user.delete({ where: { id } }),
        this.prisma.auditLog.create({
          data: {
            tenantId, userId: actorId, action: "employee.delete", entity: "User", entityId: id,
            metadata: { email: target.email, name: target.fullName },
          },
        }),
      ]);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new ConflictException(
          `${target.fullName} has related records that must be preserved. Set them Inactive instead (Edit → Status).`,
        );
      }
      throw error;
    }

    await this.supabaseAdmin.deleteUser(id);
    return { deleted: true };
  }

  /** Fetches the employee plus their school's letterhead fields, scoped to
   * the caller's own tenant for anyone but Super Admin. */
  private async docEmployee(id: string, user: AuthUser) {
    const employee = await this.prisma.user.findFirst({
      where: { id, role: { notIn: NON_STAFF_ROLES } },
      include: { staffProfile: { include: { school: true } } },
    });
    if (!employee) throw new NotFoundException("Employee not found");
    this.assertCanAct(user, employee.tenantId);
    if (!employee.staffProfile) throw new BadRequestException("This employee has no school/designation assigned yet");
    return employee as typeof employee & { staffProfile: NonNullable<typeof employee.staffProfile> };
  }

  /** Letterhead block shared by both generated documents -- deliberately
   * text-only (no logo fetch): the school's own School.logoUrl is an
   * externally-hosted URL, and pdfkit's doc.image() needs a local
   * buffer/path, so embedding it would mean the API server fetching an
   * arbitrary stored URL at request time. Not worth the SSRF surface for a
   * letterhead. */
  private drawLetterhead(doc: PDFKit.PDFDocument, school: { name: string; address: string | null; city: string | null; state: string | null; pincode: string | null; phone: string | null; email: string | null }) {
    doc.fontSize(16).fillColor("#000").font("Helvetica-Bold").text(school.name, { align: "center" });
    const addressLine = [school.address, school.city, school.state, school.pincode].filter(Boolean).join(", ");
    const contactLine = [school.phone, school.email].filter(Boolean).join("  ·  ");
    doc.fontSize(9).fillColor("#555").font("Helvetica");
    if (addressLine) doc.text(addressLine, { align: "center" });
    if (contactLine) doc.text(contactLine, { align: "center" });
    doc.moveDown(1);
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor("#ccc").stroke();
    doc.moveDown(1);
  }

  async salaryCertificatePdf(id: string, dto: SalaryCertificateDto, user: AuthUser): Promise<Buffer> {
    const employee = await this.docEmployee(id, user);
    const profile = employee.staffProfile;
    if (profile.salary == null) {
      throw new BadRequestException("This employee's salary isn't set yet -- add it on the Employee form before generating a certificate");
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 54, size: "A4" });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      this.drawWatermark(doc);
      this.drawLetterhead(doc, profile.school);

      doc.fontSize(14).fillColor("#000").font("Helvetica-Bold").text("SALARY CERTIFICATE", { align: "center" });
      doc.moveDown(1.5);

      doc.fontSize(10).font("Helvetica").fillColor("#000");
      const refDate = dto.date ? new Date(dto.date) : new Date();
      doc.text(`Ref No.: ${dto.refNo ?? "—"}`, { continued: true });
      doc.text(`   Date: ${refDate.toLocaleDateString("en-IN")}`, { align: "right" });
      doc.moveDown(1.5);

      const employmentTypeLabel = profile.employmentType === "TEMPORARY" ? "temporary" : "permanent";
      const salaryPaidByLabel = profile.salaryPaidBy === "COMPANY" ? "the company" : "the school";
      const deptClause = profile.department ? ` in the ${profile.department} department` : "";
      const joinDateLabel = new Date(profile.joinDate).toLocaleDateString("en-IN");
      const salaryLabel = Number(profile.salary).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      doc.fontSize(11).text(
        `This is to certify that ${employee.fullName}, working as ${profile.designation}${deptClause}, `
        + `bearing Employee No. ${profile.employeeNo}, has been employed with ${profile.school.name} since ${joinDateLabel} `
        + `on a ${employmentTypeLabel} basis. Their current monthly gross salary is Rs. ${salaryLabel}/-, paid by ${salaryPaidByLabel}.`,
        { align: "justify", lineGap: 4 },
      );
      doc.moveDown(1);
      doc.text("This certificate is issued upon the employee's request for whatever purpose it may serve.", { align: "justify", lineGap: 4 });

      doc.moveDown(4);
      const sigLeftX = doc.page.margins.left;
      const sigTopY = doc.y;
      doc.text(`For ${profile.school.name},`, sigLeftX, sigTopY);
      doc.moveDown(3);
      doc.text(dto.signatoryName, sigLeftX, doc.y);
      doc.text(dto.signatoryDesignation, sigLeftX, doc.y);
      this.drawSignatureSeals(doc, sigLeftX, sigTopY);

      doc.end();
    });
  }

  /** School.institutionType is a generic label for the org an employee's
   * pay documents are issued from -- SCHOOL isn't always accurate now that
   * Company/Institute/College/Centre exist too, so the slip's info row
   * shows whichever one actually applies. */
  private institutionTypeLabel(type: string): string {
    return { SCHOOL: "School", COLLEGE: "College", INSTITUTE: "Institute", CENTRE: "Center", COMPANY: "Company" }[type] ?? "School";
  }

  async salarySlipPdf(id: string, dto: SalarySlipDto, user: AuthUser): Promise<Buffer> {
    const employee = await this.docEmployee(id, user);
    const profile = employee.staffProfile;
    if (profile.salary == null) {
      throw new BadRequestException("This employee's salary isn't set yet -- add it on the Employee form before generating a slip");
    }

    await this.prisma.salarySlipLog.create({
      data: { tenantId: employee.tenantId, employeeId: employee.id, generatedById: user.id, period: dto.period },
    });

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 54, size: "A4" });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      this.drawLetterhead(doc, profile.school);

      doc.fontSize(13).font("Helvetica-Bold").fillColor("#000").text(`SALARY SLIP — ${dto.period}`, { align: "center" });
      doc.moveDown(1.2);

      doc.fontSize(10).font("Helvetica");
      const infoLeftX = doc.page.margins.left;
      const infoRightX = doc.page.width / 2;
      const infoY = doc.y;
      doc.text(`Employee Name: ${employee.fullName}`, infoLeftX, infoY);
      doc.text(`Employee No.: ${profile.employeeNo}`, infoRightX, infoY);
      doc.text(`Designation: ${profile.designation}`, infoLeftX, infoY + 15);
      doc.text(`Department: ${profile.department ?? "—"}`, infoRightX, infoY + 15);
      const schoolRowY = infoY + 30;
      doc.text(`${this.institutionTypeLabel(profile.school.institutionType)}: ${profile.school.name}`, infoLeftX, schoolRowY);
      doc.text(`Payment Mode: ${dto.paymentMode === "CASH" ? "Cash" : "Bank Transfer"}`, infoRightX, schoolRowY);
      doc.y = schoolRowY + 15;
      doc.moveDown(1.5);

      // Always the employee's own stored salary -- never a caller-supplied
      // figure. No deductions line: this slip isn't a payroll computation
      // tool, just a printable record of the fixed monthly salary on file.
      const grossEarnings = Number(profile.salary);
      const netPay = grossEarnings;
      const inr = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const colWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / 2;
      const leftX = doc.page.margins.left;
      const rightX = leftX + colWidth;
      let tableY = doc.y;

      doc.font("Helvetica-Bold").fontSize(10);
      doc.text("Earnings", leftX, tableY);
      doc.text("Amount (Rs.)", leftX, tableY, { width: colWidth - 10, align: "right" });
      tableY += 18;
      doc.moveTo(leftX, tableY - 4).lineTo(doc.page.width - doc.page.margins.right, tableY - 4).strokeColor("#ccc").stroke();
      doc.font("Helvetica").fontSize(10);

      doc.text("Basic Salary", leftX, tableY, { width: colWidth - 90 });
      doc.text(inr(grossEarnings), leftX, tableY, { width: colWidth - 10, align: "right" });
      tableY += 16;

      tableY += 6;
      doc.moveTo(leftX, tableY).lineTo(doc.page.width - doc.page.margins.right, tableY).strokeColor("#ccc").stroke();
      tableY += 8;
      doc.font("Helvetica-Bold");
      doc.text("Gross Earnings", leftX, tableY, { width: colWidth - 90 });
      doc.text(inr(grossEarnings), leftX, tableY, { width: colWidth - 10, align: "right" });

      doc.y = tableY + 20;
      doc.moveDown(3);
      doc.fontSize(12).text(`Net Pay: Rs. ${inr(netPay)}/-`, { align: "left" });

      doc.moveDown(3);
      doc.fontSize(8).font("Helvetica").fillColor("#888").text("This is a computer-generated salary slip and does not require a signature.", { align: "center" });

      doc.end();
    });
  }
}
