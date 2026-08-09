import { Injectable, NestMiddleware, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import { tenantStorage } from "./tenant-context";
import { SupabaseJwtVerifier } from "../supabase/verify-jwt";
import { verifySwitchToken } from "../auth/switch-context-token";

export interface ActiveGrantOverride {
  tenantId: string;
  schoolId?: string;
  role: string;
  grantId: string;
}

/**
 * Resolves the tenant scope for the request:
 *   1. A verified Bearer JWT's own tenantId claim — trusted and not
 *      client-suppliable. Closes a cross-tenant leak where a spoofed
 *      X-Tenant header could otherwise point a valid session at
 *      another school's data.
 *   2. Falls back to an explicit X-Tenant header, used only when no
 *      session exists yet (e.g. registering a brand new school).
 *      Deliberately NOT inferred from the request hostname — this API
 *      is served from one shared domain, not per-tenant subdomains.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService, private jwt: SupabaseJwtVerifier) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
    const claims = token ? await this.jwt.verify(token) : null;

    if (claims) {
      let tenantId = claims.tenantId;

      // Optional per-request identity override for a caller who holds
      // multiple UserAccess grants (e.g. Teacher at School A, School Admin
      // at School B). The token itself carries no role/tenant data -- only
      // a grantId pointer -- so a grant that's been deactivated since the
      // token was minted stops working on the very next request, not just
      // at next mint. Any failure here fails the whole request closed
      // (401), matching every grant so far in this design -- it never
      // silently falls back to the caller's primary identity, since that
      // would let a request proceed under an identity the client didn't
      // actually ask for.
      const grantHeader = req.headers["x-active-grant"] as string | undefined;
      let activeGrant: ActiveGrantOverride | undefined;
      if (grantHeader) {
        const { userId, grantId } = verifySwitchToken(grantHeader);
        if (userId !== claims.sub) throw new UnauthorizedException("Active grant does not belong to this session");
        const grant = await this.prisma.userAccess.findUnique({ where: { id: grantId } });
        if (!grant || grant.userId !== claims.sub || !grant.isActive) {
          throw new UnauthorizedException("This role/school is no longer available -- switch context again");
        }
        tenantId = grant.tenantId;
        activeGrant = { tenantId: grant.tenantId, schoolId: grant.schoolId ?? undefined, role: grant.role, grantId: grant.id };
        (req as Request & { activeGrant?: ActiveGrantOverride }).activeGrant = activeGrant;
      }

      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId }, select: { id: true, slug: true, status: true },
      });
      if (!tenant || tenant.status === "SUSPENDED") throw new NotFoundException("Unknown or suspended tenant");
      return tenantStorage.run({ tenantId: tenant.id, tenantSlug: tenant.slug, schoolId: activeGrant?.schoolId }, () => next());
    }

    const slug = (req.headers["x-tenant"] as string | undefined)?.toLowerCase();
    if (!slug) return next(); // public/unscoped route

    const tenant = await this.prisma.tenant.findUnique({ where: { slug }, select: { id: true, slug: true, status: true } });
    if (!tenant || tenant.status === "SUSPENDED") throw new NotFoundException("Unknown or suspended tenant");

    tenantStorage.run({ tenantId: tenant.id, tenantSlug: tenant.slug }, () => next());
  }
}
