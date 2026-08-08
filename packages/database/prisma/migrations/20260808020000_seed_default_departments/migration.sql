-- Seed a default set of departments for every existing school, so the
-- Task Manager's "Assigned Department" picker (and the new Employee
-- directory) aren't empty out of the box. Idempotent: skips any
-- (schoolId, name) pair that already exists.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO "Department" ("id", "tenantId", "schoolId", "name")
SELECT gen_random_uuid()::text, s."tenantId", s."id", d.name
FROM "School" s
CROSS JOIN (VALUES
  ('Administration'),
  ('HR'),
  ('Accounts'),
  ('Academics'),
  ('IT'),
  ('Maintenance'),
  ('Admissions')
) AS d(name)
ON CONFLICT ("schoolId", "name") DO NOTHING;
