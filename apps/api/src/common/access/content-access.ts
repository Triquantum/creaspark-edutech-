import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Role } from "@educore/database";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../tenancy/tenant-context";
import { AuthUser } from "../decorators/current-user.decorator";

/** School-level "office" roles that oversee a school's LMS content
 * alongside the teachers who actually author it (Super/Org Admin get
 * cross-tenant view access separately, handled per-service). */
export const ADMIN_ROLES = [Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.VICE_PRINCIPAL, Role.COORDINATOR, Role.ACADEMIC_ADMIN] as const;

/** Shared by Lesson/Assignment/Quiz: true if `user` may edit/delete this
 * specific content item -- its own teacher-author, or one of the school's
 * admin roles, within the same tenant. */
export function canManageContent(user: AuthUser, item: { tenantId: string; teacherId: string }): boolean {
  if (item.tenantId !== currentTenant().tenantId) return false;
  if ((ADMIN_ROLES as readonly string[]).includes(user.role)) return true;
  return user.role === Role.TEACHER && item.teacherId === user.id;
}

/** A teacher's own tenant + school comes from their StaffProfile. */
export async function teacherSchool(prisma: PrismaService, userId: string): Promise<{ tenantId: string; schoolId: string }> {
  const profile = await prisma.staffProfile.findUnique({ where: { userId } });
  if (!profile) throw new ForbiddenException("No staff profile found for this account");
  return { tenantId: profile.tenantId, schoolId: profile.schoolId };
}

/** The class a student belongs to, via their section -- null if unassigned. */
export async function studentClass(prisma: PrismaService, studentId: string): Promise<{ schoolId: string; classId: string | null }> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { schoolId: true, section: { select: { classId: true } } },
  });
  if (!student) throw new NotFoundException("Student not found");
  return { schoolId: student.schoolId, classId: student.section?.classId ?? null };
}
