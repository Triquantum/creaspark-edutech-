/**
 * Seed: one demo tenant ("Creaspark Demo Trust") with one school,
 * classes 1–10 (sections A/B), staff, 40 students with guardians,
 * a fee plan, invoices and a week of attendance.
 *
 * Default logins (password: Educore@123):
 *   admin@demo.educore.in     → SCHOOL_ADMIN
 *   teacher@demo.educore.in   → TEACHER
 *   parent@demo.educore.in    → PARENT
 *   student@demo.educore.in   → STUDENT
 */
import { PrismaClient, Role, AttendanceStatus } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";

const prisma = new PrismaClient();

function hashPassword(pw: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pw, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const FIRST = ["Aarav","Vivaan","Aditya","Ananya","Diya","Ishaan","Kavya","Rohan","Sara","Meera","Arjun","Nisha","Kabir","Tara","Dev","Riya","Aryan","Zoya","Vihaan","Anika"];
const LAST  = ["Sharma","Patel","Reddy","Iyer","Khan","Gupta","Nair","Singh","Das","Mehta"];

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo" },
    update: {},
    create: { name: "Creaspark Demo Trust", slug: "demo", plan: "ENTERPRISE" },
  });

  const school = await prisma.school.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "CDS" } },
    update: {},
    create: {
      tenantId: tenant.id, name: "Creaspark Demo School", code: "CDS",
      board: "CBSE", city: "Bengaluru", state: "Karnataka",
    },
  });

  const pw = hashPassword("Educore@123");
  const mkUser = (email: string, name: string, role: Role) =>
    prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email } },
      update: {},
      create: { tenantId: tenant.id, email, fullName: name, role, passwordHash: pw },
    });

  const admin = await mkUser("admin@demo.educore.in", "Asha Verma", Role.SCHOOL_ADMIN);
  const teacher = await mkUser("teacher@demo.educore.in", "Ravi Kulkarni", Role.TEACHER);
  await mkUser("parent@demo.educore.in", "Sunita Rao", Role.PARENT);
  await mkUser("student@demo.educore.in", "Aarav Rao", Role.STUDENT);

  await prisma.staffProfile.upsert({
    where: { userId: teacher.id },
    update: {},
    create: {
      tenantId: tenant.id, schoolId: school.id, userId: teacher.id,
      employeeNo: "EMP-001", designation: "Mathematics Teacher", department: "Science & Math",
    },
  });

  // Classes 1–10, sections A & B
  const sections: { id: string }[] = [];
  for (let g = 1; g <= 10; g++) {
    const cls = await prisma.class.upsert({
      where: { schoolId_name: { schoolId: school.id, name: `Grade ${g}` } },
      update: {},
      create: { tenantId: tenant.id, schoolId: school.id, name: `Grade ${g}` },
    });
    for (const s of ["A", "B"]) {
      const sec = await prisma.section.upsert({
        where: { classId_name: { classId: cls.id, name: s } },
        update: {},
        create: { tenantId: tenant.id, classId: cls.id, name: s },
      });
      sections.push(sec);
    }
  }

  // 40 students spread across sections
  const students = [];
  for (let i = 0; i < 40; i++) {
    const first = FIRST[i % FIRST.length];
    const last = LAST[i % LAST.length];
    const sec = sections[i % sections.length];
    const st = await prisma.student.upsert({
      where: { schoolId_admissionNo: { schoolId: school.id, admissionNo: `ADM-${1000 + i}` } },
      update: {},
      create: {
        tenantId: tenant.id, schoolId: school.id, sectionId: sec.id,
        admissionNo: `ADM-${1000 + i}`, rollNo: String((i % 20) + 1),
        firstName: first, lastName: last,
        gender: i % 2 ? "FEMALE" : "MALE",
        dob: new Date(2012 + (i % 6), i % 12, (i % 27) + 1),
      },
    });
    students.push(st);
    await prisma.guardian.create({
      data: {
        tenantId: tenant.id, studentId: st.id, relation: "Father",
        fullName: `Rajesh ${last}`, phone: `98${String(10000000 + i).padStart(8, "0")}`, isPrimary: true,
      },
    }).catch(() => {});
  }

  // Fee plan + invoices
  const plan = await prisma.feePlan.create({
    data: {
      tenantId: tenant.id, schoolId: school.id,
      name: "Standard Annual Plan", academicYear: "2026-27",
      items: { create: [
        { label: "Tuition", amount: 45000 },
        { label: "Transport", amount: 12000 },
        { label: "STEM Lab", amount: 6000 },
      ]},
    },
  });
  for (const [i, st] of students.entries()) {
    await prisma.feeInvoice.create({
      data: {
        tenantId: tenant.id, studentId: st.id, planId: plan.id,
        invoiceNo: `INV-2026-${String(i + 1).padStart(4, "0")}`,
        amount: 15750, dueDate: new Date("2026-07-10"),
        status: i % 3 === 0 ? "PAID" : "PENDING",
      },
    });
  }

  // One week of attendance
  const today = new Date();
  for (let d = 0; d < 5; d++) {
    const date = new Date(today); date.setDate(today.getDate() - d);
    for (const st of students) {
      const roll = Math.random();
      const status: AttendanceStatus = roll > 0.92 ? "ABSENT" : roll > 0.88 ? "LATE" : "PRESENT";
      await prisma.attendanceRecord.upsert({
        where: { studentId_date: { studentId: st.id, date } },
        update: {},
        create: {
          tenantId: tenant.id, sectionId: st.sectionId!, studentId: st.id,
          date, status, markedBy: teacher.id,
        },
      });
    }
  }

  for (const [name, code] of [["Mathematics","MATH"],["Science","SCI"],["English","ENG"],["Hindi","HIN"],["Social Studies","SST"],["Computer Science","CS"]] as const) {
    const found = await prisma.subject.findFirst({ where: { tenantId: tenant.id, name } });
    if (!found) await prisma.subject.create({ data: { tenantId: tenant.id, name, code } });
  }
  for (const name of ["Science & Math", "Languages", "Innovation Lab", "Sports", "Administration"]) {
    await prisma.department.upsert({
      where: { schoolId_name: { schoolId: school.id, name } },
      update: {}, create: { tenantId: tenant.id, schoolId: school.id, name },
    });
  }

  await prisma.announcement.create({
    data: {
      tenantId: tenant.id, schoolId: school.id,
      title: "Robotics Lab inauguration — Friday 10 AM",
      body: "All Grade 6–10 students are invited to the new Innovation Lab launch.",
      audience: [Role.STUDENT, Role.PARENT, Role.TEACHER], pinned: true, createdBy: admin.id,
    },
  });

  console.log("✅ Seed complete — tenant slug: demo");
}

main().finally(() => prisma.$disconnect());
