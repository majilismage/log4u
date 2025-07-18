-- Add unit preference columns to user_google_config table
-- Run this migration to add support for user unit preferences

ALTER TABLE user_google_config 
ADD COLUMN IF NOT EXISTS "speedUnit" VARCHAR(10) DEFAULT 'knots',
ADD COLUMN IF NOT EXISTS "distanceUnit" VARCHAR(20) DEFAULT 'nautical_miles';

-- Add check constraints to ensure valid unit values
ALTER TABLE user_google_config 
ADD CONSTRAINT IF NOT EXISTS check_speed_unit 
CHECK ("speedUnit" IN ('knots', 'mph', 'kmh'));

ALTER TABLE user_google_config 
ADD CONSTRAINT IF NOT EXISTS check_distance_unit 
CHECK ("distanceUnit" IN ('miles', 'nautical_miles', 'kilometers'));

-- Update the updatedAt timestamp for any existing records
UPDATE user_google_config 
SET "updatedAt" = NOW() 
WHERE "speedUnit" IS NULL OR "distanceUnit" IS NULL;

-- Create index for faster unit preference queries (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_user_google_config_units 
ON user_google_config ("speedUnit", "distanceUnit");

-- Verify the migration
-- SELECT column_name, data_type, column_default, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'user_google_config' 
-- ORDER BY ordinal_position; 