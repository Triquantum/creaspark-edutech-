/**
 * Full sidebar menu tree (parity with legacy school-ERP menus).
 * Groups collapse/expand; every leaf maps to a route. Routes not yet
 * implemented render the module scaffold page (app/(portal)/[...module]).
 *
 * `roles` restricts visibility to those roles; omitted = visible to
 * every authenticated role. Mirrors apps/api's Role enum as a plain
 * string union so the web app doesn't need @educore/database as a
 * dependency just for this type.
 */
export type Role =
  | "SUPER_ADMIN" | "ORG_ADMIN" | "SCHOOL_ADMIN" | "PRINCIPAL" | "VICE_PRINCIPAL" | "COORDINATOR"
  | "TEACHER" | "TRAINER" | "ACCOUNTANT" | "RECEPTION" | "LIBRARIAN" | "TRANSPORT_MANAGER"
  | "HR" | "INVENTORY_MANAGER" | "HOSTEL_WARDEN" | "SECURITY" | "SALES_MANAGER" | "SALES_EXECUTIVE"
  | "PARENT" | "STUDENT" | "GUEST";

export interface NavLeaf { label: string; href: string; roles?: Role[]; hiddenFrom?: Role[] }
export interface NavGroup { label: string; icon: string; children?: NavLeaf[]; href?: string; roles?: Role[]; hiddenFrom?: Role[] }

const r = (s: string) => "/" + s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const kids = (base: string, labels: string[]): NavLeaf[] =>
  labels.map((l) => ({ label: l, href: `${r(base)}${r(l)}` }));

const SUPER_ADMIN_ONLY: Role[] = ["SUPER_ADMIN"];
const SCHOOL_MANAGEMENT: Role[] = ["SUPER_ADMIN", "ORG_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "COORDINATOR", "HR"];
const SALES_TEAM: Role[] = ["SUPER_ADMIN", "ORG_ADMIN", "SALES_MANAGER", "SALES_EXECUTIVE"];
const SALES_MANAGE: Role[] = ["SUPER_ADMIN", "ORG_ADMIN", "SALES_MANAGER"];

export const NAV: NavGroup[] = [
  { label: "Dashboard", icon: "home", href: "/dashboard" },
  { label: "Student", icon: "user", href: "/students", hiddenFrom: ["PARENT", "STUDENT"] },
  { label: "Parents", icon: "users", href: "/parents", hiddenFrom: ["PARENT"] },
  { label: "Teacher", icon: "user-check", href: "/teachers", hiddenFrom: ["TEACHER"] },
  { label: "User", icon: "shield", href: "/users", hiddenFrom: ["TEACHER", "PARENT", "STUDENT"] },
  // Teachers only need their assigned Subject here -- Class/Division/Department/
  // Teacher Assignment/Syllabus/Assignment/Routine are admin-side org-chart and
  // scheduling tools, not something a teacher manages day to day.
  { label: "Academic", icon: "book", hiddenFrom: ["PARENT", "STUDENT"], children: [
    { label: "Class", href: "/academic/class", hiddenFrom: ["TEACHER"] },
    { label: "Division", href: "/academic/division", hiddenFrom: ["TEACHER"] },
    { label: "Subject", href: "/academic/subject" },
    { label: "Department", href: "/academic/department", hiddenFrom: ["TEACHER"] },
    { label: "Teacher Assignment", href: "/academic/teacher-assignment", hiddenFrom: ["TEACHER"] },
    { label: "Syllabus", href: "/academic/syllabus", hiddenFrom: ["TEACHER"] },
    { label: "Assignment", href: "/academic/assignment", hiddenFrom: ["TEACHER"] },
    { label: "Routine", href: "/academic/routine", hiddenFrom: ["TEACHER"] },
    { label: "Yearly Plan", href: "/academic/yearly-plan" },
  ] },
  { label: "Courses", icon: "monitor", href: "/lms/courses", roles: ["STUDENT", "PARENT"] },
  { label: "Virtual Class", icon: "cpu", href: "/circuit-lab", hiddenFrom: ["PARENT", "GUEST"] },
  { label: "Task Manager", icon: "check-square", hiddenFrom: ["PARENT", "STUDENT", "GUEST"], children: [
    { label: "All Tasks", href: "/tasks" },
    { label: "Task Manager Inbox", href: "/tasks/inbox" },
    { label: "Task Manager Outbox", href: "/tasks/outbox" },
  ] },
  { label: "Training", icon: "award", href: "/training", hiddenFrom: ["GUEST"] },
  { label: "School", icon: "graduation-cap", roles: ["SUPER_ADMIN", "ORG_ADMIN"],
    children: [
      { label: "Register School", href: "/admin/register-school", roles: SUPER_ADMIN_ONLY },
      { label: "View Registered Schools", href: "/admin/registered-schools" },
      { label: "Register Institute", href: "/admin/register-institute", roles: SUPER_ADMIN_ONLY },
      { label: "View Registered Institutes", href: "/admin/registered-institutes" },
    ] },
  { label: "Attendance", icon: "calendar-check", hiddenFrom: ["PARENT", "STUDENT"], children: kids("attendance", ["Student Attendance", "Teacher Attendance", "Exam Attendance"]) },
  { label: "Exam", icon: "clipboard", hiddenFrom: ["PARENT", "STUDENT"], children: kids("exam", ["Exam", "Exam Schedule", "Exam Grade", "Admit Card"]) },
  { label: "Mark", icon: "percent", hiddenFrom: ["PARENT", "STUDENT"], children: kids("mark", ["Mark Entry", "Mark Distribution", "Promotion"]) },
  { label: "Portion Status", icon: "percent", href: "/portion", hiddenFrom: ["PARENT", "STUDENT", "GUEST"] },
  { label: "Message", icon: "message", href: "/message" },
  { label: "Media", icon: "image", href: "/media" },
  { label: "Mail / SMS", icon: "mail", href: "/mail-sms", hiddenFrom: ["PARENT", "STUDENT"] },
  { label: "Online Exam", icon: "monitor", hiddenFrom: ["PARENT", "STUDENT"], children: kids("online-exam", ["Question Group", "Question Level", "Question Bank", "Online Exam", "Instruction"]) },
  { label: "Payroll", icon: "wallet", hiddenFrom: ["PARENT", "STUDENT"], children: kids("payroll", ["Salary Template", "Hourly Template", "Manage Salary", "Make Payment", "Overtime"]) },
  { label: "HR", icon: "user-check", roles: ["SUPER_ADMIN", "ORG_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "COORDINATOR", "HR"],
    children: [
      { label: "Employee", href: "/hr/employee" },
      { label: "Salary Slip Log", href: "/hr/salary-slip-log" },
      { label: "Salary Certificate Log", href: "/hr/salary-certificate-log" },
    ] },
  { label: "Asset Management", icon: "box", hiddenFrom: ["PARENT", "STUDENT"], children: [
    { label: "Vendor", href: "/assets/vendor" },
    { label: "Location", href: "/assets/location" },
    { label: "Asset Category", href: "/assets/asset-category" },
    { label: "Inventory", href: "/assets/inventory" },
    { label: "School Allocation", href: "/assets/school-allocation" },
    { label: "Reports", href: "/assets/reports" },
  ] },
  { label: "Sales Team", icon: "trending-up", roles: SALES_TEAM, children: [
    { label: "My Day", href: "/sales/my-day" },
    { label: "Activities", href: "/sales/activities" },
    { label: "Leads", href: "/sales/leads" },
    { label: "Follow-up Center", href: "/sales/follow-ups" },
    { label: "Opportunities", href: "/sales/opportunities" },
    { label: "Daily Report", href: "/sales/daily-report" },
    { label: "Team Performance", href: "/sales/team-performance", roles: SALES_MANAGE },
  ] },
  { label: "Inventory", icon: "package", hiddenFrom: ["PARENT", "STUDENT"], children: kids("inventory", ["Category", "Product", "Warehouse", "Supplier", "Purchase", "Sale"]) },
  {
    label: "Leave Application", icon: "log-out", hiddenFrom: ["PARENT", "STUDENT"],
    // Category/Assign are admin config (define leave types, grant balances);
    // Apply/Applications are the actual "request leave / see my requests"
    // actions every staff member needs — keeping both under one roof was
    // confusing teachers into thinking the whole module was broken. Neither
    // half is relevant to Parent/Student — they aren't staff and don't take
    // leave from school.
    children: [
      ...kids("leave", ["Leave Category", "Leave Assign"]).map((l) => ({ ...l, roles: SCHOOL_MANAGEMENT })),
      ...kids("leave", ["Leave Apply", "Leave Applications"]),
    ],
  },
  { label: "Child Care", icon: "heart", hiddenFrom: ["STUDENT", "TEACHER"], children: kids("child-care", ["Activity Category", "Activities", "Child Care"]) },
  { label: "Library", icon: "library", children: kids("library", ["Members", "Books", "Issue / Return", "E-Books"]) },
  { label: "Transport", icon: "bus", hiddenFrom: ["TEACHER"], children: kids("transport", ["Routes", "Vehicles", "Members"]) },
  { label: "Hostel", icon: "building", hiddenFrom: ["TEACHER"], children: kids("hostel", ["Hostels", "Category", "Members"]) },
  { label: "Sponsorship", icon: "hand-heart", hiddenFrom: ["TEACHER", "STUDENT", "PARENT"], children: kids("sponsorship", ["Candidates", "Sponsors", "Sponsorships"]) },
  { label: "Account", icon: "rupee", hiddenFrom: ["TEACHER", "STUDENT", "PARENT"], children: kids("account", ["Fee Types", "Invoices", "Payment History", "Expense", "Income", "Bank Payment"]) },
  { label: "Announcement", icon: "megaphone", children: kids("announcement", ["Notice", "Event", "Holiday"]) },
  { label: "Report", icon: "chart", hiddenFrom: ["PARENT", "STUDENT"], children: kids("report", [
      "Class Report", "Student Report", "ID Card Report", "Admit Card Report", "Exam Schedule Report",
      "Attendance Report", "Attendance Overview", "Library Books Report", "Library Card Report", "Book Issue Report",
      "Terminal Report", "Merit Stage Report", "Tabulation Sheet", "Mark Sheet Report", "Progress Card Report",
      "Online Exam Report", "Online Admission Report", "Certificate Report", "Leave Report",
      "Product Purchase Report", "Product Sale Report", "Fees Report", "Due Fees Report", "Balance Fees Report",
      "Transaction Report", "Salary Report", "Account Ledger",
    ]) },
  { label: "Online Admission", icon: "file-plus", href: "/online-admission", roles: SUPER_ADMIN_ONLY },
  { label: "Visitor Information", icon: "id-card", href: "/visitors", roles: SUPER_ADMIN_ONLY },
  { label: "Administrator", icon: "settings-2", roles: SUPER_ADMIN_ONLY,
    children: [
      { label: "People Directory", href: "/admin/people" },
      ...kids("admin", ["Academic Year", "Certificate Template", "Admins", "Role", "Permission", "Backup", "Update"]),
    ] },
  { label: "Frontend", icon: "globe", roles: SUPER_ADMIN_ONLY, children: kids("frontend", ["Pages", "Menu", "Photo Gallery", "News"]) },
  { label: "Settings", icon: "settings", roles: SUPER_ADMIN_ONLY, children: kids("settings", ["General Settings", "Payment Settings", "SMS Settings", "Email Settings", "Language", "Theme"]) },
];

export function visibleTo(role: Role | null, roles?: Role[], hiddenFrom?: Role[]) {
  if (!roles && !hiddenFrom) return true;
  if (role === null) return false;
  if (roles && !roles.includes(role)) return false;
  if (hiddenFrom && hiddenFrom.includes(role)) return false;
  return true;
}

export interface NavPage { label: string; href: string }

/** Every module page the given role can see, flattened for search — group
 * leaves get their group as a prefix so "Academic · Class" is distinct
 * from "Exam · Class". */
export function flattenPages(role: Role | null): NavPage[] {
  const pages: NavPage[] = [];
  for (const g of NAV) {
    if (!visibleTo(role, g.roles, g.hiddenFrom)) continue;
    if (g.href) pages.push({ label: g.label, href: g.href });
    for (const c of g.children ?? []) {
      if (!visibleTo(role, c.roles, c.hiddenFrom)) continue;
      pages.push({ label: g.children!.length > 1 ? `${g.label} · ${c.label}` : c.label, href: c.href });
    }
  }
  return pages;
}
