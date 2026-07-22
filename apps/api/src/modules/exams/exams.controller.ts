import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@educore/database";
import { ExamsService } from "./exams.service";
import { CreateExamDto, RecordResultsDto } from "./exams.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";

@ApiTags("exams")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("exams")
export class ExamsController {
  constructor(private exams: ExamsService) {}

  @Get()
  @Roles(Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.COORDINATOR, Role.TEACHER, Role.ACCOUNTANT)
  list() {
    return this.exams.list();
  }

  @Post()
  @Roles(Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.COORDINATOR)
  create(@Body() dto: CreateExamDto, @CurrentUser() user: AuthUser) {
    return this.exams.create(dto, user.id);
  }

  @Post("results")
  @Roles(Role.SCHOOL_ADMIN, Role.TEACHER)
  recordResults(@Body() dto: RecordResultsDto, @CurrentUser() user: AuthUser) {
    return this.exams.recordResults(dto, user.id);
  }

  /** No @Roles: any authenticated user may call this, but the service scopes
   * results to their own linked student (STUDENT), their children (PARENT),
   * or the requested student (staff — the RolesGuard on other exam routes
   * already gates who can reach a studentId that isn't their own). */
  @Get("progress")
  progress(@CurrentUser() user: AuthUser, @Query("studentId") studentId?: string) {
    return this.exams.progress(user, studentId);
  }
}
