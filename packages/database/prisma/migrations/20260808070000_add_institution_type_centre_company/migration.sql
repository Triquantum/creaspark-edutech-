-- InstitutionType gains CENTRE and COMPANY alongside SCHOOL/COLLEGE/
-- INSTITUTE. Additive only -- existing School rows keep their current
-- institutionType unchanged. Safe to re-run.

ALTER TYPE "InstitutionType" ADD VALUE IF NOT EXISTS 'CENTRE';
ALTER TYPE "InstitutionType" ADD VALUE IF NOT EXISTS 'COMPANY';
