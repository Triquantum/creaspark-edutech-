import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { SupabaseModule } from "./common/supabase/supabase.module";
import { AuthModule } from "./modules/auth/auth.module";
import { StudentsModule } from "./modules/students/students.module";
import { AttendanceModule } from "./modules/attendance/attendance.module";
import { FeesModule } from "./modules/fees/fees.module";
import { AnnouncementsModule } from "./modules/announcements/announcements.module";
import { AcademicModule } from "./modules/academic/academic.module";
import { TeachersModule } from "./modules/teachers/teachers.module";
import { UsersModule } from "./modules/users/users.module";
import { RecordsModule } from "./modules/records/records.module";
import { TenantMiddleware } from "./common/tenancy/tenant.middleware";
import { HealthController } from "./modules/health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    SupabaseModule,
    AuthModule,
    StudentsModule,
    AttendanceModule,
    FeesModule,
    AnnouncementsModule,
    AcademicModule,
    TeachersModule,
    UsersModule,
    RecordsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes("*");
  }
}
