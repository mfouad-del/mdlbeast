-- ============================================================================
-- MDLBEAST Communications System - Consolidated Database Schema
-- ============================================================================
-- This consolidated schema replaces 47+ migration scripts for fresh installs
-- For existing databases, continue using migration scripts
-- Version: 2.0
-- Date: 2026-01-17
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS & AUTHENTICATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'member',
  
  -- Hierarchy
  parent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  scope VARCHAR(20) DEFAULT 'own',
  
  -- Profile
  phone VARCHAR(50),
  department VARCHAR(100),
  position VARCHAR(100),
  profile_picture_url TEXT,
  signature_url TEXT,
  stamp_url TEXT,
  
  -- Permissions (JSONB for flexibility)
  permissions JSONB DEFAULT '{}'::jsonb,
  
  -- Tenant (Multi-tenant support)
  tenant_id INTEGER,
  
  -- Notification preferences
  notify_email BOOLEAN DEFAULT true,
  notify_document BOOLEAN DEFAULT true,
  notify_approval BOOLEAN DEFAULT true,
  notify_project BOOLEAN DEFAULT true,
  notify_internal_comm BOOLEAN DEFAULT false,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_parent_id ON users(parent_id);
CREATE INDEX idx_users_manager_id ON users(manager_id);
CREATE INDEX idx_users_tenant_id ON users(tenant_id);

-- ============================================================================
-- DOCUMENTS & ARCHIVE
-- ============================================================================

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  barcode VARCHAR(50) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL,
  sender VARCHAR(255),
  receiver VARCHAR(255),
  date TIMESTAMP DEFAULT NOW(),
  subject TEXT,
  priority VARCHAR(50) DEFAULT 'normal',
  status VARCHAR(50) DEFAULT 'active',
  classification VARCHAR(50) DEFAULT 'public',
  notes TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  user_id INTEGER REFERENCES users(id),
  tenant_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_documents_barcode ON documents(barcode);
CREATE INDEX idx_documents_type ON documents(type);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_tenant_id ON documents(tenant_id);
CREATE INDEX idx_documents_date ON documents(date DESC);

-- ============================================================================
-- PROJECTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  contact_person VARCHAR(255),
  notes TEXT,
  tenant_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  project_number VARCHAR(100) UNIQUE NOT NULL,
  client_id INTEGER REFERENCES clients(id),
  location TEXT,
  contract_value NUMERIC(15,2),
  status VARCHAR(50) DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  description TEXT,
  documents JSONB DEFAULT '[]'::jsonb,
  created_by INTEGER REFERENCES users(id),
  tenant_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_projects_number ON projects(project_number);
CREATE INDEX idx_projects_client_id ON projects(client_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_by ON projects(created_by);

-- ============================================================================
-- APPROVALS
-- ============================================================================

CREATE TABLE IF NOT EXISTS approval_requests (
  id SERIAL PRIMARY KEY,
  requester_id INTEGER REFERENCES users(id) NOT NULL,
  manager_id INTEGER REFERENCES users(id) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  attachment_url TEXT,
  signed_attachment_url TEXT,
  approval_number VARCHAR(100) UNIQUE,
  status VARCHAR(50) DEFAULT 'PENDING',
  seen_by_requester BOOLEAN DEFAULT false,
  tenant_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_approval_requests_requester ON approval_requests(requester_id);
CREATE INDEX idx_approval_requests_manager ON approval_requests(manager_id);
CREATE INDEX idx_approval_requests_status ON approval_requests(status);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  type VARCHAR(50) DEFAULT 'info',
  entity_type VARCHAR(50),
  entity_id VARCHAR(100),
  link VARCHAR(255),
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  priority VARCHAR(20) DEFAULT 'normal',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_type ON notifications(type);

-- ============================================================================
-- EMAIL QUEUE
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_queue (
  id SERIAL PRIMARY KEY,
  to_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  html TEXT NOT NULL,
  locale VARCHAR(5) DEFAULT 'en',
  status VARCHAR(50) DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_queue_status ON email_queue(status);
CREATE INDEX idx_email_queue_created_at ON email_queue(created_at);

-- ============================================================================
-- AUDIT LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id VARCHAR(100),
  details TEXT,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================================================
-- PAYMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_requests (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  requested_by INTEGER REFERENCES users(id),
  approved_by INTEGER REFERENCES users(id),
  amount NUMERIC(15,2) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  attachment_url TEXT,
  transfer_number VARCHAR(100),
  bank_name VARCHAR(255),
  collection_date DATE,
  collected_by INTEGER REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payment_requests_project ON payment_requests(project_id);
CREATE INDEX idx_payment_requests_status ON payment_requests(status);

-- ============================================================================
-- REPORTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS supervision_reports (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  engineer_id INTEGER REFERENCES users(id),
  visit_date DATE NOT NULL,
  report_number INTEGER,
  work_progress INTEGER DEFAULT 0,
  notes TEXT,
  recommendations TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(50) DEFAULT 'draft',
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_supervision_reports_project ON supervision_reports(project_id);
CREATE INDEX idx_supervision_reports_status ON supervision_reports(status);

-- ============================================================================
-- INTERNAL COMMUNICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS internal_messages (
  id SERIAL PRIMARY KEY,
  channel VARCHAR(100) DEFAULT 'general',
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_internal_messages_channel ON internal_messages(channel);
CREATE INDEX idx_internal_messages_created_at ON internal_messages(created_at DESC);

-- ============================================================================
-- SYSTEM SETTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  value JSONB,
  description TEXT,
  updated_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_system_settings_key ON system_settings(key);

-- ============================================================================
-- TENANTS (Multi-tenant support)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  logo_url TEXT,
  signature_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- SEQUENCES (for document numbering)
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS doc_in_seq START 1;
CREATE SEQUENCE IF NOT EXISTS doc_out_seq START 1;

-- ============================================================================
-- TRIGGERS (auto-update timestamps)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================


-- 03_create_modules_tables.sql
-- Tables for Barcode Intelligence, Tenants, Snapshots and Reports

-- Barcodes
CREATE TABLE IF NOT EXISTS barcodes (
  id SERIAL PRIMARY KEY,
  barcode VARCHAR(255) UNIQUE NOT NULL,
  type VARCHAR(100),
  status VARCHAR(50),
  priority VARCHAR(50),
  subject TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  tenant_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Barcode timeline (tracking events)
CREATE TABLE IF NOT EXISTS barcode_timeline (
  id SERIAL PRIMARY KEY,
  barcode_id INTEGER REFERENCES barcodes(id) ON DELETE CASCADE,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(255) NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tenants (multi-tenant branding)
CREATE TABLE IF NOT EXISTS tenants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  logo_url TEXT,
  signature_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Snapshots for backup/restore metadata
CREATE TABLE IF NOT EXISTS snapshots (
  id SERIAL PRIMARY KEY,
  file_name TEXT NOT NULL,
  size_bytes BIGINT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reports table (audit / cached reports meta)
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  params JSONB DEFAULT '{}'::jsonb,
  generated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- helper triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure triggers are idempotent
DROP TRIGGER IF EXISTS update_barcodes_updated_at ON barcodes;
DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;

CREATE TRIGGER update_barcodes_updated_at BEFORE UPDATE ON barcodes
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- 04_seed_modules.sql
-- Seed a test barcode and a timeline entry (idempotent)

WITH user_id AS (
  SELECT id as uid FROM users WHERE username='admin@mdlbeast.com' OR username='admin@zaco.sa' LIMIT 1
), upsert AS (
  INSERT INTO barcodes (barcode, type, status, priority, subject, attachments, user_id)
  VALUES ('TEST123456','incoming','وارد','عادي','Seeded test barcode','[]'::jsonb, (SELECT uid FROM user_id))
  ON CONFLICT (barcode) DO UPDATE SET subject = EXCLUDED.subject
  RETURNING id
)
INSERT INTO barcode_timeline (barcode_id, actor_id, action, meta)
SELECT b.id, u.uid, 'seeded', jsonb_build_object('note','seeded test barcode')
FROM (SELECT id FROM barcodes WHERE barcode='TEST123456' LIMIT 1) b, user_id u
WHERE NOT EXISTS (SELECT 1 FROM barcode_timeline t WHERE t.barcode_id = b.id AND t.action = 'seeded');



-- 05_create_indexes.sql
-- Add useful indexes for barcode and timeline queries

CREATE INDEX IF NOT EXISTS idx_barcodes_barcode ON barcodes (lower(barcode));
CREATE INDEX IF NOT EXISTS idx_barcodes_created_at ON barcodes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_barcode_timeline_barcode_id_created_at ON barcode_timeline (barcode_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_created_at ON snapshots (created_at DESC);

-- Vacuum analyze to refresh planner stats
ANALYZE barcodes;
ANALYZE barcode_timeline;
ANALYZE snapshots;



-- 07_create_sequences.sql
-- Sequences for document barcode numbering

CREATE SEQUENCE IF NOT EXISTS doc_in_seq START 1;
CREATE SEQUENCE IF NOT EXISTS doc_out_seq START 1;


-- Create a unified numeric sequence for new barcodes (doc_seq)
CREATE SEQUENCE IF NOT EXISTS doc_seq START 1;

-- Note: existing doc_in_seq/doc_out_seq remain and are not modified to preserve history.
-- New documents will use doc_seq and produce numeric-only barcodes like 0000001, 0000002, ...


-- Expand allowed values for users.role to support member, supervisor, manager
BEGIN;
-- Drop existing check constraint if present; name may vary, so try common patterns
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
-- Add new check constraint with expanded values (including 'user' for backwards compatibility)
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','manager','supervisor','member','user'));
COMMIT;


CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50), -- 'DOCUMENT', 'REPORT', 'AUTH', 'SYSTEM'
  entity_id VARCHAR(50),   -- Document ID or Barcode
  details TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);


-- Add columns to users table for hierarchy and signatures
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS signature_url TEXT,
ADD COLUMN IF NOT EXISTS stamp_url TEXT;

-- Create Approval Requests Table
CREATE TABLE IF NOT EXISTS approval_requests (
  id SERIAL PRIMARY KEY,
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manager_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  attachment_url TEXT NOT NULL,
  signed_attachment_url TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Indexes
CREATE INDEX IF NOT EXISTS idx_approval_requests_requester ON approval_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_manager ON approval_requests(manager_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_approval_requests_updated_at ON approval_requests;
CREATE TRIGGER update_approval_requests_updated_at
    BEFORE UPDATE ON approval_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- 15_add_tenant_signature.sql
-- Add institution (tenant) signature image URL for approvals/requests

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS signature_url TEXT;


-- Add seen_by_requester column to track if user has viewed the response
-- This enables notification badges to show unread responses

ALTER TABLE approval_requests 
ADD COLUMN IF NOT EXISTS seen_by_requester BOOLEAN DEFAULT FALSE;

-- Set existing approved/rejected requests as seen (to avoid showing old notifications)
UPDATE approval_requests 
SET seen_by_requester = TRUE 
WHERE status != 'PENDING';

-- Create index for fast notification queries
CREATE INDEX IF NOT EXISTS idx_approval_requests_seen 
ON approval_requests(requester_id, status, seen_by_requester);

COMMENT ON COLUMN approval_requests.seen_by_requester IS 'Whether requester has seen the manager response (for notification badges)';


-- Migration 17: Add unique approval numbers
-- Created: 2026-01-03

-- Add approval_number column
ALTER TABLE approval_requests 
ADD COLUMN IF NOT EXISTS approval_number VARCHAR(20) UNIQUE;

-- Create sequence for approval numbers
CREATE SEQUENCE IF NOT EXISTS approval_number_seq START 1;

-- Update existing records with sequential numbers
UPDATE approval_requests 
SET approval_number = 'APV-' || LPAD(nextval('approval_number_seq')::TEXT, 6, '0')
WHERE approval_number IS NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_approval_requests_number ON approval_requests(approval_number);

-- Add comment
COMMENT ON COLUMN approval_requests.approval_number IS 'Unique approval request number (e.g., APV-000001)';


-- Migration 18: Add email column to users table
-- This enables email notifications for approval requests

-- Add email column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'email'
  ) THEN
    ALTER TABLE users ADD COLUMN email VARCHAR(255);
    
    -- Add unique constraint
    CREATE UNIQUE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
    
    RAISE NOTICE 'Added email column to users table';
  ELSE
    RAISE NOTICE 'Email column already exists in users table';
  END IF;
END $$;

-- Note: Email is optional, so no NOT NULL constraint
-- Admins should update user emails through the user management interface


ALTER TABLE documents ADD COLUMN IF NOT EXISTS attachment_count VARCHAR(255) DEFAULT '0';


-- ============================================================================
-- Email Queue Migration
-- Run this on your production database
-- ============================================================================

-- Create email_queue table
CREATE TABLE IF NOT EXISTS email_queue (
  id SERIAL PRIMARY KEY,
  to_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  html TEXT NOT NULL,
  locale VARCHAR(5) DEFAULT 'en',
  status VARCHAR(50) DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_created_at ON email_queue(created_at);

-- Add notification preferences columns if not exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='users' AND column_name='notify_email') THEN
    ALTER TABLE users ADD COLUMN notify_email BOOLEAN DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='users' AND column_name='notify_document') THEN
    ALTER TABLE users ADD COLUMN notify_document BOOLEAN DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='users' AND column_name='notify_approval') THEN
    ALTER TABLE users ADD COLUMN notify_approval BOOLEAN DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='users' AND column_name='notify_project') THEN
    ALTER TABLE users ADD COLUMN notify_project BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Add priority column to notifications if not exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='notifications' AND column_name='priority') THEN
    ALTER TABLE notifications ADD COLUMN priority VARCHAR(20) DEFAULT 'normal';
  END IF;
END $$;

-- Create index on notification priority
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);

COMMENT ON TABLE email_queue IS 'Email queue for async sending with retry logic';
COMMENT ON COLUMN email_queue.status IS 'pending, sent, or failed';
COMMENT ON COLUMN email_queue.locale IS 'Language for email template (en or ar)';


-- ============================================================================
-- MDLBEAST Communications - Remove Unused Tables
-- ============================================================================
-- This script removes tables that are not needed for MDLBEAST operations:
-- - clients (not used)
-- - projects (not used)
-- - tenants (multi-tenant not needed)
-- - payment_requests (not used)
-- - supervision_reports (not used)
-- 
-- CAUTION: This will delete data permanently. Backup first!
-- ============================================================================

BEGIN;

-- Drop tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS supervision_reports CASCADE;
DROP TABLE IF EXISTS payment_requests CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

-- Remove tenant_id column from users table if it exists
ALTER TABLE users DROP COLUMN IF EXISTS tenant_id CASCADE;

-- Remove tenant_id column from documents table if it exists
ALTER TABLE documents DROP COLUMN IF EXISTS tenant_id CASCADE;

COMMIT;

-- Verify tables are removed
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('clients', 'projects', 'tenants', 'payment_requests', 'supervision_reports')
ORDER BY table_name;

-- Should return 0 rows if successful


