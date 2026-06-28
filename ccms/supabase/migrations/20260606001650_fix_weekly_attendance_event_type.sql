CREATE OR REPLACE FUNCTION public.get_weekly_attendance(p_org_id uuid, p_branch_id uuid DEFAULT NULL::uuid, p_weeks integer DEFAULT 12)
 RETURNS TABLE(week_start text, present_count bigint, expected_count bigint, rate numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    AND e.event_type = 'service'
  GROUP BY DATE_TRUNC('week', e.starts_at AT TIME ZONE 'UTC')
  ORDER BY DATE_TRUNC('week', e.starts_at AT TIME ZONE 'UTC');
$function$;;