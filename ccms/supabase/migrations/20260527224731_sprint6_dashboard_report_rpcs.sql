
-- ─── get_monthly_giving ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_monthly_giving(
  p_org_id uuid, p_branch_id uuid DEFAULT NULL, p_months int DEFAULT 12
)
RETURNS TABLE(month text, total numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT TO_CHAR(DATE_TRUNC('month', transaction_date), 'YYYY-MM'),
         COALESCE(SUM(amount), 0)
  FROM transactions
  WHERE org_id = p_org_id
    AND (p_branch_id IS NULL OR branch_id = p_branch_id)
    AND transaction_date >= (CURRENT_DATE - make_interval(months => p_months))
  GROUP BY DATE_TRUNC('month', transaction_date)
  ORDER BY DATE_TRUNC('month', transaction_date);
$$;

-- ─── get_monthly_member_growth ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_monthly_member_growth(
  p_org_id uuid, p_branch_id uuid DEFAULT NULL, p_months int DEFAULT 12
)
RETURNS TABLE(month text, new_members bigint, cumulative bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH monthly AS (
    SELECT DATE_TRUNC('month', created_at) AS mo, COUNT(*) AS cnt
    FROM members
    WHERE org_id = p_org_id AND (p_branch_id IS NULL OR branch_id = p_branch_id)
      AND created_at >= (NOW() - make_interval(months => p_months))
    GROUP BY DATE_TRUNC('month', created_at)
  ), base AS (
    SELECT COUNT(*) AS total FROM members
    WHERE org_id = p_org_id AND (p_branch_id IS NULL OR branch_id = p_branch_id)
      AND created_at < (NOW() - make_interval(months => p_months))
  )
  SELECT TO_CHAR(m.mo, 'YYYY-MM'), m.cnt,
         SUM(m.cnt) OVER (ORDER BY m.mo) + b.total
  FROM monthly m, base b ORDER BY m.mo;
$$;

-- ─── get_weekly_attendance ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_weekly_attendance(
  p_org_id uuid, p_branch_id uuid DEFAULT NULL, p_weeks int DEFAULT 12
)
RETURNS TABLE(week_start text, present_count bigint, expected_count bigint, rate numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    TO_CHAR(DATE_TRUNC('week', e.starts_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD'),
    COUNT(a.id),
    COALESCE(SUM(e.expected_attendance), 0),
    CASE WHEN COALESCE(SUM(e.expected_attendance), 0) > 0
      THEN ROUND(COUNT(a.id)::numeric / SUM(e.expected_attendance) * 100, 1) ELSE 0 END
  FROM events e
  LEFT JOIN attendance a ON a.event_id = e.id AND a.org_id = p_org_id
  WHERE e.org_id = p_org_id AND (p_branch_id IS NULL OR e.branch_id = p_branch_id)
    AND e.starts_at >= (NOW() - make_interval(weeks => p_weeks))
    AND e.event_type = 'sunday_service'
  GROUP BY DATE_TRUNC('week', e.starts_at AT TIME ZONE 'UTC')
  ORDER BY DATE_TRUNC('week', e.starts_at AT TIME ZONE 'UTC');
$$;

-- ─── get_category_breakdown ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_category_breakdown(
  p_org_id uuid, p_branch_id uuid DEFAULT NULL,
  p_start date DEFAULT NULL, p_end date DEFAULT NULL
)
RETURNS TABLE(category text, total numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(tc.name, 'Other'), COALESCE(SUM(t.amount), 0)
  FROM transactions t
  LEFT JOIN transaction_categories tc ON tc.id = t.category_id
  WHERE t.org_id = p_org_id AND (p_branch_id IS NULL OR t.branch_id = p_branch_id)
    AND (p_start IS NULL OR t.transaction_date >= p_start)
    AND (p_end IS NULL OR t.transaction_date <= p_end)
  GROUP BY COALESCE(tc.name, 'Other') ORDER BY SUM(t.amount) DESC;
$$;

-- ─── get_branch_comparison ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_branch_comparison(
  p_org_id uuid, p_start date DEFAULT NULL, p_end date DEFAULT NULL
)
RETURNS TABLE(branch_id uuid, branch_name text, member_count bigint, monthly_giving numeric, attendance_rate numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id, b.name,
    COUNT(DISTINCT m.id) FILTER (WHERE m.membership_status = 'active'),
    COALESCE(SUM(t.amount), 0),
    CASE WHEN COALESCE(SUM(e.expected_attendance), 0) > 0
      THEN ROUND(COUNT(DISTINCT a.id)::numeric / SUM(e.expected_attendance) * 100, 1) ELSE 0 END
  FROM branches b
  LEFT JOIN members m ON m.branch_id = b.id AND m.org_id = p_org_id
  LEFT JOIN transactions t ON t.branch_id = b.id AND t.org_id = p_org_id
    AND (p_start IS NULL OR t.transaction_date >= p_start)
    AND (p_end IS NULL OR t.transaction_date <= p_end)
  LEFT JOIN events e ON e.branch_id = b.id AND e.org_id = p_org_id
    AND (p_start IS NULL OR e.starts_at::date >= p_start)
    AND (p_end IS NULL OR e.starts_at::date <= p_end)
  LEFT JOIN attendance a ON a.event_id = e.id AND a.org_id = p_org_id
  WHERE b.org_id = p_org_id
  GROUP BY b.id, b.name ORDER BY COUNT(DISTINCT m.id) DESC;
$$;

-- ─── get_members_at_risk ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_members_at_risk(
  p_org_id uuid, p_branch_id uuid DEFAULT NULL, p_days int DEFAULT 30, p_limit int DEFAULT 50
)
RETURNS TABLE(id uuid, first_name text, last_name text, member_number text,
              branch_name text, group_name text, last_seen date, days_since int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.first_name, m.last_name, m.member_number,
    br.name, g.name,
    MAX(e.starts_at::date),
    CASE WHEN MAX(e.starts_at::date) IS NULL THEN 9999
         ELSE (CURRENT_DATE - MAX(e.starts_at::date)) END
  FROM members m
  LEFT JOIN branches br ON br.id = m.branch_id
  LEFT JOIN group_memberships gm ON gm.member_id = m.id AND gm.is_active = true
  LEFT JOIN groups g ON g.id = gm.group_id
  LEFT JOIN attendance a ON a.member_id = m.id AND a.org_id = p_org_id
  LEFT JOIN events e ON e.id = a.event_id
  WHERE m.org_id = p_org_id AND m.membership_status = 'active'
    AND (p_branch_id IS NULL OR m.branch_id = p_branch_id)
  GROUP BY m.id, m.first_name, m.last_name, m.member_number, br.name, g.name
  HAVING CASE WHEN MAX(e.starts_at::date) IS NULL THEN 9999
              ELSE (CURRENT_DATE - MAX(e.starts_at::date)) END >= p_days
  ORDER BY CASE WHEN MAX(e.starts_at::date) IS NULL THEN 9999
                ELSE (CURRENT_DATE - MAX(e.starts_at::date)) END DESC
  LIMIT p_limit;
$$;

-- ─── get_top_givers ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_top_givers(
  p_org_id uuid, p_branch_id uuid DEFAULT NULL,
  p_start date DEFAULT NULL, p_end date DEFAULT NULL, p_limit int DEFAULT 25
)
RETURNS TABLE(member_id uuid, first_name text, last_name text, member_number text,
              branch_name text, total_given numeric, gift_count bigint, last_gift_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.first_name, m.last_name, m.member_number,
    br.name, SUM(t.amount), COUNT(t.id), MAX(t.transaction_date)
  FROM transactions t
  JOIN members m ON m.id = t.member_id
  LEFT JOIN branches br ON br.id = m.branch_id
  WHERE t.org_id = p_org_id AND t.member_id IS NOT NULL AND t.is_collective IS NOT TRUE
    AND (p_branch_id IS NULL OR t.branch_id = p_branch_id)
    AND (p_start IS NULL OR t.transaction_date >= p_start)
    AND (p_end IS NULL OR t.transaction_date <= p_end)
  GROUP BY m.id, m.first_name, m.last_name, m.member_number, br.name
  ORDER BY SUM(t.amount) DESC LIMIT p_limit;
$$;

-- ─── get_monthly_giving_by_category ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_monthly_giving_by_category(
  p_org_id uuid, p_branch_id uuid DEFAULT NULL, p_months int DEFAULT 12
)
RETURNS TABLE(month text, tithe numeric, offering numeric, building numeric, other_amount numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT TO_CHAR(DATE_TRUNC('month', t.transaction_date), 'YYYY-MM'),
    COALESCE(SUM(t.amount) FILTER (WHERE LOWER(tc.name) LIKE '%tithe%'), 0),
    COALESCE(SUM(t.amount) FILTER (WHERE LOWER(tc.name) LIKE '%offering%' AND LOWER(tc.name) NOT LIKE '%building%'), 0),
    COALESCE(SUM(t.amount) FILTER (WHERE LOWER(tc.name) LIKE '%building%'), 0),
    COALESCE(SUM(t.amount) FILTER (WHERE tc.name IS NULL OR (
      LOWER(tc.name) NOT LIKE '%tithe%' AND LOWER(tc.name) NOT LIKE '%offering%' AND LOWER(tc.name) NOT LIKE '%building%'
    )), 0)
  FROM transactions t
  LEFT JOIN transaction_categories tc ON tc.id = t.category_id
  WHERE t.org_id = p_org_id AND (p_branch_id IS NULL OR t.branch_id = p_branch_id)
    AND t.transaction_date >= (CURRENT_DATE - make_interval(months => p_months))
  GROUP BY DATE_TRUNC('month', t.transaction_date)
  ORDER BY DATE_TRUNC('month', t.transaction_date);
$$;

-- ─── get_age_breakdown ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_age_breakdown(
  p_org_id uuid, p_branch_id uuid DEFAULT NULL
)
RETURNS TABLE(age_group text, cnt bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    CASE WHEN DATE_PART('year', AGE(date_of_birth)) < 18 THEN 'Under 18'
         WHEN DATE_PART('year', AGE(date_of_birth)) BETWEEN 18 AND 25 THEN '18-25'
         WHEN DATE_PART('year', AGE(date_of_birth)) BETWEEN 26 AND 35 THEN '26-35'
         WHEN DATE_PART('year', AGE(date_of_birth)) BETWEEN 36 AND 50 THEN '36-50'
         ELSE '51+' END,
    COUNT(*)
  FROM members
  WHERE org_id = p_org_id AND (p_branch_id IS NULL OR branch_id = p_branch_id)
    AND membership_status = 'active' AND date_of_birth IS NOT NULL
  GROUP BY 1 ORDER BY MIN(date_of_birth) DESC;
$$;

-- ─── get_gender_breakdown ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_gender_breakdown(
  p_org_id uuid, p_branch_id uuid DEFAULT NULL
)
RETURNS TABLE(gender text, cnt bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(gender, 'not_specified'), COUNT(*)
  FROM members
  WHERE org_id = p_org_id AND (p_branch_id IS NULL OR branch_id = p_branch_id)
    AND membership_status = 'active'
  GROUP BY 1;
$$;

-- ─── get_giving_by_branch ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_giving_by_branch(
  p_org_id uuid, p_start date DEFAULT NULL, p_end date DEFAULT NULL
)
RETURNS TABLE(branch_id uuid, branch_name text, total numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id, b.name, COALESCE(SUM(t.amount), 0)
  FROM branches b
  LEFT JOIN transactions t ON t.branch_id = b.id AND t.org_id = p_org_id
    AND (p_start IS NULL OR t.transaction_date >= p_start)
    AND (p_end IS NULL OR t.transaction_date <= p_end)
  WHERE b.org_id = p_org_id
  GROUP BY b.id, b.name ORDER BY SUM(t.amount) DESC;
$$;

-- ─── get_attendance_by_event_type ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_attendance_by_event_type(
  p_org_id uuid, p_branch_id uuid DEFAULT NULL,
  p_start date DEFAULT NULL, p_end date DEFAULT NULL
)
RETURNS TABLE(event_type text, avg_rate numeric, event_count bigint, total_present bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(e.event_type, 'other'),
    CASE WHEN COALESCE(SUM(e.expected_attendance), 0) > 0
      THEN ROUND(COUNT(a.id)::numeric / SUM(e.expected_attendance) * 100, 1) ELSE 0 END,
    COUNT(DISTINCT e.id), COUNT(a.id)
  FROM events e
  LEFT JOIN attendance a ON a.event_id = e.id AND a.org_id = p_org_id
  WHERE e.org_id = p_org_id AND (p_branch_id IS NULL OR e.branch_id = p_branch_id)
    AND (p_start IS NULL OR e.starts_at::date >= p_start)
    AND (p_end IS NULL OR e.starts_at::date <= p_end)
  GROUP BY 1 ORDER BY COUNT(a.id) DESC;
$$;
;