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
