-- =====================================================================
-- Scope the profile-photos and org-logos storage policies
-- Migration: 20261029000001_scope_profile_photo_and_logo_storage_policies.sql
-- =====================================================================
--
-- THE PROBLEM
--   Eight storage policies were created by hand in the Supabase dashboard
--   (they are in no migration). Each one only checks the bucket name:
--     profile-photos: "profile-photos read" / "insert" / "update" / "delete"
--     org-logos:      "Anyone can view org logos",
--                     "Authenticated users can upload / update / delete org logos"
--   So any logged-in user of any church can replace or delete another
--   church's logo, or another person's profile photo. Found by
--   tests/cross-tenant-check.sql (v3).
--
-- THE FIX
--   Replace them with scoped policies matching the paths the app uses
--   (src/pages/settings/SettingsPage.tsx):
--     profile-photos: `${user.id}.jpg`    -> only your own file
--     org-logos:      `${orgId}/logo.jpg` -> only your own church's folder
--   All four operations are kept (select / insert / update / delete),
--   because the app uploads with upsert: true, which needs all of them.
--   Displaying photos and logos uses public URLs on public buckets, which
--   do not go through these policies.
--
-- SAFETY RAILS
--   1. Aborts, changing nothing, unless both buckets exist and are public.
--   2. Rolls back if any policy on these buckets is still unscoped.
-- =====================================================================

BEGIN;

-- 1. Both buckets must exist and be public, or photo/logo display could change.
DO $$
DECLARE problem text;
BEGIN
  SELECT string_agg(b, ', ') INTO problem
  FROM unnest(ARRAY['profile-photos', 'org-logos']) AS b
  WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = b AND public = true);

  IF problem IS NOT NULL THEN
    RAISE EXCEPTION 'Stopping, nothing changed: bucket(s) % missing or not public. Ask before continuing.', problem;
  END IF;
END $$;

-- 2. Scoped replacements (dropped first so this file is safe to re-run).
DROP POLICY IF EXISTS profile_photos_select ON storage.objects;
DROP POLICY IF EXISTS profile_photos_insert ON storage.objects;
DROP POLICY IF EXISTS profile_photos_update ON storage.objects;
DROP POLICY IF EXISTS profile_photos_delete ON storage.objects;
DROP POLICY IF EXISTS org_logos_select ON storage.objects;
DROP POLICY IF EXISTS org_logos_insert ON storage.objects;
DROP POLICY IF EXISTS org_logos_update ON storage.objects;
DROP POLICY IF EXISTS org_logos_delete ON storage.objects;

-- profile-photos: a user may only touch the file named after their own id
CREATE POLICY profile_photos_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'profile-photos' AND split_part(name, '.', 1) = (auth.uid())::text);
CREATE POLICY profile_photos_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-photos' AND split_part(name, '.', 1) = (auth.uid())::text);
CREATE POLICY profile_photos_update ON storage.objects FOR UPDATE TO authenticated
  USING      (bucket_id = 'profile-photos' AND split_part(name, '.', 1) = (auth.uid())::text)
  WITH CHECK (bucket_id = 'profile-photos' AND split_part(name, '.', 1) = (auth.uid())::text);
CREATE POLICY profile_photos_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'profile-photos' AND split_part(name, '.', 1) = (auth.uid())::text);

-- org-logos: a user may only touch files inside their own church's folder
CREATE POLICY org_logos_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'org-logos' AND (storage.foldername(name))[1] = (public.get_my_org_id())::text);
CREATE POLICY org_logos_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'org-logos' AND (storage.foldername(name))[1] = (public.get_my_org_id())::text);
CREATE POLICY org_logos_update ON storage.objects FOR UPDATE TO authenticated
  USING      (bucket_id = 'org-logos' AND (storage.foldername(name))[1] = (public.get_my_org_id())::text)
  WITH CHECK (bucket_id = 'org-logos' AND (storage.foldername(name))[1] = (public.get_my_org_id())::text);
CREATE POLICY org_logos_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'org-logos' AND (storage.foldername(name))[1] = (public.get_my_org_id())::text);

-- 3. Remove the hand-made, bucket-only policies.
DROP POLICY IF EXISTS "profile-photos read"   ON storage.objects;
DROP POLICY IF EXISTS "profile-photos insert" ON storage.objects;
DROP POLICY IF EXISTS "profile-photos update" ON storage.objects;
DROP POLICY IF EXISTS "profile-photos delete" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view org logos"                ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload org logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update org logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete org logos" ON storage.objects;

-- 4. Verify nothing unscoped remains on either bucket.
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(policyname, ', ') INTO bad
  FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND ((COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%profile-photos%'
      OR (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%org-logos%')
    AND position('get_my_org_id()' IN COALESCE(qual, '') || COALESCE(with_check, '')) = 0
    AND position('auth.uid()'      IN COALESCE(qual, '') || COALESCE(with_check, '')) = 0;

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Rolling back: unscoped policies still present: %', bad;
  END IF;
END $$;

COMMIT;

-- What is on these two buckets now (shown in the SQL editor results).
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND (policyname LIKE 'profile_photos_%' OR policyname LIKE 'org_logos_%')
ORDER BY policyname;
