
-- ─── MINISTRIES RLS ───────────────────────────────────────────────────────────

-- All org members can view ministries
CREATE POLICY "org_members_view_ministries"
  ON public.ministries FOR SELECT
  USING (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

-- super_admin and pastor can insert ministries
CREATE POLICY "admins_insert_ministries"
  ON public.ministries FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('super_admin', 'pastor')
  );

-- super_admin and pastor can update ministries
CREATE POLICY "admins_update_ministries"
  ON public.ministries FOR UPDATE
  USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('super_admin', 'pastor')
  );

-- super_admin and pastor can delete ministries
CREATE POLICY "admins_delete_ministries"
  ON public.ministries FOR DELETE
  USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('super_admin', 'pastor')
  );

-- ─── GROUPS RLS ───────────────────────────────────────────────────────────────

-- All org members can view groups
CREATE POLICY "org_members_view_groups"
  ON public.groups FOR SELECT
  USING (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

-- super_admin, pastor can insert groups
CREATE POLICY "admins_insert_groups"
  ON public.groups FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('super_admin', 'pastor')
  );

-- super_admin, pastor can update any group; group_leader can update their own group
CREATE POLICY "admins_or_leader_update_groups"
  ON public.groups FOR UPDATE
  USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
    AND (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('super_admin', 'pastor')
      OR (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'group_leader'
        AND leader_id = (
          SELECT m.id FROM public.members m
          WHERE m.user_id = auth.uid()
          LIMIT 1
        )
      )
    )
  );

-- super_admin, pastor can delete groups
CREATE POLICY "admins_delete_groups"
  ON public.groups FOR DELETE
  USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('super_admin', 'pastor')
  );

-- ─── GROUP_MEMBERSHIPS RLS ────────────────────────────────────────────────────

-- All org members can view group_memberships
CREATE POLICY "org_members_view_group_memberships"
  ON public.group_memberships FOR SELECT
  USING (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

-- super_admin, pastor, group_leader (own group) can insert group_memberships
CREATE POLICY "admins_or_leader_insert_group_memberships"
  ON public.group_memberships FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
    AND (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('super_admin', 'pastor')
      OR (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'group_leader'
        AND group_id IN (
          SELECT g.id FROM public.groups g
          WHERE g.leader_id = (
            SELECT m.id FROM public.members m WHERE m.user_id = auth.uid() LIMIT 1
          )
        )
      )
    )
  );

-- super_admin, pastor, group_leader (own group) can update group_memberships
CREATE POLICY "admins_or_leader_update_group_memberships"
  ON public.group_memberships FOR UPDATE
  USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
    AND (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('super_admin', 'pastor')
      OR (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'group_leader'
        AND group_id IN (
          SELECT g.id FROM public.groups g
          WHERE g.leader_id = (
            SELECT m.id FROM public.members m WHERE m.user_id = auth.uid() LIMIT 1
          )
        )
      )
    )
  );

-- super_admin, pastor, group_leader (own group) can delete group_memberships
CREATE POLICY "admins_or_leader_delete_group_memberships"
  ON public.group_memberships FOR DELETE
  USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
    AND (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('super_admin', 'pastor')
      OR (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'group_leader'
        AND group_id IN (
          SELECT g.id FROM public.groups g
          WHERE g.leader_id = (
            SELECT m.id FROM public.members m WHERE m.user_id = auth.uid() LIMIT 1
          )
        )
      )
    )
  );
;