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
