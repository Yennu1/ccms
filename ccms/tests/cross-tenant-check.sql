-- =====================================================================
-- CCMS cross-tenant isolation check  (v2)
-- Save as: ccms/tests/cross-tenant-check.sql   <- and COMMIT it to the repo
-- =====================================================================
--
-- WHAT IT DOES
--   Logs in (impersonates) a real user from Org A and tries to read Org B's
--   data, then does the reverse. Four kinds of check, all in one run:
--
--   1. TABLE   Direct SELECT on every tenant table (anything with an
--              org_id column, plus the organisations table).
--   2. RPC     Every read-only database function that takes p_org_id,
--              found AUTOMATICALLY. You no longer have to remember to add
--              new functions to a list.
--   3. RLS     Every tenant table has row-level security switched on and
--              at least one SELECT policy.
--   4. LINT    A read-only scan of every policy in the public schema, incl. the
--              INSERT / UPDATE / DELETE ones. Every way a policy can grant
--              access (every top-level OR branch) must be tied to the
--              caller's org or to the caller themselves. That catches the
--              mistakes that actually happened here: a bare super_admin
--              clause, or a role list with no org check. Also checks the
--              member-photos storage policies.
--
-- SAFE TO RUN ON PRODUCTION
--   It writes nothing to your real tables. It only creates temporary
--   objects that vanish when the session ends. Database functions that
--   are VOLATILE (allowed to write) are never executed; they are listed
--   as MANUAL so you know they were not covered.
--
-- HOW TO RUN
--   Supabase Dashboard -> SQL Editor -> paste the whole file -> Run.
--   You will get a "destructive operations" warning because the file
--   contains DROP TABLE for its own temporary tables. That is expected.
--   Results come back as ONE table. The first row is the verdict.
--
-- READING THE STATUS COLUMN
--   FAIL           A real leak. Do not deploy, do not onboard anyone.
--   LINT_FAIL      A policy that looks unscoped. Read the detail, fix it.
--   ERROR          The check could not run. Read the detail.
--   INCONCLUSIVE   Nothing to test against (empty table, or no rows for
--                  the arguments used). NOT a pass, not a failure.
--   MANUAL         Not executed by design. Review by hand.
--   SKIP           Not reachable by logged-in users, or cannot be called.
--   PASS           Checked and clean.
--
-- WHEN TO RUN
--   Before onboarding any new church, and after any migration that adds
--   a table, a function, or a policy.
--
-- BEFORE YOU RUN: set the two emails below to two users who belong to
-- two DIFFERENT organisations.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. Setup
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS pg_temp.ct_config;
CREATE TEMP TABLE ct_config (
  label   text,
  email   text,
  user_id uuid,
  org_id  uuid
);

INSERT INTO ct_config (label, email) VALUES
  ('Org A', 'admin@centry.com'),      -- <-- edit if needed
  ('Org B', 'faithwalk@gmail.com');   -- <-- edit if needed

UPDATE ct_config c
SET user_id = u.id
FROM auth.users u
WHERE lower(u.email) = lower(c.email);

UPDATE ct_config c
SET org_id = p.org_id
FROM public.profiles p
WHERE p.id = c.user_id;

DO $$
DECLARE v_missing text;
BEGIN
  SELECT string_agg(label || ' (' || email || ')', ', ')
  INTO v_missing FROM ct_config WHERE user_id IS NULL OR org_id IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Could not resolve user or org for: %. Edit the emails at the top of this file.', v_missing;
  END IF;
  IF (SELECT count(DISTINCT org_id) FROM ct_config) < 2 THEN
    RAISE EXCEPTION 'Both test users resolve to the same org. Pick users from two different tenants.';
  END IF;
END $$;

-- Tables that carry a tenant key. organisations has no org_id, its own id is the key.
DROP TABLE IF EXISTS pg_temp.ct_tenant_tables;
CREATE TEMP TABLE ct_tenant_tables AS
SELECT c.oid AS reloid,
       c.relname::text AS table_name,
       CASE
         WHEN EXISTS (SELECT 1 FROM pg_attribute a
                      WHERE a.attrelid = c.oid AND a.attname = 'org_id'
                        AND a.attnum > 0 AND NOT a.attisdropped) THEN 'org_id'
         WHEN c.relname = 'organisations' THEN 'id'
       END AS tenant_col
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r';
DELETE FROM ct_tenant_tables WHERE tenant_col IS NULL;

-- Policies a human has reviewed and judged safe, with the reason.
DROP TABLE IF EXISTS pg_temp.ct_exempt;
CREATE TEMP TABLE ct_exempt (table_name text, reason text);
-- Example: INSERT INTO ct_exempt VALUES ('some_lookup_table', 'public reference data, no tenant');

DROP TABLE IF EXISTS pg_temp.ct_results;
CREATE TEMP TABLE ct_results (
  check_kind   text,
  attacker     text,
  target       text,
  object_name  text,
  control_rows bigint,
  attack_rows  bigint,
  status       text,
  detail       text
);

-- Builds a named-argument call for a function, using the given org id for
-- p_org_id and sensible stand-ins for any other required argument.
-- Arguments that have a default are left out so the default applies.
CREATE OR REPLACE FUNCTION pg_temp.ct_build_args(p_fn oid, p_org uuid)
RETURNS text LANGUAGE plpgsql AS $f$
DECLARE
  r record;
  v_types oid[]; v_modes "char"[]; v_names text[];
  i int; v_mode "char"; v_in int := 0;
  v_name text; v_tname text; v_val text; v_out text := '';
BEGIN
  SELECT p.proargnames AS names,
         COALESCE(p.proallargtypes, p.proargtypes::oid[]) AS types,
         p.proargmodes AS modes, p.pronargs, p.pronargdefaults
  INTO r FROM pg_proc p WHERE p.oid = p_fn;

  v_names := r.names; v_types := r.types; v_modes := r.modes;

  FOR i IN 1..COALESCE(array_length(v_types, 1), 0) LOOP
    v_mode := COALESCE(v_modes[i], 'i');
    CONTINUE WHEN v_mode NOT IN ('i', 'b', 'v');      -- input arguments only
    v_in := v_in + 1;
    v_name := v_names[i];
    v_tname := format_type(v_types[i], NULL);

    IF v_name = 'p_org_id' THEN
      v_val := quote_literal(p_org::text) || '::uuid';
    ELSIF v_in > (r.pronargs - r.pronargdefaults) THEN
      CONTINUE;                                        -- has a default, omit
    ELSIF v_name IS NULL OR v_name = '' THEN
      RETURN NULL;                                     -- unnamed required arg
    ELSE
      v_val := CASE
        WHEN v_tname = 'date' THEN
          quote_literal(CASE WHEN v_name ~* '(start|from|since|begin)' THEN '2000-01-01'
                             WHEN v_name ~* '(end|until|to$)' THEN (CURRENT_DATE + 1)::text
                             ELSE CURRENT_DATE::text END) || '::date'
        WHEN v_tname IN ('timestamp with time zone', 'timestamp without time zone') THEN
          quote_literal(CASE WHEN v_name ~* '(start|from|since|begin)' THEN '2000-01-01'
                             WHEN v_name ~* '(end|until|to$)' THEN (CURRENT_DATE + 1)::text
                             ELSE CURRENT_DATE::text END) || '::' || v_tname
        WHEN v_tname IN ('integer', 'bigint', 'smallint') THEN
          (CASE WHEN v_name ~* 'year'  THEN EXTRACT(year FROM CURRENT_DATE)::int::text
                WHEN v_name ~* 'month' THEN '12'
                WHEN v_name ~* 'day'   THEN '365'
                WHEN v_name ~* 'week'  THEN '52'
                WHEN v_name ~* 'limit|top' THEN '50'
                ELSE '10' END) || '::' || v_tname
        WHEN v_tname IN ('integer[]', 'bigint[]', 'smallint[]') AND v_name ~* 'month' THEN
          'ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]::' || v_tname
        WHEN v_tname = 'boolean' THEN 'false'
        ELSE 'NULL::' || v_tname
      END;
    END IF;

    v_out := v_out || CASE WHEN v_out = '' THEN '' ELSE ', ' END
                   || format('%I => %s', v_name, v_val);
  END LOOP;

  RETURN v_out;
END
$f$;



-- Splits a policy expression into its top-level OR branches. Every branch is
-- a separate way of getting access, so every branch must be tied to an org.
CREATE OR REPLACE FUNCTION pg_temp.ct_or_branches(p_expr text)
RETURNS text[] LANGUAGE plpgsql AS $f$
DECLARE
  s text := btrim(regexp_replace(p_expr, '\s+', ' ', 'g'));
  n int; i int; depth int; ch text; inq boolean; st int;
  stripped boolean := true;
  res text[] := '{}';
BEGIN
  -- peel off parentheses that wrap the whole expression
  WHILE stripped AND left(s, 1) = '(' AND right(s, 1) = ')' LOOP
    depth := 0; inq := false;
    FOR i IN 1..length(s) LOOP
      ch := substr(s, i, 1);
      IF ch = '''' THEN inq := NOT inq;
      ELSIF NOT inq THEN
        IF ch = '(' THEN depth := depth + 1;
        ELSIF ch = ')' THEN
          depth := depth - 1;
          IF depth = 0 AND i < length(s) THEN stripped := false; EXIT; END IF;
        END IF;
      END IF;
    END LOOP;
    IF stripped THEN s := btrim(substr(s, 2, length(s) - 2)); END IF;
  END LOOP;

  -- split on OR at depth zero
  depth := 0; inq := false; st := 1; n := length(s); i := 1;
  WHILE i <= n LOOP
    ch := substr(s, i, 1);
    IF ch = '''' THEN inq := NOT inq;
    ELSIF NOT inq THEN
      IF ch = '(' THEN depth := depth + 1;
      ELSIF ch = ')' THEN depth := depth - 1;
      ELSIF depth = 0 AND substr(s, i, 4) = ' OR ' THEN
        res := res || btrim(substr(s, st, i - st));
        st := i + 4; i := i + 3;
      END IF;
    END IF;
    i := i + 1;
  END LOOP;
  res := res || btrim(substr(s, st));
  RETURN res;
END
$f$;

-- NULL if every branch of the expression is tied to an org or to the user,
-- otherwise a description of the first branch that is not.
CREATE OR REPLACE FUNCTION pg_temp.ct_policy_issue(p_expr text)
RETURNS text LANGUAGE plpgsql AS $f$
DECLARE b text;
BEGIN
  IF p_expr IS NULL OR btrim(p_expr) = '' THEN RETURN NULL; END IF;
  FOREACH b IN ARRAY pg_temp.ct_or_branches(p_expr) LOOP
    IF position('get_my_org_id()' IN b) = 0 AND position('auth.uid()' IN b) = 0 THEN
      RETURN 'a way in with no org or user check: ' || left(b, 180);
    END IF;
  END LOOP;
  RETURN NULL;
END
$f$;

-- ---------------------------------------------------------------------
-- 1. RLS posture: switched on, with at least one SELECT policy
-- ---------------------------------------------------------------------
INSERT INTO ct_results (check_kind, object_name, status, detail)
SELECT
  'RLS', t.table_name,
  CASE WHEN NOT c.relrowsecurity THEN 'FAIL'
       WHEN COALESCE(pol.sel, 0) = 0 THEN 'FAIL'
       ELSE 'PASS' END,
  CASE WHEN NOT c.relrowsecurity THEN 'RLS is NOT enabled on this table'
       WHEN COALESCE(pol.sel, 0) = 0 THEN 'RLS enabled but ZERO SELECT policies (fails closed, still a bug)'
       ELSE pol.sel || ' SELECT policy/policies, ' || pol.total || ' total' END
FROM ct_tenant_tables t
JOIN pg_class c ON c.oid = t.reloid
LEFT JOIN (
  SELECT tablename,
         count(*) FILTER (WHERE cmd IN ('SELECT', 'ALL')) AS sel,
         count(*) AS total
  FROM pg_policies WHERE schemaname = 'public' GROUP BY tablename
) pol ON pol.tablename = t.table_name;


-- ---------------------------------------------------------------------
-- 2. Policy lint (read-only, covers INSERT / UPDATE / DELETE too)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  rec record;
  v_issue text; v_exempt text;
  n_checked int := 0; n_exempt int := 0; n_bad int := 0;
BEGIN
  FOR rec IN
    SELECT p.tablename, p.policyname, p.cmd,
           COALESCE(p.qual, '') AS qual, COALESCE(p.with_check, '') AS wc
    FROM pg_policies p
    WHERE p.schemaname = 'public'
    ORDER BY p.tablename, p.policyname
  LOOP
    n_checked := n_checked + 1;

    SELECT reason INTO v_exempt FROM ct_exempt WHERE table_name = rec.tablename;
    IF FOUND THEN n_exempt := n_exempt + 1; CONTINUE; END IF;

    v_issue := COALESCE(pg_temp.ct_policy_issue(rec.qual), pg_temp.ct_policy_issue(rec.wc));

    IF v_issue IS NOT NULL THEN
      n_bad := n_bad + 1;
      INSERT INTO ct_results (check_kind, object_name, status, detail)
      VALUES ('LINT', rec.tablename || '.' || rec.policyname, 'LINT_FAIL',
              rec.cmd || ' policy has ' || v_issue
              || ' | If this is intentional, add the table to ct_exempt at the top of this file, with a reason.');
    END IF;
  END LOOP;

  INSERT INTO ct_results (check_kind, object_name, status, detail)
  VALUES ('LINT', 'all policies', CASE WHEN n_bad = 0 THEN 'PASS' ELSE 'INFO' END,
          n_checked || ' policies scanned, ' || n_exempt || ' reviewed-and-exempt, ' || n_bad || ' flagged');
END $$;

-- member-photos storage policies must be tied to the caller's org
DO $$
DECLARE
  rec record; n int := 0; d text;
BEGIN
  FOR rec IN
    SELECT policyname, cmd, COALESCE(qual, '') || ' ' || COALESCE(with_check, '') AS d
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (COALESCE(qual, '') || COALESCE(with_check, '')) LIKE '%member-photos%'
  LOOP
    n := n + 1;
    INSERT INTO ct_results (check_kind, object_name, status, detail)
    VALUES ('LINT', 'storage.objects.' || rec.policyname,
            CASE WHEN position('get_my_org_id()' IN rec.d) > 0 THEN 'PASS' ELSE 'LINT_FAIL' END,
            rec.cmd || ' policy on member-photos ' ||
            CASE WHEN position('get_my_org_id()' IN rec.d) > 0
                 THEN 'is tied to the caller''s org'
                 ELSE 'is NOT tied to the caller''s org' END);
  END LOOP;

  IF n = 0 THEN
    INSERT INTO ct_results (check_kind, object_name, status, detail)
    VALUES ('LINT', 'storage.member-photos', 'ERROR',
            'No policies found for the member-photos bucket. Photo uploads will fail. Run the member-photos migration.');
  END IF;
END $$;


-- ---------------------------------------------------------------------
-- 3. Live isolation tests, as a logged-in user from each org
-- ---------------------------------------------------------------------
DO $$
DECLARE
  r_att ct_config%ROWTYPE;
  r_tgt ct_config%ROWTYPE;
  v_claims text;
  rec record;
  fn record;
  v_ctrl bigint; v_atk bigint;
  v_status text; v_detail text;
  v_args_c text; v_args_a text;
BEGIN
  -- Functions this script will NOT run. Listed once so nothing is silently skipped.
  FOR fn IN
    SELECT p.proname, p.provolatile
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND 'p_org_id' = ANY (p.proargnames)
      AND (p.provolatile = 'v' OR NOT p.proretset)
    ORDER BY p.proname
  LOOP
    INSERT INTO ct_results (check_kind, object_name, status, detail)
    VALUES ('RPC', fn.proname, 'MANUAL',
      CASE WHEN fn.provolatile = 'v'
           THEN 'VOLATILE (may write), so not executed. Check by hand that it compares p_org_id with get_my_org_id().'
           ELSE 'Does not return a set of rows, so rows cannot be counted. Check by hand that it compares p_org_id with get_my_org_id().' END);
  END LOOP;

  FOR r_att IN SELECT * FROM ct_config ORDER BY label LOOP
    SELECT * INTO r_tgt FROM ct_config WHERE org_id <> r_att.org_id LIMIT 1;
    v_claims := json_build_object(
      'sub', r_att.user_id::text, 'role', 'authenticated', 'aud', 'authenticated')::text;

    -- 3a. Direct table reads
    FOR rec IN SELECT table_name, tenant_col FROM ct_tenant_tables ORDER BY table_name LOOP
      v_ctrl := NULL; v_atk := NULL; v_detail := NULL;
      BEGIN
        EXECUTE 'SET LOCAL ROLE authenticated';
        EXECUTE format('SET LOCAL request.jwt.claims = %L', v_claims);
        EXECUTE format('SELECT count(*) FROM public.%I WHERE %I = %L',
                       rec.table_name, rec.tenant_col, r_att.org_id) INTO v_ctrl;
        EXECUTE format('SELECT count(*) FROM public.%I WHERE %I = %L',
                       rec.table_name, rec.tenant_col, r_tgt.org_id) INTO v_atk;
        EXECUTE 'RESET ROLE';
      EXCEPTION WHEN OTHERS THEN
        EXECUTE 'RESET ROLE';
        v_detail := 'Query failed: ' || SQLERRM;
      END;

      IF v_detail IS NOT NULL THEN
        v_status := 'ERROR';
      ELSIF v_atk > 0 THEN
        v_status := 'FAIL';
        v_detail := 'LEAK: read ' || v_atk || ' rows belonging to ' || r_tgt.label;
      ELSIF v_ctrl = 0 THEN
        v_status := 'INCONCLUSIVE';
        v_detail := 'No own-org rows either, so this proves nothing. Add data to this table in both orgs.';
      ELSE
        v_status := 'PASS';
        v_detail := 'Own org ' || v_ctrl || ' rows, other org 0 rows';
      END IF;

      INSERT INTO ct_results
      VALUES ('TABLE', r_att.label, r_tgt.label, rec.table_name, v_ctrl, v_atk, v_status, v_detail);
    END LOOP;

    -- 3b. Read-only functions that take p_org_id (auto-discovered)
    FOR fn IN
      SELECT p.oid, p.proname
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prokind = 'f'
        AND 'p_org_id' = ANY (p.proargnames)
        AND p.provolatile IN ('s', 'i') AND p.proretset
      ORDER BY p.proname
    LOOP
      v_args_c := pg_temp.ct_build_args(fn.oid, r_att.org_id);
      v_args_a := pg_temp.ct_build_args(fn.oid, r_tgt.org_id);

      IF v_args_c IS NULL THEN
        INSERT INTO ct_results
        VALUES ('RPC', r_att.label, r_tgt.label, fn.proname, NULL, NULL, 'SKIP',
                'Has an unnamed required argument, so the script cannot build a call. Check by hand.');
        CONTINUE;
      END IF;

      v_ctrl := NULL; v_atk := NULL; v_detail := NULL; v_status := NULL;
      BEGIN
        EXECUTE 'SET LOCAL ROLE authenticated';
        EXECUTE format('SET LOCAL request.jwt.claims = %L', v_claims);
        EXECUTE format('SELECT count(*) FROM public.%I(%s)', fn.proname, v_args_c) INTO v_ctrl;
        EXECUTE format('SELECT count(*) FROM public.%I(%s)', fn.proname, v_args_a) INTO v_atk;
        EXECUTE 'RESET ROLE';
      EXCEPTION
        WHEN insufficient_privilege THEN
          v_status := 'SKIP';
          v_detail := 'Logged-in users are not allowed to call this, so it is not reachable from the app.';
        WHEN OTHERS THEN
          v_detail := 'Call failed: ' || SQLERRM || ' | args: ' || left(v_args_c, 160);
      END;

      IF v_status IS NULL THEN
        IF v_detail IS NOT NULL THEN
          v_status := 'ERROR';
        ELSIF v_atk > 0 THEN
          v_status := 'FAIL';
          v_detail := 'LEAK: returned ' || v_atk || ' rows of another tenant''s data';
        ELSIF v_ctrl = 0 THEN
          v_status := 'INCONCLUSIVE';
          v_detail := 'Own-org call also returned 0 rows, so this proves nothing. Args used: ' || left(v_args_c, 160);
        ELSE
          v_status := 'PASS';
          v_detail := 'Own org ' || v_ctrl || ' rows, other org 0 rows';
        END IF;
      END IF;

      INSERT INTO ct_results
      VALUES ('RPC', r_att.label, r_tgt.label, fn.proname, v_ctrl, v_atk, v_status, v_detail);
    END LOOP;
  END LOOP;

  EXECUTE 'RESET ROLE';
END $$;


-- ---------------------------------------------------------------------
-- 4. One result table. First row is the verdict.
-- ---------------------------------------------------------------------
WITH s AS (
  SELECT
    count(*) FILTER (WHERE status IN ('FAIL', 'LINT_FAIL')) AS bad,
    count(*) FILTER (WHERE status IN ('ERROR', 'INCONCLUSIVE')) AS unproven,
    count(*) FILTER (WHERE status = 'MANUAL') AS manual,
    count(*) FILTER (WHERE status = 'PASS') AS passed,
    count(*) AS total
  FROM ct_results
)
SELECT check_kind, attacker, target, object_name, control_rows, attack_rows, status, detail
FROM (
  SELECT 0 AS ord, 'VERDICT' AS check_kind, NULL::text AS attacker, NULL::text AS target,
         NULL::text AS object_name, NULL::bigint AS control_rows, NULL::bigint AS attack_rows,
         CASE WHEN bad > 0 THEN 'FAIL' WHEN unproven > 0 THEN 'REVIEW' ELSE 'PASS' END AS status,
         CASE
           WHEN bad > 0 THEN '*** ' || bad || ' PROBLEM(S) FOUND. DO NOT DEPLOY OR ONBOARD UNTIL FIXED. ***'
           WHEN unproven > 0 THEN 'No leaks found. ' || unproven || ' check(s) could not be proven (empty data or errors), '
                                  || passed || ' passed, ' || manual || ' need a manual look.'
           ELSE 'All ' || passed || ' checks passed, ' || manual || ' need a manual look.'
         END AS detail,
         s.total
  FROM s
  UNION ALL
  SELECT CASE status WHEN 'FAIL' THEN 1 WHEN 'LINT_FAIL' THEN 2 WHEN 'ERROR' THEN 3
                     WHEN 'INCONCLUSIVE' THEN 4 WHEN 'MANUAL' THEN 5 WHEN 'SKIP' THEN 6 ELSE 7 END,
         check_kind, attacker, target, object_name, control_rows, attack_rows, status, detail, 0
  FROM ct_results
) x
ORDER BY ord, check_kind, object_name, attacker;
