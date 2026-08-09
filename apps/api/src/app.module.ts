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
import { TeacherAssignmentsModule } from "./modules/teacher-assignments/teacher-assignments.module";
import { ParentsModule } from "./modules/parents/parents.module";
import { UsersModule } from "./modules/users/users.module";
import { RecordsModule } from "./modules/records/records.module";
import { EventsModule } from "./modules/events/events.module";
import { MessagesModule } from "./modules/messages/messages.module";
import { ExamsModule } from "./modules/exams/exams.module";
import { PlatformModule } from "./modules/platform/platform.module";
import { VisitorsModule } from "./modules/visitors/visitors.module";
import { PortionModule } from "./modules/portion/portion.module";
import { LessonsModule } from "./modules/lessons/lessons.module";
import { AssignmentsModule } from "./modules/assignments/assignments.module";
import { QuizzesModule } from "./modules/quizzes/quizzes.module";
import { MediaModule } from "./modules/media/media.module";
import { InventoryItemModule } from "./modules/inventory-item/inventory-item.module";
import { TasksModule } from "./modules/tasks/tasks.module";
import { EmployeesModule } from "./modules/employees/employees.module";
import { TrainingsModule } from "./modules/trainings/trainings.module";
import { HolidaysModule } from "./modules/holidays/holidays.module";
import { AssetsModule } from "./modules/assets/assets.module";
import { SalesModule } from "./modules/sales/sales.module";
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
    TeacherAssignmentsModule,
    ParentsModule,
    UsersModule,
    RecordsModule,
    EventsModule,
    MessagesModule,
    ExamsModule,
    PlatformModule,
    VisitorsModule,
    PortionModule,
    LessonsModule,
    AssignmentsModule,
    QuizzesModule,
    MediaModule,
    InventoryItemModule,
    TasksModule,
    EmployeesModule,
    TrainingsModule,
    HolidaysModule,
    AssetsModule,
    SalesModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes("*");
  }
}
