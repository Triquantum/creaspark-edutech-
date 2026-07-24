import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { passportJwtSecret } from "jwks-rsa";

interface SupabaseJwtPayload {
  sub: string;
  email: string;
  app_metadata?: { role?: string; tenantId?: string };
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        cacheMaxAge: 10 * 60 * 1000,
        rateLimit: true,
        jwksUri: process.env.SUPABASE_JWKS_URL!,
      }),
      audience: "authenticated",
      issuer: `${process.env.SUPABASE_URL!.replace(/\/+$/, "")}/auth/v1`,
      algorithms: ["ES256", "RS256"],
    });
  }

  validate(payload: SupabaseJwtPayload) {
    const { role, tenantId } = payload.app_metadata ?? {};
    if (!role || !tenantId) throw new UnauthorizedException("Account is missing role/tenant setup");
    return { id: payload.sub, tenantId, role, email: payload.email };
  }
}
