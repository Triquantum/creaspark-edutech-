import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes, scryptSync } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { CreateUserDto, QueryUsersDto, UpdateUserDto } from "./users.dto";

function hashPassword(pw: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
}

const USER_LIST_SELECT = {
  id: true, fullName: true, email: true, phone: true, role: true,
  isActive: true, lastLoginAt: true, createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async list(query: QueryUsersDto) {
    const { tenantId } = currentTenant();
    return this.prisma.user.findMany({
      where: {
        tenantId,
        ...(query.role && { role: query.role }),
        ...(query.q && {
          OR: [
            { fullName: { contains: query.q, mode: "insensitive" as const } },
            { email: { contains: query.q, mode: "insensitive" as const } },
          ],
        }),
      },
      select: USER_LIST_SELECT,
      orderBy: { fullName: "asc" },
      take: 200,
    });
  }

  /** Registers a login for any role; returns a temp password once if none was supplied. */
  async create(dto: CreateUserDto, actorId: string) {
    const { tenantId } = currentTenant();
    const email = dto.email.trim().toLowerCase();

    const taken = await this.prisma.user.findUnique({ where: { tenantId_email: { tenantId, email } } });
    if (taken) throw new ConflictException(`A user with email ${email} already exists`);

    const tempPassword = dto.password ?? `Cs@${randomBytes(4).toString("hex")}`;

    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          tenantId, email, fullName: dto.fullName.trim(), phone: dto.phone,
          role: dto.role, passwordHash: hashPassword(tempPassword),
        },
        select: USER_LIST_SELECT,
      });
      await tx.auditLog.create({
        data: { tenantId, userId: actorId, action: "user.register", entity: "User", entityId: u.id, metadata: { role: dto.role } },
      });
      return u;
    });

    return {
      ...user,
      // Returned exactly once so the admin can hand it over; never retrievable again.
      ...(dto.password ? {} : { tempPassword }),
    };
  }

  private async findUser(id: string) {
    const { tenantId } = currentTenant();
    const user = await this.prisma.user.findFirst({ where: { id, tenantId }, select: USER_LIST_SELECT });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const { tenantId } = currentTenant();
    await this.findUser(id);

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
        data: { tenantId, userId: actorId, action: "user.update", entity: "User", entityId: id },
      }),
    ]);
    return this.findUser(id);
  }

  /** Generates a fresh temp password so a locked-out user can sign in again. */
  async resetPassword(id: string, actorId: string) {
    const { tenantId } = currentTenant();
    await this.findUser(id);
    const tempPassword = `Cs@${randomBytes(4).toString("hex")}`;

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { passwordHash: hashPassword(tempPassword) } }),
      this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.auditLog.create({
        data: { tenantId, userId: actorId, action: "user.reset-password", entity: "User", entityId: id },
      }),
    ]);
    return { tempPassword };
  }

  async remove(id: string, actorId: string) {
    if (id === actorId) throw new BadRequestException("You can't delete your own account");
    const { tenantId } = currentTenant();
    const user = await this.findUser(id);

    await this.prisma.$transaction([
      this.prisma.user.delete({ where: { id } }), // refresh + reset tokens cascade
      this.prisma.auditLog.create({
        data: {
          tenantId, userId: actorId, action: "user.delete", entity: "User", entityId: id,
          metadata: { email: user.email, name: user.fullName, role: user.role },
        },
      }),
    ]);
    return { deleted: true };
  }
}
