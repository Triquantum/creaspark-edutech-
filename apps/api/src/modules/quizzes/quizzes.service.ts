import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { CourseStatus, QuestionType, Role } from "@educore/database";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { AuthUser } from "../../common/decorators/current-user.decorator";
import { resolveViewableStudentId } from "../../common/access/student-access";
import { ADMIN_ROLES } from "../courses/courses.service";
import { CreateQuizDto, UpdateQuizDto, CreateQuestionDto, UpdateQuestionDto, SubmitAttemptDto } from "./quizzes.dto";

@Injectable()
export class QuizzesService {
  constructor(private prisma: PrismaService) {}

  private canManageCourse(user: AuthUser, course: { teacherId: string }): boolean {
    if ((ADMIN_ROLES as readonly string[]).includes(user.role)) return true;
    return user.role === Role.TEACHER && course.teacherId === user.id;
  }

  private async requireCourseAccess(courseId: string, user: AuthUser) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course || course.tenantId !== currentTenant().tenantId) throw new NotFoundException("Course not found");
    const managed = this.canManageCourse(user, course);
    if (!managed && course.status !== CourseStatus.PUBLISHED) throw new NotFoundException("Course not found");
    return { course, managed };
  }

  async listForCourse(courseId: string, user: AuthUser) {
    await this.requireCourseAccess(courseId, user);
    return this.prisma.quiz.findMany({ where: { courseId }, include: { _count: { select: { questions: true } } }, orderBy: { createdAt: "desc" } });
  }

  async create(dto: CreateQuizDto, user: AuthUser) {
    const { course, managed } = await this.requireCourseAccess(dto.courseId, user);
    if (!managed) throw new ForbiddenException("Only the course's teacher or school management can add quizzes");
    return this.prisma.quiz.create({ data: { tenantId: course.tenantId, courseId: dto.courseId, title: dto.title, description: dto.description } });
  }

  private async findQuiz(id: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: { course: true, questions: { orderBy: { order: "asc" } } },
    });
    if (!quiz || quiz.course.tenantId !== currentTenant().tenantId) throw new NotFoundException("Quiz not found");
    return quiz;
  }

  /** Teacher/admin sees correctAnswer + every attempt. Student sees the
   * questions without answers, plus their own attempt if they've taken it. */
  async get(id: string, user: AuthUser, studentId?: string) {
    const quiz = await this.findQuiz(id);
    if (this.canManageCourse(user, quiz.course)) {
      const attempts = await this.prisma.quizAttempt.findMany({
        where: { quizId: id },
        include: { student: { select: { firstName: true, lastName: true, admissionNo: true } } },
        orderBy: { submittedAt: "desc" },
      });
      return { ...quiz, attempts };
    }
    if (quiz.course.status !== CourseStatus.PUBLISHED) throw new NotFoundException("Quiz not found");
    const resolvedStudentId = await resolveViewableStudentId(this.prisma, user, studentId);
    const myAttempt = await this.prisma.quizAttempt.findUnique({ where: { quizId_studentId: { quizId: id, studentId: resolvedStudentId } } });
    return {
      ...quiz,
      questions: quiz.questions.map((q) => ({ id: q.id, questionText: q.questionText, type: q.type, options: q.options, marks: q.marks, order: q.order })),
      myAttempt,
    };
  }

  async update(id: string, dto: UpdateQuizDto, user: AuthUser) {
    const quiz = await this.findQuiz(id);
    if (!this.canManageCourse(user, quiz.course)) throw new NotFoundException("Quiz not found");
    return this.prisma.quiz.update({ where: { id }, data: dto });
  }

  async remove(id: string, user: AuthUser) {
    const quiz = await this.findQuiz(id);
    if (!this.canManageCourse(user, quiz.course)) throw new NotFoundException("Quiz not found");
    await this.prisma.quiz.delete({ where: { id } });
    return { deleted: true };
  }

  async addQuestion(quizId: string, dto: CreateQuestionDto, user: AuthUser) {
    const quiz = await this.findQuiz(quizId);
    if (!this.canManageCourse(user, quiz.course)) throw new NotFoundException("Quiz not found");
    return this.prisma.quizQuestion.create({
      data: {
        tenantId: quiz.tenantId, quizId, questionText: dto.questionText, type: dto.type ?? QuestionType.MCQ,
        options: dto.options, correctAnswer: dto.correctAnswer, marks: dto.marks ?? 1, order: dto.order ?? 0,
      },
    });
  }

  private async requireManageQuestion(questionId: string, user: AuthUser) {
    const question = await this.prisma.quizQuestion.findUnique({ where: { id: questionId }, include: { quiz: { include: { course: true } } } });
    if (!question || !this.canManageCourse(user, question.quiz.course)) throw new NotFoundException("Question not found");
    return question;
  }

  async updateQuestion(questionId: string, dto: UpdateQuestionDto, user: AuthUser) {
    await this.requireManageQuestion(questionId, user);
    return this.prisma.quizQuestion.update({ where: { id: questionId }, data: dto });
  }

  async removeQuestion(questionId: string, user: AuthUser) {
    await this.requireManageQuestion(questionId, user);
    await this.prisma.quizQuestion.delete({ where: { id: questionId } });
    return { deleted: true };
  }

  /** One attempt per student (upsert). Auto-grades MCQ questions against
   * correctAnswer; SHORT_ANSWER questions are excluded from the score. */
  async submitAttempt(quizId: string, dto: SubmitAttemptDto, user: AuthUser) {
    if (user.role !== Role.STUDENT) throw new ForbiddenException("Only students can take quizzes");
    const quiz = await this.findQuiz(quizId);
    if (quiz.course.status !== CourseStatus.PUBLISHED) throw new NotFoundException("Quiz not found");
    const studentId = await resolveViewableStudentId(this.prisma, user);

    const score = quiz.questions.reduce((total, q) => {
      if (q.type !== QuestionType.MCQ || !q.correctAnswer) return total;
      return dto.answers[q.id] === q.correctAnswer ? total + q.marks : total;
    }, 0);

    return this.prisma.quizAttempt.upsert({
      where: { quizId_studentId: { quizId, studentId } },
      create: { tenantId: quiz.tenantId, quizId, studentId, answers: dto.answers, score },
      update: { answers: dto.answers, score, submittedAt: new Date() },
    });
  }
}
