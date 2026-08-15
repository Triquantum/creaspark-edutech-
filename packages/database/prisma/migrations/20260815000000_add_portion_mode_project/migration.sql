-- Portion Status: add "Project" as a third Mode option alongside
-- Practical (Lab) and Theory (Class). Additive only. Safe to re-run.

ALTER TYPE "PortionMode" ADD VALUE IF NOT EXISTS 'PROJECT';
