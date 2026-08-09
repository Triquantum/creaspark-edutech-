import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface AuthUser {
  id: string;
  tenantId: string;
  role: string;
  email: string;
  /** Present only when the request carried a verified X-Active-Grant
   * override -- the specific school scope of that switched grant. */
  schoolId?: string;
  /** The UserAccess row currently active for this request, if switched. */
  activeGrantId?: string;
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
