import { AsyncLocalStorage } from "async_hooks";

export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  /** Set only when the request carried a verified X-Active-Grant override. */
  schoolId?: string;
  /** Best-effort client IP, captured once per request -- lets any
   * auditLog.create() call attach it without threading @Req() through
   * every controller/service method. */
  ip?: string;
}

/**
 * Request-scoped tenant context. Every DB query in tenant-scoped
 * services must read tenantId from here — never from client input —
 * which guarantees row-level isolation between schools/organizations.
 */
export const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function currentTenant(): TenantContext {
  const ctx = tenantStorage.getStore();
  if (!ctx) throw new Error("Tenant context missing — request did not pass TenantMiddleware");
  return ctx;
}

/** Undefined outside a request (e.g. a script) or on the rare unscoped
 * public route that skips TenantMiddleware's tenantStorage.run() entirely. */
export function currentIp(): string | undefined {
  return tenantStorage.getStore()?.ip;
}
