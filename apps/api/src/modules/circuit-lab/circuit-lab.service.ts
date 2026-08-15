import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Role } from "@educore/database";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { AuthUser } from "../../common/decorators/current-user.decorator";
import { resolveViewableStudentId } from "../../common/access/student-access";
import { studentClass } from "../../common/access/content-access";
import {
  CreateCircuitProjectDto, UpdateCircuitProjectDto, QueryCircuitProjectsDto, ReviewCircuitProjectDto,
} from "./circuit-lab.dto";

@Injectable()
export class CircuitLabService {
  constructor(private prisma: PrismaService) {}

  async list(user: AuthUser, query: QueryCircuitProjectsDto) {
    if (user.role === Role.STUDENT) {
      const studentId = await resolveViewableStudentId(this.prisma, user);
      return this.prisma.circuitProject.findMany({ where: { studentId }, orderBy: { createdAt: "desc" } });
    }

    const crossTenant = user.role === Role.SUPER_ADMIN || user.role === Role.ORG_ADMIN;
    return this.prisma.circuitProject.findMany({
      where: {
        ...(!crossTenant && { tenantId: currentTenant().tenantId }),
        ...(query.schoolId && { schoolId: query.schoolId }),
        ...(query.classId && { classId: query.classId }),
        ...(query.subjectId && { subjectId: query.subjectId }),
        ...(query.studentId && { studentId: query.studentId }),
      },
      include: { student: { select: { firstName: true, lastName: true, admissionNo: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(dto: CreateCircuitProjectDto, user: AuthUser) {
    if (user.role !== Role.STUDENT) throw new ForbiddenException("Only students can create Circuit Lab projects");
    const studentId = await resolveViewableStudentId(this.prisma, user);
    const { schoolId, classId } = await studentClass(this.prisma, studentId);
    return this.prisma.circuitProject.create({
      data: {
        tenantId: currentTenant().tenantId, schoolId, classId, subjectId: dto.subjectId, studentId,
        title: dto.title, simulator: dto.simulator, projectUrl: dto.projectUrl, notes: dto.notes,
      },
    });
  }

  private async findOwn(id: string, user: AuthUser) {
    const project = await this.prisma.circuitProject.findUnique({ where: { id } });
    if (!project || project.tenantId !== currentTenant().tenantId) throw new NotFoundException("Circuit Lab project not found");
    const studentId = await resolveViewableStudentId(this.prisma, user);
    if (project.studentId !== studentId) throw new ForbiddenException("You can only edit your own projects");
    return project;
  }

  async update(id: string, dto: UpdateCircuitProjectDto, user: AuthUser) {
    await this.findOwn(id, user);
    return this.prisma.circuitProject.update({ where: { id }, data: dto });
  }

  async remove(id: string, user: AuthUser) {
    await this.findOwn(id, user);
    await this.prisma.circuitProject.delete({ where: { id } });
    return { deleted: true };
  }

  async review(id: string, dto: ReviewCircuitProjectDto, user: AuthUser) {
    const project = await this.prisma.circuitProject.findUnique({ where: { id } });
    if (!project || project.tenantId !== currentTenant().tenantId) throw new NotFoundException("Circuit Lab project not found");
    return this.prisma.circuitProject.update({
      where: { id },
      data: { feedback: dto.feedback, reviewedById: user.id, reviewedAt: new Date() },
    });
  }
}
