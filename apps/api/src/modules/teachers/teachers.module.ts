import { Body, Controller, Delete, Get, Module, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@educore/database";
import { TeachersService } from "./teachers.service";
import { CreateTeacherDto, UpdateTeacherDto } from "./teachers.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";

@ApiTags("teachers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("teachers")
export class TeachersController {
  constructor(private teachers: TeachersService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.VICE_PRINCIPAL, Role.COORDINATOR, Role.HR)
  list(@CurrentUser() user: AuthUser, @Query("q") q?: string, @Query("schoolId") schoolId?: string) {
    return this.teachers.list(user, q, schoolId);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.HR)
  create(@Body() dto: CreateTeacherDto, @CurrentUser() user: AuthUser) {
    return this.teachers.create(dto, user, user.id);
  }

  @Patch(":id")
  @Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.HR)
  update(@Param("id") id: string, @Body() dto: UpdateTeacherDto, @CurrentUser() user: AuthUser) {
    return this.teachers.update(id, dto, user, user.id);
  }

  @Delete(":id")
  @Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN)
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.teachers.remove(id, user, user.id);
  }
}

@Module({ controllers: [TeachersController], providers: [TeachersService] })
export class TeachersModule {}
