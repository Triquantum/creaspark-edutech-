import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@educore/database";
import { StudentsService } from "./students.service";
import { CreateStudentDto, QueryStudentsDto, UpdateStudentDto } from "./dto/create-student.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";
import { listViewableStudents } from "../../common/access/student-access";
import { PrismaService } from "../../prisma/prisma.service";

@ApiTags("students")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("students")
export class StudentsController {
  constructor(private students: StudentsService, private prisma: PrismaService) {}

  @Get()
  @Roles(Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.TEACHER, Role.COORDINATOR, Role.RECEPTION)
  list(@Query() query: QueryStudentsDto) {
    return this.students.list(query);
  }

  /** No @Roles: every student a STUDENT/PARENT account may view — powers the frontend child picker. */
  @Get("mine")
  mine(@CurrentUser() user: AuthUser) {
    return listViewableStudents(this.prisma, user);
  }

  @Get(":id")
  @Roles(Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.TEACHER, Role.COORDINATOR)
  get(@Param("id") id: string) {
    return this.students.get(id);
  }

  @Post()
  @Roles(Role.SCHOOL_ADMIN, Role.RECEPTION)
  create(@Body() dto: CreateStudentDto, @CurrentUser() user: AuthUser) {
    return this.students.create(dto, user.id);
  }

  @Patch(":id")
  @Roles(Role.SCHOOL_ADMIN, Role.RECEPTION)
  update(@Param("id") id: string, @Body() dto: UpdateStudentDto, @CurrentUser() user: AuthUser) {
    return this.students.update(id, dto, user.id);
  }

  @Delete(":id")
  @Roles(Role.SCHOOL_ADMIN)
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.students.remove(id, user.id);
  }
}
