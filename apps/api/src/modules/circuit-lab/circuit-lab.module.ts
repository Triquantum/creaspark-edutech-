import { Body, Controller, Delete, Get, Module, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@educore/database";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";
import { CircuitLabService } from "./circuit-lab.service";
import { ADMIN_ROLES } from "../../common/access/content-access";
import {
  CreateCircuitProjectDto, UpdateCircuitProjectDto, QueryCircuitProjectsDto, ReviewCircuitProjectDto,
} from "./circuit-lab.dto";

// Virtual Class (Wokwi + PICSimLab embeds): students build/save their own
// projects, teachers/school-office roles view and leave feedback. Parent
// excluded, same as the Courses nav gating -- this is student-authored work,
// not something a guardian needs a dedicated view into yet.
const VIEW = [Role.STUDENT, Role.TEACHER, ...ADMIN_ROLES] as const;
const MANAGE = [Role.TEACHER, ...ADMIN_ROLES] as const;

@ApiTags("circuit-lab")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("circuit-lab")
export class CircuitLabController {
  constructor(private svc: CircuitLabService) {}

  @Get()
  @Roles(...VIEW)
  list(@Query() query: QueryCircuitProjectsDto, @CurrentUser() user: AuthUser) {
    return this.svc.list(user, query);
  }

  @Post()
  @Roles(Role.STUDENT)
  create(@Body() dto: CreateCircuitProjectDto, @CurrentUser() user: AuthUser) {
    return this.svc.create(dto, user);
  }

  @Patch(":id")
  @Roles(Role.STUDENT)
  update(@Param("id") id: string, @Body() dto: UpdateCircuitProjectDto, @CurrentUser() user: AuthUser) {
    return this.svc.update(id, dto, user);
  }

  @Delete(":id")
  @Roles(Role.STUDENT)
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.svc.remove(id, user);
  }

  @Patch(":id/review")
  @Roles(...MANAGE)
  review(@Param("id") id: string, @Body() dto: ReviewCircuitProjectDto, @CurrentUser() user: AuthUser) {
    return this.svc.review(id, dto, user);
  }
}

@Module({ controllers: [CircuitLabController], providers: [CircuitLabService] })
export class CircuitLabModule {}
