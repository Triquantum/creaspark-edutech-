import { ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthUser } from "../decorators/current-user.decorator";
import { currentTenant } from "../tenancy/tenant-context";

/**
 * Resolves which single student a caller may view student-scoped data for.
 * STUDENT: only their own linked Student row. PARENT: only a child linked via
 * Guardian.userId (defaults to their primary child when none is specified).
 * Any other role: the requested id as-is — the @Roles guard on the route
 * already restricts who can reach staff-only endpoints.
 */
export async function resolveViewableStudentId(
  prisma: PrismaService,
  user: AuthUser,
  requestedStudentId?: string,
): Promise<string> {
  const { tenantId } = currentTenant();

  if (user.role === "STUDENT") {
    const student = await prisma.student.findFirst({ where: { userId: user.id, tenantId } });
    if (!student) throw new ForbiddenException("No student profile linked to this account");
    if (requestedStudentId && requestedStudentId !== student.id) {
      throw new ForbiddenException("You can only view your own records");
    }
    return student.id;
  }

  if (user.role === "PARENT") {
    if (!requestedStudentId) {
      const primary = await prisma.guardian.findFirst({
        where: { userId: user.id, tenantId },
        orderBy: { isPrimary: "desc" },
      });
      if (!primary) throw new ForbiddenException("No children linked to this account");
      return primary.studentId;
    }
    const link = await prisma.guardian.findFirst({
      where: { userId: user.id, studentId: requestedStudentId, tenantId },
    });
    if (!link) throw new ForbiddenException("You can only view your own children's records");
    return requestedStudentId;
  }

  if (!requestedStudentId) throw new ForbiddenException("studentId is required");
  return requestedStudentId;
}

/** Every student a PARENT's account may view — powers the child picker in the
 * UI. `activeOnly` restricts to status: ACTIVE (used by the /students/mine
 * picker route); left false for internal callers like MessagesService that
 * need every linked child regardless of status (e.g. section broadcasts for
 * a transferred child shouldn't just vanish from their inbox). */
export async function listViewableStudents(prisma: PrismaService, user: AuthUser, activeOnly = false) {
  const { tenantId } = currentTenant();

  if (user.role === "STUDENT") {
    const student = await prisma.student.findFirst({
      where: { userId: user.id, tenantId, ...(activeOnly && { status: "ACTIVE" }) },
      select: { id: true, firstName: true, lastName: true },
    });
    return student ? [student] : [];
  }

  if (user.role === "PARENT") {
    const links = await prisma.guardian.findMany({
      where: { userId: user.id, tenantId, ...(activeOnly && { student: { status: "ACTIVE" } }) },
      orderBy: { isPrimary: "desc" },
      select: { student: { select: { id: true, firstName: true, lastName: true } } },
    });
    return links.map((l) => l.student);
  }

  return [];
}
