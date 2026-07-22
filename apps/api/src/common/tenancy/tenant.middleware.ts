import { Injectable, NestMiddleware, NotFoundException } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import { tenantStorage } from "./tenant-context";
import { SupabaseJwtVerifier } from "../supabase/verify-jwt";

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
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: claims.tenantId }, select: { id: true, slug: true, status: true },
      });
      if (!tenant || tenant.status === "SUSPENDED") throw new NotFoundException("Unknown or suspended tenant");
      return tenantStorage.run({ tenantId: tenant.id, tenantSlug: tenant.slug }, next);
    }

    const slug = (req.headers["x-tenant"] as string | undefined)?.toLowerCase();
    if (!slug) return next(); // public/unscoped route

    const tenant = await this.prisma.tenant.findUnique({ where: { slug }, select: { id: true, slug: true, status: true } });
    if (!tenant || tenant.status === "SUSPENDED") throw new NotFoundException("Unknown or suspended tenant");

    tenantStorage.run({ tenantId: tenant.id, tenantSlug: tenant.slug }, next);
  }
}
