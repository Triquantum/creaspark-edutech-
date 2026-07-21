# API Reference (summary)

Base URL: `https://{tenant}.educore.in/api/v1` — full interactive spec at `/docs` (Swagger).
All requests need `X-Tenant` (or subdomain) and, except auth, `Authorization: Bearer <jwt>`.

## Auth
| Method | Path | Notes |
|---|---|---|
| POST | /auth/login | `{email, password}` → access + refresh tokens |
| POST | /auth/refresh | Rotates refresh token |
| GET | /auth/me | Current user claims |

## Students
| Method | Path | Roles |
|---|---|---|
| GET | /students?q=&sectionId=&cursor= | admin, principal, teacher, coordinator, reception |
| GET | /students/:id | admin, principal, teacher, coordinator |
| POST | /students | admin, reception |

## Attendance
| POST | /attendance/mark | teacher, admin, coordinator — bulk upsert per section/date |
| GET | /attendance/summary?sectionId=&from=&to= | grouped counts by status |

## Fees
| GET | /fees/invoices?status=&studentId= | accountant, admin, principal |
| POST | /fees/payments | accountant, admin — transactional, balance-checked |
| GET | /fees/summary | collected vs outstanding |

## Announcements
| GET | /announcements | filtered to caller's role |
| POST | /announcements | admin, principal, coordinator |

Errors follow NestJS conventions: `{statusCode, message, error}`. Validation errors list
each failing field. 401 → re-authenticate; 403 → role insufficient; 404 → not found
*within your tenant* (cross-tenant IDs are indistinguishable from missing, by design).
