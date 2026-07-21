/**
 * Full sidebar menu tree (parity with legacy school-ERP menus).
 * Groups collapse/expand; every leaf maps to a route. Routes not yet
 * implemented render the module scaffold page (app/(portal)/[...module]).
 */
export interface NavLeaf { label: string; href: string }
export interface NavGroup { label: string; icon: string; children?: NavLeaf[]; href?: string }

const r = (s: string) => "/" + s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const kids = (base: string, labels: string[]): NavLeaf[] =>
  labels.map((l) => ({ label: l, href: `${r(base)}${r(l)}` }));

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
  { label: "Leave Application", icon: "log-out", children: kids("leave", ["Leave Category", "Leave Assign", "Leave Apply", "Leave Applications"]) },
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
  { label: "Online Admission", icon: "file-plus", href: "/online-admission" },
  { label: "Visitor Information", icon: "id-card", href: "/visitors" },
  { label: "Administrator", icon: "settings-2", children: kids("admin", ["Register School", "Academic Year", "Certificate Template", "Admins", "Role", "Permission", "Backup", "Update"]) },
  { label: "Frontend", icon: "globe", children: kids("frontend", ["Pages", "Menu", "Photo Gallery", "News"]) },
  { label: "Settings", icon: "settings", children: kids("settings", ["General Settings", "Payment Settings", "SMS Settings", "Email Settings", "Language", "Theme"]) },
];
