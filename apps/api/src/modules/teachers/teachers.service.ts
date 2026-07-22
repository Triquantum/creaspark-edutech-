import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Role } from "@educore/database";
import { randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { SupabaseAdminService } from "../../common/supabase/supabase-admin.service";
import { CreateTeacherDto, UpdateTeacherDto } from "./teachers.dto";

@Injectable()
export class TeachersService {
  constructor(private prisma: PrismaService, private supabaseAdmin: SupabaseAdminService) {}

  async list(q?: string) {
    const { tenantId } = currentTenant();
    return this.prisma.user.findMany({
      where: {
        tenantId,
        role: Role.TEACHER,
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
        staffProfile: { select: { employeeNo: true, designation: true, department: true, joinDate: true } },
      },
      orderBy: { fullName: "asc" },
      take: 100,
    });
  }

  /** Creates the login and staff profile; returns a temp password once if none was supplied. */
  async create(dto: CreateTeacherDto, actorId: string) {
    const { tenantId } = currentTenant();

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

    const user = await this.prisma.$transaction(async (tx) => {
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
      id: user.id, fullName: user.fullName, email: user.email,
      // Returned exactly once so the admin can hand it over; never retrievable again.
      ...(dto.password ? {} : { tempPassword }),
    };
  }

  private async findTeacher(id: string) {
    const { tenantId } = currentTenant();
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId, role: Role.TEACHER },
      include: { staffProfile: true },
    });
    if (!user) throw new NotFoundException("Teacher not found");
    return user;
  }

  async update(id: string, dto: UpdateTeacherDto, actorId: string) {
    const { tenantId } = currentTenant();
    const user = await this.findTeacher(id);

    if (dto.email && dto.email !== user.email) {
      const clash = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (clash) throw new ConflictException(`A user with email ${dto.email} already exists`);
      await this.supabaseAdmin.updateEmail(id, dto.email);
    }
    if (dto.employeeNo && user.staffProfile && dto.employeeNo !== user.staffProfile.employeeNo) {
      const clash = await this.prisma.staffProfile.findUnique({
        where: { schoolId_employeeNo: { schoolId: user.staffProfile.schoolId, employeeNo: dto.employeeNo } },
      });
      if (clash) throw new ConflictException(`Employee no. ${dto.employeeNo} already exists in this school`);
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
      if (user.staffProfile && (dto.employeeNo || dto.designation || dto.department !== undefined)) {
        await tx.staffProfile.update({
          where: { userId: id },
          data: {
            ...(dto.employeeNo && { employeeNo: dto.employeeNo }),
            ...(dto.designation && { designation: dto.designation }),
            ...(dto.department !== undefined && { department: dto.department }),
          },
        });
      }
      await tx.auditLog.create({
        data: { tenantId, userId: actorId, action: "teacher.update", entity: "User", entityId: id },
      });
    });
    return this.findTeacher(id);
  }

  /** Removes login + staff profile. Historical records (attendance they marked, etc.) keep their reference by id. */
  async remove(id: string, actorId: string) {
    const { tenantId } = currentTenant();
    const user = await this.findTeacher(id);

    await this.supabaseAdmin.deleteUser(id);
    await this.prisma.$transaction([
      this.prisma.staffProfile.deleteMany({ where: { userId: id } }),
      this.prisma.user.delete({ where: { id } }),
      this.prisma.auditLog.create({
        data: {
          tenantId, userId: actorId, action: "teacher.delete", entity: "User", entityId: id,
          metadata: { email: user.email, name: user.fullName },
        },
      }),
    ]);
    return { deleted: true };
  }
}
