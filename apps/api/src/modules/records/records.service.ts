import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Role } from "@educore/database";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { AuthUser } from "../../common/decorators/current-user.decorator";
import { QueryRecordsDto, RecordDataDto } from "./records.dto";

const PAGE = 200;

function toData(dto: RecordDataDto) {
  return {
    name: dto.name,
    ...(dto.notes && { notes: dto.notes }),
    ...(dto.fields && { fields: dto.fields }),
  };
}

@Injectable()
export class RecordsService {
  constructor(private prisma: PrismaService) {}

  /** SUPER_ADMIN has no real school of their own; tenantId is resolved from
   * an explicit schoolId instead of currentTenant(). GenericRecord rows
   * carry only tenantId (no schoolId column), so unlike list-heavy modules
   * there's no cross-tenant "all schools" read here — list/create always
   * need one school picked. */
  private async resolveTenant(user: AuthUser, schoolId?: string): Promise<string> {
    if (user.role === Role.SUPER_ADMIN) {
      if (!schoolId) throw new BadRequestException("schoolId is required for Super Admin");
      const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
      if (!school) throw new NotFoundException("School not found");
      return school.tenantId;
    }
    return currentTenant().tenantId;
  }

  /** For actions on an existing record: SUPER_ADMIN may act on any tenant's
   * data, everyone else only their own. */
  private assertCanAct(user: AuthUser, recordTenantId: string) {
    if (user.role === Role.SUPER_ADMIN) return;
    if (recordTenantId !== currentTenant().tenantId) throw new NotFoundException("Record not found");
  }

  async list(module: string, query: QueryRecordsDto, user: AuthUser) {
    const tenantId = await this.resolveTenant(user, query.schoolId);
    const items = await this.prisma.genericRecord.findMany({
      where: { tenantId, module },
      orderBy: { updatedAt: "desc" },
      take: PAGE,
    });
    if (!query.q) return items;
    const q = query.q.toLowerCase();
    return items.filter((r) => JSON.stringify(r.data).toLowerCase().includes(q));
  }

  async get(module: string, id: string, user: AuthUser) {
    const record = await this.prisma.genericRecord.findFirst({ where: { id, module } });
    if (!record) throw new NotFoundException("Record not found");
    this.assertCanAct(user, record.tenantId);
    return record;
  }

  async create(module: string, dto: RecordDataDto, user: AuthUser, actorId: string, schoolId?: string) {
    const tenantId = await this.resolveTenant(user, schoolId);
    return this.prisma.genericRecord.create({
      data: { tenantId, module, data: toData(dto), createdBy: actorId },
    });
  }

  async update(module: string, id: string, dto: RecordDataDto, user: AuthUser) {
    await this.get(module, id, user);
    return this.prisma.genericRecord.update({ where: { id }, data: { data: toData(dto) } });
  }

  async remove(module: string, id: string, user: AuthUser) {
    await this.get(module, id, user);
    await this.prisma.genericRecord.delete({ where: { id } });
    return { deleted: true };
  }
}
