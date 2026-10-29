-- =====================================================================
-- Drop the hand-made, unscoped member-photos storage policies
-- Migration: 20261029000000_drop_unscoped_member_photo_policies.sql
-- =====================================================================
--
-- THE PROBLEM
--   Four storage policies on the member-photos bucket were created by hand
--   in the Supabase dashboard (they are in no migration):
--     "Authenticated users can upload member photos"   (INSERT)
--     "Authenticated users can update member photos"   (UPDATE)
--     "Authenticated users can delete member photos"   (DELETE)
--     "Public can view member photos"                  (SELECT)
--   None of them check the caller's org. Storage policies are combined with
--   OR, so these override the org-scoped member_photos_* policies: any
--   logged-in user of any church can upload over, replace or delete another
--   church's member photos, and anyone can list every file in the bucket.
--   Found by tests/cross-tenant-check.sql (v3).
--
-- WHY IT IS SAFE TO DROP THEM
--   Every member-photo upload in the app uses the path
--   `${org_id}/${member_id}.${ext}` (MemberProfilePage, MemberEditPage,
--   MemberNewPage), which the org-scoped member_photos_* policies already
--   allow. Displaying photos uses public URLs on a public bucket, which do
--   not go through these policies at all.
--
-- SAFETY RAIL
--   Aborts without changing anything if any of the four org-scoped
--   replacement policies is missing.
-- =====================================================================

BEGIN;

DO $$
DECLARE missing text;
BEGIN
  SELECT string_agg(p, ', ') INTO missing
  FROM unnest(ARRAY['member_photos_insert', 'member_photos_update',
                    'member_photos_delete', 'member_photos_select']) AS p
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = p);

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stopping, nothing changed: the org-scoped replacement policies are missing (%). Dropping the old ones now would break photo uploads.', missing;
  END IF;
END $$;

DROP POLICY IF EXISTS "Authenticated users can upload member photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update member photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete member photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view member photos" ON storage.objects;

-- Verify: no member-photos policy left without an org check.
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(policyname, ', ') INTO bad
  FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%member-photos%'
    AND position('get_my_org_id()' IN COALESCE(qual, '') || COALESCE(with_check, '')) = 0;

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Rolling back: unscoped member-photos policies still present: %', bad;
  END IF;
  RAISE NOTICE 'Verified: every member-photos policy is tied to the caller''s org.';
END $$;

COMMIT;
