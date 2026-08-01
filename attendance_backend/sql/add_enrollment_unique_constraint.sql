-- Migration: Add UNIQUE constraint on (class_id, student_id) for atomic class enrollments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_enrollment_class_student'
    ) THEN
        ALTER TABLE class_enrollments
        ADD CONSTRAINT uq_enrollment_class_student
        UNIQUE (class_id, student_id);
    END IF;
END
$$;

SELECT 'Migration uq_enrollment_class_student applied successfully.' AS status;
