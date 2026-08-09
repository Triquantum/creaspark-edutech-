import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { UnauthorizedException } from "@nestjs/common";

// 12 hours -- long enough for one working session's worth of a tab staying
// on a switched role/school, short enough that a stale token can't linger
// indefinitely. Re-verified against the live UserAccess row on every
// request regardless, so this TTL only bounds the encrypted pointer itself.
const SWITCH_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

// Distinct namespace string from the admission-login token (auth.service.ts)
// so the two token types can never be decrypted/replayed as each other,
// even though both derive from the same SUPABASE_SECRET_KEY.
const SWITCH_TOKEN_KEY = createHash("sha256").update(`switch-context-enc:${process.env.SUPABASE_SECRET_KEY}`).digest();

export interface SwitchContextPayload {
  userId: string;
  grantId: string;
}

/** Encrypts {userId, grantId, exp} -- deliberately carries no role/tenantId/
 * schoolId itself. Every caller (TenantMiddleware) re-fetches the live
 * UserAccess row by grantId on every request, so a revoked or deactivated
 * grant stops working immediately rather than only at next token mint. */
export function signSwitchToken(payload: SwitchContextPayload): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", SWITCH_TOKEN_KEY, iv);
  const json = JSON.stringify({ ...payload, exp: Date.now() + SWITCH_TOKEN_TTL_MS });
  const encrypted = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, encrypted, authTag].map((b) => b.toString("base64url")).join(".");
}

export function verifySwitchToken(token: string): SwitchContextPayload {
  const [ivB64, dataB64, tagB64] = token.split(".");
  if (!ivB64 || !dataB64 || !tagB64) throw new UnauthorizedException("Invalid active-grant token");
  try {
    const decipher = createDecipheriv("aes-256-gcm", SWITCH_TOKEN_KEY, Buffer.from(ivB64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]);
    const { userId, grantId, exp } = JSON.parse(decrypted.toString("utf8"));
    if (Date.now() > exp) throw new UnauthorizedException("Active grant has expired -- switch context again");
    return { userId, grantId };
  } catch (err) {
    if (err instanceof UnauthorizedException) throw err;
    throw new UnauthorizedException("Invalid active-grant token");
  }
}
