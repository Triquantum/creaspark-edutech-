import { Injectable, NestMiddleware, NotFoundException } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import { tenantStorage } from "./tenant-context";

/**
 * Resolves the tenant from (in priority order):
 *   1. X-Tenant header (used by web app / mobile)
 *   2. Subdomain: {slug}.educore.in
 * Public routes (auth, health, docs) that carry a tenant hint still
 * resolve it; routes without one run with a "public" no-tenant scope.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const headerSlug = (req.headers["x-tenant"] as string | undefined)?.toLowerCase();
    const hostSlug = req.hostname?.split(".")[0];
    const slug = headerSlug || (hostSlug && hostSlug !== "localhost" && hostSlug !== "www" ? hostSlug : undefined);

    if (!slug) return next(); // public/unscoped route

    const tenant = await this.prisma.tenant.findUnique({ where: { slug }, select: { id: true, slug: true, status: true } });
    if (!tenant || tenant.status === "SUSPENDED") throw new NotFoundException("Unknown or suspended tenant");

    tenantStorage.run({ tenantId: tenant.id, tenantSlug: tenant.slug }, next);
  }
}
