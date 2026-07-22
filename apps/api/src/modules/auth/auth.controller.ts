import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@educore/database";
import { AuthService } from "./auth.service";
import { LoginWithTokenDto, RegisterSchoolDto } from "./dto/login.dto";
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
