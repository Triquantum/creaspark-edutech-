import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Role } from "@educore/database";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { SupabaseAdminService } from "../../common/supabase/supabase-admin.service";
import { AuthUser } from "../../common/decorators/current-user.decorator";
import { RegisterSchoolDto } from "./dto/login.dto";

const LOGIN_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes — just long enough to pick an account and type a password

// Derived once per process from the Supabase service secret — never persisted or logged.
const LOGIN_TOKEN_KEY = createHash("sha256").update(`login-token-enc:${process.env.SUPABASE_SECRET_KEY}`).digest();

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private supabaseAdmin: SupabaseAdminService) {}

  async me(user: AuthUser) {
    const [dbUser, tenant] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: user.id }, select: { fullName: true } }),
      this.prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { name: true } }),
    ]);
    return { ...user, fullName: dbUser?.fullName, tenantName: tenant?.name };
  }

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

  /** AES-256-GCM encrypts {email, exp} so the frontend can carry "which
   * login" between the lookup and sign-in steps without us ever handing a
   * real email address to an unauthenticated caller. A signature alone
   * (HMAC) would only prevent tampering — the payload would still be
   * plainly base64-decodable — so this needs actual encryption, not just
   * signing, to keep the email hidden. Not a session credential by
   * itself — signInWithToken() still requires the correct password. */
  private signLoginToken(email: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", LOGIN_TOKEN_KEY, iv);
    const payload = JSON.stringify({ email, exp: Date.now() + LOGIN_TOKEN_TTL_MS });
    const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv, encrypted, authTag].map((b) => b.toString("base64url")).join(".");
  }

  private verifyLoginToken(token: string): string {
    const [ivB64, dataB64, tagB64] = token.split(".");
    if (!ivB64 || !dataB64 || !tagB64) throw new UnauthorizedException("Invalid or expired login link");
    try {
      const decipher = createDecipheriv("aes-256-gcm", LOGIN_TOKEN_KEY, Buffer.from(ivB64, "base64url"));
      decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
      const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]);
      const { email, exp } = JSON.parse(decrypted.toString("utf8"));
      if (Date.now() > exp) throw new UnauthorizedException("This login link has expired — look up the admission number again");
      return email;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException("Invalid or expired login link");
    }
  }

  /**
   * Public, pre-login lookup: an admission number can be shared by the
   * student's own account and their guardians', so this returns every
   * matching login as a labelled choice — the frontend shows a picker,
   * then signInWithToken() checks the password server-side. Real email
   * addresses never reach the browser; each account is identified by an
   * opaque signed token instead, so an anonymous caller who guesses or
   * enumerates admission numbers can't harvest guardians' real emails.
   * Admission numbers are only unique per school, not globally, so a
   * given number can also legitimately match students at different
   * schools nationally; the school name in each label disambiguates that.
   */
  async lookupByAdmission(admissionNoRaw: string) {
    const admissionNo = admissionNoRaw.trim();
    if (!admissionNo) throw new BadRequestException("Admission number is required");

    const students = await this.prisma.student.findMany({
      where: { admissionNo },
      include: {
        user: { select: { email: true } },
        guardians: { include: { user: { select: { email: true } } } },
        school: { select: { name: true } },
      },
    });

    const accounts: { label: string; token: string }[] = [];
    for (const s of students) {
      if (s.user) accounts.push({ label: `${s.firstName} ${s.lastName} (Student, ${s.school.name})`, token: this.signLoginToken(s.user.email) });
      for (const g of s.guardians) {
        if (g.user) accounts.push({ label: `${g.fullName} (${g.relation}, ${s.school.name})`, token: this.signLoginToken(g.user.email) });
      }
    }
    return { accounts };
  }

  /** Verifies the token from lookupByAdmission() and checks the password
   * against Supabase directly — the real credential check still happens
   * at Supabase, we just relay it server-side so the email stays hidden. */
  async signInWithToken(token: string, password: string) {
    const email = this.verifyLoginToken(token);
    return this.supabaseAdmin.verifyPassword(email, password);
  }
}
