# Creaspark™

**Empowering Future Ready Education** — Creaspark is a multi-tenant School ERP & LMS platform for
schools, school groups, trusts, STEM academies and coaching centers across India.

This repository is the **production foundation** of the platform: multi-tenant data model,
authenticated API with role-based access, and a premium Next.js front end — structured so
every remaining module (see `docs/roadmap.md`) slots into an existing pattern rather than
being invented from scratch.

## What's implemented

| Layer | Status |
|---|---|
| Multi-tenant core (Tenant → School → Users) with row-level isolation | ✅ |
| Auth: JWT access + rotating refresh tokens, scrypt password hashing | ✅ |
| RBAC: 19 roles, `@Roles()` guard on every endpoint | ✅ |
| Students module (search, cursor pagination, guardians, audit log) | ✅ |
| Attendance module (bulk mark, summaries, RFID/QR/biometric-ready enum) | ✅ |
| Fees module (plans, invoices, transactional payments, collections summary) | ✅ |
| Announcements (role-targeted) | ✅ |
| Prisma schema + seed (demo tenant, 40 students, invoices, attendance) | ✅ |
| Next.js 15 web app: landing, glass login, dashboard, students table, dark mode | ✅ |
| Swagger/OpenAPI at `/docs`, rate limiting, helmet, CORS | ✅ |
| Docker Compose (Postgres, Redis, API, Web), GitHub Actions CI | ✅ |
| Sample unit test (payment over-collection guard) | ✅ |
| Playwright E2E suite (login, dashboard, students, error states) | ✅ |
| Health endpoints (`/health/live`, `/health/ready`) for probes | ✅ |
| Kubernetes manifests (Deployments, HPA, Ingress, migrate Job) | ✅ |
| ER diagram (Mermaid), GraphQL schema spec, user & admin manuals | ✅ |

Remaining modules (exams UI, LMS, transport GPS, HR/payroll, AI features, etc.) are mapped
phase-by-phase in **`docs/roadmap.md`** and follow the exact patterns established here.

## Quick start

```bash
cp .env.example .env
docker compose up --build          # Postgres + Redis + API (4000) + Web (3000)

# or run locally:
pnpm install
pnpm db:migrate && pnpm db:seed
pnpm dev
```

- Web: http://localhost:3000
- API docs (Swagger): http://localhost:4000/docs
- Demo login: `admin@demo.educore.in` / `Educore@123` (tenant `demo`)

## Repository layout

```
apps/
  api/          NestJS REST API (modular: auth, students, attendance, fees, …)
  web/          Next.js 15 + Tailwind front end (landing, login, portal)
packages/
  database/     Prisma schema, migrations, seed — shared by all services
docs/           Architecture, API, deployment, roadmap
infra/          NGINX and deployment assets
.github/        CI pipeline (build, test, docker images)
```

## Multi-tenancy in one paragraph

Every tenant-scoped table carries `tenantId`. `TenantMiddleware` resolves the tenant from
the subdomain (`sunrise.educore.in`) or `X-Tenant` header, verifies it, and stores it in an
`AsyncLocalStorage` context. Services read `currentTenant()` — never client input — for
every query, so a compromised or buggy client can never read another school's rows. JWTs
also embed `tenantId`, and cross-checks reject mismatches.

## License

Proprietary — © 2026 Creaspark Technologies.
