import {
  BadRequestException, Body, Controller, Delete, Get, Injectable, Module, NotFoundException,
  Param, Patch, Post, Res, UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Prisma, Role } from "@educore/database";
import type { Response } from "express";
import { readFileSync } from "fs";
import { join } from "path";
import PDFDocument from "pdfkit";
import nodemailer from "nodemailer";
import { PrismaService } from "../../prisma/prisma.service";
import { currentTenant } from "../../common/tenancy/tenant-context";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthUser, CurrentUser } from "../../common/decorators/current-user.decorator";
import {
  CreateTrainingDto, EmailTrainingReportDto, MarkAttendanceDto, SubmitFeedbackDto,
  UpdateTrainingDto, UpdateTrainingStatusDto,
} from "./trainings.dto";

const TRAINING_INCLUDE = {
  conductedBy: { select: { fullName: true } },
  targetSchool: { select: { name: true } },
};

// Report PDF styling -- shared across every section so headings, rules, and
// body text stay visually consistent instead of drifting section to section.
const NAVY = "#1e3a8a";
const SLATE = "#334155";
const MUTED = "#64748b";
const LINE = "#e2e8f0";

// Reuses the same bundled letterhead logo as the Employee salary
// certificate/slip (apps/api/src/modules/employees/assets) rather than
// duplicating the asset. nest-cli's asset copier places it at
// <dist>/modules/employees/assets, while `nest build`'s own tsc output
// nests this file one level deeper at <dist>/src/modules/trainings -- so
// __dirname needs three levels up (past src/) before descending back into
// modules/employees/assets.
const WATERMARK_LOGO_PATH = join(__dirname, "..", "..", "..", "modules", "employees", "assets", "creaspark-logo.jpeg");

function roleLabel(role: string): string {
  return role.toLowerCase().split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}
function statusLabel(status: string): string {
  return status[0] + status.slice(1).toLowerCase();
}

@Injectable()
export class TrainingsService {
  constructor(private prisma: PrismaService) {}

  private assetCache = new Map<string, Buffer | null>();

  /** Lazily read once per warm instance, matching employees.service.ts's
   * own asset-loading pattern -- bundled assets never change between
   * requests, and a missing file is cached as null so a report doesn't
   * retry a failed disk read on every generation. */
  private loadAsset(path: string): Buffer | null {
    if (!this.assetCache.has(path)) {
      try {
        this.assetCache.set(path, readFileSync(path));
      } catch {
        this.assetCache.set(path, null);
      }
    }
    return this.assetCache.get(path) ?? null;
  }

  /** Faint, centered background mark drawn before any other content on the
   * page so text and table rows sit on top of it. Called again after each
   * addPage() so multi-page attendance rosters carry it on every page, not
   * just the first. Silently skipped if the bundled asset is missing. */
  private drawWatermark(doc: PDFKit.PDFDocument) {
    const logo = this.loadAsset(WATERMARK_LOGO_PATH);
    if (!logo) return;
    const size = 320;
    const x = (doc.page.width - size) / 2;
    const y = (doc.page.height - size) / 2;
    doc.opacity(0.08).image(logo, x, y, { width: size, height: size }).opacity(1);
  }

  /** Uppercased navy heading with a thin rule underneath -- the same visual
   * unit repeated for Details/Feedback Summary/Attendance so every section
   * of the report reads as one consistent document. */
  private sectionHeading(doc: PDFKit.PDFDocument, title: string) {
    doc.font("Helvetica-Bold").fontSize(11).fillColor(NAVY).text(title.toUpperCase(), { characterSpacing: 0.4 });
    doc.moveDown(0.2);
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor(LINE).lineWidth(1).stroke();
    doc.moveDown(0.5);
  }

  /** A user's own school, resolved the same way messages.module.ts's
   * personFilter() does -- staff via StaffProfile, students directly,
   * parents via their first linked student. Returns null if none (e.g. an
   * admin role with no school of their own), which excludes them from any
   * school-restricted training while still matching platform-wide ones. */
  private async resolveMySchoolId(userId: string): Promise<string | null> {
    const staff = await this.prisma.staffProfile.findUnique({ where: { userId }, select: { schoolId: true } });
    if (staff) return staff.schoolId;
    const student = await this.prisma.student.findFirst({ where: { userId }, select: { schoolId: true } });
    if (student) return student.schoolId;
    const guardian = await this.prisma.guardian.findFirst({ where: { userId }, select: { student: { select: { schoolId: true } } } });
    return guardian?.student.schoolId ?? null;
  }

  private async isTargeted(
    training: { targetRoles: Role[]; targetSchoolId: string | null; targetClassIds: string[] },
    user: AuthUser,
  ): Promise<boolean> {
    const roleOk = training.targetRoles.length === 0 || training.targetRoles.includes(user.role as Role);
    if (!roleOk) return false;
    if (training.targetSchoolId && (await this.resolveMySchoolId(user.id)) !== training.targetSchoolId) return false;
    if (training.targetClassIds.length > 0 && user.role === Role.TEACHER) {
      const assigned = await this.prisma.teacherAssignment.findFirst({
        where: { teacherId: user.id, section: { classId: { in: training.targetClassIds } } },
      });
      if (!assigned) return false;
    }
    return true;
  }

  /** Same audience match used to decide who gets notified -- reused here so
   * the attendance picker lists exactly the people who were targeted.
   * targetClassIds narrows teachers to those with a TeacherAssignment on one
   * of those classes (via their section); non-teacher roles are unaffected. */
  private audienceWhere(targetRoles: Role[], targetSchoolId: string | null, targetClassIds: string[]): Prisma.UserWhereInput {
    const AND: Prisma.UserWhereInput[] = [{ isActive: true }];
    if (targetRoles.length > 0) AND.push({ role: { in: targetRoles } });
    if (targetSchoolId) AND.push({ staffProfile: { schoolId: targetSchoolId } });
    if (targetClassIds.length > 0) {
      AND.push({
        OR: [
          { role: { not: Role.TEACHER } },
          { teacherAssignments: { some: { section: { classId: { in: targetClassIds } } } } },
        ],
      });
    }
    return { AND };
  }

  /** Notifies the matched audience via the existing Message/bell system --
   * same reuse as portion.module.ts's notifyReviewers and tasks.module.ts's
   * notifyAssignee. Each recipient's message is stamped with THEIR OWN
   * tenantId (not the creating Super Admin's placeholder one) since a
   * platform-wide training's audience can span every tenant, and a
   * Message only surfaces in a recipient's own tenant-scoped inbox. */
  private async notifyAudience(
    training: { id: string; title: string }, creatorId: string,
    targetRoles: Role[], targetSchoolId: string | undefined, targetClassIds: string[],
  ) {
    const recipients = await this.prisma.user.findMany({
      where: this.audienceWhere(targetRoles, targetSchoolId ?? null, targetClassIds),
      select: { id: true, tenantId: true },
    });
    if (!recipients.length) return;
    await this.prisma.message.createMany({
      data: recipients.map((r) => ({
        tenantId: r.tenantId, senderId: creatorId, recipientId: r.id,
        subject: "New training scheduled",
        body: `"${training.title}" has been scheduled. Please share your feedback once it's complete.`,
      })),
    });
  }

  async create(dto: CreateTrainingDto, user: AuthUser) {
    const targetRoles = dto.targetRoles ?? [];
    const targetClassIds = dto.targetClassIds ?? [];
    const training = await this.prisma.training.create({
      data: {
        tenantId: currentTenant().tenantId, title: dto.title, description: dto.description,
        subject: dto.subject, venue: dto.venue, duration: dto.duration,
        resourcePerson: dto.resourcePerson, agenda: dto.agenda,
        ...(dto.status && { status: dto.status }),
        ...(dto.mode && { mode: dto.mode }),
        documentUrls: dto.documentUrls ?? [],
        conductedAt: new Date(dto.conductedAt), conductedById: user.id,
        targetRoles, targetSchoolId: dto.targetSchoolId, targetClassIds,
      },
      include: TRAINING_INCLUDE,
    });
    await this.notifyAudience(training, user.id, targetRoles, dto.targetSchoolId, targetClassIds);
    return training;
  }

  /** SUPER_ADMIN sees every training with a response count; everyone else
   * sees only trainings targeted at their role + school, each flagged with
   * whether they've already submitted feedback. */
  async list(user: AuthUser) {
    if (user.role === Role.SUPER_ADMIN) {
      return this.prisma.training.findMany({
        include: { ...TRAINING_INCLUDE, _count: { select: { feedback: true } } },
        orderBy: { conductedAt: "desc" },
      });
    }
    const mySchoolId = await this.resolveMySchoolId(user.id);
    const conditions: Prisma.TrainingWhereInput[] = [
      { OR: [{ targetRoles: { isEmpty: true } }, { targetRoles: { has: user.role as Role } }] },
      { OR: [{ targetSchoolId: null }, ...(mySchoolId ? [{ targetSchoolId: mySchoolId }] : [])] },
    ];
    if (user.role === Role.TEACHER) {
      const assignments = await this.prisma.teacherAssignment.findMany({
        where: { teacherId: user.id }, select: { section: { select: { classId: true } } },
      });
      const myClassIds = [...new Set(assignments.map((a) => a.section.classId))];
      conditions.push({ OR: [{ targetClassIds: { isEmpty: true } }, { targetClassIds: { hasSome: myClassIds } }] });
    }
    return this.prisma.training.findMany({
      where: { AND: conditions },
      include: {
        ...TRAINING_INCLUDE,
        feedback: { where: { respondentId: user.id }, select: { id: true } },
        attendance: { where: { userId: user.id }, select: { present: true } },
      },
      orderBy: { conductedAt: "desc" },
    });
  }

  private async findTraining(id: string) {
    const training = await this.prisma.training.findUnique({ where: { id } });
    if (!training) throw new NotFoundException("Training not found");
    return training;
  }

  /** SUPER_ADMIN-only: move a training through its Scheduled/Ongoing/Completed/Cancelled lifecycle. */
  async updateStatus(id: string, dto: UpdateTrainingStatusDto) {
    await this.findTraining(id);
    return this.prisma.training.update({
      where: { id }, data: { status: dto.status }, include: TRAINING_INCLUDE,
    });
  }

  /** SUPER_ADMIN-only: full edit. Optional text fields sent as "" clear the
   * stored value to null; omitted fields are left untouched. */
  async update(id: string, dto: UpdateTrainingDto) {
    await this.findTraining(id);
    const clearable = (v: string | undefined) => (v === undefined ? undefined : v || null);
    return this.prisma.training.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        description: clearable(dto.description),
        subject: clearable(dto.subject),
        venue: clearable(dto.venue),
        duration: clearable(dto.duration),
        resourcePerson: clearable(dto.resourcePerson),
        agenda: clearable(dto.agenda),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.mode !== undefined && { mode: dto.mode }),
        ...(dto.documentUrls !== undefined && { documentUrls: dto.documentUrls }),
        ...(dto.conductedAt !== undefined && { conductedAt: new Date(dto.conductedAt) }),
        ...(dto.targetRoles !== undefined && { targetRoles: dto.targetRoles }),
        targetSchoolId: clearable(dto.targetSchoolId),
        ...(dto.targetClassIds !== undefined && { targetClassIds: dto.targetClassIds }),
      },
      include: TRAINING_INCLUDE,
    });
  }

  /** SUPER_ADMIN-only: delete a training. Cascades to its attendance and feedback rows. */
  async remove(id: string) {
    await this.findTraining(id);
    await this.prisma.training.delete({ where: { id } });
    return { deleted: true };
  }

  /** SUPER_ADMIN-only: every response plus rating averages. */
  async getFeedback(id: string) {
    await this.findTraining(id);
    const responses = await this.prisma.trainingFeedback.findMany({
      where: { trainingId: id },
      include: { respondent: { select: { fullName: true, role: true } } },
      orderBy: { submittedAt: "desc" },
    });
    const avg = (key: "contentRating" | "trainerRating" | "usefulnessRating" | "overallRating") =>
      responses.length ? Math.round((responses.reduce((s, r) => s + r[key], 0) / responses.length) * 10) / 10 : null;
    return {
      responses,
      averages: {
        content: avg("contentRating"), trainer: avg("trainerRating"),
        usefulness: avg("usefulnessRating"), overall: avg("overallRating"),
      },
    };
  }

  async myFeedback(id: string, user: AuthUser) {
    return this.prisma.trainingFeedback.findUnique({
      where: { trainingId_respondentId: { trainingId: id, respondentId: user.id } },
    });
  }

  async submitFeedback(id: string, dto: SubmitFeedbackDto, user: AuthUser) {
    const training = await this.findTraining(id);
    if (!(await this.isTargeted(training, user))) throw new NotFoundException("Training not found");
    return this.prisma.trainingFeedback.upsert({
      where: { trainingId_respondentId: { trainingId: id, respondentId: user.id } },
      create: {
        tenantId: currentTenant().tenantId, trainingId: id, respondentId: user.id,
        contentRating: dto.contentRating, trainerRating: dto.trainerRating,
        usefulnessRating: dto.usefulnessRating, overallRating: dto.overallRating, comments: dto.comments,
      },
      update: {
        contentRating: dto.contentRating, trainerRating: dto.trainerRating,
        usefulnessRating: dto.usefulnessRating, overallRating: dto.overallRating, comments: dto.comments,
        submittedAt: new Date(),
      },
    });
  }

  /** SUPER_ADMIN-only: the targeted audience, each row carrying their
   * existing attendance mark (if any) so the picker opens pre-checked. */
  async getAttendance(id: string) {
    const training = await this.findTraining(id);
    const audience = await this.prisma.user.findMany({
      where: this.audienceWhere(training.targetRoles, training.targetSchoolId, training.targetClassIds),
      select: {
        id: true, fullName: true, role: true,
        staffProfile: { select: { school: { select: { name: true } } } },
      },
      orderBy: { fullName: "asc" },
    });
    const records = await this.prisma.trainingAttendance.findMany({ where: { trainingId: id } });
    const byUser = new Map(records.map((r) => [r.userId, r]));
    return audience.map((u) => ({
      userId: u.id, fullName: u.fullName, role: u.role, schoolName: u.staffProfile?.school.name ?? null,
      present: byUser.get(u.id)?.present ?? null,
      markedAt: byUser.get(u.id)?.markedAt ?? null,
    }));
  }

  /** SUPER_ADMIN-only: bulk upsert Present/Absent marks for the audience. */
  async markAttendance(id: string, dto: MarkAttendanceDto, user: AuthUser) {
    await this.findTraining(id);
    const tenantId = currentTenant().tenantId;
    await this.prisma.$transaction(
      dto.records.map((r) =>
        this.prisma.trainingAttendance.upsert({
          where: { trainingId_userId: { trainingId: id, userId: r.userId } },
          create: { tenantId, trainingId: id, userId: r.userId, present: r.present, markedById: user.id },
          update: { present: r.present, markedById: user.id, markedAt: new Date() },
        }),
      ),
    );
    return this.getAttendance(id);
  }

  /** Single-training report: details, feedback summary + responses, and the
   * attendance roster. Details/Feedback use a consistent label/value grid;
   * Attendance -- the densest, most-reprinted section -- gets a real
   * bordered table (sorted by school, then teacher name) rather than plain
   * text lines. A faint Creaspark watermark repeats on every page. */
  private buildTrainingReportPdf(
    training: Awaited<ReturnType<TrainingsService["findTraining"]>> & {
      conductedBy: { fullName: string }; targetSchool: { name: string } | null;
    },
    feedback: Awaited<ReturnType<TrainingsService["getFeedback"]>>,
    attendance: Awaited<ReturnType<TrainingsService["getAttendance"]>>,
    classNames: string[],
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 54, size: "A4" });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const contentWidth = right - left;

      this.drawWatermark(doc);

      doc.font("Helvetica-Bold").fontSize(17).fillColor(NAVY).text(training.title);
      doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(`Generated ${new Date().toLocaleString("en-IN")}`);
      doc.moveDown(0.5);
      doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor(NAVY).lineWidth(1.5).stroke();
      doc.lineWidth(1);
      doc.moveDown(1);

      // Grades/classes can repeat once per school they belong to (same id,
      // different school) -- dedupe the display names, not the ids.
      const uniqueClassNames = [...new Set(classNames)];
      const audience = [
        training.targetRoles.length === 0 ? "Everyone" : training.targetRoles.map(roleLabel).join(", "),
        training.targetSchool?.name,
        uniqueClassNames.length > 0 ? uniqueClassNames.join(", ") : null,
      ].filter(Boolean).join(" · ");

      this.sectionHeading(doc, "Details");
      const labelW = 130;
      const valueX = left + labelW;
      const valueW = right - valueX;
      const detailRows: [string, string][] = [
        ["Subject", training.subject ?? "—"],
        ["Status", statusLabel(training.status)],
        ["Mode", training.mode === "ONLINE" ? "Online" : "Offline"],
        ["Conducted on", new Date(training.conductedAt).toLocaleDateString("en-IN")],
        ["Conducted by", training.conductedBy.fullName],
        ["Venue", training.venue ?? "—"],
        ["Duration", training.duration ?? "—"],
        ["Resource person", training.resourcePerson ?? "—"],
        ["Audience", audience || "Everyone"],
      ];
      for (const [label, value] of detailRows) {
        const rowY = doc.y;
        const labelH = doc.font("Helvetica-Bold").fontSize(9).heightOfString(label.toUpperCase(), { width: labelW - 10 });
        const valueH = doc.font("Helvetica").fontSize(10).heightOfString(value, { width: valueW });
        doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text(label.toUpperCase(), left, rowY, { width: labelW - 10 });
        doc.font("Helvetica").fontSize(10).fillColor(SLATE).text(value, valueX, rowY, { width: valueW });
        doc.y = rowY + Math.max(labelH, valueH) + 6;
      }
      // pdfkit doesn't reset doc.x back to the margin after a positioned
      // text() call (x, y, opts) -- without this, the next flowing text()
      // call below would silently pick up the grid's rightmost x instead
      // of the page's left margin.
      doc.x = left;
      if (training.description) {
        doc.moveDown(0.3);
        doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text("DESCRIPTION");
        doc.font("Helvetica").fontSize(10).fillColor(SLATE).text(training.description, { align: "justify", lineGap: 2 });
      }
      if (training.agenda) {
        doc.moveDown(0.3);
        doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text("AGENDA");
        doc.font("Helvetica").fontSize(10).fillColor(SLATE).text(training.agenda, { lineGap: 2 });
      }
      if (training.documentUrls.length > 0) {
        doc.moveDown(0.3);
        doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text("DOCUMENTS");
        doc.font("Helvetica").fontSize(9).fillColor(NAVY);
        training.documentUrls.forEach((url, i) => doc.text(`${i + 1}. ${url.split("/").pop()}`, { lineGap: 1 }));
      }

      doc.moveDown(1);
      this.sectionHeading(doc, "Feedback Summary");
      const stats: [string, number | null][] = [
        ["Content", feedback.averages.content],
        ["Trainer", feedback.averages.trainer],
        ["Usefulness", feedback.averages.usefulness],
        ["Overall", feedback.averages.overall],
      ];
      const statW = contentWidth / stats.length;
      const statY = doc.y;
      stats.forEach(([label, val], i) => {
        const x = left + i * statW;
        doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(label.toUpperCase(), x, statY, { width: statW, align: "center" });
        doc.font("Helvetica-Bold").fontSize(16).fillColor(NAVY).text(val != null ? String(val) : "—", x, statY + 12, { width: statW, align: "center" });
      });
      doc.x = left;
      doc.y = statY + 38;
      doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor(LINE).stroke();
      doc.moveDown(0.6);

      if (feedback.responses.length === 0) {
        doc.font("Helvetica").fontSize(10).fillColor(MUTED).text("No feedback submitted yet.");
      } else {
        for (const r of feedback.responses) {
          doc.font("Helvetica-Bold").fontSize(10).fillColor(SLATE)
            .text(`${r.respondent.fullName}  `, { continued: true })
            .font("Helvetica").fontSize(9).fillColor(MUTED).text(`(${roleLabel(r.respondent.role)})`);
          doc.font("Helvetica").fontSize(9).fillColor(SLATE).text(
            `Content ${r.contentRating} · Trainer ${r.trainerRating} · Usefulness ${r.usefulnessRating} · Overall ${r.overallRating}`,
          );
          if (r.comments) doc.font("Helvetica-Oblique").fontSize(9).fillColor(MUTED).text(r.comments, { indent: 10 });
          doc.moveDown(0.4);
        }
      }

      doc.moveDown(0.6);
      this.sectionHeading(doc, "Attendance");
      if (attendance.length === 0) {
        doc.font("Helvetica").fontSize(10).fillColor(MUTED).text("No one is targeted by this training yet.");
      } else {
        const sorted = [...attendance].sort((a, b) => {
          const schoolCmp = (a.schoolName || "￿").localeCompare(b.schoolName || "￿");
          return schoolCmp !== 0 ? schoolCmp : a.fullName.localeCompare(b.fullName);
        });

        const cols = [
          { key: "no", label: "#", width: 24, align: "left" as const },
          { key: "name", label: "Name", width: 135, align: "left" as const },
          { key: "role", label: "Role", width: 62, align: "left" as const },
          { key: "school", label: "School", width: contentWidth - 24 - 135 - 62 - 85, align: "left" as const },
          { key: "status", label: "Status", width: 85, align: "right" as const },
        ];
        const rowH = 20;
        const headerH = 22;

        const drawHeader = (y: number) => {
          doc.rect(left, y, contentWidth, headerH).fill(NAVY);
          let x = left;
          doc.font("Helvetica-Bold").fontSize(9).fillColor("#fff");
          for (const col of cols) {
            doc.text(col.label, x + 8, y + 6, { width: col.width - 12, align: col.align });
            x += col.width;
          }
          return y + headerH;
        };

        let y = drawHeader(doc.y);
        sorted.forEach((a, i) => {
          if (y + rowH > doc.page.height - doc.page.margins.bottom) {
            doc.addPage();
            this.drawWatermark(doc);
            y = drawHeader(doc.page.margins.top);
          }
          if (i % 2 === 1) doc.rect(left, y, contentWidth, rowH).fill("#f8fafc");
          const mark = a.present === true ? "Present" : a.present === false ? "Absent" : "Not marked";
          const markColor = a.present === true ? "#16a34a" : a.present === false ? "#dc2626" : MUTED;
          const cellOpts = { height: rowH - 6, ellipsis: true };
          let x = left;
          doc.font("Helvetica").fontSize(9).fillColor(SLATE);
          doc.text(String(i + 1), x + 8, y + 6, { width: cols[0].width - 12, ...cellOpts }); x += cols[0].width;
          doc.text(a.fullName, x + 8, y + 6, { width: cols[1].width - 12, ...cellOpts }); x += cols[1].width;
          doc.text(roleLabel(a.role), x + 8, y + 6, { width: cols[2].width - 12, ...cellOpts }); x += cols[2].width;
          doc.text(a.schoolName ?? "—", x + 8, y + 6, { width: cols[3].width - 12, ...cellOpts }); x += cols[3].width;
          doc.font("Helvetica-Bold").fillColor(markColor).text(mark, x + 8, y + 6, { width: cols[4].width - 16, align: "right", ...cellOpts });
          doc.moveTo(left, y + rowH).lineTo(right, y + rowH).strokeColor(LINE).stroke();
          y += rowH;
        });
        doc.x = left;
        doc.y = y + 10;
      }

      doc.end();
    });
  }

  /** Fails fast with a clear message rather than a cryptic SMTP error if
   * the server has no email credentials configured yet. */
  private async sendEmail(to: string, subject: string, text: string, attachment: { filename: string; content: Buffer }): Promise<void> {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      throw new BadRequestException(
        "Email sending isn't configured on this server yet — an administrator needs to set SMTP_HOST/SMTP_USER/SMTP_PASS.",
      );
    }
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT ? Number(SMTP_PORT) : 587,
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    try {
      await transporter.sendMail({ from: SMTP_FROM || SMTP_USER, to, subject, text, attachments: [attachment] });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown SMTP error";
      throw new BadRequestException(`Could not send email: ${message}`);
    }
  }

  async reportPdf(id: string): Promise<Buffer> {
    const training = await this.prisma.training.findUnique({ where: { id }, include: TRAINING_INCLUDE });
    if (!training) throw new NotFoundException("Training not found");
    const [feedback, attendance, classes] = await Promise.all([
      this.getFeedback(id),
      this.getAttendance(id),
      training.targetClassIds.length
        ? this.prisma.class.findMany({ where: { id: { in: training.targetClassIds } }, select: { name: true } })
        : Promise.resolve([]),
    ]);
    return this.buildTrainingReportPdf(training, feedback, attendance, classes.map((c) => c.name));
  }

  async emailReport(id: string, toEmail: string): Promise<{ sent: boolean }> {
    const training = await this.findTraining(id);
    const pdf = await this.reportPdf(id);
    await this.sendEmail(
      toEmail,
      `Training Report — ${training.title}`,
      `Attached is the training report for "${training.title}", generated ${new Date().toLocaleString("en-IN")}.`,
      { filename: "training-report.pdf", content: pdf },
    );
    return { sent: true };
  }
}

@ApiTags("trainings")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("trainings")
export class TrainingsController {
  constructor(private svc: TrainingsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.svc.list(user);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  create(@Body() dto: CreateTrainingDto, @CurrentUser() user: AuthUser) {
    return this.svc.create(dto, user);
  }

  @Patch(":id/status")
  @Roles(Role.SUPER_ADMIN)
  updateStatus(@Param("id") id: string, @Body() dto: UpdateTrainingStatusDto) {
    return this.svc.updateStatus(id, dto);
  }

  @Patch(":id")
  @Roles(Role.SUPER_ADMIN)
  update(@Param("id") id: string, @Body() dto: UpdateTrainingDto) {
    return this.svc.update(id, dto);
  }

  @Delete(":id")
  @Roles(Role.SUPER_ADMIN)
  remove(@Param("id") id: string) {
    return this.svc.remove(id);
  }

  @Get(":id/feedback")
  @Roles(Role.SUPER_ADMIN)
  getFeedback(@Param("id") id: string) {
    return this.svc.getFeedback(id);
  }

  @Get(":id/my-feedback")
  myFeedback(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.svc.myFeedback(id, user);
  }

  @Post(":id/feedback")
  submitFeedback(@Param("id") id: string, @Body() dto: SubmitFeedbackDto, @CurrentUser() user: AuthUser) {
    return this.svc.submitFeedback(id, dto, user);
  }

  @Get(":id/attendance")
  @Roles(Role.SUPER_ADMIN)
  getAttendance(@Param("id") id: string) {
    return this.svc.getAttendance(id);
  }

  @Post(":id/attendance")
  @Roles(Role.SUPER_ADMIN)
  markAttendance(@Param("id") id: string, @Body() dto: MarkAttendanceDto, @CurrentUser() user: AuthUser) {
    return this.svc.markAttendance(id, dto, user);
  }

  /** "Print" is just opening this PDF in a new tab and using the browser's own print dialog. */
  @Get(":id/report/pdf")
  @Roles(Role.SUPER_ADMIN)
  async reportPdf(@Param("id") id: string, @Res() res: Response) {
    const pdf = await this.svc.reportPdf(id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="training-report.pdf"');
    res.send(pdf);
  }

  @Post(":id/report/email")
  @Roles(Role.SUPER_ADMIN)
  emailReport(@Param("id") id: string, @Body() dto: EmailTrainingReportDto) {
    return this.svc.emailReport(id, dto.toEmail);
  }
}

@Module({ controllers: [TrainingsController], providers: [TrainingsService] })
export class TrainingsModule {}
