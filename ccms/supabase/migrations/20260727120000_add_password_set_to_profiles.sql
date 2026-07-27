-- Server-truth onboarding flag for the invite flow.
--
-- Replaces the fragile URL-token sniffing (which failed because the real invite
-- redirect fragment does not carry `type` where the client could read it) with a
-- durable per-profile fact: has this user ever set their own password?
--
-- Invited users' profile rows are created with password_set = false (the column
-- default), so ProtectedRoute routes them to /accept-invite until they set one.

alter table public.profiles
  add column if not exists password_set boolean not null default false;

-- Backfill (CRITICAL): every existing account that already has a real password
-- in auth.users is onboarded -> set true so current/real/test users are never
-- bounced to /accept-invite. Users with no password (pending invites) correctly
-- remain false.
update public.profiles p
set password_set = true
from auth.users u
where p.id = u.id
  and u.encrypted_password is not null
  and u.encrypted_password <> ''
  and p.password_set = false;
