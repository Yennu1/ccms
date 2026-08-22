
-- ═══════════════════════════════════════════════════════════
-- CRITICAL SECURITY FIX: user_roles_all policy (covers INSERT/UPDATE/
-- DELETE/SELECT) only checked get_my_role() = 'super_admin' with NO
-- organization check. Any Super Admin of ANY church could modify or
-- delete role/access records belonging to ANY OTHER church. Verified
-- directly: successfully demoted another org's real super_admin to
-- group_leader inside a rolled-back test transaction.
-- ═══════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "user_roles_all" ON public.user_roles;
CREATE POLICY "user_roles_all"
ON public.user_roles FOR ALL
USING (get_my_role() = 'super_admin' AND org_id = get_my_org_id())
WITH CHECK (get_my_role() = 'super_admin' AND org_id = get_my_org_id());

-- Simplify user_roles_select: the super_admin clause is now fully
-- redundant with the corrected ALL policy above (also resolves the
-- "multiple permissive policies" performance warning).
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
CREATE POLICY "user_roles_select"
ON public.user_roles FOR SELECT
USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════
-- PERFORMANCE: RLS policies re-evaluating auth.uid() per-row instead
-- of once per query (wrap in a subquery so Postgres caches it).
-- ═══════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "organisations_select" ON public.organisations;
CREATE POLICY "organisations_select"
ON public.organisations FOR SELECT
USING (id IN (SELECT profiles.org_id FROM profiles WHERE profiles.id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select"
ON public.profiles FOR SELECT
USING (id = (SELECT auth.uid()) OR (get_my_role() = ANY(ARRAY['super_admin','admin']) AND org_id = get_my_org_id()));

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update"
ON public.profiles FOR UPDATE
USING (id = (SELECT auth.uid()) OR get_my_role() = 'super_admin');

-- ═══════════════════════════════════════════════════════════
-- PERFORMANCE: ~49 unindexed foreign keys across every table.
-- ═══════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_attendance_checked_in_by ON public.attendance(checked_in_by);
CREATE INDEX IF NOT EXISTS idx_attendance_member_id ON public.attendance(member_id);
CREATE INDEX IF NOT EXISTS idx_attendance_org_id ON public.attendance(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id ON public.audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_branches_org_id ON public.branches(org_id);
CREATE INDEX IF NOT EXISTS idx_event_occurrences_event_id ON public.event_occurrences(event_id);
CREATE INDEX IF NOT EXISTS idx_events_branch_id ON public.events(branch_id);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON public.events(created_by);
CREATE INDEX IF NOT EXISTS idx_events_group_id ON public.events(group_id);
CREATE INDEX IF NOT EXISTS idx_events_org_id ON public.events(org_id);
CREATE INDEX IF NOT EXISTS idx_events_parent_event_id ON public.events(parent_event_id);
CREATE INDEX IF NOT EXISTS idx_expenses_recorded_by ON public.expenses(recorded_by);
CREATE INDEX IF NOT EXISTS idx_group_memberships_member_id ON public.group_memberships(member_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_org_id ON public.group_memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_group_schedules_group_id ON public.group_schedules(group_id);
CREATE INDEX IF NOT EXISTS idx_groups_branch_id ON public.groups(branch_id);
CREATE INDEX IF NOT EXISTS idx_groups_leader_id ON public.groups(leader_id);
CREATE INDEX IF NOT EXISTS idx_groups_ministry_id ON public.groups(ministry_id);
CREATE INDEX IF NOT EXISTS idx_groups_org_id ON public.groups(org_id);
CREATE INDEX IF NOT EXISTS idx_households_branch_id ON public.households(branch_id);
CREATE INDEX IF NOT EXISTS idx_households_head_member_id ON public.households(head_member_id);
CREATE INDEX IF NOT EXISTS idx_households_org_id ON public.households(org_id);
CREATE INDEX IF NOT EXISTS idx_member_relationships_org_id ON public.member_relationships(org_id);
CREATE INDEX IF NOT EXISTS idx_member_relationships_related_member_id ON public.member_relationships(related_member_id);
CREATE INDEX IF NOT EXISTS idx_members_branch_id ON public.members(branch_id);
CREATE INDEX IF NOT EXISTS idx_members_created_by ON public.members(created_by);
CREATE INDEX IF NOT EXISTS idx_members_household_id ON public.members(household_id);
CREATE INDEX IF NOT EXISTS idx_members_user_id ON public.members(user_id);
CREATE INDEX IF NOT EXISTS idx_ministries_branch_id ON public.ministries(branch_id);
CREATE INDEX IF NOT EXISTS idx_ministries_leader_id ON public.ministries(leader_id);
CREATE INDEX IF NOT EXISTS idx_ministries_org_id ON public.ministries(org_id);
CREATE INDEX IF NOT EXISTS idx_pastoral_notes_author_id ON public.pastoral_notes(author_id);
CREATE INDEX IF NOT EXISTS idx_pastoral_notes_member_id ON public.pastoral_notes(member_id);
CREATE INDEX IF NOT EXISTS idx_pastoral_notes_org_id ON public.pastoral_notes(org_id);
CREATE INDEX IF NOT EXISTS idx_pledges_branch_id ON public.pledges(branch_id);
CREATE INDEX IF NOT EXISTS idx_pledges_category_id ON public.pledges(category_id);
CREATE INDEX IF NOT EXISTS idx_pledges_member_id ON public.pledges(member_id);
CREATE INDEX IF NOT EXISTS idx_pledges_org_id ON public.pledges(org_id);
CREATE INDEX IF NOT EXISTS idx_profiles_branch_id ON public.profiles(branch_id);
CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON public.profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_transaction_categories_org_id ON public.transaction_categories(org_id);
CREATE INDEX IF NOT EXISTS idx_transactions_branch_id ON public.transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_event_id ON public.transactions(event_id);
CREATE INDEX IF NOT EXISTS idx_transactions_household_id ON public.transactions(household_id);
CREATE INDEX IF NOT EXISTS idx_transactions_member_id ON public.transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_transactions_org_id ON public.transactions(org_id);
CREATE INDEX IF NOT EXISTS idx_transactions_recorded_by ON public.transactions(recorded_by);
CREATE INDEX IF NOT EXISTS idx_user_roles_branch_id ON public.user_roles(branch_id);
;