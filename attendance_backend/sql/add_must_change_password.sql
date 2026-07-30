-- Add must_change_password column to users table
-- Used for forcing newly bulk-registered students to change their password on first login

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;

-- Display migration completion message
SELECT 'Migration for must_change_password completed successfully!' AS status;
