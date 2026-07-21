import { Global, Module } from "@nestjs/common";
import { SupabaseAdminService } from "./supabase-admin.service";
import { SupabaseJwtVerifier } from "./verify-jwt";

@Global()
@Module({
  providers: [SupabaseAdminService, SupabaseJwtVerifier],
  exports: [SupabaseAdminService, SupabaseJwtVerifier],
})
export class SupabaseModule {}
