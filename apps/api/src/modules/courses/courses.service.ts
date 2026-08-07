import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { CourseStatus, Role } from "@educore/database";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { AuthUser } from "../../common/decorators/current-user.decorator";
import { resolveViewableStudentId } from "../../common/access/student-access";
import { CreateCourseDto, UpdateCourseDto, QueryCoursesDto, CreateLessonDto, UpdateLessonDto } from "./courses.dto";

export const ADMIN_ROLES = [Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.VICE_PRINCIPAL, Role.COORDINATOR] as const;

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  /** A teacher's own school comes from their StaffProfile. */
  private async teacherSchool(userId: string): Promise<{ tenantId: string; schoolId: string }> {
    const profile = await this.prisma.staffProfile.findUnique({ where: { userId } });
    if (!profile) throw new ForbiddenException("No staff profile found for this account");
    return { tenantId: profile.tenantId, schoolId: profile.schoolId };
  }

  /** The class a student belongs to, via their section — null if unassigned. */
  private async studentClass(studentId: string): Promise<{ schoolId: string; classId: string | null }> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { schoolId: true, section: { select: { classId: true } } },
    });
    if (!student) throw new NotFoundException("Student not found");
    return { schoolId: student.schoolId, classId: student.section?.classId ?? null };
  }

  private canManage(user: AuthUser, course: { teacherId: string; tenantId: string }): boolean {
    if (course.tenantId !== currentTenant().tenantId) return false;
    if ((ADMIN_ROLES as readonly string[]).includes(user.role)) return true;
    return user.role === Role.TEACHER && course.teacherId === user.id;
  }

  private async requireManage(id: string, user: AuthUser) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course || !this.canManage(user, course)) throw new NotFoundException("Course not found");
    return course;
  }

  async list(user: AuthUser, query: QueryCoursesDto) {
    // SUPER_ADMIN/ORG_ADMIN have no real tenant of their own (same
    // placeholder-tenantId situation as everywhere else this pattern
    // appears) -- give them the same cross-tenant admin view rather than
    // falling through to the STUDENT/PARENT branch below, which assumes
    // the caller has a linked student and would error out for them.
    if (user.role === Role.SUPER_ADMIN || user.role === Role.ORG_ADMIN) {
      return this.prisma.course.findMany({
        include: {
          teacher: { select: { fullName: true } }, subject: { select: { name: true } },
          class: { select: { name: true } }, _count: { select: { lessons: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    const { tenantId } = currentTenant();

    if (user.role === Role.TEACHER) {
      return this.prisma.course.findMany({
        where: { tenantId, teacherId: user.id },
        include: { subject: { select: { name: true } }, class: { select: { name: true } }, _count: { select: { lessons: true } } },
        orderBy: { createdAt: "desc" },
      });
    }
    if ((ADMIN_ROLES as readonly string[]).includes(user.role)) {
      return this.prisma.course.findMany({
        where: { tenantId },
        include: {
          teacher: { select: { fullName: true } }, subject: { select: { name: true } },
          class: { select: { name: true } }, _count: { select: { lessons: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    // STUDENT/PARENT: published courses matching the student's class, or school-wide (classId null).
    const studentId = await resolveViewableStudentId(this.prisma, user, query.studentId);
    const { schoolId, classId } = await this.studentClass(studentId);
    return this.prisma.course.findMany({
      where: {
        tenantId, schoolId, status: CourseStatus.PUBLISHED,
        OR: [{ classId: null }, ...(classId ? [{ classId }] : [])],
      },
      include: { teacher: { select: { fullName: true } }, subject: { select: { name: true } }, _count: { select: { lessons: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(dto: CreateCourseDto, user: AuthUser) {
    const { tenantId, schoolId } = await this.teacherSchool(user.id);
    return this.prisma.course.create({
      data: { tenantId, schoolId, teacherId: user.id, title: dto.title, description: dto.description, subjectId: dto.subjectId, classId: dto.classId },
    });
  }

  async get(id: string, user: AuthUser, studentId?: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        teacher: { select: { fullName: true } }, subject: { select: { name: true } }, class: { select: { name: true } },
        lessons: { orderBy: { order: "asc" } },
        assignments: { orderBy: { createdAt: "desc" } },
        quizzes: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!course) throw new NotFoundException("Course not found");

    if (this.canManage(user, course)) return course;

    // Otherwise: must be a published course this student's class can see.
    if (course.tenantId !== currentTenant().tenantId || course.status !== CourseStatus.PUBLISHED) {
      throw new NotFoundException("Course not found");
    }
    const resolvedStudentId = await resolveViewableStudentId(this.prisma, user, studentId);
    const { schoolId, classId } = await this.studentClass(resolvedStudentId);
    if (course.schoolId !== schoolId || (course.classId && course.classId !== classId)) {
      throw new NotFoundException("Course not found");
    }

    const [completions] = await Promise.all([
      this.prisma.lessonCompletion.findMany({
        where: { studentId: resolvedStudentId, lessonId: { in: course.lessons.map((l) => l.id) } },
        select: { lessonId: true },
      }),
      this.prisma.courseView.upsert({
        where: { courseId_studentId: { courseId: course.id, studentId: resolvedStudentId } },
        create: { tenantId: course.tenantId, courseId: course.id, studentId: resolvedStudentId },
        update: { viewedAt: new Date() },
      }),
    ]);
    const completedIds = new Set(completions.map((c) => c.lessonId));
    return {
      ...course,
      lessons: course.lessons.map((l) => ({ ...l, completed: completedIds.has(l.id) })),
    };
  }

  async update(id: string, dto: UpdateCourseDto, user: AuthUser) {
    await this.requireManage(id, user);
    return this.prisma.course.update({ where: { id }, data: dto });
  }

  async remove(id: string, user: AuthUser) {
    await this.requireManage(id, user);
    await this.prisma.course.delete({ where: { id } });
    return { deleted: true };
  }

  async addLesson(courseId: string, dto: CreateLessonDto, user: AuthUser) {
    const course = await this.requireManage(courseId, user);
    return this.prisma.lesson.create({
      data: { tenantId: course.tenantId, courseId, title: dto.title, content: dto.content, videoUrl: dto.videoUrl, order: dto.order ?? 0 },
    });
  }

  private async requireManageLesson(lessonId: string, user: AuthUser) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId }, include: { course: true } });
    if (!lesson || !this.canManage(user, lesson.course)) throw new NotFoundException("Lesson not found");
    return lesson;
  }

  async updateLesson(lessonId: string, dto: UpdateLessonDto, user: AuthUser) {
    await this.requireManageLesson(lessonId, user);
    return this.prisma.lesson.update({ where: { id: lessonId }, data: dto });
  }

  async removeLesson(lessonId: string, user: AuthUser) {
    await this.requireManageLesson(lessonId, user);
    await this.prisma.lesson.delete({ where: { id: lessonId } });
    return { deleted: true };
  }

  /** STUDENT self-marks a lesson complete — no PARENT/teacher proxy in v1. */
  async completeLesson(lessonId: string, user: AuthUser) {
    if (user.role !== Role.STUDENT) throw new ForbiddenException("Only students can mark lessons complete");
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId }, include: { course: true } });
    if (!lesson || lesson.course.tenantId !== currentTenant().tenantId) throw new NotFoundException("Lesson not found");
    const studentId = await resolveViewableStudentId(this.prisma, user);
    return this.prisma.lessonCompletion.upsert({
      where: { lessonId_studentId: { lessonId, studentId } },
      create: { tenantId: lesson.tenantId, lessonId, studentId },
      update: {},
    });
  }

  /** Teacher/admin: per-student roster progress for a course with a class.
   * Student/parent: their own progress in this course. */
  async progress(courseId: string, user: AuthUser, studentId?: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: { lessons: { select: { id: true } }, assignments: { select: { id: true, maxMarks: true } }, quizzes: { select: { id: true } } },
    });
    if (!course) throw new NotFoundException("Course not found");

    const computeFor = async (sid: string) => {
      const [completedLessons, gradedSubmissions, attemptedSubmissions, attempts, view] = await Promise.all([
        this.prisma.lessonCompletion.count({ where: { studentId: sid, lessonId: { in: course.lessons.map((l) => l.id) } } }),
        this.prisma.submission.findMany({
          where: { studentId: sid, assignmentId: { in: course.assignments.map((a) => a.id) }, status: "GRADED" },
          select: { marksAwarded: true, assignmentId: true },
        }),
        this.prisma.submission.count({ where: { studentId: sid, assignmentId: { in: course.assignments.map((a) => a.id) } } }),
        this.prisma.quizAttempt.findMany({ where: { studentId: sid, quizId: { in: course.quizzes.map((q) => q.id) } }, select: { score: true } }),
        this.prisma.courseView.findUnique({ where: { courseId_studentId: { courseId: course.id, studentId: sid } }, select: { viewedAt: true } }),
      ]);
      const totalLessons = course.lessons.length;
      const avgQuizScore = attempts.length ? Math.round(attempts.reduce((s, a) => s + (a.score ?? 0), 0) / attempts.length) : null;
      const tried = completedLessons > 0 || attemptedSubmissions > 0 || attempts.length > 0;
      return {
        studentId: sid,
        opened: !!view, viewedAt: view?.viewedAt ?? null, tried,
        lessonsCompleted: completedLessons, totalLessons,
        percentComplete: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : null,
        assignmentsGraded: gradedSubmissions.length, assignmentsAttempted: attemptedSubmissions, totalAssignments: course.assignments.length,
        quizzesAttempted: attempts.length, totalQuizzes: course.quizzes.length, avgQuizScore,
      };
    };

    if (this.canManage(user, course)) {
      if (!course.classId) return { course: { id: course.id, title: course.title }, roster: [] };
      const students = await this.prisma.student.findMany({
        where: { tenantId: course.tenantId, schoolId: course.schoolId, section: { classId: course.classId } },
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      });
      const roster = await Promise.all(students.map(async (s) => ({ ...s, ...(await computeFor(s.id)) })));
      const summary = {
        totalStudents: roster.length,
        openedCount: roster.filter((r) => r.opened).length,
        triedCount: roster.filter((r) => r.tried).length,
      };
      return { course: { id: course.id, title: course.title }, roster, summary };
    }

    const resolvedStudentId = await resolveViewableStudentId(this.prisma, user, studentId);
    return { course: { id: course.id, title: course.title }, self: await computeFor(resolvedStudentId) };
  }
}
