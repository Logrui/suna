BEGIN;

-- Create the browser-screenshots bucket for browser automation screenshots
-- This bucket stores screenshots captured during browser actions
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
    'browser-screenshots',
    'browser-screenshots',
    true,  -- Public access required for screenshot URLs
    52428800  -- 50MB limit
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for browser-screenshots bucket
DROP POLICY IF EXISTS "Users can upload to browser-screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Browser screenshots are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their browser screenshots" ON storage.objects;

-- Allow authenticated users to upload screenshots
CREATE POLICY "Users can upload to browser-screenshots" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'browser-screenshots'
    AND auth.role() = 'authenticated'
);

-- Make uploaded screenshots publicly readable (required for frontend/LLM access)
CREATE POLICY "Browser screenshots are publicly readable" ON storage.objects
FOR SELECT USING (bucket_id = 'browser-screenshots');

-- Allow users to delete their own screenshots
CREATE POLICY "Users can delete their browser screenshots" ON storage.objects
FOR DELETE USING (
    bucket_id = 'browser-screenshots'
    AND auth.role() = 'authenticated'
);

COMMIT;
