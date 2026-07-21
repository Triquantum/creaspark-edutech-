# Admin Manual — School & Organization Administrators

## First-day setup (new school)
1. **Branding** — Settings → School profile: logo, brand colour, academic year start.
2. **Structure** — create Classes (Grade 1–12) and Sections (A/B/…).
3. **Staff** — add users with the right role; each role sees only its own portal
   (19 roles from Principal to Security — see `docs/api.md` for what each can call).
4. **Fee plans** — Fees → Plans: define items (tuition, transport, labs) and due months;
   generate invoices per class in one action.
5. **Import students** — Students → Add (bulk CSV import lands in Phase 2; the API's
   `POST /students` already supports scripted import).

## Daily operations
- **Dashboard** is your control room: attendance %, collections vs target, pending invoices.
- **Recording an offline payment**: Fees → open invoice → Record payment (cash/cheque/UPI).
  Over-collection is blocked by the system; partial payments mark the invoice PARTIAL.
- **Announcements**: choose the audience roles; **pinned** notices stay on top of every
  matching user's dashboard.

## Security responsibilities
- Every sensitive action is written to the **audit log** with user, action and timestamp.
- Deactivate a departing staff member (Users → toggle Active) — this immediately blocks
  sign-in; their refresh tokens are revoked on next rotation.
- Never share the admin account; create individual accounts so the audit trail stays honest.

## Data isolation
Your school's data is isolated at the database-row level per tenant. Another school's IDs
simply return "not found" — even a compromised browser session cannot cross tenants.
