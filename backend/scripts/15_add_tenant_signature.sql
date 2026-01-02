-- 15_add_tenant_signature.sql
-- Add institution (tenant) signature image URL for approvals/requests

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS signature_url TEXT;
