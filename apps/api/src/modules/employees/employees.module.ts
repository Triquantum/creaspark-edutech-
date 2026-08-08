import { Body, Controller, Delete, Get, Module, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@educore/database";
import type { Response } from "express";
import { EmployeesService } from "./employees.service";
import { CreateEmployeeDto, SalaryCertificateDto, SalarySlipDto, UpdateEmployeeDto } from "./employees.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";

const HR_ROLES = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.HR] as const;

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
  @Roles(...HR_ROLES)
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: AuthUser) {
    return this.employees.create(dto, user, user.id);
  }

  @Patch(":id")
  @Roles(...HR_ROLES)
  update(@Param("id") id: string, @Body() dto: UpdateEmployeeDto, @CurrentUser() user: AuthUser) {
    return this.employees.update(id, dto, user, user.id);
  }

  @Delete(":id")
  @Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN)
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.employees.remove(id, user, user.id);
  }

  @Post(":id/salary-certificate")
  @Roles(...HR_ROLES)
  async salaryCertificate(
    @Param("id") id: string, @Body() dto: SalaryCertificateDto, @CurrentUser() user: AuthUser, @Res() res: Response,
  ) {
    const pdf = await this.employees.salaryCertificatePdf(id, dto, user);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="salary-certificate.pdf"');
    res.send(pdf);
  }

  @Post(":id/salary-slip")
  @Roles(...HR_ROLES)
  async salarySlip(
    @Param("id") id: string, @Body() dto: SalarySlipDto, @CurrentUser() user: AuthUser, @Res() res: Response,
  ) {
    const pdf = await this.employees.salarySlipPdf(id, dto, user);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="salary-slip.pdf"');
    res.send(pdf);
  }
}

@Module({ controllers: [EmployeesController], providers: [EmployeesService] })
export class EmployeesModule {}
