import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PaymentMode, Role } from "@educore/database";
import { FeesService } from "./fees.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";

@ApiTags("fees")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("fees")
export class FeesController {
  constructor(private fees: FeesService) {}

  @Get("invoices")
  @Roles(Role.ACCOUNTANT, Role.SCHOOL_ADMIN, Role.PRINCIPAL)
  invoices(@Query("status") status?: string, @Query("studentId") studentId?: string) {
    return this.fees.listInvoices(status, studentId);
  }

  @Post("payments")
  @Roles(Role.ACCOUNTANT, Role.SCHOOL_ADMIN)
  pay(
    @Body() body: { invoiceId: string; amount: number; mode: PaymentMode; reference?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.fees.recordPayment(body.invoiceId, body.amount, body.mode, user.id, body.reference);
  }

  @Get("summary")
  @Roles(Role.ACCOUNTANT, Role.SCHOOL_ADMIN, Role.PRINCIPAL)
  summary() {
    return this.fees.collectionsSummary();
  }
}
