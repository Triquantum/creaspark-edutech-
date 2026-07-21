import { Body, Controller, Delete, Get, Module, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@educore/database";
import { ParentsService } from "./parents.service";
import { CreateParentDto, QueryParentsDto, UpdateParentDto } from "./parents.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";

@ApiTags("parents")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("parents")
export class ParentsController {
  constructor(private parents: ParentsService) {}

  @Get()
  @Roles(Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.VICE_PRINCIPAL, Role.COORDINATOR, Role.RECEPTION, Role.TEACHER)
  list(@Query() query: QueryParentsDto) {
    return this.parents.list(query);
  }

  @Post()
  @Roles(Role.SCHOOL_ADMIN, Role.RECEPTION)
  create(@Body() dto: CreateParentDto, @CurrentUser() user: AuthUser) {
    return this.parents.create(dto, user.id);
  }

  @Patch(":id")
  @Roles(Role.SCHOOL_ADMIN, Role.RECEPTION)
  update(@Param("id") id: string, @Body() dto: UpdateParentDto, @CurrentUser() user: AuthUser) {
    return this.parents.update(id, dto, user.id);
  }

  @Delete(":id")
  @Roles(Role.SCHOOL_ADMIN)
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.parents.remove(id, user.id);
  }
}

@Module({ controllers: [ParentsController], providers: [ParentsService] })
export class ParentsModule {}
