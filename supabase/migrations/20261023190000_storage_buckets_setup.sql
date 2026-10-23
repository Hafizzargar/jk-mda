-- Setup public storage buckets for article images and news media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('article-images', 'article-images', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']),
    ('news-media', 'news-media', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'])
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'];

-- Storage RLS policies
DROP POLICY IF EXISTS "Public can view article-images" ON storage.objects;
CREATE POLICY "Public can view article-images"
ON storage.objects FOR SELECT
USING (bucket_id IN ('article-images', 'news-media'));

DROP POLICY IF EXISTS "Authenticated employees can upload article-images" ON storage.objects;
CREATE POLICY "Authenticated employees can upload article-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id IN ('article-images', 'news-media'));
