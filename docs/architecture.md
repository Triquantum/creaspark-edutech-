# Architecture

## Overview

```
 Browser / PWA / Mobile
        │  HTTPS ({tenant}.educore.in)
        ▼
   NGINX / Cloudflare ──► Next.js (SSR, static, PWA)
        │                        │  X-Tenant + Bearer JWT
        ▼                        ▼
              NestJS API  (REST /api/v1, Swagger /docs)
        │  TenantMiddleware → AsyncLocalStorage tenant ctx
        │  Guards: JwtAuthGuard → RolesGuard → module logic
        ▼
   Prisma ──► PostgreSQL (row-level tenant isolation)
   Redis  ──► cache, rate limits, BullMQ job queues (phase 2)
   S3/R2  ──► documents, photos, report cards
```

## Tenancy model

Shared-database, shared-schema, **row-level isolation**:

- `tenantId` column + composite indexes on every tenant-scoped table.
- Tenant resolved once per request (subdomain or `X-Tenant` header) and pinned in
  `AsyncLocalStorage` — services call `currentTenant()` and never trust request bodies.
- Unique constraints are tenant-scoped (`@@unique([tenantId, email])`, etc.).
- Upgrade path: high-volume Enterprise tenants can be moved to a dedicated schema or
  database without API changes, since all access already flows through one context.

## Security

- scrypt password hashing (constant-time compare), JWT access (15 min) + rotating,
  hashed refresh tokens (revocation on rotation).
- RBAC: 19 roles enforced by `RolesGuard`; SUPER_ADMIN bypass; extendable to
  permission-level ABAC via the same decorator pattern.
- helmet, strict CORS, global validation pipe (whitelist), rate limiting (120 req/min),
  audit log on sensitive mutations. Prisma parameterization removes SQL-injection risk.

## Domain modules (API)

Each module = controller + service + DTOs, all tenant-scoped:
`auth`, `students`, `attendance`, `fees`, `announcements` today; exams, LMS, transport,
HR, library, hostel, inventory follow the identical layout (see roadmap).

## Scaling path

Stateless API → horizontal replicas behind NGINX/K8s; Postgres read replicas; Redis for
hot caches and queues; BullMQ workers for reports/notifications; ElasticSearch for
universal search when Postgres FTS is outgrown. `output: standalone` Next builds keep
web images small.
