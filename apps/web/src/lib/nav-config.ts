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
  | "HR" | "INVENTORY_MANAGER" | "HOSTEL_WARDEN" | "SECURITY" | "PARENT" | "STUDENT" | "GUEST";

export interface NavLeaf { label: string; href: string; roles?: Role[] }
export interface NavGroup { label: string; icon: string; children?: NavLeaf[]; href?: string; roles?: Role[] }

const r = (s: string) => "/" + s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const kids = (base: string, labels: string[]): NavLeaf[] =>
  labels.map((l) => ({ label: l, href: `${r(base)}${r(l)}` }));

const SUPER_ADMIN_ONLY: Role[] = ["SUPER_ADMIN"];
const SCHOOL_MANAGEMENT: Role[] = ["SUPER_ADMIN", "ORG_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "COORDINATOR", "HR"];

export const NAV: NavGroup[] = [
  { label: "Dashboard", icon: "home", href: "/dashboard" },
  { label: "Student", icon: "user", href: "/students" },
  { label: "Parents", icon: "users", href: "/parents" },
  { label: "Teacher", icon: "user-check", href: "/teachers" },
  { label: "User", icon: "shield", href: "/users" },
  { label: "Academic", icon: "book", children: kids("academic", ["Class", "Division", "Subject", "Department", "Syllabus", "Assignment", "Routine"]) },
  { label: "Attendance", icon: "calendar-check", children: kids("attendance", ["Student Attendance", "Teacher Attendance", "Exam Attendance"]) },
  { label: "Exam", icon: "clipboard", children: kids("exam", ["Exam", "Exam Schedule", "Exam Grade", "Admit Card"]) },
  { label: "Mark", icon: "percent", children: kids("mark", ["Mark Entry", "Mark Distribution", "Promotion"]) },
  { label: "Message", icon: "message", href: "/message" },
  { label: "Media", icon: "image", href: "/media" },
  { label: "Mail / SMS", icon: "mail", href: "/mail-sms" },
  { label: "Online Exam", icon: "monitor", children: kids("online-exam", ["Question Group", "Question Level", "Question Bank", "Online Exam", "Instruction"]) },
  { label: "Payroll", icon: "wallet", children: kids("payroll", ["Salary Template", "Hourly Template", "Manage Salary", "Make Payment", "Overtime"]) },
  { label: "Asset Management", icon: "box", children: kids("assets", ["Vendor", "Location", "Asset Category", "Asset", "Asset Assignment", "Purchase"]) },
  { label: "Inventory", icon: "package", children: kids("inventory", ["Category", "Product", "Warehouse", "Supplier", "Purchase", "Sale"]) },
  {
    label: "Leave Application", icon: "log-out",
    // Category/Assign are admin config (define leave types, grant balances);
    // Apply/Applications are the actual "request leave / see my requests"
    // actions every staff member needs — keeping both under one roof was
    // confusing teachers into thinking the whole module was broken.
    children: [
      ...kids("leave", ["Leave Category", "Leave Assign"]).map((l) => ({ ...l, roles: SCHOOL_MANAGEMENT })),
      ...kids("leave", ["Leave Apply", "Leave Applications"]),
    ],
  },
  { label: "Child Care", icon: "heart", children: kids("child-care", ["Activity Category", "Activities", "Child Care"]) },
  { label: "Library", icon: "library", children: kids("library", ["Members", "Books", "Issue / Return", "E-Books"]) },
  { label: "Transport", icon: "bus", children: kids("transport", ["Routes", "Vehicles", "Members"]) },
  { label: "Hostel", icon: "building", children: kids("hostel", ["Hostels", "Category", "Members"]) },
  { label: "Sponsorship", icon: "hand-heart", children: kids("sponsorship", ["Candidates", "Sponsors", "Sponsorships"]) },
  { label: "Account", icon: "rupee", children: kids("account", ["Fee Types", "Invoices", "Payment History", "Expense", "Income", "Bank Payment"]) },
  { label: "Announcement", icon: "megaphone", children: kids("announcement", ["Notice", "Event", "Holiday"]) },
  { label: "Report", icon: "chart", children: kids("report", [
      "Class Report", "Student Report", "ID Card Report", "Admit Card Report", "Exam Schedule Report",
      "Attendance Report", "Attendance Overview", "Library Books Report", "Library Card Report", "Book Issue Report",
      "Terminal Report", "Merit Stage Report", "Tabulation Sheet", "Mark Sheet Report", "Progress Card Report",
      "Online Exam Report", "Online Admission Report", "Certificate Report", "Leave Report",
      "Product Purchase Report", "Product Sale Report", "Fees Report", "Due Fees Report", "Balance Fees Report",
      "Transaction Report", "Salary Report", "Account Ledger",
    ]) },
  { label: "Online Admission", icon: "file-plus", href: "/online-admission", roles: SUPER_ADMIN_ONLY },
  { label: "Visitor Information", icon: "id-card", href: "/visitors", roles: SUPER_ADMIN_ONLY },
  // Register School stays reachable by school-level admins (added earlier
  // as their dedicated onboarding entry point); the rest of Administrator
  // is platform-level config and super-admin only.
  { label: "Register School", icon: "file-plus", href: "/admin/register-school", roles: ["SUPER_ADMIN", "ORG_ADMIN", "SCHOOL_ADMIN"] },
  { label: "Administrator", icon: "settings-2", roles: SUPER_ADMIN_ONLY,
    children: kids("admin", ["Academic Year", "Certificate Template", "Admins", "Role", "Permission", "Backup", "Update"]) },
  { label: "Frontend", icon: "globe", roles: SUPER_ADMIN_ONLY, children: kids("frontend", ["Pages", "Menu", "Photo Gallery", "News"]) },
  { label: "Settings", icon: "settings", roles: SUPER_ADMIN_ONLY, children: kids("settings", ["General Settings", "Payment Settings", "SMS Settings", "Email Settings", "Language", "Theme"]) },
];
