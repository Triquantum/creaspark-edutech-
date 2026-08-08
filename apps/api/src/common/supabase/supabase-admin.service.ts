import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Role } from "@educore/database";

export interface AdminUserMeta {
  role: Role;
  tenantId: string;
}

/** Wraps Supabase's Auth Admin API — the source of truth for credentials/sessions. */
@Injectable()
export class SupabaseAdminService {
  private client: SupabaseClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  /** role/tenantId travel in app_metadata so every future JWT for this user carries them. */
  async createUser(email: string, password: string, meta: AdminUserMeta) {
    const { data, error } = await this.client.auth.admin.createUser({
      email, password, email_confirm: true, app_metadata: meta,
    });
    if (error) throw new BadRequestException(error.message);
    return data.user;
  }

  async updateAppMetadata(userId: string, meta: Partial<AdminUserMeta>) {
    const { error } = await this.client.auth.admin.updateUserById(userId, { app_metadata: meta });
    if (error) throw new BadRequestException(error.message);
  }

  async setPassword(userId: string, password: string) {
    const { error } = await this.client.auth.admin.updateUserById(userId, { password });
    if (error) throw new BadRequestException(error.message);
  }

  async updateEmail(userId: string, email: string) {
    const { error } = await this.client.auth.admin.updateUserById(userId, { email, email_confirm: true });
    if (error) throw new BadRequestException(error.message);
  }

  /** Blocks sign-in without deleting the identity — backs the "Inactive" status. */
  async setBanned(userId: string, banned: boolean) {
    const { error } = await this.client.auth.admin.updateUserById(userId, {
      ban_duration: banned ? "87600h" : "none",
    });
    if (error) throw new BadRequestException(error.message);
  }

  async deleteUser(userId: string) {
    const { error } = await this.client.auth.admin.deleteUser(userId);
    if (error) throw new BadRequestException(error.message);
  }

  /** Checks a password server-side (used by the admission-number login
   * flow, where the frontend never sees the real email to sign in with
   * directly). Supabase itself still verifies the credential — this just
   * relays the standard password grant. */
  async verifyPassword(email: string, password: string) {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error || !data.session) throw new UnauthorizedException("Invalid email/admission number or password");
    return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
  }

  /** Uploads to a private bucket using the service-role client, which
   * bypasses RLS -- the bucket itself carries no public/anon access, so
   * this is the only way in or out (see getSignedUrl for reads). */
  async uploadPrivateFile(bucket: string, path: string, data: Buffer, contentType: string) {
    const { error } = await this.client.storage.from(bucket).upload(path, data, { contentType, upsert: true });
    if (error) throw new BadRequestException(error.message);
  }

  /** Short-lived signed URL for a private-bucket object -- generated fresh
   * per request rather than stored, so access can't outlive the caller's
   * own permission check on the log row. */
  async getSignedUrl(bucket: string, path: string, expiresInSeconds = 300) {
    const { data, error } = await this.client.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
    if (error || !data) throw new BadRequestException(error?.message ?? "Could not create signed URL");
    return data.signedUrl;
  }
}
