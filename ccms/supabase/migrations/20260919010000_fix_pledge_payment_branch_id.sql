-- Fix: recording a pledge payment failed with
--   null value in column "branch_id" of relation "transactions"
--   violates not-null constraint
--
-- Root cause: on_pledge_payment_insert() copied NEW.branch_id (the branch
-- on the pledge_payments row, which comes from the logged-in user) straight
-- into transactions.branch_id. pledge_payments.branch_id is nullable and
-- super_admin/admin accounts have no branch_id of their own (they're not
-- tied to one branch), so the copied value was NULL. transactions.branch_id
-- is NOT NULL, so the insert failed and the whole payment was rejected.
--
-- Fix: always take branch_id from the pledge being paid (pledges.branch_id
-- is set once, from the member's branch, when the pledge is created), never
-- from the person recording the payment.

CREATE OR REPLACE FUNCTION public.on_pledge_payment_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id   UUID;
  v_category_id UUID;
  v_branch_id   UUID;
BEGIN
  SELECT member_id, category_id, branch_id
    INTO v_member_id, v_category_id, v_branch_id
    FROM public.pledges
    WHERE id = NEW.pledge_id;

  INSERT INTO public.transactions (
    org_id, branch_id, member_id, category_id,
    amount, currency, payment_method, transaction_date,
    reference_number, notes, recorded_by, is_collective,
    pledge_id, pledge_payment_id
  ) VALUES (
    NEW.org_id, v_branch_id, v_member_id, v_category_id,
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
