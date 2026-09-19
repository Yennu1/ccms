-- ============================================================================
-- Pledge payments — history of individual amounts recorded against a pledge.
-- Each payment auto-creates a matching income row in transactions.
-- Deleting a pledge KEEPS its transactions (per product decision).
-- ============================================================================

BEGIN;

-- 1) Table -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.pledge_payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  branch_id         UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  pledge_id         UUID NOT NULL REFERENCES public.pledges(id) ON DELETE CASCADE,
  amount            NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method    TEXT NOT NULL DEFAULT 'cash'
                       CHECK (payment_method IN ('cash','momo','bank_transfer','cheque')),
  reference_number  TEXT,
  notes             TEXT,
  recorded_by       UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pledge_payments_pledge_id ON public.pledge_payments(pledge_id);
CREATE INDEX IF NOT EXISTS idx_pledge_payments_org_id    ON public.pledge_payments(org_id);
CREATE INDEX IF NOT EXISTS idx_pledge_payments_branch_id ON public.pledge_payments(branch_id);

-- 2) Link columns on transactions --------------------------------------------
-- pledge_id survives even if the payment/pledge row is deleted (audit trail).

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS pledge_id         UUID REFERENCES public.pledges(id)         ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pledge_payment_id UUID REFERENCES public.pledge_payments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_pledge_id         ON public.transactions(pledge_id);
CREATE INDEX IF NOT EXISTS idx_transactions_pledge_payment_id ON public.transactions(pledge_payment_id);

-- 3) RLS ---------------------------------------------------------------------

ALTER TABLE public.pledge_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pledge_payments_select" ON public.pledge_payments;
DROP POLICY IF EXISTS "pledge_payments_insert" ON public.pledge_payments;
DROP POLICY IF EXISTS "pledge_payments_update" ON public.pledge_payments;
DROP POLICY IF EXISTS "pledge_payments_delete" ON public.pledge_payments;

CREATE POLICY "pledge_payments_select" ON public.pledge_payments FOR SELECT
USING (
  (get_my_role() = 'super_admin' AND org_id = get_my_org_id())
  OR (get_my_role() IN ('admin','finance_officer') AND org_id = get_my_org_id())
);

CREATE POLICY "pledge_payments_insert" ON public.pledge_payments FOR INSERT
WITH CHECK (
  (get_my_role() = 'super_admin' AND org_id = get_my_org_id())
  OR (get_my_role() IN ('admin','finance_officer') AND org_id = get_my_org_id())
);

CREATE POLICY "pledge_payments_update" ON public.pledge_payments FOR UPDATE
USING (
  (get_my_role() = 'super_admin' AND org_id = get_my_org_id())
  OR (get_my_role() IN ('admin','finance_officer') AND org_id = get_my_org_id())
);

CREATE POLICY "pledge_payments_delete" ON public.pledge_payments FOR DELETE
USING (
  (get_my_role() = 'super_admin' AND org_id = get_my_org_id())
  OR (get_my_role() IN ('admin','finance_officer') AND org_id = get_my_org_id())
);

-- 4) Recalculate the pledge's amount_paid + status from its payments ---------

CREATE OR REPLACE FUNCTION public.recalc_pledge_amount_paid(p_pledge_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total   NUMERIC(14,2);
  v_target  NUMERIC(14,2);
  v_due     DATE;
  v_status  TEXT;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_total
    FROM public.pledge_payments
    WHERE pledge_id = p_pledge_id;

  SELECT total_amount, due_date, status
    INTO v_target, v_due, v_status
    FROM public.pledges
    WHERE id = p_pledge_id;

  -- If the pledge no longer exists (deleted mid-transaction), nothing to do.
  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.pledges SET
    amount_paid = v_total,
    status = CASE
      WHEN v_status = 'cancelled'                       THEN 'cancelled'
      WHEN v_total >= v_target                          THEN 'fulfilled'
      WHEN v_due IS NOT NULL AND v_due < CURRENT_DATE   THEN 'overdue'
      ELSE 'active'
    END
  WHERE id = p_pledge_id;
END;
$$;

-- 5) Sync triggers between pledge_payments and transactions ------------------
-- Session guard `ccms.pledge_deleting` = 'true' means a pledge is being
-- deleted right now; the payment-delete trigger then skips transaction
-- deletion so income history is preserved.

CREATE OR REPLACE FUNCTION public.on_pledge_payment_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id   UUID;
  v_category_id UUID;
BEGIN
  SELECT member_id, category_id
    INTO v_member_id, v_category_id
    FROM public.pledges
    WHERE id = NEW.pledge_id;

  INSERT INTO public.transactions (
    org_id, branch_id, member_id, category_id,
    amount, currency, payment_method, transaction_date,
    reference_number, notes, recorded_by, is_collective,
    pledge_id, pledge_payment_id
  ) VALUES (
    NEW.org_id, NEW.branch_id, v_member_id, v_category_id,
    NEW.amount, 'GHS', NEW.payment_method, NEW.payment_date,
    NEW.reference_number,
    COALESCE(NEW.notes, 'Pledge payment'),
    NEW.recorded_by, FALSE,
    NEW.pledge_id, NEW.id
  );

  PERFORM public.recalc_pledge_amount_paid(NEW.pledge_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_pledge_payment_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.transactions SET
    amount           = NEW.amount,
    payment_method   = NEW.payment_method,
    transaction_date = NEW.payment_date,
    reference_number = NEW.reference_number,
    notes            = COALESCE(NEW.notes, 'Pledge payment')
  WHERE pledge_payment_id = NEW.id;

  PERFORM public.recalc_pledge_amount_paid(NEW.pledge_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_pledge_payment_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleting_pledge TEXT;
BEGIN
  BEGIN
    v_deleting_pledge := current_setting('ccms.pledge_deleting', TRUE);
  EXCEPTION WHEN OTHERS THEN
    v_deleting_pledge := NULL;
  END;

  IF v_deleting_pledge IS DISTINCT FROM 'true' THEN
    DELETE FROM public.transactions WHERE pledge_payment_id = OLD.id;
    PERFORM public.recalc_pledge_amount_paid(OLD.pledge_id);
  END IF;

  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_pledge_delete_begin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('ccms.pledge_deleting', 'true', TRUE);
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_pledge_delete_end()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('ccms.pledge_deleting', 'false', TRUE);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_pledge_payment_insert ON public.pledge_payments;
DROP TRIGGER IF EXISTS trg_pledge_payment_update ON public.pledge_payments;
DROP TRIGGER IF EXISTS trg_pledge_payment_delete ON public.pledge_payments;
DROP TRIGGER IF EXISTS trg_pledge_delete_begin   ON public.pledges;
DROP TRIGGER IF EXISTS trg_pledge_delete_end     ON public.pledges;

CREATE TRIGGER trg_pledge_payment_insert
  AFTER INSERT ON public.pledge_payments
  FOR EACH ROW EXECUTE FUNCTION public.on_pledge_payment_insert();

CREATE TRIGGER trg_pledge_payment_update
  AFTER UPDATE ON public.pledge_payments
  FOR EACH ROW EXECUTE FUNCTION public.on_pledge_payment_update();

CREATE TRIGGER trg_pledge_payment_delete
  BEFORE DELETE ON public.pledge_payments
  FOR EACH ROW EXECUTE FUNCTION public.on_pledge_payment_delete();

CREATE TRIGGER trg_pledge_delete_begin
  BEFORE DELETE ON public.pledges
  FOR EACH ROW EXECUTE FUNCTION public.on_pledge_delete_begin();

CREATE TRIGGER trg_pledge_delete_end
  AFTER DELETE ON public.pledges
  FOR EACH ROW EXECUTE FUNCTION public.on_pledge_delete_end();

COMMIT;
