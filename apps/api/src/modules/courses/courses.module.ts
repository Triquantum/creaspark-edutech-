import { Body, Controller, Delete, Get, Module, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@educore/database";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";
import { CoursesService, ADMIN_ROLES } from "./courses.service";
import { CreateCourseDto, UpdateCourseDto, QueryCoursesDto, CreateLessonDto, UpdateLessonDto } from "./courses.dto";

const MANAGE_ROLES = [Role.TEACHER, ...ADMIN_ROLES] as const;

@ApiTags("courses")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("courses")
export class CoursesController {
  constructor(private svc: CoursesService) {}

  @Get()
  list(@Query() query: QueryCoursesDto, @CurrentUser() user: AuthUser) {
    return this.svc.list(user, query);
  }

  @Post()
  @Roles(Role.TEACHER)
  create(@Body() dto: CreateCourseDto, @CurrentUser() user: AuthUser) {
    return this.svc.create(dto, user);
  }

  @Get(":id")
  get(@Param("id") id: string, @Query("studentId") studentId: string | undefined, @CurrentUser() user: AuthUser) {
    return this.svc.get(id, user, studentId);
  }

  @Patch(":id")
  @Roles(...MANAGE_ROLES)
  update(@Param("id") id: string, @Body() dto: UpdateCourseDto, @CurrentUser() user: AuthUser) {
    return this.svc.update(id, dto, user);
  }

  @Delete(":id")
  @Roles(...MANAGE_ROLES)
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.svc.remove(id, user);
  }

  @Get(":id/progress")
  progress(@Param("id") id: string, @Query("studentId") studentId: string | undefined, @CurrentUser() user: AuthUser) {
    return this.svc.progress(id, user, studentId);
  }

  @Post(":id/lessons")
  @Roles(...MANAGE_ROLES)
  addLesson(@Param("id") id: string, @Body() dto: CreateLessonDto, @CurrentUser() user: AuthUser) {
    return this.svc.addLesson(id, dto, user);
  }
}

@ApiTags("lessons")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("lessons")
export class LessonsController {
  constructor(private svc: CoursesService) {}

  @Patch(":id")
  @Roles(...MANAGE_ROLES)
  update(@Param("id") id: string, @Body() dto: UpdateLessonDto, @CurrentUser() user: AuthUser) {
    return this.svc.updateLesson(id, dto, user);
  }

  @Delete(":id")
  @Roles(...MANAGE_ROLES)
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.svc.removeLesson(id, user);
  }

  @Post(":id/complete")
  @Roles(Role.STUDENT)
  complete(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.svc.completeLesson(id, user);
  }
}

@Module({ controllers: [CoursesController, LessonsController], providers: [CoursesService] })
export class CoursesModule {}
