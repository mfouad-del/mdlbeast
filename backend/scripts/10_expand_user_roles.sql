-- Expand allowed values for users.role to support member, supervisor, manager
BEGIN;
-- Drop existing check constraint if present; name may vary, so try common patterns
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
-- Add new check constraint with expanded values (including 'user' for backwards compatibility)
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','manager','supervisor','member','user'));
COMMIT;
