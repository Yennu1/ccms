
-- Part 1: Add type column to ministries
ALTER TABLE public.ministries
  ADD COLUMN ministry_type text NOT NULL DEFAULT 'grouped'
  CHECK (ministry_type IN ('standalone', 'grouped'));

-- Part 2: Create ministry_memberships table
CREATE TABLE public.ministry_memberships (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  ministry_id  uuid NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  member_id    uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  role         text DEFAULT 'member' CHECK (role IN ('leader', 'member')),
  joined_at    date DEFAULT CURRENT_DATE,
  left_at      date,
  is_active    boolean DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  UNIQUE (ministry_id, member_id)
);

-- Part 3: Indexes
CREATE INDEX idx_ministry_memberships_org_id ON public.ministry_memberships(org_id);
CREATE INDEX idx_ministry_memberships_member_id ON public.ministry_memberships(member_id);

-- Part 4: Enable RLS and policies
ALTER TABLE public.ministry_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_view_ministry_memberships"
ON public.ministry_memberships FOR SELECT
USING (org_id = (SELECT profiles.org_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "admins_insert_ministry_memberships"
ON public.ministry_memberships FOR INSERT
WITH CHECK (
  org_id = (SELECT profiles.org_id FROM profiles WHERE profiles.id = auth.uid())
  AND (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid())
      = ANY (ARRAY['super_admin','pastor'])
);

CREATE POLICY "admins_update_ministry_memberships"
ON public.ministry_memberships FOR UPDATE
USING (
  org_id = (SELECT profiles.org_id FROM profiles WHERE profiles.id = auth.uid())
  AND (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid())
      = ANY (ARRAY['super_admin','pastor'])
);

CREATE POLICY "admins_delete_ministry_memberships"
ON public.ministry_memberships FOR DELETE
USING (
  org_id = (SELECT profiles.org_id FROM profiles WHERE profiles.id = auth.uid())
  AND (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid())
      = ANY (ARRAY['super_admin','pastor'])
);
;