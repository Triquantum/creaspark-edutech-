import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ContentStatus, Role, SubmissionStatus } from "@educore/database";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { AuthUser } from "../../common/decorators/current-user.decorator";
import { resolveViewableStudentId } from "../../common/access/student-access";
import { canManageContent, teacherSchool, studentClass } from "../../common/access/content-access";
import { CreateAssignmentDto, UpdateAssignmentDto, QueryAssignmentsDto, SubmitAssignmentDto, GradeSubmissionDto } from "./assignments.dto";

@Injectable()
export class AssignmentsService {
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

  async list(user: AuthUser, query: QueryAssignmentsDto) {
    if (user.role === Role.STUDENT || user.role === Role.PARENT) {
      const studentId = await resolveViewableStudentId(this.prisma, user);
      const { schoolId, classId } = await studentClass(this.prisma, studentId);
      return this.prisma.assignment.findMany({
        where: {
          tenantId: currentTenant().tenantId, schoolId, status: ContentStatus.PUBLISHED,
          ...(query.subjectId && { subjectId: query.subjectId }),
          OR: [{ classId: null }, ...(classId ? [{ classId }] : [])],
        },
        orderBy: { createdAt: "desc" },
      });
    }
    return this.prisma.assignment.findMany({ where: this.contentWhere(user, query), orderBy: { createdAt: "desc" } });
  }

  async create(dto: CreateAssignmentDto, user: AuthUser) {
    const { tenantId, schoolId } = await teacherSchool(this.prisma, user.id);
    if (dto.schoolId !== schoolId) throw new NotFoundException("School not found in your organization");
    return this.prisma.assignment.create({
      data: {
        tenantId, schoolId, subjectId: dto.subjectId, classId: dto.classId, teacherId: user.id,
        title: dto.title, description: dto.description,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined, maxMarks: dto.maxMarks,
        status: dto.status ?? ContentStatus.DRAFT,
      },
    });
  }

  private async findAssignment(id: string) {
    const assignment = await this.prisma.assignment.findUnique({ where: { id } });
    if (!assignment || assignment.tenantId !== currentTenant().tenantId) throw new NotFoundException("Assignment not found");
    return assignment;
  }

  /** Detail: teacher/admin gets every submission; student/parent gets their own. */
  async get(id: string, user: AuthUser, studentId?: string) {
    const assignment = await this.findAssignment(id);
    if (canManageContent(user, assignment)) {
      const submissions = await this.prisma.submission.findMany({
        where: { assignmentId: id },
        include: { student: { select: { firstName: true, lastName: true, admissionNo: true } } },
        orderBy: { submittedAt: "desc" },
      });
      return { ...assignment, submissions };
    }
    const resolvedStudentId = await resolveViewableStudentId(this.prisma, user, studentId);
    const mySubmission = await this.prisma.submission.findUnique({
      where: { assignmentId_studentId: { assignmentId: id, studentId: resolvedStudentId } },
    });
    return { ...assignment, mySubmission };
  }

  private async requireManage(id: string, user: AuthUser) {
    const assignment = await this.findAssignment(id);
    if (!canManageContent(user, assignment)) throw new NotFoundException("Assignment not found");
    return assignment;
  }

  async update(id: string, dto: UpdateAssignmentDto, user: AuthUser) {
    await this.requireManage(id, user);
    return this.prisma.assignment.update({
      where: { id },
      data: { ...dto, dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined },
    });
  }

  async remove(id: string, user: AuthUser) {
    await this.requireManage(id, user);
    await this.prisma.assignment.delete({ where: { id } });
    return { deleted: true };
  }

  async submit(id: string, dto: SubmitAssignmentDto, user: AuthUser) {
    if (user.role !== Role.STUDENT) throw new ForbiddenException("Only students can submit assignments");
    const assignment = await this.findAssignment(id);
    if (assignment.status !== ContentStatus.PUBLISHED) throw new NotFoundException("Assignment not found");
    const studentId = await resolveViewableStudentId(this.prisma, user);
    const late = assignment.dueDate ? new Date() > assignment.dueDate : false;

    return this.prisma.submission.upsert({
      where: { assignmentId_studentId: { assignmentId: id, studentId } },
      create: {
        tenantId: assignment.tenantId, assignmentId: id, studentId,
        content: dto.content, attachmentUrl: dto.attachmentUrl, status: late ? SubmissionStatus.LATE : SubmissionStatus.SUBMITTED,
      },
      update: { content: dto.content, attachmentUrl: dto.attachmentUrl, submittedAt: new Date(), status: late ? SubmissionStatus.LATE : SubmissionStatus.SUBMITTED },
    });
  }

  async grade(id: string, studentId: string, dto: GradeSubmissionDto, user: AuthUser) {
    await this.requireManage(id, user);
    const submission = await this.prisma.submission.findUnique({ where: { assignmentId_studentId: { assignmentId: id, studentId } } });
    if (!submission) throw new NotFoundException("Submission not found");
    return this.prisma.submission.update({
      where: { assignmentId_studentId: { assignmentId: id, studentId } },
      data: { marksAwarded: dto.marksAwarded, feedback: dto.feedback, status: SubmissionStatus.GRADED, gradedAt: new Date(), gradedBy: user.id },
    });
  }
}
