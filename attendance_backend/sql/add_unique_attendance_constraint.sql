-- Add a unique constraint on (session_id, student_id) in attendance_records
-- to support atomic INSERT ... ON CONFLICT DO UPDATE upserts and prevent
-- duplicate attendance entries per session per student.
-- This is idempotent: IF NOT EXISTS prevents errors if the constraint already exists.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_attendance_session_student'
    ) THEN
        ALTER TABLE attendance_records
        ADD CONSTRAINT uq_attendance_session_student
        UNIQUE (session_id, student_id);
    END IF;
END
$$;

SELECT 'Migration: uq_attendance_session_student constraint ensured.' AS status;
