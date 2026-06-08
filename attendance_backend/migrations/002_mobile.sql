CREATE TABLE device_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    biometric_enrolled BOOLEAN DEFAULT FALSE,
    expo_push_token TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, device_id)
);

ALTER TABLE attendance_records
ADD COLUMN biometric_verified BOOLEAN DEFAULT FALSE;
