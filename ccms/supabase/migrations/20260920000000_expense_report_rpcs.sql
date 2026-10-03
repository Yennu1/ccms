-- Expense reporting RPCs for the new Reports > Expense panel.
--
-- Mirrors the giving report shape but filters by an explicit set of months
-- within one year (the admin ticks months + picks a year), NOT a rolling
-- N-month window. Empty months are zero-filled so the chart always shows a
-- bar slot (blank at ₵0) for every month the admin selected.
--
-- SECURITY: all functions are SECURITY DEFINER (bypass RLS for aggregate
-- performance, same pattern as the existing dashboard RPCs). Each one is
-- fail-closed: the WHERE clause carries `AND p_org_id = get_my_org_id()`, so
-- passing another org's id returns zero rows instead of that org's data.
-- This matches migration 20260821000000_fix_cross_tenant_leak_dashboard_rpcs.

-- ─── get_expense_by_month ─────────────────────────────────────────────────────
-- Monthly expense totals broken down by the same 4 category buckets used on the
-- giving chart, for the selected months of one year. p_months is an int[] of
-- month numbers (1-12). Zero-filled: every requested month is returned.
CREATE OR REPLACE FUNCTION public.get_expense_by_month(
  p_org_id uuid, p_year int, p_months int[], p_branch_id uuid DEFAULT NULL
)
RETURNS TABLE(
  month text, salaries numeric, utilities numeric, events numeric, other_amount numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH wanted AS (
    SELECT TO_CHAR(make_date(p_year, m, 1), 'YYYY-MM') AS ym
    FROM unnest(p_months) AS m
    WHERE m BETWEEN 1 AND 12
  )
  SELECT
    w.ym,
    COALESCE(SUM(e.amount) FILTER (WHERE LOWER(tc.name) LIKE '%salar%'), 0),
    COALESCE(SUM(e.amount) FILTER (WHERE LOWER(tc.name) LIKE '%util%'), 0),
    COALESCE(SUM(e.amount) FILTER (WHERE LOWER(tc.name) LIKE '%event%'), 0),
    COALESCE(SUM(e.amount) FILTER (WHERE tc.name IS NULL OR (
      LOWER(tc.name) NOT LIKE '%salar%'
      AND LOWER(tc.name) NOT LIKE '%util%'
      AND LOWER(tc.name) NOT LIKE '%event%'
    )), 0)
  FROM wanted w
  LEFT JOIN expenses e
    ON TO_CHAR(DATE_TRUNC('month', e.expense_date), 'YYYY-MM') = w.ym
   AND e.org_id = p_org_id
   AND (p_branch_id IS NULL OR e.branch_id = p_branch_id)
  LEFT JOIN transaction_categories tc ON tc.id = e.category_id
  WHERE p_org_id = get_my_org_id()
  GROUP BY w.ym
  ORDER BY w.ym;
$$;

-- ─── get_expense_category_breakdown ───────────────────────────────────────────
-- Total per category across the selected months of one year, for the small
-- horizontal breakdown + the table underneath the chart.
CREATE OR REPLACE FUNCTION public.get_expense_category_breakdown(
  p_org_id uuid, p_year int, p_months int[], p_branch_id uuid DEFAULT NULL
)
RETURNS TABLE(category text, total numeric, cnt bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(tc.name, 'Uncategorised'), COALESCE(SUM(e.amount), 0), COUNT(*)
  FROM expenses e
  LEFT JOIN transaction_categories tc ON tc.id = e.category_id
  WHERE e.org_id = p_org_id
    AND p_org_id = get_my_org_id()
    AND (p_branch_id IS NULL OR e.branch_id = p_branch_id)
    AND DATE_PART('year', e.expense_date) = p_year
    AND DATE_PART('month', e.expense_date) = ANY(p_months)
  GROUP BY tc.name
  ORDER BY SUM(e.amount) DESC;
$$;

-- ─── get_expense_summary ──────────────────────────────────────────────────────
-- KPI cards. Defaults (no month/year filter applied) describe the CURRENT
-- month; when the admin applies a filter the frontend passes the selected
-- year + months and the same three cards recompute over that window.
CREATE OR REPLACE FUNCTION public.get_expense_summary(
  p_org_id uuid, p_year int, p_months int[], p_branch_id uuid DEFAULT NULL
)
RETURNS TABLE(total_spent numeric, category_count bigint, biggest_month text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH scoped AS (
    SELECT e.amount, e.category_id, e.expense_date
    FROM expenses e
    WHERE e.org_id = p_org_id
      AND p_org_id = get_my_org_id()
      AND (p_branch_id IS NULL OR e.branch_id = p_branch_id)
      AND DATE_PART('year', e.expense_date) = p_year
      AND DATE_PART('month', e.expense_date) = ANY(p_months)
  )
  SELECT
    COALESCE(SUM(amount), 0),
    COUNT(DISTINCT category_id),
    COALESCE((
      SELECT TO_CHAR(DATE_TRUNC('month', expense_date), 'YYYY-MM')
      FROM scoped
      GROUP BY DATE_TRUNC('month', expense_date)
      ORDER BY SUM(amount) DESC
      LIMIT 1
    ), '')
  FROM scoped;
$$;

GRANT EXECUTE ON FUNCTION public.get_expense_by_month(uuid, int, int[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_expense_category_breakdown(uuid, int, int[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_expense_summary(uuid, int, int[], uuid) TO authenticated;
