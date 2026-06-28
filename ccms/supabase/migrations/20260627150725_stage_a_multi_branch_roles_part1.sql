-- ═══════════════════════════════════════════════════════════
-- STAGE A PART 1: Multi-Branch Role Architecture
-- Roles: super_admin, admin, finance_officer, group_leader
-- ═══════════════════════════════════════════════════════════

CREATE TABLE public.user_roles (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('super_admin', 'admin', 'finance_officer', 'group_leader')),
  branch_id   uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, org_id)
);

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_org_id  ON public.user_roles(org_id);

INSERT INTO public.user_roles (user_id, org_id, role, branch_id)
SELECT id, org_id,
  CASE role WHEN 'pastor' THEN 'admin' ELSE role END,
  NULL
FROM public.profiles
WHERE role IN ('super_admin', 'admin', 'pastor', 'finance_officer', 'group_leader');

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = auth.uid() AND is_active = true LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_branch_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT branch_id FROM public.user_roles
  WHERE user_id = auth.uid() AND is_active = true LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT
USING (user_id = auth.uid() OR (get_my_role() = 'super_admin' AND org_id = get_my_org_id()));
CREATE POLICY "user_roles_all" ON public.user_roles FOR ALL
USING (get_my_role() = 'super_admin') WITH CHECK (get_my_role() = 'super_admin');

-- Members
DROP POLICY IF EXISTS "Admins can view all members"   ON public.members;
DROP POLICY IF EXISTS "Members can view own record"    ON public.members;
DROP POLICY IF EXISTS "Admins can insert members"      ON public.members;
DROP POLICY IF EXISTS "Admins can update members"      ON public.members;
CREATE POLICY "members_select" ON public.members FOR SELECT
USING (get_my_role() = 'super_admin' OR (get_my_role() IN ('admin','finance_officer','group_leader') AND org_id = get_my_org_id() AND branch_id = get_my_branch_id()));
CREATE POLICY "members_insert" ON public.members FOR INSERT
WITH CHECK (get_my_role() = 'super_admin' OR (get_my_role() IN ('admin','finance_officer') AND org_id = get_my_org_id() AND branch_id = get_my_branch_id()));
CREATE POLICY "members_update" ON public.members FOR UPDATE
USING (get_my_role() = 'super_admin' OR (get_my_role() IN ('admin','finance_officer') AND org_id = get_my_org_id() AND branch_id = get_my_branch_id()));
CREATE POLICY "members_delete" ON public.members FOR DELETE
USING (get_my_role() = 'super_admin');

-- Transactions
DROP POLICY IF EXISTS "Finance can view transactions" ON public.transactions;
DROP POLICY IF EXISTS "Finance can view transactions in their org" ON public.transactions;
DROP POLICY IF EXISTS "Finance can insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Finance can update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Finance can delete transactions" ON public.transactions;
CREATE POLICY "transactions_select" ON public.transactions FOR SELECT
USING (get_my_role() = 'super_admin' OR (get_my_role() IN ('admin','finance_officer') AND org_id = get_my_org_id() AND branch_id = get_my_branch_id()));
CREATE POLICY "transactions_insert" ON public.transactions FOR INSERT
WITH CHECK (get_my_role() = 'super_admin' OR (get_my_role() IN ('admin','finance_officer') AND org_id = get_my_org_id() AND branch_id = get_my_branch_id()));
CREATE POLICY "transactions_update" ON public.transactions FOR UPDATE
USING (get_my_role() = 'super_admin' OR (get_my_role() IN ('admin','finance_officer') AND org_id = get_my_org_id() AND branch_id = get_my_branch_id()));
CREATE POLICY "transactions_delete" ON public.transactions FOR DELETE
USING (get_my_role() = 'super_admin');

-- Pledges
DROP POLICY IF EXISTS "Finance can view pledges in their org" ON public.pledges;
DROP POLICY IF EXISTS "Finance can insert pledges" ON public.pledges;
DROP POLICY IF EXISTS "Finance can update pledges" ON public.pledges;
DROP POLICY IF EXISTS "Finance can delete pledges" ON public.pledges;
CREATE POLICY "pledges_select" ON public.pledges FOR SELECT
USING (get_my_role() = 'super_admin' OR (get_my_role() IN ('admin','finance_officer') AND org_id = get_my_org_id()));
CREATE POLICY "pledges_insert" ON public.pledges FOR INSERT
WITH CHECK (get_my_role() = 'super_admin' OR (get_my_role() IN ('admin','finance_officer') AND org_id = get_my_org_id()));
CREATE POLICY "pledges_update" ON public.pledges FOR UPDATE
USING (get_my_role() = 'super_admin' OR (get_my_role() IN ('admin','finance_officer') AND org_id = get_my_org_id()));
CREATE POLICY "pledges_delete" ON public.pledges FOR DELETE
USING (get_my_role() = 'super_admin' OR (get_my_role() IN ('admin','finance_officer') AND org_id = get_my_org_id()));

-- Groups
DROP POLICY IF EXISTS "org_members_view_groups" ON public.groups;
DROP POLICY IF EXISTS "admins_insert_groups" ON public.groups;
DROP POLICY IF EXISTS "admins_or_leader_update_groups" ON public.groups;
DROP POLICY IF EXISTS "admins_delete_groups" ON public.groups;
CREATE POLICY "groups_select" ON public.groups FOR SELECT
USING (get_my_role() = 'super_admin' OR (org_id = get_my_org_id() AND branch_id = get_my_branch_id()));
CREATE POLICY "groups_insert" ON public.groups FOR INSERT
WITH CHECK (get_my_role() = 'super_admin' OR (get_my_role() = 'admin' AND org_id = get_my_org_id() AND branch_id = get_my_branch_id()));
CREATE POLICY "groups_update" ON public.groups FOR UPDATE
USING (get_my_role() = 'super_admin' OR (get_my_role() = 'admin' AND org_id = get_my_org_id() AND branch_id = get_my_branch_id()) OR (get_my_role() = 'group_leader' AND org_id = get_my_org_id() AND leader_id = auth.uid() AND branch_id = get_my_branch_id()));
CREATE POLICY "groups_delete" ON public.groups FOR DELETE
USING (get_my_role() = 'super_admin');

-- Group memberships
DROP POLICY IF EXISTS "org_members_view_group_memberships" ON public.group_memberships;
DROP POLICY IF EXISTS "Admins can view group memberships" ON public.group_memberships;
DROP POLICY IF EXISTS "admins_or_leader_insert_group_memberships" ON public.group_memberships;
DROP POLICY IF EXISTS "admins_or_leader_update_group_memberships" ON public.group_memberships;
DROP POLICY IF EXISTS "admins_or_leader_delete_group_memberships" ON public.group_memberships;
CREATE POLICY "group_memberships_select" ON public.group_memberships FOR SELECT
USING (get_my_role() = 'super_admin' OR (org_id = get_my_org_id() AND group_id IN (SELECT id FROM public.groups WHERE branch_id = get_my_branch_id())));
CREATE POLICY "group_memberships_insert" ON public.group_memberships FOR INSERT
WITH CHECK (get_my_role() = 'super_admin' OR (org_id = get_my_org_id() AND group_id IN (SELECT id FROM public.groups WHERE branch_id = get_my_branch_id() AND (get_my_role() = 'admin' OR leader_id = auth.uid()))));
CREATE POLICY "group_memberships_update" ON public.group_memberships FOR UPDATE
USING (get_my_role() = 'super_admin' OR (org_id = get_my_org_id() AND group_id IN (SELECT id FROM public.groups WHERE branch_id = get_my_branch_id() AND (get_my_role() = 'admin' OR leader_id = auth.uid()))));
CREATE POLICY "group_memberships_delete" ON public.group_memberships FOR DELETE
USING (get_my_role() = 'super_admin' OR (org_id = get_my_org_id() AND group_id IN (SELECT id FROM public.groups WHERE branch_id = get_my_branch_id() AND (get_my_role() = 'admin' OR leader_id = auth.uid()))));

-- Events
DROP POLICY IF EXISTS "events_select" ON public.events;
DROP POLICY IF EXISTS "events_insert" ON public.events;
DROP POLICY IF EXISTS "events_update" ON public.events;
DROP POLICY IF EXISTS "events_delete" ON public.events;
CREATE POLICY "events_select" ON public.events FOR SELECT
USING (get_my_role() = 'super_admin' OR (org_id = get_my_org_id() AND (branch_id = get_my_branch_id() OR branch_id IS NULL)));
CREATE POLICY "events_insert" ON public.events FOR INSERT
WITH CHECK (get_my_role() = 'super_admin' OR (get_my_role() = 'admin' AND org_id = get_my_org_id() AND branch_id = get_my_branch_id()));
CREATE POLICY "events_update" ON public.events FOR UPDATE
USING (get_my_role() = 'super_admin' OR (get_my_role() = 'admin' AND org_id = get_my_org_id() AND branch_id = get_my_branch_id()));
CREATE POLICY "events_delete" ON public.events FOR DELETE
USING (get_my_role() = 'super_admin');

-- Attendance
DROP POLICY IF EXISTS "attendance_all" ON public.attendance;
DROP POLICY IF EXISTS "attendance_select" ON public.attendance;
CREATE POLICY "attendance_select" ON public.attendance FOR SELECT
USING (get_my_role() = 'super_admin' OR (org_id = get_my_org_id() AND event_id IN (SELECT id FROM public.events WHERE branch_id = get_my_branch_id() OR branch_id IS NULL)));
CREATE POLICY "attendance_insert" ON public.attendance FOR INSERT
WITH CHECK (get_my_role() = 'super_admin' OR (get_my_role() IN ('admin','group_leader') AND org_id = get_my_org_id() AND event_id IN (SELECT id FROM public.events WHERE branch_id = get_my_branch_id() OR branch_id IS NULL)));
CREATE POLICY "attendance_update" ON public.attendance FOR UPDATE
USING (get_my_role() = 'super_admin' OR (get_my_role() IN ('admin','group_leader') AND org_id = get_my_org_id() AND event_id IN (SELECT id FROM public.events WHERE branch_id = get_my_branch_id() OR branch_id IS NULL)));
CREATE POLICY "attendance_delete" ON public.attendance FOR DELETE
USING (get_my_role() = 'super_admin');
