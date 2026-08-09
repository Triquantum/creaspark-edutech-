import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@educore/database";
import { AuthService } from "./auth.service";
import { LoginWithTokenDto, RegisterSchoolDto, SwitchContextDto } from "./dto/login.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post("register-school")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN)
  registerSchool(@Body() dto: RegisterSchoolDto) {
    return this.auth.registerSchool(dto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }

  /** Mints the X-Active-Grant pointer token for one of the caller's own
   * UserAccess rows. The frontend stores it per-tab (sessionStorage) and
   * sends it on every subsequent request; TenantMiddleware re-verifies it
   * against the live grant on each one. */
  @Post("switch-context")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  switchContext(@Body() dto: SwitchContextDto, @CurrentUser() user: AuthUser) {
    return this.auth.switchContext(dto, user);
  }

  /** Public, pre-login: resolves an admission number to the login(s) it can sign into. */
  @Get("lookup-admission/:admissionNo")
  lookupAdmission(@Param("admissionNo") admissionNo: string) {
    return this.auth.lookupByAdmission(admissionNo);
  }

  /** Public, pre-login: exchanges a lookup token + password for a Supabase session. */
  @Post("login-with-token")
  loginWithToken(@Body() dto: LoginWithTokenDto) {
    return this.auth.signInWithToken(dto.token, dto.password);
  }
}
