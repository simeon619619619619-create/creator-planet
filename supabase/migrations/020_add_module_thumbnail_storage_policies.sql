-- Add storage policies for module thumbnails
-- The course-thumbnails bucket is being reused for module thumbnails
-- File path format: modules/{module_id}/thumbnail-{timestamp}.{ext}
--
-- Root cause: The existing "Creators can upload course thumbnails" policy
-- expected the first folder to be a course ID, but uploadModuleThumbnail()
-- was uploading to modules/{moduleId}/... which didn't match the policy.

-- Allow creators to upload module thumbnails
CREATE POLICY "Creators can upload module thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'course-thumbnails'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'modules'
  AND EXISTS (
    SELECT 1 FROM modules m
    JOIN courses c ON m.course_id = c.id
    WHERE m.id::text = (storage.foldername(name))[2]
    AND c.creator_id = get_my_profile_id()
  )
);

-- Allow creators to update module thumbnails
CREATE POLICY "Creators can update module thumbnails"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'course-thumbnails'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'modules'
  AND EXISTS (
    SELECT 1 FROM modules m
    JOIN courses c ON m.course_id = c.id
    WHERE m.id::text = (storage.foldername(name))[2]
    AND c.creator_id = get_my_profile_id()
  )
);

-- Allow creators to delete module thumbnails
CREATE POLICY "Creators can delete module thumbnails"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'course-thumbnails'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'modules'
  AND EXISTS (
    SELECT 1 FROM modules m
    JOIN courses c ON m.course_id = c.id
    WHERE m.id::text = (storage.foldername(name))[2]
    AND c.creator_id = get_my_profile_id()
  )
);
