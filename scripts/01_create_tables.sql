-- Create Users Table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Documents Table
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  barcode VARCHAR(255) UNIQUE NOT NULL,
  type VARCHAR(100) NOT NULL,
  sender VARCHAR(255) NOT NULL,
  receiver VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  subject TEXT NOT NULL,
  priority VARCHAR(50) NOT NULL CHECK (priority IN ('عادي', 'عاجل', 'عاجل جداً')),
  status VARCHAR(50) NOT NULL CHECK (status IN ('وارد', 'صادر', 'محفوظ')),
  classification VARCHAR(100),
  notes TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_documents_barcode ON documents(barcode);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_date ON documents(date);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Ensure triggers are idempotent: drop if they already exist before creating
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
