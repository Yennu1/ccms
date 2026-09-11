-- =====================================================================
-- Scope super_admin: the three policies migration 1 could not reach
-- Migration: 20260911010000_scope_super_admin_remaining.sql
--
-- Apply AFTER 20260911000000_scope_super_admin_to_own_org.sql
-- =====================================================================
--
-- WHY THESE WERE MISSED
--
--   1. organisations_update
--      Migration 1 only touched tables with an org_id column. The
--      organisations table identifies itself by `id`, so it was skipped
--      by design. Its UPDATE policy is still the bare clause:
--          (get_my_role() = 'super_admin')
--      A super_admin in any church can rename or alter any other church.
--
--   2. households_delete
--   3. ministries_delete
--      These use the ANY(ARRAY[...]) form:
--          (get_my_role() = ANY (ARRAY['super_admin','admin']))
--      Migration 1 matched the literal string
--      "get_my_role() = 'super_admin'::text" and so did not see them.
--      Note these also grant `admin`, not just super_admin, so the
--      exposure here is wider than migration 1's.
--
-- WHY THIS IS NOT THEORETICAL
--
--   With a WHERE clause, Postgres also applies SELECT policies to
--   UPDATE/DELETE, and the correct SELECT policies on these tables
--   masked the hole. But an unbounded statement reads no existing
--   values, so SELECT policies do not gate it. Verified against a
--   replica of the live policies:
--
--       UPDATE public.organisations SET name='HACKED';   -- renamed the other church
--       DELETE FROM public.households;                   -- wiped the other church's rows
--       DELETE FROM public.ministries;                   -- wiped the other church's rows
--
--   All three succeeded across tenants. After this migration all three
--   affect the caller's own organisation only.
--
-- HOW TO APPLY
--   1. Save to supabase/migrations/ in the repo.
--   2. Paste into the Supabase SQL editor and Run.
--   3. Re-run tests/cross-tenant-check.sql.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. organisations: scope by `id`, since this table has no org_id column
-- ---------------------------------------------------------------------
ALTER POLICY organisations_update ON public.organisations
  USING (
    (get_my_role() = 'super_admin'::text)
    AND (id = get_my_org_id())
  );

-- ---------------------------------------------------------------------
-- 2. households_delete: add the missing org scope
-- ---------------------------------------------------------------------
ALTER POLICY households_delete ON public.households
  USING (
    (get_my_role() = ANY (ARRAY['super_admin'::text, 'admin'::text]))
    AND (org_id = get_my_org_id())
  );

-- ---------------------------------------------------------------------
-- 3. ministries_delete: add the missing org scope
-- ---------------------------------------------------------------------
ALTER POLICY ministries_delete ON public.ministries
  USING (
    (get_my_role() = ANY (ARRAY['super_admin'::text, 'admin'::text]))
    AND (org_id = get_my_org_id())
  );

-- ---------------------------------------------------------------------
-- 4. Verify: no policy on any table may mention super_admin without an
--    accompanying org scope. Aborts the whole migration if one remains.
-- ---------------------------------------------------------------------
DO $verify$
DECLARE
  r          RECORD;
  v_bad      int := 0;
  v_def      text;
  v_scope    text;
BEGIN
  FOR r IN
    SELECT p.tablename, p.policyname, p.cmd,
           COALESCE(p.qual, '')       AS qual,
           COALESCE(p.with_check, '') AS with_check
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND (p.qual LIKE '%super_admin%' OR p.with_check LIKE '%super_admin%')
    ORDER BY p.tablename, p.policyname
  LOOP
    v_def := r.qual || ' ' || r.with_check;

    -- organisations scopes on id; every other table scopes on org_id
    v_scope := CASE WHEN r.tablename = 'organisations'
                    THEN 'get_my_org_id()'
                    ELSE 'org_id = get_my_org_id()'
               END;

    IF position(v_scope in v_def) = 0 THEN
      RAISE WARNING 'UNSCOPED: %.% (%) -> %', r.tablename, r.policyname, r.cmd, v_def;
      v_bad := v_bad + 1;
    END IF;
  END LOOP;

  IF v_bad > 0 THEN
    RAISE EXCEPTION '% policy/policies still mention super_admin with no org scope. Rolling back.', v_bad;
  END IF;

  RAISE NOTICE 'Verified: every super_admin policy is org-scoped.';
END
$verify$;

COMMIT;

-- ---------------------------------------------------------------------
-- Post-migration review
-- ---------------------------------------------------------------------
SELECT tablename, policyname, cmd, COALESCE(qual, with_check) AS definition
FROM pg_policies
WHERE schemaname = 'public'
  AND (COALESCE(qual, '') LIKE '%super_admin%' OR COALESCE(with_check, '') LIKE '%super_admin%')
ORDER BY tablename, policyname;
