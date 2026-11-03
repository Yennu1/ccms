-- =====================================================================
-- Give every new member a member number automatically
-- Migration: 20261029000002_assign_member_number_trigger.sql
-- =====================================================================
--
-- THE PROBLEM
--   The "Add member" form (MemberNewPage.tsx) sends no member_number and
--   says "the database trigger assigns member_number automatically". That
--   trigger never existed: the members table has no triggers at all. So
--   every member added through the form has member_number = NULL. That
--   also crashed member search in production ("Cannot read properties of
--   null (reading 'toLowerCase')"), fixed separately in PR #27.
--   Members from the CSV import are fine: the importer numbers them itself.
--
-- THE FIX
--   1. A BEFORE INSERT trigger that assigns the next number in the same
--      format the importer uses (GH-00001, GH-00002, ...), per church.
--      It only acts when no number was supplied, so the importer's own
--      numbers are left alone.
--      - It runs with owner rights (SECURITY DEFINER) so it sees every
--        member of the church, not just the caller's branch. Without that,
--        a branch admin would only see their own branch's numbers and could
--        hand out a duplicate.
--      - A per-church lock stops two people adding members at the same
--        moment from getting the same number.
--   2. A one-off backfill giving every existing member without a number
--      the next free number in their church, oldest first.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.assign_member_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_next int;
BEGIN
  IF NEW.member_number IS NOT NULL AND btrim(NEW.member_number) <> '' THEN
    RETURN NEW;   -- a number was supplied (e.g. the CSV importer)
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('member_number:' || NEW.org_id::text));

  SELECT COALESCE(MAX((substring(member_number FROM '(\d+)$'))::int), 0) + 1
  INTO v_next
  FROM public.members
  WHERE org_id = NEW.org_id;

  NEW.member_number := 'GH-' || lpad(v_next::text, 5, '0');
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_assign_member_number ON public.members;
CREATE TRIGGER trg_assign_member_number
  BEFORE INSERT ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.assign_member_number();

-- Backfill existing members that have no number, oldest first, per church.
DROP TABLE IF EXISTS pg_temp.backfilled;
CREATE TEMP TABLE backfilled (id uuid);

DO $$
DECLARE r record; v_next int;
BEGIN
  FOR r IN
    SELECT id, org_id FROM public.members
    WHERE member_number IS NULL OR btrim(member_number) = ''
    ORDER BY org_id, created_at
  LOOP
    PERFORM pg_advisory_xact_lock(hashtext('member_number:' || r.org_id::text));
    SELECT COALESCE(MAX((substring(member_number FROM '(\d+)$'))::int), 0) + 1
    INTO v_next FROM public.members WHERE org_id = r.org_id;

    UPDATE public.members
    SET member_number = 'GH-' || lpad(v_next::text, 5, '0')
    WHERE id = r.id;
    INSERT INTO backfilled VALUES (r.id);
  END LOOP;

  IF EXISTS (SELECT 1 FROM public.members WHERE member_number IS NULL OR btrim(member_number) = '') THEN
    RAISE EXCEPTION 'Rolling back: some members still have no number.';
  END IF;
END $$;

COMMIT;

-- Shown in the SQL editor: the members that just received a number.
SELECT m.first_name, m.last_name, m.member_number
FROM public.members m JOIN backfilled b ON b.id = m.id
ORDER BY m.created_at;
