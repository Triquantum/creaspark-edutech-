import { Body, Controller, Delete, Get, Module, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@educore/database";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";
import { QuizzesService } from "./quizzes.service";
import { ADMIN_ROLES } from "../../common/access/content-access";
import { CreateQuizDto, UpdateQuizDto, QueryQuizzesDto, CreateQuestionDto, UpdateQuestionDto, SubmitAttemptDto } from "./quizzes.dto";

const MANAGE_ROLES = [Role.TEACHER, ...ADMIN_ROLES] as const;

@ApiTags("quizzes")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("quizzes")
export class QuizzesController {
  constructor(private svc: QuizzesService) {}

  @Get()
  list(@Query() query: QueryQuizzesDto, @CurrentUser() user: AuthUser) {
    return this.svc.list(user, query);
  }

  @Post()
  @Roles(Role.TEACHER)
  create(@Body() dto: CreateQuizDto, @CurrentUser() user: AuthUser) {
    return this.svc.create(dto, user);
  }

  @Get(":id")
  get(@Param("id") id: string, @Query("studentId") studentId: string | undefined, @CurrentUser() user: AuthUser) {
    return this.svc.get(id, user, studentId);
  }

  @Patch(":id")
  @Roles(...MANAGE_ROLES)
  update(@Param("id") id: string, @Body() dto: UpdateQuizDto, @CurrentUser() user: AuthUser) {
    return this.svc.update(id, dto, user);
  }

  @Delete(":id")
  @Roles(...MANAGE_ROLES)
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.svc.remove(id, user);
  }

  @Post(":id/questions")
  @Roles(...MANAGE_ROLES)
  addQuestion(@Param("id") id: string, @Body() dto: CreateQuestionDto, @CurrentUser() user: AuthUser) {
    return this.svc.addQuestion(id, dto, user);
  }

  @Post(":id/attempt")
  @Roles(Role.STUDENT)
  submitAttempt(@Param("id") id: string, @Body() dto: SubmitAttemptDto, @CurrentUser() user: AuthUser) {
    return this.svc.submitAttempt(id, dto, user);
  }
}

@ApiTags("quiz-questions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("quiz-questions")
export class QuizQuestionsController {
  constructor(private svc: QuizzesService) {}

  @Patch(":id")
  @Roles(...MANAGE_ROLES)
  update(@Param("id") id: string, @Body() dto: UpdateQuestionDto, @CurrentUser() user: AuthUser) {
    return this.svc.updateQuestion(id, dto, user);
  }

  @Delete(":id")
  @Roles(...MANAGE_ROLES)
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.svc.removeQuestion(id, user);
  }
}

@Module({ controllers: [QuizzesController, QuizQuestionsController], providers: [QuizzesService] })
export class QuizzesModule {}
