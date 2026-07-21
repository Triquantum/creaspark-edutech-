import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Role } from "@educore/database";
import { randomBytes, scryptSync } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { CreateTeacherDto, UpdateTeacherDto } from "./teachers.dto";

function hashPassword(pw: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
}

@Injectable()
export class TeachersService {
  constructor(private prisma: PrismaService) {}

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

  /** Creates the login user and staff profile atomically; returns a temp password once if none was supplied. */
  async create(dto: CreateTeacherDto, actorId: string) {
    const { tenantId } = currentTenant();

    const [emailTaken, empTaken] = await Promise.all([
      this.prisma.user.findUnique({ where: { tenantId_email: { tenantId, email: dto.email } } }),
      this.prisma.staffProfile.findUnique({ where: { schoolId_employeeNo: { schoolId: dto.schoolId, employeeNo: dto.employeeNo } } }),
    ]);
    if (emailTaken) throw new ConflictException(`A user with email ${dto.email} already exists`);
    if (empTaken) throw new ConflictException(`Employee no. ${dto.employeeNo} already exists in this school`);

    const tempPassword = dto.password ?? `Cs@${randomBytes(4).toString("hex")}`;

    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          tenantId, email: dto.email, phone: dto.phone, fullName: dto.fullName,
          role: Role.TEACHER, passwordHash: hashPassword(tempPassword),
        },
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
      const clash = await this.prisma.user.findUnique({ where: { tenantId_email: { tenantId, email: dto.email } } });
      if (clash) throw new ConflictException(`A user with email ${dto.email} already exists`);
    }
    if (dto.employeeNo && user.staffProfile && dto.employeeNo !== user.staffProfile.employeeNo) {
      const clash = await this.prisma.staffProfile.findUnique({
        where: { schoolId_employeeNo: { schoolId: user.staffProfile.schoolId, employeeNo: dto.employeeNo } },
      });
      if (clash) throw new ConflictException(`Employee no. ${dto.employeeNo} already exists in this school`);
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
    await this.prisma.$transaction([
      this.prisma.staffProfile.deleteMany({ where: { userId: id } }),
      this.prisma.user.delete({ where: { id } }), // refresh tokens cascade
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
