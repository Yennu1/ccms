-- Stage C: profiles.role is fully superseded by user_roles as of Stage B.
-- Verified zero references remain in: frontend code, RLS policies, and 
-- database functions before running this.
ALTER TABLE public.profiles DROP COLUMN role;