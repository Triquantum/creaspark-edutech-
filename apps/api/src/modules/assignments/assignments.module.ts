import { Body, Controller, Delete, Get, Module, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@educore/database";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";
import { AssignmentsService } from "./assignments.service";
import { ADMIN_ROLES } from "../../common/access/content-access";
import { CreateAssignmentDto, UpdateAssignmentDto, QueryAssignmentsDto, SubmitAssignmentDto, GradeSubmissionDto } from "./assignments.dto";

const MANAGE_ROLES = [Role.TEACHER, ...ADMIN_ROLES] as const;

@ApiTags("assignments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("assignments")
export class AssignmentsController {
  constructor(private svc: AssignmentsService) {}

  @Get()
  list(@Query() query: QueryAssignmentsDto, @CurrentUser() user: AuthUser) {
    return this.svc.list(user, query);
  }

  @Post()
  @Roles(Role.TEACHER)
  create(@Body() dto: CreateAssignmentDto, @CurrentUser() user: AuthUser) {
    return this.svc.create(dto, user);
  }

  @Get(":id")
  get(@Param("id") id: string, @Query("studentId") studentId: string | undefined, @CurrentUser() user: AuthUser) {
    return this.svc.get(id, user, studentId);
  }

  @Patch(":id")
  @Roles(...MANAGE_ROLES)
  update(@Param("id") id: string, @Body() dto: UpdateAssignmentDto, @CurrentUser() user: AuthUser) {
    return this.svc.update(id, dto, user);
  }

  @Delete(":id")
  @Roles(...MANAGE_ROLES)
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.svc.remove(id, user);
  }

  @Post(":id/submit")
  @Roles(Role.STUDENT)
  submit(@Param("id") id: string, @Body() dto: SubmitAssignmentDto, @CurrentUser() user: AuthUser) {
    return this.svc.submit(id, dto, user);
  }

  @Patch(":id/submissions/:studentId/grade")
  @Roles(...MANAGE_ROLES)
  grade(@Param("id") id: string, @Param("studentId") studentId: string, @Body() dto: GradeSubmissionDto, @CurrentUser() user: AuthUser) {
    return this.svc.grade(id, studentId, dto, user);
  }
}

@Module({ controllers: [AssignmentsController], providers: [AssignmentsService] })
export class AssignmentsModule {}
