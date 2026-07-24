import { Injectable } from "@nestjs/common";
import * as jwt from "jsonwebtoken";
import { JwksClient } from "jwks-rsa";

export interface SupabaseClaims {
  sub: string;
  email: string;
  /** Our app Role, read from app_metadata — not Supabase's own top-level "authenticated" role claim. */
  role: string;
  tenantId: string;
}

@Injectable()
export class SupabaseJwtVerifier {
  private client = new JwksClient({
    jwksUri: process.env.SUPABASE_JWKS_URL!,
    cache: true,
    cacheMaxAge: 10 * 60 * 1000,
  });

  async verify(token: string): Promise<SupabaseClaims | null> {
    try {
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded.payload === "string" || !decoded.header.kid) return null;

      const key = await this.client.getSigningKey(decoded.header.kid);
      const payload = jwt.verify(token, key.getPublicKey(), {
        audience: "authenticated",
        issuer: `${process.env.SUPABASE_URL!.replace(/\/+$/, "")}/auth/v1`,
      }) as jwt.JwtPayload;

      const appMeta = (payload.app_metadata ?? {}) as { role?: string; tenantId?: string };
      if (!payload.sub || !payload.email || !appMeta.role || !appMeta.tenantId) return null;

      return { sub: payload.sub, email: payload.email as string, role: appMeta.role, tenantId: appMeta.tenantId };
    } catch {
      return null;
    }
  }
}
