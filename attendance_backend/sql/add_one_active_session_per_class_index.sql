-- Migration: Prevent multiple ACTIVE sessions for the same class concurrently
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_session_per_class
ON attendance_sessions (class_id)
WHERE status = 'ACTIVE';

SELECT 'Migration uq_one_active_session_per_class applied successfully.' AS status;
