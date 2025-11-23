BEGIN;

-- Create the image-uploads bucket for LLM vision processing
-- This bucket stores images that will be analyzed by the vision tool
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
    'image-uploads',
    'image-uploads',
    true,
    52428800
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for image-uploads bucket
DROP POLICY IF EXISTS "Users can upload to image-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Image uploads are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their images" ON storage.objects;

-- Allow authenticated users to upload images
CREATE POLICY "Users can upload to image-uploads" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'image-uploads'
    AND auth.role() = 'authenticated'
);

-- Make uploaded images publicly readable (required for LLM access)
CREATE POLICY "Image uploads are publicly readable" ON storage.objects
FOR SELECT USING (bucket_id = 'image-uploads');

-- Allow users to delete their own uploaded images
CREATE POLICY "Users can delete their images" ON storage.objects
FOR DELETE USING (
    bucket_id = 'image-uploads'
    AND auth.role() = 'authenticated'
);

COMMIT;
