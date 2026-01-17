-- Add is_starred and reactions columns to internal_messages table
-- Run this migration to support the enhanced InternalCommunication component

ALTER TABLE internal_messages ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT false;
ALTER TABLE internal_messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;

-- Create index for starred messages
CREATE INDEX IF NOT EXISTS idx_internal_messages_starred ON internal_messages(is_starred) WHERE is_starred = true;
