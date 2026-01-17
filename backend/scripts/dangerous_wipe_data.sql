
-- ============================================================================
-- DANGEROUS: WIPE ALL DATA EXCEPT SYSTEM USERS
-- ============================================================================

-- 1. Truncate operational tables (Order matters due to Foreign Keys)
TRUNCATE TABLE 
  audit_logs,
  notifications,
  approval_requests,
  documents,
  projects,
  clients,
  payment_requests,
  supervision_reports,
  internal_messages,
  email_queue
RESTART IDENTITY CASCADE;

-- 2. Delete Non-System Users
DELETE FROM users 
WHERE email NOT IN ('admin@mdlbeast.com', 'user@mdlbeast.com');

-- 3. Reset Sequences (Optional, for clean IDs)
ALTER SEQUENCE documents_id_seq RESTART WITH 1;
ALTER SEQUENCE approval_requests_id_seq RESTART WITH 1;
ALTER SEQUENCE projects_id_seq RESTART WITH 1;

