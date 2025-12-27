-- 11_add_statement_column.sql
-- Add an optional 'statement' column to documents so forms can include legal/statement text

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS statement TEXT;

-- Optionally add the column to barcodes for convenience (keeps a synced copy if desired)
ALTER TABLE barcodes
  ADD COLUMN IF NOT EXISTS statement TEXT;