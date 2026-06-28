
-- Member numbers should be unique PER organisation, not globally.
-- Drop the global unique constraint and replace with a composite one scoped by org_id.
ALTER TABLE public.members DROP CONSTRAINT members_member_number_key;
ALTER TABLE public.members ADD CONSTRAINT members_org_member_number_key
  UNIQUE (org_id, member_number);
;