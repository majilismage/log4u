-- Add map zoom distance preference to user_google_config table
-- This allows users to customize the default zoom distance when viewing maps

ALTER TABLE user_google_config 
ADD COLUMN IF NOT EXISTS "mapZoomDistance" INTEGER DEFAULT 100;

-- Add check constraint to ensure reasonable zoom distance values (5-500 km/miles)
ALTER TABLE user_google_config 
ADD CONSTRAINT IF NOT EXISTS check_map_zoom_distance 
CHECK ("mapZoomDistance" >= 5 AND "mapZoomDistance" <= 500);

-- Update the updatedAt timestamp for any existing records
UPDATE user_google_config 
SET "updatedAt" = NOW() 
WHERE "mapZoomDistance" IS NULL;

-- Create index for faster map zoom preference queries (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_user_google_config_map_zoom 
ON user_google_config ("mapZoomDistance");

-- Verify the migration
-- SELECT column_name, data_type, column_default, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'user_google_config' AND column_name = 'mapZoomDistance';