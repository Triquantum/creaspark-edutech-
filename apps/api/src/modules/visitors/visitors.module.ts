import {
  Body, Controller, Delete, Get, Injectable, Module, NotFoundException,
  Param, Patch, Post, Query, UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@educore/database";
import { IsOptional, IsString } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";

export class CreateVisitorDto {
  @IsString() schoolId: string;
  @IsString() visitorName: string;
  @IsString() phone: string;
  @IsString() purpose: string;
  @IsOptional() @IsString() personToMeet?: string;
  @IsOptional() @IsString() idProofType?: string;
  @IsOptional() @IsString() idProofNumber?: string;
}

/**
 * Front-desk visitor log for SUPER_ADMIN — deliberately cross-tenant (like
 * PlatformModule) since the Super Admin's own JWT tenant is the platform
 * placeholder, not any real school. tenantId on write is resolved from the
 * chosen school, not currentTenant().
 */
@Injectable()
export class VisitorsService {
  constructor(private prisma: PrismaService) {}

  list(schoolId?: string) {
    return this.prisma.visitor.findMany({
      where: schoolId ? { schoolId } : undefined,
      include: { school: { select: { name: true } } },
      orderBy: { checkInAt: "desc" },
      take: 100,
    });
  }

  async create(dto: CreateVisitorDto, actorId: string) {
    const school = await this.prisma.school.findUnique({ where: { id: dto.schoolId } });
    if (!school) throw new NotFoundException("School not found");
    return this.prisma.visitor.create({
      data: {
        tenantId: school.tenantId, schoolId: school.id,
        visitorName: dto.visitorName, phone: dto.phone, purpose: dto.purpose,
        personToMeet: dto.personToMeet, idProofType: dto.idProofType, idProofNumber: dto.idProofNumber,
        createdBy: actorId,
      },
    });
  }

  async checkOut(id: string) {
    const visitor = await this.prisma.visitor.findUnique({ where: { id } });
    if (!visitor) throw new NotFoundException("Visitor not found");
    return this.prisma.visitor.update({ where: { id }, data: { checkOutAt: new Date() } });
  }

  async remove(id: string) {
    const visitor = await this.prisma.visitor.findUnique({ where: { id } });
    if (!visitor) throw new NotFoundException("Visitor not found");
    await this.prisma.visitor.delete({ where: { id } });
    return { deleted: true };
  }
}

@ApiTags("visitors")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller("visitors")
export class VisitorsController {
  constructor(private svc: VisitorsService) {}

  @Get()
  list(@Query("schoolId") schoolId?: string) {
    return this.svc.list(schoolId);
  }

  @Post()
  create(@Body() dto: CreateVisitorDto, @CurrentUser() user: AuthUser) {
    return this.svc.create(dto, user.id);
  }

  @Patch(":id/checkout")
  checkOut(@Param("id") id: string) {
    return this.svc.checkOut(id);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.svc.remove(id);
  }
}

@Module({ controllers: [VisitorsController], providers: [VisitorsService] })
export class VisitorsModule {}
