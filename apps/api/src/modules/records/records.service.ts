import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
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

  async list(module: string, query: QueryRecordsDto) {
    const { tenantId } = currentTenant();
    const items = await this.prisma.genericRecord.findMany({
      where: { tenantId, module },
      orderBy: { updatedAt: "desc" },
      take: PAGE,
    });
    if (!query.q) return items;
    const q = query.q.toLowerCase();
    return items.filter((r) => JSON.stringify(r.data).toLowerCase().includes(q));
  }

  async get(module: string, id: string) {
    const { tenantId } = currentTenant();
    const record = await this.prisma.genericRecord.findFirst({ where: { id, tenantId, module } });
    if (!record) throw new NotFoundException("Record not found");
    return record;
  }

  create(module: string, dto: RecordDataDto, actorId: string) {
    const { tenantId } = currentTenant();
    return this.prisma.genericRecord.create({
      data: { tenantId, module, data: toData(dto), createdBy: actorId },
    });
  }

  async update(module: string, id: string, dto: RecordDataDto) {
    await this.get(module, id);
    return this.prisma.genericRecord.update({ where: { id }, data: { data: toData(dto) } });
  }

  async remove(module: string, id: string) {
    await this.get(module, id);
    await this.prisma.genericRecord.delete({ where: { id } });
    return { deleted: true };
  }
}
