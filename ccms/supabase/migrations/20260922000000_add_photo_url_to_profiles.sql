-- Admin profile photos.
--
-- Adds photo_url to profiles so a signed-in user can set their own avatar in
-- Settings › My Profile. Mirrors members.photo_url (added earlier for member
-- photos). The actual image bytes live in the `profile-photos` storage bucket;
-- this column just holds the public URL.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS photo_url text;
