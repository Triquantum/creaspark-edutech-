# Delivery Roadmap

The brief spans ~30 modules. This repo ships the foundation (Phase 0–1); each later phase
reuses the same patterns: a Prisma model group, a Nest module (controller/service/DTO with
`@Roles` + `currentTenant()`), and a portal page built from the existing UI kit.

| Phase | Scope | Builds on |
|---|---|---|
| 0 ✅ | Monorepo, tenancy, auth, RBAC, CI, Docker | — |
| 1 ✅ | Students, attendance, fees core, announcements, dashboard | 0 |
| 2 | Exams & report cards, timetable, subjects/teacher mapping | Student + Section models |
| 3 | Payments gateway (Razorpay webhooks), receipts/GST PDFs, accounting exports | Fees module |
| 4 | LMS: courses, assignments, submissions, progress; parent & student portals | Auth roles already defined |
| 5 | Transport (GPS ingest via Socket.io + Redis), library, inventory, hostel | Announcement/notification rails |
| 6 | HR & payroll, leave, recruitment | StaffProfile model |
| 7 | Communication hub: SMS/WhatsApp/email templates, push (FCM), circulars | BullMQ workers |
| 8 | STEM/robotics: kit inventory, lab sessions, competitions, certificates | Inventory + LMS |
| 9 | AI layer: lesson planner, report-card comments, risk detection, chatbot — via a dedicated `ai` service calling an LLM API with tenant-scoped context | All prior data |
| 10 | Super-admin console: tenant onboarding, plans/billing, usage analytics, audit explorer | Tenant model |
| 11 | Hardening: ElasticSearch universal search, K8s manifests, >95% coverage, pen test | Everything |

**Conventions to keep** (they're what make the codebase scale):
1. Never read `tenantId` from a request — always `currentTenant()`.
2. Every mutation writes an `AuditLog` row.
3. Every list endpoint: cursor pagination + tenant-scoped indexes.
4. Every new page: `Card`/`StatCard`/`Button` primitives, tokens from `tailwind.config.ts`.
