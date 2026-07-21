import { Body, Controller, Delete, Get, Module, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RecordsService } from "./records.service";
import { QueryRecordsDto, RecordDataDto } from "./records.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";

/**
 * Generic CRUD for every sidebar leaf that doesn't have a dedicated
 * module yet — any authenticated user may read/write within their
 * tenant (no @Roles restriction: RolesGuard allows all authenticated
 * roles when no roles are declared).
 */
@ApiTags("records")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("records/:module")
export class RecordsController {
  constructor(private records: RecordsService) {}

  @Get()
  list(@Param("module") module: string, @Query() query: QueryRecordsDto) {
    return this.records.list(module, query);
  }

  @Get(":id")
  get(@Param("module") module: string, @Param("id") id: string) {
    return this.records.get(module, id);
  }

  @Post()
  create(@Param("module") module: string, @Body() dto: RecordDataDto, @CurrentUser() user: AuthUser) {
    return this.records.create(module, dto, user.id);
  }

  @Patch(":id")
  update(@Param("module") module: string, @Param("id") id: string, @Body() dto: RecordDataDto) {
    return this.records.update(module, id, dto);
  }

  @Delete(":id")
  remove(@Param("module") module: string, @Param("id") id: string) {
    return this.records.remove(module, id);
  }
}

@Module({ controllers: [RecordsController], providers: [RecordsService] })
export class RecordsModule {}
