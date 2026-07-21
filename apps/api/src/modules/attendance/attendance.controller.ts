import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@educore/database";
import { AttendanceService, MarkAttendanceInput } from "./attendance.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";

@ApiTags("attendance")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("attendance")
export class AttendanceController {
  constructor(private attendance: AttendanceService) {}

  @Post("mark")
  @Roles(Role.TEACHER, Role.SCHOOL_ADMIN, Role.COORDINATOR)
  mark(@Body() body: MarkAttendanceInput, @CurrentUser() user: AuthUser) {
    return this.attendance.markSection(body, user.id);
  }

  @Get("summary")
  @Roles(Role.TEACHER, Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.COORDINATOR)
  summary(@Query("sectionId") sectionId: string, @Query("from") from: string, @Query("to") to: string) {
    return this.attendance.sectionSummary(sectionId, from, to);
  }

  @Get("today")
  @Roles(Role.TEACHER, Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.COORDINATOR)
  today() {
    return this.attendance.todaySummary();
  }
}
