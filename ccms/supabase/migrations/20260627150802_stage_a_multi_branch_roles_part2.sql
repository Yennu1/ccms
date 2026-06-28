-- ═══════════════════════════════════════════════════════════
-- STAGE A PART 2: Remaining table RLS policies
-- ═══════════════════════════════════════════════════════════

-- Ministries
DROP POLICY IF EXISTS "org_members_view_ministries" ON public.ministries;
DROP POLICY IF EXISTS "admins_insert_ministries" ON public.ministries;
DROP POLICY IF EXISTS "admins_update_ministries" ON public.ministries;
DROP POLICY IF EXISTS "admins_delete_ministries" ON public.ministries;
CREATE POLICY "ministries_select" ON public.ministries FOR SELECT USING (org_id = get_my_org_id());
CREATE POLICY "ministries_insert" ON public.ministries FOR INSERT WITH CHECK (get_my_role() IN ('super_admin','admin') AND org_id = get_my_org_id());
CREATE POLICY "ministries_update" ON public.ministries FOR UPDATE USING (get_my_role() IN ('super_admin','admin') AND org_id = get_my_org_id());
CREATE POLICY "ministries_delete" ON public.ministries FOR DELETE USING (get_my_role() IN ('super_admin','admin'));

-- Ministry memberships
DROP POLICY IF EXISTS "org_members_view_ministry_memberships" ON public.ministry_memberships;
DROP POLICY IF EXISTS "admins_insert_ministry_memberships" ON public.ministry_memberships;
DROP POLICY IF EXISTS "admins_update_ministry_memberships" ON public.ministry_memberships;
DROP POLICY IF EXISTS "admins_delete_ministry_memberships" ON public.ministry_memberships;
CREATE POLICY "ministry_memberships_select" ON public.ministry_memberships FOR SELECT USING (org_id = get_my_org_id());
CREATE POLICY "ministry_memberships_insert" ON public.ministry_memberships FOR INSERT WITH CHECK (get_my_role() IN ('super_admin','admin') AND org_id = get_my_org_id());
CREATE POLICY "ministry_memberships_update" ON public.ministry_memberships FOR UPDATE USING (get_my_role() IN ('super_admin','admin') AND org_id = get_my_org_id());
CREATE POLICY "ministry_memberships_delete" ON public.ministry_memberships FOR DELETE USING (get_my_role() IN ('super_admin','admin') AND org_id = get_my_org_id());

-- Households
DROP POLICY IF EXISTS "Admins can view households in their org" ON public.households;
DROP POLICY IF EXISTS "Admins can insert households" ON public.households;
DROP POLICY IF EXISTS "Admins can update households" ON public.households;
DROP POLICY IF EXISTS "Admins can delete households" ON public.households;
CREATE POLICY "households_select" ON public.households FOR SELECT USING (get_my_role() IN ('super_admin','admin','finance_officer') AND org_id = get_my_org_id());
CREATE POLICY "households_insert" ON public.households FOR INSERT WITH CHECK (get_my_role() IN ('super_admin','admin') AND org_id = get_my_org_id());
CREATE POLICY "households_update" ON public.households FOR UPDATE USING (get_my_role() IN ('super_admin','admin') AND org_id = get_my_org_id());
CREATE POLICY "households_delete" ON public.households FOR DELETE USING (get_my_role() IN ('super_admin','admin'));

-- Member relationships
DROP POLICY IF EXISTS "Admins can view member relationships" ON public.member_relationships;
DROP POLICY IF EXISTS "Admins can insert member relationships" ON public.member_relationships;
DROP POLICY IF EXISTS "Admins can delete member relationships" ON public.member_relationships;
CREATE POLICY "member_relationships_select" ON public.member_relationships FOR SELECT USING (get_my_role() IN ('super_admin','admin','finance_officer') AND org_id = get_my_org_id());
CREATE POLICY "member_relationships_insert" ON public.member_relationships FOR INSERT WITH CHECK (get_my_role() IN ('super_admin','admin') AND org_id = get_my_org_id());
CREATE POLICY "member_relationships_delete" ON public.member_relationships FOR DELETE USING (get_my_role() IN ('super_admin','admin') AND org_id = get_my_org_id());

-- Group schedules (scoped via group_id)
DROP POLICY IF EXISTS "gs_select" ON public.group_schedules;
DROP POLICY IF EXISTS "gs_insert" ON public.group_schedules;
DROP POLICY IF EXISTS "gs_update" ON public.group_schedules;
DROP POLICY IF EXISTS "gs_delete" ON public.group_schedules;
CREATE POLICY "group_schedules_select" ON public.group_schedules FOR SELECT USING (group_id IN (SELECT id FROM public.groups WHERE org_id = get_my_org_id() AND (get_my_role() = 'super_admin' OR branch_id = get_my_branch_id())));
CREATE POLICY "group_schedules_insert" ON public.group_schedules FOR INSERT WITH CHECK (group_id IN (SELECT id FROM public.groups WHERE org_id = get_my_org_id() AND (get_my_role() = 'super_admin' OR (branch_id = get_my_branch_id() AND (get_my_role() = 'admin' OR leader_id = auth.uid())))));
CREATE POLICY "group_schedules_update" ON public.group_schedules FOR UPDATE USING (group_id IN (SELECT id FROM public.groups WHERE org_id = get_my_org_id() AND (get_my_role() = 'super_admin' OR (branch_id = get_my_branch_id() AND (get_my_role() = 'admin' OR leader_id = auth.uid())))));
CREATE POLICY "group_schedules_delete" ON public.group_schedules FOR DELETE USING (group_id IN (SELECT id FROM public.groups WHERE org_id = get_my_org_id() AND (get_my_role() = 'super_admin' OR (get_my_role() = 'admin' AND branch_id = get_my_branch_id()))));

-- Pastoral notes
DROP POLICY IF EXISTS "Only pastors can view pastoral notes" ON public.pastoral_notes;
CREATE POLICY "pastoral_notes_select" ON public.pastoral_notes FOR SELECT USING (get_my_role() = 'super_admin' AND org_id = get_my_org_id());
CREATE POLICY "pastoral_notes_insert" ON public.pastoral_notes FOR INSERT WITH CHECK (get_my_role() = 'super_admin' AND org_id = get_my_org_id());
CREATE POLICY "pastoral_notes_update" ON public.pastoral_notes FOR UPDATE USING (get_my_role() = 'super_admin' AND org_id = get_my_org_id());
CREATE POLICY "pastoral_notes_delete" ON public.pastoral_notes FOR DELETE USING (get_my_role() = 'super_admin' AND org_id = get_my_org_id());

-- Audit logs
DROP POLICY IF EXISTS "Only super admin can view audit logs" ON public.audit_logs;
CREATE POLICY "audit_logs_select" ON public.audit_logs FOR SELECT USING (get_my_role() = 'super_admin' AND org_id = get_my_org_id());

-- Transaction categories
DROP POLICY IF EXISTS "Users can view transaction categories in their org" ON public.transaction_categories;
DROP POLICY IF EXISTS "Admins can insert transaction categories" ON public.transaction_categories;
CREATE POLICY "transaction_categories_select" ON public.transaction_categories FOR SELECT USING (org_id = get_my_org_id());
CREATE POLICY "transaction_categories_insert" ON public.transaction_categories FOR INSERT WITH CHECK (get_my_role() IN ('super_admin','admin') AND org_id = get_my_org_id());
CREATE POLICY "transaction_categories_update" ON public.transaction_categories FOR UPDATE USING (get_my_role() IN ('super_admin','admin') AND org_id = get_my_org_id());

-- Branches
DROP POLICY IF EXISTS "Users can view branches in their org" ON public.branches;
CREATE POLICY "branches_select" ON public.branches FOR SELECT USING (org_id = get_my_org_id());
CREATE POLICY "branches_insert" ON public.branches FOR INSERT WITH CHECK (get_my_role() = 'super_admin');
CREATE POLICY "branches_update" ON public.branches FOR UPDATE USING (get_my_role() = 'super_admin');
CREATE POLICY "branches_delete" ON public.branches FOR DELETE USING (get_my_role() = 'super_admin');

-- Organisations
DROP POLICY IF EXISTS "Users can view their own organisation" ON public.organisations;
CREATE POLICY "organisations_select" ON public.organisations FOR SELECT USING (id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "organisations_update" ON public.organisations FOR UPDATE USING (get_my_role() = 'super_admin');

-- Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles in org" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (id = auth.uid() OR (get_my_role() IN ('super_admin','admin') AND org_id = get_my_org_id()));
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (id = auth.uid() OR get_my_role() = 'super_admin');

-- Event occurrences
DROP POLICY IF EXISTS "event_occurrences_select" ON public.event_occurrences;
DROP POLICY IF EXISTS "event_occurrences_insert" ON public.event_occurrences;
CREATE POLICY "event_occurrences_select" ON public.event_occurrences FOR SELECT
USING (get_my_role() = 'super_admin' OR (org_id = get_my_org_id() AND event_id IN (SELECT id FROM public.events WHERE branch_id = get_my_branch_id() OR branch_id IS NULL)));
CREATE POLICY "event_occurrences_insert" ON public.event_occurrences FOR INSERT
WITH CHECK (get_my_role() = 'super_admin' OR (get_my_role() = 'admin' AND org_id = get_my_org_id() AND event_id IN (SELECT id FROM public.events WHERE branch_id = get_my_branch_id())));
