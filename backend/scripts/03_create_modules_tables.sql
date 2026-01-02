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
