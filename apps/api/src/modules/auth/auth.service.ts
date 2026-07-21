import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  private verifyPassword(stored: string, supplied: string) {
    const [salt, hash] = stored.split(":");
    const candidate = scryptSync(supplied, salt, 64);
    return timingSafeEqual(Buffer.from(hash, "hex"), candidate);
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
}
