import { Body, Controller, Delete, Get, Module, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@educore/database";
import { EmployeesService } from "./employees.service";
import { CreateEmployeeDto, UpdateEmployeeDto } from "./employees.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";

@ApiTags("employees")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("employees")
export class EmployeesController {
  constructor(private employees: EmployeesService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.VICE_PRINCIPAL, Role.COORDINATOR, Role.HR)
  list(
    @CurrentUser() user: AuthUser, @Query("q") q?: string, @Query("schoolId") schoolId?: string,
    @Query("activeOnly") activeOnly?: string,
  ) {
    return this.employees.list(user, q, schoolId, activeOnly);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.HR)
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: AuthUser) {
    return this.employees.create(dto, user, user.id);
  }

  @Patch(":id")
  @Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.HR)
  update(@Param("id") id: string, @Body() dto: UpdateEmployeeDto, @CurrentUser() user: AuthUser) {
    return this.employees.update(id, dto, user, user.id);
  }

  @Delete(":id")
  @Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN)
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.employees.remove(id, user, user.id);
  }
}

@Module({ controllers: [EmployeesController], providers: [EmployeesService] })
export class EmployeesModule {}
