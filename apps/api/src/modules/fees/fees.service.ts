import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PaymentMode, Prisma } from "@educore/database";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { AuthUser } from "../../common/decorators/current-user.decorator";
import { resolveViewableStudentId } from "../../common/access/student-access";

@Injectable()
export class FeesService {
  constructor(private prisma: PrismaService) {}

  async listInvoices(status?: string, studentId?: string) {
    const { tenantId } = currentTenant();
    return this.prisma.feeInvoice.findMany({
      where: { tenantId, ...(status && { status: status as any }), ...(studentId && { studentId }) },
      include: { student: { select: { firstName: true, lastName: true, admissionNo: true } }, payments: true },
      orderBy: { dueDate: "asc" },
      take: 100,
    });
  }

  /** Record a payment; auto-updates invoice status (PARTIAL/PAID). */
  async recordPayment(invoiceId: string, amount: number, mode: PaymentMode, receivedBy: string, reference?: string) {
    const { tenantId } = currentTenant();
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.feeInvoice.findFirst({ where: { id: invoiceId, tenantId }, include: { payments: true } });
      if (!invoice) throw new NotFoundException("Invoice not found");
      if (invoice.status === "CANCELLED") throw new BadRequestException("Invoice cancelled");

      const paidSoFar = invoice.payments.reduce((s, p) => s.add(p.amount), new Prisma.Decimal(0));
      const total = invoice.amount.add(invoice.fine).sub(invoice.discount);
      const remaining = total.sub(paidSoFar);
      if (new Prisma.Decimal(amount).gt(remaining)) throw new BadRequestException("Amount exceeds balance");

      const payment = await tx.payment.create({
        data: { tenantId, invoiceId, amount, mode, reference, receivedBy },
      });
      const nowPaid = paidSoFar.add(amount);
      await tx.feeInvoice.update({
        where: { id: invoiceId },
        data: { status: nowPaid.gte(total) ? "PAID" : "PARTIAL" },
      });
      await tx.auditLog.create({
        data: { tenantId, userId: receivedBy, action: "fees.payment", entity: "Payment", entityId: payment.id, metadata: { amount, mode } },
      });
      return payment;
    });
  }

  async collectionsSummary() {
    const { tenantId } = currentTenant();
    const [collected, pending] = await Promise.all([
      this.prisma.payment.aggregate({ where: { tenantId }, _sum: { amount: true } }),
      this.prisma.feeInvoice.aggregate({ where: { tenantId, status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } }, _sum: { amount: true } }),
    ]);
    return { collected: collected._sum.amount ?? 0, outstanding: pending._sum.amount ?? 0 };
  }

  /** Self-service: a student/parent's own invoices with fee-plan breakdown + payment history. */
  async myFees(user: AuthUser, requestedStudentId?: string) {
    const studentId = await resolveViewableStudentId(this.prisma, user, requestedStudentId);
    const { tenantId } = currentTenant();

    const invoices = await this.prisma.feeInvoice.findMany({
      where: { tenantId, studentId },
      include: { plan: { include: { items: true } }, payments: { orderBy: { paidAt: "desc" } } },
      orderBy: { dueDate: "desc" },
    });

    const outstanding = invoices.filter((i) => i.status !== "PAID" && i.status !== "CANCELLED");
    const nextDue = outstanding.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0] ?? null;
    const totalDue = outstanding.reduce((sum, i) => {
      const paid = i.payments.reduce((s, p) => s.add(p.amount), new Prisma.Decimal(0));
      return sum.add(i.amount.add(i.fine).sub(i.discount).sub(paid));
    }, new Prisma.Decimal(0));

    return {
      studentId,
      totalDue,
      nextDue: nextDue ? { invoiceNo: nextDue.invoiceNo, dueDate: nextDue.dueDate, amount: nextDue.amount } : null,
      invoices,
      payments: invoices.flatMap((i) => i.payments.map((p) => ({ ...p, invoiceNo: i.invoiceNo }))),
    };
  }

  /** Staff-facing payment history across the whole tenant, most recent first. */
  paymentHistory(studentId?: string) {
    const { tenantId } = currentTenant();
    return this.prisma.payment.findMany({
      where: { tenantId, ...(studentId && { invoice: { studentId } }) },
      include: { invoice: { select: { invoiceNo: true, student: { select: { firstName: true, lastName: true, admissionNo: true } } } } },
      orderBy: { paidAt: "desc" },
      take: 100,
    });
  }
}
