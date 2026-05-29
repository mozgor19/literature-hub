-- Increase body limit to fit embedded image URLs
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_body_check;
ALTER TABLE comments ADD CONSTRAINT comments_body_check
  CHECK (char_length(body) BETWEEN 1 AND 8000);

-- Public bucket for comment images (5 MB per file)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comment-images',
  'comment-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read (images are referenced from public comments)
CREATE POLICY "comment_images_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'comment-images');

-- Authenticated users can upload
CREATE POLICY "comment_images_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comment-images');

-- Users can delete their own images (first path segment = user_id)
CREATE POLICY "comment_images_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'comment-images' AND
    (string_to_array(name, '/'))[1] = auth.uid()::text
  );
