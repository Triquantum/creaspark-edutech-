import { Body, Controller, Delete, Get, Module, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@educore/database";
import { UsersService } from "./users.service";
import { CreateUserDto, QueryUsersDto, UpdateUserDto } from "./users.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";

const ADMIN_ROLES = [Role.SCHOOL_ADMIN, Role.ORG_ADMIN] as const;

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("users")
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  @Roles(...ADMIN_ROLES, Role.PRINCIPAL, Role.HR)
  list(@Query() query: QueryUsersDto) {
    return this.users.list(query);
  }

  @Post()
  @Roles(...ADMIN_ROLES)
  register(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    return this.users.create(dto, user.id);
  }

  @Patch(":id")
  @Roles(...ADMIN_ROLES)
  update(@Param("id") id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: AuthUser) {
    return this.users.update(id, dto, user.id);
  }

  @Post(":id/reset-password")
  @Roles(...ADMIN_ROLES)
  resetPassword(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.users.resetPassword(id, user.id);
  }

  @Delete(":id")
  @Roles(...ADMIN_ROLES)
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.users.remove(id, user.id);
  }
}

@Module({ controllers: [UsersController], providers: [UsersService] })
export class UsersModule {}
