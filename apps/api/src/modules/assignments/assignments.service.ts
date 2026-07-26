import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { CourseStatus, Role, SubmissionStatus } from "@educore/database";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { AuthUser } from "../../common/decorators/current-user.decorator";
import { resolveViewableStudentId } from "../../common/access/student-access";
import { ADMIN_ROLES } from "../courses/courses.service";
import { CreateAssignmentDto, UpdateAssignmentDto, SubmitAssignmentDto, GradeSubmissionDto } from "./assignments.dto";

@Injectable()
export class AssignmentsService {
  constructor(private prisma: PrismaService) {}

  /** Whether `user` manages the given course (teacher-owner or school admin/principal/etc). */
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
    return this.prisma.assignment.findMany({ where: { courseId }, orderBy: { createdAt: "desc" } });
  }

  async create(dto: CreateAssignmentDto, user: AuthUser) {
    const { course, managed } = await this.requireCourseAccess(dto.courseId, user);
    if (!managed) throw new ForbiddenException("Only the course's teacher or school management can add assignments");
    return this.prisma.assignment.create({
      data: {
        tenantId: course.tenantId, courseId: dto.courseId, title: dto.title, description: dto.description,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined, maxMarks: dto.maxMarks,
      },
    });
  }

  private async findAssignment(id: string) {
    const assignment = await this.prisma.assignment.findUnique({ where: { id }, include: { course: true } });
    if (!assignment || assignment.course.tenantId !== currentTenant().tenantId) throw new NotFoundException("Assignment not found");
    return assignment;
  }

  /** Detail: teacher/admin gets every submission; student/parent gets their own. */
  async get(id: string, user: AuthUser, studentId?: string) {
    const assignment = await this.findAssignment(id);
    if (this.canManageCourse(user, assignment.course)) {
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

  async update(id: string, dto: UpdateAssignmentDto, user: AuthUser) {
    const assignment = await this.findAssignment(id);
    if (!this.canManageCourse(user, assignment.course)) throw new NotFoundException("Assignment not found");
    return this.prisma.assignment.update({
      where: { id },
      data: { ...dto, dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined },
    });
  }

  async remove(id: string, user: AuthUser) {
    const assignment = await this.findAssignment(id);
    if (!this.canManageCourse(user, assignment.course)) throw new NotFoundException("Assignment not found");
    await this.prisma.assignment.delete({ where: { id } });
    return { deleted: true };
  }

  async submit(id: string, dto: SubmitAssignmentDto, user: AuthUser) {
    if (user.role !== Role.STUDENT) throw new ForbiddenException("Only students can submit assignments");
    const assignment = await this.findAssignment(id);
    if (assignment.course.status !== CourseStatus.PUBLISHED) throw new NotFoundException("Assignment not found");
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
    const assignment = await this.findAssignment(id);
    if (!this.canManageCourse(user, assignment.course)) throw new NotFoundException("Assignment not found");
    const submission = await this.prisma.submission.findUnique({ where: { assignmentId_studentId: { assignmentId: id, studentId } } });
    if (!submission) throw new NotFoundException("Submission not found");
    return this.prisma.submission.update({
      where: { assignmentId_studentId: { assignmentId: id, studentId } },
      data: { marksAwarded: dto.marksAwarded, feedback: dto.feedback, status: SubmissionStatus.GRADED, gradedAt: new Date(), gradedBy: user.id },
    });
  }
}
