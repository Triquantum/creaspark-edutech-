import type { Request } from "express";

/** Best-effort client IP behind Vercel's proxy -- there's no trust-proxy
 * config, so req.ip alone would return an internal address. */
export function clientIp(req: Request): string | undefined {
  const forwarded = req.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return first?.trim() ?? req.ip;
}
