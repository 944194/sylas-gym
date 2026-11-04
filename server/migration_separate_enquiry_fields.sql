-- Run this once on each existing AURAFIT database before deploying the updated backend.
ALTER TABLE enquiries
    ADD COLUMN IF NOT EXISTS fitness_goal VARCHAR(100),
    ADD COLUMN IF NOT EXISTS enquiry_text TEXT NOT NULL DEFAULT '';
