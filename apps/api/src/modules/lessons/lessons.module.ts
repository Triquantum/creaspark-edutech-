import {
  Body, Controller, Delete, ForbiddenException, Get, Injectable,
  Module, NotFoundException, Param, Patch, Post, Query, UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ContentStatus, Role } from "@educore/database";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";
import { resolveViewableStudentId } from "../../common/access/student-access";
import { ADMIN_ROLES, canManageContent, teacherSchool, studentClass } from "../../common/access/content-access";
import { CreateLessonDto, UpdateLessonDto, QueryLessonsDto, QueryProgressDto, RecordViewDto } from "./lessons.dto";

const MANAGE_ROLES = [Role.TEACHER, ...ADMIN_ROLES] as const;

const CONTENT_INCLUDE = {
  subject: { select: { name: true } },
  class: { select: { name: true } },
  teacher: { select: { fullName: true } },
};

@Injectable()
export class LessonsService {
  constructor(private prisma: PrismaService) {}

  /** Shared by list()/progress(): cross-tenant for SUPER_ADMIN/ORG_ADMIN,
   * own-authored-only for TEACHER, whole-school for the office ADMIN_ROLES. */
  private contentWhere(user: AuthUser, query: { subjectId?: string; schoolId?: string; classId?: string }) {
    const crossTenant = user.role === Role.SUPER_ADMIN || user.role === Role.ORG_ADMIN;
    return {
      ...(!crossTenant && { tenantId: currentTenant().tenantId }),
      ...(query.subjectId && { subjectId: query.subjectId }),
      ...(query.schoolId && { schoolId: query.schoolId }),
      ...(query.classId && { OR: [{ classId: null }, { classId: query.classId }] }),
      ...(user.role === Role.TEACHER && { teacherId: user.id }),
    };
  }

  async list(user: AuthUser, query: QueryLessonsDto) {
    if (user.role === Role.STUDENT || user.role === Role.PARENT) {
      const studentId = await resolveViewableStudentId(this.prisma, user, query.studentId);
      const { schoolId, classId } = await studentClass(this.prisma, studentId);
      return this.prisma.lesson.findMany({
        where: {
          tenantId: currentTenant().tenantId, schoolId, status: ContentStatus.PUBLISHED,
          ...(query.subjectId && { subjectId: query.subjectId }),
          OR: [{ classId: null }, ...(classId ? [{ classId }] : [])],
        },
        include: CONTENT_INCLUDE,
        orderBy: [{ subjectId: "asc" }, { order: "asc" }],
      });
    }
    return this.prisma.lesson.findMany({
      where: this.contentWhere(user, query),
      include: CONTENT_INCLUDE,
      orderBy: [{ subjectId: "asc" }, { order: "asc" }],
    });
  }

  async create(dto: CreateLessonDto, user: AuthUser) {
    const { tenantId, schoolId } = await teacherSchool(this.prisma, user.id);
    if (dto.schoolId !== schoolId) throw new NotFoundException("School not found in your organization");
    return this.prisma.lesson.create({
      data: {
        tenantId, schoolId, subjectId: dto.subjectId, classId: dto.classId, teacherId: user.id,
        title: dto.title, content: dto.content, videoUrl: dto.videoUrl, order: dto.order ?? 0,
        status: dto.status ?? ContentStatus.DRAFT,
      },
      include: CONTENT_INCLUDE,
    });
  }

  private async requireManage(id: string, user: AuthUser) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id } });
    if (!lesson || !canManageContent(user, lesson)) throw new NotFoundException("Lesson not found");
    return lesson;
  }

  async update(id: string, dto: UpdateLessonDto, user: AuthUser) {
    await this.requireManage(id, user);
    return this.prisma.lesson.update({ where: { id }, data: dto, include: CONTENT_INCLUDE });
  }

  async remove(id: string, user: AuthUser) {
    await this.requireManage(id, user);
    await this.prisma.lesson.delete({ where: { id } });
    return { deleted: true };
  }

  /** STUDENT self-marks a lesson complete -- no PARENT/teacher proxy in v1. */
  async complete(id: string, user: AuthUser) {
    if (user.role !== Role.STUDENT) throw new ForbiddenException("Only students can mark lessons complete");
    const lesson = await this.prisma.lesson.findUnique({ where: { id } });
    if (!lesson || lesson.tenantId !== currentTenant().tenantId) throw new NotFoundException("Lesson not found");
    const studentId = await resolveViewableStudentId(this.prisma, user);
    return this.prisma.lessonCompletion.upsert({
      where: { lessonId_studentId: { lessonId: id, studentId } },
      create: { tenantId: lesson.tenantId, lessonId: id, studentId },
      update: {},
    });
  }

  /** Student marks a subject's content page opened -- separate from
   * per-lesson completion; mirrors the old CourseView "opened at least
   * once" signal now that there's no single course page to record it on.
   * schoolId/classId are derived from the caller's own enrollment (this
   * route is STUDENT-only) since the frontend has no way to know them. */
  async recordView(dto: RecordViewDto, user: AuthUser) {
    const studentId = await resolveViewableStudentId(this.prisma, user);
    const { schoolId, classId } = await studentClass(this.prisma, studentId);
    const existing = await this.prisma.subjectView.findFirst({
      where: { studentId, subjectId: dto.subjectId ?? null, schoolId, classId: classId ?? null },
    });
    if (existing) return this.prisma.subjectView.update({ where: { id: existing.id }, data: { viewedAt: new Date() } });
    return this.prisma.subjectView.create({
      data: { tenantId: currentTenant().tenantId, studentId, subjectId: dto.subjectId, schoolId, classId },
    });
  }

  /** Teacher/admin: per-student roster progress for a subject+school+class
   * (schoolId/classId required from them). Student/parent: their own
   * progress -- schoolId/classId are derived from their own enrollment
   * instead, since the frontend has no easy way to know those for them. */
  async progress(query: QueryProgressDto, user: AuthUser) {
    const isManager = user.role === Role.TEACHER || (ADMIN_ROLES as readonly string[]).includes(user.role)
      || user.role === Role.SUPER_ADMIN || user.role === Role.ORG_ADMIN;

    let schoolId: string;
    let classId: string | undefined;
    let selfStudentId: string | undefined;
    if (isManager) {
      if (!query.schoolId) throw new NotFoundException("schoolId is required");
      schoolId = query.schoolId;
      classId = query.classId;
    } else {
      selfStudentId = await resolveViewableStudentId(this.prisma, user, query.studentId);
      const own = await studentClass(this.prisma, selfStudentId);
      schoolId = own.schoolId;
      classId = own.classId ?? undefined;
    }

    const where = isManager
      ? this.contentWhere(user, { subjectId: query.subjectId, schoolId, classId })
      : {
          tenantId: currentTenant().tenantId, schoolId, subjectId: query.subjectId, status: ContentStatus.PUBLISHED,
          ...(classId && { OR: [{ classId: null }, { classId }] }),
        };

    const [lessons, assignments, quizzes] = await Promise.all([
      this.prisma.lesson.findMany({ where, select: { id: true } }),
      this.prisma.assignment.findMany({ where, select: { id: true } }),
      this.prisma.quiz.findMany({ where, select: { id: true } }),
    ]);

    const computeFor = async (sid: string) => {
      const [completedLessons, gradedSubmissions, attemptedSubmissions, attempts, view] = await Promise.all([
        this.prisma.lessonCompletion.count({ where: { studentId: sid, lessonId: { in: lessons.map((l) => l.id) } } }),
        this.prisma.submission.findMany({
          where: { studentId: sid, assignmentId: { in: assignments.map((a) => a.id) }, status: "GRADED" },
          select: { marksAwarded: true },
        }),
        this.prisma.submission.count({ where: { studentId: sid, assignmentId: { in: assignments.map((a) => a.id) } } }),
        this.prisma.quizAttempt.findMany({ where: { studentId: sid, quizId: { in: quizzes.map((q) => q.id) } }, select: { score: true } }),
        this.prisma.subjectView.findFirst({
          where: { studentId: sid, subjectId: query.subjectId, schoolId, classId: classId ?? null },
          select: { viewedAt: true },
        }),
      ]);
      const totalLessons = lessons.length;
      const avgQuizScore = attempts.length ? Math.round(attempts.reduce((s, a) => s + (a.score ?? 0), 0) / attempts.length) : null;
      const tried = completedLessons > 0 || attemptedSubmissions > 0 || attempts.length > 0;
      return {
        studentId: sid,
        opened: !!view, viewedAt: view?.viewedAt ?? null, tried,
        lessonsCompleted: completedLessons, totalLessons,
        percentComplete: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : null,
        assignmentsGraded: gradedSubmissions.length, assignmentsAttempted: attemptedSubmissions, totalAssignments: assignments.length,
        quizzesAttempted: attempts.length, totalQuizzes: quizzes.length, avgQuizScore,
      };
    };

    if (isManager) {
      if (!classId) return { roster: [] };
      const students = await this.prisma.student.findMany({
        where: { schoolId, section: { classId } },
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      });
      const roster = await Promise.all(students.map(async (s) => ({ ...s, ...(await computeFor(s.id)) })));
      const summary = {
        totalStudents: roster.length,
        openedCount: roster.filter((r) => r.opened).length,
        triedCount: roster.filter((r) => r.tried).length,
      };
      return { roster, summary };
    }

    return { self: await computeFor(selfStudentId!) };
  }
}

@ApiTags("lessons")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("lessons")
export class LessonsController {
  constructor(private svc: LessonsService) {}

  @Get()
  list(@Query() query: QueryLessonsDto, @CurrentUser() user: AuthUser) {
    return this.svc.list(user, query);
  }

  @Get("progress")
  progress(@Query() query: QueryProgressDto, @CurrentUser() user: AuthUser) {
    return this.svc.progress(query, user);
  }

  @Post("view")
  @Roles(Role.STUDENT)
  recordView(@Body() dto: RecordViewDto, @CurrentUser() user: AuthUser) {
    return this.svc.recordView(dto, user);
  }

  @Post()
  @Roles(Role.TEACHER)
  create(@Body() dto: CreateLessonDto, @CurrentUser() user: AuthUser) {
    return this.svc.create(dto, user);
  }

  @Patch(":id")
  @Roles(...MANAGE_ROLES)
  update(@Param("id") id: string, @Body() dto: UpdateLessonDto, @CurrentUser() user: AuthUser) {
    return this.svc.update(id, dto, user);
  }

  @Delete(":id")
  @Roles(...MANAGE_ROLES)
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.svc.remove(id, user);
  }

  @Post(":id/complete")
  @Roles(Role.STUDENT)
  complete(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.svc.complete(id, user);
  }
}

@Module({ controllers: [LessonsController], providers: [LessonsService] })
export class LessonsModule {}
