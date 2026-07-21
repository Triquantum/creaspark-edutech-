import { AsyncLocalStorage } from "async_hooks";

export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
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
