
-- Function: when a new organisation is created, automatically give it a Main Branch.
-- Idempotent: only inserts if the org has no main branch yet, so it can never double up.
CREATE OR REPLACE FUNCTION public.create_main_branch_for_new_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.branches
    WHERE org_id = NEW.id AND is_main_branch = true
  ) THEN
    INSERT INTO public.branches (org_id, name, is_main_branch, is_active, created_at, updated_at)
    VALUES (NEW.id, 'Main Branch', true, true, now(), now());
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger: fires once, right after a new organisation row is inserted.
DROP TRIGGER IF EXISTS trg_create_main_branch ON public.organisations;
CREATE TRIGGER trg_create_main_branch
AFTER INSERT ON public.organisations
FOR EACH ROW
EXECUTE FUNCTION public.create_main_branch_for_new_org();
;