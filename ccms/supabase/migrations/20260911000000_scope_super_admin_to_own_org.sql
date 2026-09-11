-- =====================================================================
-- Scope super_admin to its own organisation
-- Migration: 20260911000000_scope_super_admin_to_own_org.sql
-- =====================================================================
--
-- THE BUG
--   RLS policies across the schema begin with a bare clause:
--       get_my_role() = 'super_admin'
--   with no org check attached. Because it is joined with OR, any
--   super_admin bypasses the org-scoping in the rest of the policy and
--   reads (and on some tables deletes) EVERY church's rows.
--
--   Confirmed live: the Centry demo super_admin could read 16 members
--   and 13 transactions belonging to a real beta church, and that
--   church's super_admin could read 61 members and 125 transactions
--   belonging to the demo org.
--
-- THE FIX
--   Rewrite every occurrence of the bare clause to:
--       (get_my_role() = 'super_admin' AND org_id = get_my_org_id())
--   super_admin remains the highest role WITHIN a church and loses the
--   ability to reach outside it.
--
-- HOW IT WORKS
--   Rather than hand-retyping ~40 policy definitions (where one typo is
--   a new security hole), this reads each policy's current definition
--   from the catalog, patches only the offending substring, and applies
--   it with ALTER POLICY. Everything else in each policy is preserved
--   byte for byte.
--
-- SAFETY
--   - Only touches policies on tables that actually have an org_id column.
--   - Only touches policies whose definition contains the bare clause.
--   - Skips any clause already scoped (safe to re-run).
--   - Runs in a single transaction: if any statement fails, nothing applies.
--   - Prints every change as a NOTICE, and raises an exception if any
--     bare clause remains afterwards.
--
-- HOW TO APPLY
--   1. Save this file to supabase/migrations/ in the repo.
--   2. Paste the whole file into the Supabase SQL editor and Run.
--   3. Re-run tests/cross-tenant-check.sql and confirm all FAILs clear.
-- =====================================================================

BEGIN;

-- Helper: how many UNSCOPED bare super_admin clauses does this expression
-- contain? The scoped form contains the bare form as a substring, so we
-- count both and subtract. Dropped again at the end of the migration.
CREATE OR REPLACE FUNCTION public.__unscoped_super_admin_count(def text)
RETURNS int LANGUAGE sql IMMUTABLE AS $fn$
  SELECT
    ( (length(def) - length(replace(def, '(get_my_role() = ''super_admin''::text)', '')))
      / length('(get_my_role() = ''super_admin''::text)') )
    -
    ( (length(def) - length(replace(def, '((get_my_role() = ''super_admin''::text) AND (org_id = get_my_org_id()))', '')))
      / length('((get_my_role() = ''super_admin''::text) AND (org_id = get_my_org_id()))') )
$fn$;

DO $migration$
DECLARE
  r                RECORD;
  v_new_qual       text;
  v_new_check      text;
  v_sql            text;
  v_changed        int := 0;
  v_remaining      int;

  -- the offending substring, exactly as Postgres renders it in the catalog
  c_bare    CONSTANT text := '(get_my_role() = ''super_admin''::text)';
  c_scoped  CONSTANT text := '((get_my_role() = ''super_admin''::text) AND (org_id = get_my_org_id()))';
  c_sentinel CONSTANT text := '@@SUPER_ADMIN_ALREADY_SCOPED@@';
BEGIN
  FOR r IN
    SELECT
      p.schemaname,
      p.tablename,
      p.policyname,
      p.cmd,
      pg_get_expr(pol.polqual,      pol.polrelid) AS qual,
      pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check
    FROM pg_policies p
    JOIN pg_class     c   ON c.relname = p.tablename
    JOIN pg_namespace n   ON n.oid = c.relnamespace AND n.nspname = p.schemaname
    JOIN pg_policy    pol ON pol.polrelid = c.oid AND pol.polname = p.policyname
    WHERE p.schemaname = 'public'
      -- only tables that actually carry an org_id column
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = c.oid
          AND a.attname = 'org_id'
          AND a.attnum > 0
          AND NOT a.attisdropped
      )
      -- only policies carrying an UNSCOPED bare clause.
      -- NOTE: the scoped form contains the bare form as a substring, so a
      -- plain LIKE would always match. Count occurrences of each instead:
      -- any bare occurrence not accounted for by a scoped one is unscoped.
      AND public.__unscoped_super_admin_count(
            COALESCE(pg_get_expr(pol.polqual, pol.polrelid), '')
          ) + public.__unscoped_super_admin_count(
            COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid), '')
          ) > 0
    ORDER BY p.tablename, p.policyname
  LOOP
    -- Protect any already-scoped clause behind a sentinel so it is not
    -- double-wrapped, patch the remaining bare ones, then restore.
    v_new_qual  := replace(replace(replace(COALESCE(r.qual, ''),
                     c_scoped, c_sentinel), c_bare, c_scoped), c_sentinel, c_scoped);
    v_new_check := replace(replace(replace(COALESCE(r.with_check, ''),
                     c_scoped, c_sentinel), c_bare, c_scoped), c_sentinel, c_scoped);

    v_sql := format('ALTER POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);

    IF r.qual IS NOT NULL THEN
      v_sql := v_sql || format(' USING (%s)', v_new_qual);
    END IF;

    IF r.with_check IS NOT NULL THEN
      v_sql := v_sql || format(' WITH CHECK (%s)', v_new_check);
    END IF;

    RAISE NOTICE 'Patching %.% policy % (%)', r.schemaname, r.tablename, r.policyname, r.cmd;
    EXECUTE v_sql;
    v_changed := v_changed + 1;
  END LOOP;

  RAISE NOTICE '--- Patched % policy/policies ---', v_changed;

  -- Verify: no bare clause may survive on any org_id-bearing table
  SELECT count(*) INTO v_remaining
  FROM pg_policies p
  JOIN pg_class     c   ON c.relname = p.tablename
  JOIN pg_namespace n   ON n.oid = c.relnamespace AND n.nspname = p.schemaname
  JOIN pg_policy    pol ON pol.polrelid = c.oid AND pol.polname = p.policyname
  WHERE p.schemaname = 'public'
    AND EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = c.oid AND a.attname = 'org_id'
        AND a.attnum > 0 AND NOT a.attisdropped
    )
    AND public.__unscoped_super_admin_count(
          COALESCE(pg_get_expr(pol.polqual, pol.polrelid), '')
        ) + public.__unscoped_super_admin_count(
          COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid), '')
        ) > 0;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Migration incomplete: % policy/policies still contain an unscoped super_admin clause. Rolling back.', v_remaining;
  END IF;

  RAISE NOTICE 'Verified: no unscoped super_admin clauses remain.';
END
$migration$;

DROP FUNCTION public.__unscoped_super_admin_count(text);

COMMIT;

-- ---------------------------------------------------------------------
-- Post-migration review: every remaining super_admin mention should now
-- sit next to an org_id check. Eyeball this output after running.
-- ---------------------------------------------------------------------
SELECT tablename, policyname, cmd,
       COALESCE(qual, with_check) AS definition
FROM pg_policies
WHERE schemaname = 'public'
  AND (COALESCE(qual, '') LIKE '%super_admin%' OR COALESCE(with_check, '') LIKE '%super_admin%')
ORDER BY tablename, policyname;
