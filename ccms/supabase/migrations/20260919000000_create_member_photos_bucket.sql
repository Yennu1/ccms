-- =====================================================================
-- Create the member-photos storage bucket and its RLS policies
-- Migration: 20260919000000_create_member_photos_bucket.sql
-- =====================================================================
--
-- THE BUG
--   src/pages/members/MemberEditPage.tsx and MemberProfilePage.tsx both
--   call supabase.storage.from('member-photos').upload(...), but this
--   bucket is never created anywhere in the codebase, and storage.objects
--   has zero RLS policies for it. Every upload fails — either with
--   "Bucket not found" if the bucket itself is missing, or with a
--   row-level security violation if the bucket exists (e.g. created by
--   hand in the dashboard at some point) but was never given policies.
--   Reported: photo upload does not work for admins.
--
-- THE FIX
--   Create the bucket, marked public (matches the existing code, which
--   calls getPublicUrl() and expects photos to load without auth).
--   Add RLS policies on storage.objects scoped to this bucket, following
--   the same org-isolation pattern used everywhere else in this project:
--   the upload path is `${org_id}/${member_id}.${ext}` (see
--   MemberProfilePage.tsx / MemberEditPage.tsx), so a policy can extract
--   the first path segment and require it to equal the caller's own
--   get_my_org_id() — the same fail-closed shape as every RLS policy
--   fixed earlier this project.
--
-- VERIFIED
--   Tested against a mock of the storage schema: before this migration,
--   an authenticated user's upload attempt is rejected by RLS (no
--   policies exist). After, a user can upload/update/delete only within
--   their own org's folder, and is blocked from writing into another
--   org's folder. Public read confirmed via the bucket's public flag,
--   which does not require an object-level SELECT policy.
-- =====================================================================

-- Bucket: public read (photos load via getPublicUrl with no auth,
-- exactly as the existing frontend code expects), 5MB limit matching
-- the 5MB check already enforced client-side in MemberProfilePage.tsx.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'member-photos',
  'member-photos',
  true,
  5242880, -- 5 MB, matches the client-side check
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- INSERT: an authenticated user may only upload into a path whose first
-- folder segment is their own org_id.
DROP POLICY IF EXISTS member_photos_insert ON storage.objects;
CREATE POLICY member_photos_insert ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'member-photos'
    AND (storage.foldername(name))[1] = public.get_my_org_id()::text
  );

-- UPDATE: upsert:true in the app triggers this on re-upload of an
-- existing photo — same org scope.
DROP POLICY IF EXISTS member_photos_update ON storage.objects;
CREATE POLICY member_photos_update ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'member-photos'
    AND (storage.foldername(name))[1] = public.get_my_org_id()::text
  )
  WITH CHECK (
    bucket_id = 'member-photos'
    AND (storage.foldername(name))[1] = public.get_my_org_id()::text
  );

-- DELETE: matches the .remove() call in MemberProfilePage.tsx's
-- handlePhotoRemove — same org scope.
DROP POLICY IF EXISTS member_photos_delete ON storage.objects;
CREATE POLICY member_photos_delete ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'member-photos'
    AND (storage.foldername(name))[1] = public.get_my_org_id()::text
  );

-- SELECT: the bucket is public, so reads via the public URL do not need
-- an object-level policy to succeed. This policy exists only so that
-- authenticated API calls that list/inspect objects (not the public
-- getPublicUrl path) also work, scoped the same way as everything else.
DROP POLICY IF EXISTS member_photos_select ON storage.objects;
CREATE POLICY member_photos_select ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'member-photos'
    AND (storage.foldername(name))[1] = public.get_my_org_id()::text
  );
