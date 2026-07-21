import { Test } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { FeesService } from "./fees.service";
import { PrismaService } from "../../prisma/prisma.service";
import { tenantStorage } from "../../common/tenancy/tenant-context";

describe("FeesService.recordPayment", () => {
  it("rejects payments that exceed the invoice balance", async () => {
    const Decimal = require("@prisma/client/runtime/library").Decimal;
    const prismaMock: any = {
      $transaction: (fn: any) => fn(prismaMock),
      feeInvoice: {
        findFirst: jest.fn().mockResolvedValue({
          id: "inv1", status: "PENDING",
          amount: new Decimal(1000), fine: new Decimal(0), discount: new Decimal(0),
          payments: [{ amount: new Decimal(900) }],
        }),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [FeesService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    const svc = moduleRef.get(FeesService);

    await tenantStorage.run({ tenantId: "t1", tenantSlug: "demo" }, async () => {
      await expect(svc.recordPayment("inv1", 500, "CASH" as any, "u1")).rejects.toThrow(BadRequestException);
    });
  });
});
