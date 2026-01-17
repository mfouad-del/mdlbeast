-- ============================================================================
-- Migration: Add attachment_count column to documents table
-- Date: 2026-01-17
-- Purpose: Fix "column attachment_count does not exist" error
-- ============================================================================

-- Add attachment_count column if it doesn't exist
ALTER TABLE documents ADD COLUMN IF NOT EXISTS attachment_count VARCHAR(255) DEFAULT '0';

-- Update existing rows to have default value
UPDATE documents SET attachment_count = '0' WHERE attachment_count IS NULL;

-- Optional: Update attachment_count based on existing attachments JSONB array
-- Uncomment if you want to sync with existing data:
-- UPDATE documents SET attachment_count = CAST(COALESCE(jsonb_array_length(attachments), 0) AS VARCHAR);

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'documents' AND column_name = 'attachment_count';
