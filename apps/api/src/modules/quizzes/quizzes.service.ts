import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ContentStatus, QuestionType, Role } from "@educore/database";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { AuthUser } from "../../common/decorators/current-user.decorator";
import { resolveViewableStudentId } from "../../common/access/student-access";
import { canManageContent, teacherSchool, studentClass } from "../../common/access/content-access";
import { CreateQuizDto, UpdateQuizDto, QueryQuizzesDto, CreateQuestionDto, UpdateQuestionDto, SubmitAttemptDto } from "./quizzes.dto";

@Injectable()
export class QuizzesService {
  constructor(private prisma: PrismaService) {}

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

  async list(user: AuthUser, query: QueryQuizzesDto) {
    if (user.role === Role.STUDENT || user.role === Role.PARENT) {
      const studentId = await resolveViewableStudentId(this.prisma, user);
      const { schoolId, classId } = await studentClass(this.prisma, studentId);
      return this.prisma.quiz.findMany({
        where: {
          tenantId: currentTenant().tenantId, schoolId, status: ContentStatus.PUBLISHED,
          ...(query.subjectId && { subjectId: query.subjectId }),
          OR: [{ classId: null }, ...(classId ? [{ classId }] : [])],
        },
        include: { _count: { select: { questions: true } } },
        orderBy: { createdAt: "desc" },
      });
    }
    return this.prisma.quiz.findMany({
      where: this.contentWhere(user, query),
      include: { _count: { select: { questions: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(dto: CreateQuizDto, user: AuthUser) {
    const { tenantId, schoolId } = await teacherSchool(this.prisma, user.id);
    if (dto.schoolId !== schoolId) throw new NotFoundException("School not found in your organization");
    return this.prisma.quiz.create({
      data: {
        tenantId, schoolId, subjectId: dto.subjectId, classId: dto.classId, teacherId: user.id,
        title: dto.title, description: dto.description, status: dto.status ?? ContentStatus.DRAFT,
      },
    });
  }

  private async findQuiz(id: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: { questions: { orderBy: { order: "asc" } } },
    });
    if (!quiz || quiz.tenantId !== currentTenant().tenantId) throw new NotFoundException("Quiz not found");
    return quiz;
  }

  /** Teacher/admin sees correctAnswer + every attempt. Student sees the
   * questions without answers, plus their own attempt if they've taken it. */
  async get(id: string, user: AuthUser, studentId?: string) {
    const quiz = await this.findQuiz(id);
    if (canManageContent(user, quiz)) {
      const attempts = await this.prisma.quizAttempt.findMany({
        where: { quizId: id },
        include: { student: { select: { firstName: true, lastName: true, admissionNo: true } } },
        orderBy: { submittedAt: "desc" },
      });
      return { ...quiz, attempts };
    }
    if (quiz.status !== ContentStatus.PUBLISHED) throw new NotFoundException("Quiz not found");
    const resolvedStudentId = await resolveViewableStudentId(this.prisma, user, studentId);
    const myAttempt = await this.prisma.quizAttempt.findUnique({ where: { quizId_studentId: { quizId: id, studentId: resolvedStudentId } } });
    return {
      ...quiz,
      questions: quiz.questions.map((q) => ({ id: q.id, questionText: q.questionText, type: q.type, options: q.options, marks: q.marks, order: q.order })),
      myAttempt,
    };
  }

  private async requireManage(id: string, user: AuthUser) {
    const quiz = await this.findQuiz(id);
    if (!canManageContent(user, quiz)) throw new NotFoundException("Quiz not found");
    return quiz;
  }

  async update(id: string, dto: UpdateQuizDto, user: AuthUser) {
    await this.requireManage(id, user);
    return this.prisma.quiz.update({ where: { id }, data: dto });
  }

  async remove(id: string, user: AuthUser) {
    await this.requireManage(id, user);
    await this.prisma.quiz.delete({ where: { id } });
    return { deleted: true };
  }

  async addQuestion(quizId: string, dto: CreateQuestionDto, user: AuthUser) {
    const quiz = await this.requireManage(quizId, user);
    return this.prisma.quizQuestion.create({
      data: {
        tenantId: quiz.tenantId, quizId, questionText: dto.questionText, type: dto.type ?? QuestionType.MCQ,
        options: dto.options, correctAnswer: dto.correctAnswer, marks: dto.marks ?? 1, order: dto.order ?? 0,
      },
    });
  }

  private async requireManageQuestion(questionId: string, user: AuthUser) {
    const question = await this.prisma.quizQuestion.findUnique({ where: { id: questionId }, include: { quiz: true } });
    if (!question || !canManageContent(user, question.quiz)) throw new NotFoundException("Question not found");
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
    if (quiz.status !== ContentStatus.PUBLISHED) throw new NotFoundException("Quiz not found");
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
