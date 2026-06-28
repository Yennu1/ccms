CREATE OR REPLACE FUNCTION public.get_members_at_risk(p_org_id uuid, p_branch_id uuid DEFAULT NULL::uuid, p_days integer DEFAULT 30, p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, first_name text, last_name text, member_number text, branch_name text, group_name text, last_seen date, days_since integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT m.id, m.first_name, m.last_name, m.member_number,
    br.name,
    STRING_AGG(DISTINCT g.name, ', ' ORDER BY g.name),
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
  GROUP BY m.id, m.first_name, m.last_name, m.member_number, br.name
  HAVING CASE WHEN MAX(e.starts_at::date) IS NULL THEN 9999
              ELSE (CURRENT_DATE - MAX(e.starts_at::date)) END >= p_days
  ORDER BY CASE WHEN MAX(e.starts_at::date) IS NULL THEN 9999
                ELSE (CURRENT_DATE - MAX(e.starts_at::date)) END DESC
  LIMIT p_limit;
$function$;