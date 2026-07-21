import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Role } from "@educore/database";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { RegisterSchoolDto } from "./dto/login.dto";

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  private verifyPassword(stored: string, supplied: string) {
    const [salt, hash] = stored.split(":");
    const candidate = scryptSync(supplied, salt, 64);
    return timingSafeEqual(Buffer.from(hash, "hex"), candidate);
  }

  private hashPassword(pw: string) {
    const salt = randomBytes(16).toString("hex");
    return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
  }

  async login(email: string, password: string) {
    const { tenantId } = currentTenant();
    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    if (!user || !user.isActive || !this.verifyPassword(user.passwordHash, password)) {
      throw new UnauthorizedException("Invalid credentials");
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.prisma.auditLog.create({
      data: { tenantId, userId: user.id, action: "auth.login", entity: "User", entityId: user.id },
    });

    return this.issueTokens(user.id, tenantId, user.role, user.email, user.fullName);
  }

  private async issueTokens(userId: string, tenantId: string, role: string, email: string, fullName: string) {
    const accessToken = await this.jwt.signAsync({ sub: userId, tenantId, role, email });

    const raw = randomBytes(48).toString("hex");
    const tokenHash = createHash("sha256").update(raw).digest("hex");
    const ttl = Number(process.env.JWT_REFRESH_TTL ?? 2_592_000);
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt: new Date(Date.now() + ttl * 1000) },
    });

    return { accessToken, refreshToken: raw, user: { id: userId, role, email, fullName } };
  }

  async refresh(raw: string) {
    const tokenHash = createHash("sha256").update(raw).digest("hex");
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash }, include: { user: true },
    });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token invalid");
    }
    // Rotation: revoke old, issue new
    await this.prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
    const u = record.user;
    return this.issueTokens(u.id, u.tenantId, u.role, u.email, u.fullName);
  }

  /**
   * Always returns a generic message so the caller can't enumerate which
   * emails have accounts. No SMTP is configured in this environment, so
   * outside production the raw token is included in the response to keep
   * the reset flow testable end-to-end.
   */
  async requestReset(email: string) {
    const { tenantId } = currentTenant();
    const message = "If an account exists for that email, a password reset has been generated.";
    const user = await this.prisma.user.findUnique({ where: { tenantId_email: { tenantId, email } } });
    if (!user || !user.isActive) return { message };

    const raw = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(raw).digest("hex");
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
    });
    await this.prisma.auditLog.create({
      data: { tenantId, userId: user.id, action: "auth.request-reset", entity: "User", entityId: user.id },
    });

    return { message, ...(process.env.NODE_ENV !== "production" && { resetToken: raw }) };
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException("Reset link is invalid or has expired");
    }

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash: this.hashPassword(newPassword) } }),
      this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return { message: "Password updated. Sign in with your new password." };
  }

  /**
   * Self-service tenant signup: creates an isolated Tenant + School + its
   * first SCHOOL_ADMIN login, then signs them straight in. Every table is
   * already tenant-scoped, so the new school's students/teachers/parents/
   * users are automatically independent of every other school — including
   * one sharing the exact same admin email, since uniqueness is per-tenant.
   */
  async registerSchool(dto: RegisterSchoolDto) {
    const slug = dto.schoolCode.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/(^-|-$)/g, "");
    if (!slug) throw new BadRequestException("School code must contain letters or numbers");

    const clash = await this.prisma.tenant.findUnique({ where: { slug } });
    if (clash) throw new ConflictException(`School code "${slug}" is already taken`);

    const email = dto.adminEmail.trim().toLowerCase();
    const schoolName = dto.schoolName.trim();

    const { tenant, user } = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { name: schoolName, slug } });
      await tx.school.create({ data: { tenantId: tenant.id, name: schoolName, code: slug.toUpperCase() } });
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id, email, fullName: dto.adminFullName.trim(),
          role: Role.SCHOOL_ADMIN, passwordHash: this.hashPassword(dto.adminPassword),
        },
      });
      await tx.auditLog.create({
        data: { tenantId: tenant.id, userId: user.id, action: "tenant.register", entity: "Tenant", entityId: tenant.id },
      });
      return { tenant, user };
    });

    const tokens = await this.issueTokens(user.id, tenant.id, user.role, user.email, user.fullName);
    return { ...tokens, tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name } };
  }
}
