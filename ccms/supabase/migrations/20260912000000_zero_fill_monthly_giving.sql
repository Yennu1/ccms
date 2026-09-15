-- =====================================================================
-- Zero-fill get_monthly_giving so every calendar month is represented
-- Migration: 20260912000000_zero_fill_monthly_giving.sql
-- =====================================================================
--
-- THE BUG
--   get_monthly_giving grouped transactions by month, which means a
--   month with zero transactions produced NO ROW AT ALL rather than a
--   row with total = 0. The frontend's "3M / 6M / 12M" toggle takes the
--   last N *rows* from this result (DashboardPage.tsx), so a gap month
--   silently shifted what "6M" actually meant in real calendar time —
--   this is the root cause of the Giving Trend chart and its "X-month
--   total" figure not lining up, and matches the "presets not strictly
--   limiting to the exact window" behaviour reported separately.
--
-- THE FIX
--   Build the list of calendar months first (via generate_series), then
--   LEFT JOIN transactions onto it. Every month in the window is now
--   always present, with total = 0 where nothing was given.
--
-- VERIFIED
--   Tested against a reproduction with a deliberate gap month (no
--   transactions two months out of six). Before: 4 rows, two months
--   silently missing. After: 6 rows, the two gap months present at
--   total = 0.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_monthly_giving(p_org_id uuid, p_branch_id uuid DEFAULT NULL::uuid, p_months integer DEFAULT 12)
RETURNS TABLE(month text, total numeric) LANGUAGE sql STABLE AS $$
  WITH months AS (
    SELECT date_trunc('month', CURRENT_DATE) - (n || ' months')::interval AS mo
    FROM generate_series(0, p_months - 1) AS n
  )
  SELECT
    TO_CHAR(m.mo, 'YYYY-MM') AS month,
    COALESCE(SUM(t.amount), 0) AS total
  FROM months m
  LEFT JOIN public.transactions t
    ON DATE_TRUNC('month', t.transaction_date) = m.mo
    AND t.org_id = p_org_id
    AND p_org_id = public.get_my_org_id()
    AND (p_branch_id IS NULL OR t.branch_id = p_branch_id)
  GROUP BY m.mo
  ORDER BY m.mo;
$$;
