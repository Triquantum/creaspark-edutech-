import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { Role } from "@educore/database";
import { PrismaService } from "../../prisma/prisma.service";
import { SupabaseAdminService } from "../../common/supabase/supabase-admin.service";
import { RegisterSchoolDto } from "./dto/login.dto";

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private supabaseAdmin: SupabaseAdminService) {}

  /**
   * Self-service tenant signup: creates an isolated Tenant + School, then
   * the Supabase Auth identity for its first SCHOOL_ADMIN (role/tenantId
   * travel in app_metadata so every JWT they get carries them), and
   * mirrors a row into our own User table for relational queries. The
   * frontend signs in via supabase-js with the same credentials right
   * after this succeeds — creating an auth user doesn't issue a session.
   */
  async registerSchool(dto: RegisterSchoolDto) {
    const slug = dto.schoolCode.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/(^-|-$)/g, "");
    if (!slug) throw new BadRequestException("School code must contain letters or numbers");

    const [tenantClash, emailTaken] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { slug } }),
      this.prisma.user.findUnique({ where: { email: dto.adminEmail.trim().toLowerCase() } }),
    ]);
    if (tenantClash) throw new ConflictException(`School code "${slug}" is already taken`);
    if (emailTaken) throw new ConflictException(`A user with email ${dto.adminEmail} already exists`);

    const email = dto.adminEmail.trim().toLowerCase();
    const schoolName = dto.schoolName.trim();

    const tenant = await this.prisma.tenant.create({ data: { name: schoolName, slug } });
    await this.prisma.school.create({ data: { tenantId: tenant.id, name: schoolName, code: slug.toUpperCase() } });

    try {
      const authUser = await this.supabaseAdmin.createUser(email, dto.adminPassword, {
        role: Role.SCHOOL_ADMIN, tenantId: tenant.id,
      });
      const user = await this.prisma.user.create({
        data: { id: authUser.id, tenantId: tenant.id, email, fullName: dto.adminFullName.trim(), role: Role.SCHOOL_ADMIN },
      });
      await this.prisma.auditLog.create({
        data: { tenantId: tenant.id, userId: user.id, action: "tenant.register", entity: "Tenant", entityId: tenant.id },
      });
      return { tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name } };
    } catch (err) {
      // Roll back the empty tenant/school so the school code is free to retry.
      await this.prisma.school.deleteMany({ where: { tenantId: tenant.id } });
      await this.prisma.tenant.delete({ where: { id: tenant.id } });
      throw err;
    }
  }
}
