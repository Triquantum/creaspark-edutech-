import {
  Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Patch, Post, UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@educore/database";
import { IsInt, IsOptional, IsString, Min } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";

// Curriculum content is authored centrally by CREASPARK, same as Asset
// Category/Vendor/Location -- only platform admins manage it. Every other
// staff-facing role (School Admin down to Teacher) can view it, since it's
// literally the week-by-week plan they're meant to follow.
const MANAGE = [Role.SUPER_ADMIN, Role.ORG_ADMIN] as const;
const VIEW = [
  Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.VICE_PRINCIPAL, Role.COORDINATOR, Role.TEACHER,
] as const;

export class CreateGradeDto {
  @IsString() academicYear: string;
  @IsString() gradeLabel: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}
export class UpdateGradeDto {
  @IsOptional() @IsString() academicYear?: string;
  @IsOptional() @IsString() gradeLabel?: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}
export class CreateEntryDto {
  @IsOptional() @IsInt() @Min(0) rowIndex?: number;
  @IsOptional() @IsString() term?: string;
  @IsOptional() @IsString() month?: string;
  @IsOptional() @IsString() week?: string;
  @IsOptional() @IsInt() workingDays?: number;
  @IsOptional() @IsInt() instructedDays?: number;
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() unitChapter?: string;
  @IsOptional() @IsString() learningOutcome?: string;
  @IsOptional() @IsString() activity?: string;
  @IsOptional() @IsString() sdgMapping?: string;
  @IsOptional() @IsString() skills?: string;
  @IsOptional() @IsString() values?: string;
  @IsOptional() @IsString() digitalContent?: string;
  @IsOptional() @IsString() assessment?: string;
  @IsOptional() @IsString() remarks?: string;
}
export class UpdateEntryDto extends CreateEntryDto {}

@Injectable()
export class YearlyPlanService {
  constructor(private prisma: PrismaService) {}

  async listGrades() {
    const grades = await this.prisma.yearlyPlanGrade.findMany({
      orderBy: [{ academicYear: "desc" }, { sortOrder: "asc" }],
      include: { _count: { select: { entries: true } } },
    });
    return grades.map((g) => ({ ...g, entryCount: g._count.entries }));
  }

  private async findGrade(id: string) {
    const grade = await this.prisma.yearlyPlanGrade.findUnique({
      where: { id }, include: { entries: { orderBy: { rowIndex: "asc" } } },
    });
    if (!grade) throw new NotFoundException("Yearly plan not found");
    return grade;
  }

  gradeDetail(id: string) {
    return this.findGrade(id);
  }

  createGrade(dto: CreateGradeDto, user: AuthUser) {
    return this.prisma.yearlyPlanGrade.create({
      data: { academicYear: dto.academicYear, gradeLabel: dto.gradeLabel, sortOrder: dto.sortOrder ?? 0, createdById: user.id },
    });
  }

  async updateGrade(id: string, dto: UpdateGradeDto) {
    await this.findGrade(id);
    return this.prisma.yearlyPlanGrade.update({ where: { id }, data: dto });
  }

  async removeGrade(id: string) {
    await this.findGrade(id);
    await this.prisma.yearlyPlanGrade.delete({ where: { id } });
    return { deleted: true };
  }

  async addEntry(gradeId: string, dto: CreateEntryDto) {
    const grade = await this.findGrade(gradeId);
    const rowIndex = dto.rowIndex ?? grade.entries.length;
    return this.prisma.yearlyPlanEntry.create({ data: { gradeId, ...dto, rowIndex } });
  }

  private async findEntry(id: string) {
    const entry = await this.prisma.yearlyPlanEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException("Entry not found");
    return entry;
  }

  async updateEntry(id: string, dto: UpdateEntryDto) {
    await this.findEntry(id);
    return this.prisma.yearlyPlanEntry.update({ where: { id }, data: dto });
  }

  async removeEntry(id: string) {
    await this.findEntry(id);
    await this.prisma.yearlyPlanEntry.delete({ where: { id } });
    return { deleted: true };
  }
}

@ApiTags("yearly-plan") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...VIEW)
@Controller("academic/yearly-plan")
export class YearlyPlanController {
  constructor(private svc: YearlyPlanService) {}

  @Get("grades") listGrades() { return this.svc.listGrades(); }
  @Get("grades/:id") gradeDetail(@Param("id") id: string) { return this.svc.gradeDetail(id); }

  @Post("grades") @Roles(...MANAGE)
  createGrade(@Body() dto: CreateGradeDto, @CurrentUser() user: AuthUser) { return this.svc.createGrade(dto, user); }

  @Patch("grades/:id") @Roles(...MANAGE)
  updateGrade(@Param("id") id: string, @Body() dto: UpdateGradeDto) { return this.svc.updateGrade(id, dto); }

  @Delete("grades/:id") @Roles(...MANAGE)
  removeGrade(@Param("id") id: string) { return this.svc.removeGrade(id); }

  @Post("grades/:id/entries") @Roles(...MANAGE)
  addEntry(@Param("id") id: string, @Body() dto: CreateEntryDto) { return this.svc.addEntry(id, dto); }

  @Patch("entries/:id") @Roles(...MANAGE)
  updateEntry(@Param("id") id: string, @Body() dto: UpdateEntryDto) { return this.svc.updateEntry(id, dto); }

  @Delete("entries/:id") @Roles(...MANAGE)
  removeEntry(@Param("id") id: string) { return this.svc.removeEntry(id); }
}

@Module({ controllers: [YearlyPlanController], providers: [YearlyPlanService] })
export class YearlyPlanModule {}
