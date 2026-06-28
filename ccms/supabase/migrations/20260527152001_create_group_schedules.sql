
-- Create table
CREATE TABLE IF NOT EXISTS group_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  meeting_day TEXT NOT NULL,
  meeting_time TIME NOT NULL,
  meeting_venue TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE group_schedules ENABLE ROW LEVEL SECURITY;

-- All org members can read
CREATE POLICY "gs_select" ON group_schedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_schedules.group_id
        AND g.org_id = (SELECT org_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Admins / pastors / leaders can insert
CREATE POLICY "gs_insert" ON group_schedules
  FOR INSERT WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'pastor', 'group_leader')
  );

-- Admins / pastors / leaders can update
CREATE POLICY "gs_update" ON group_schedules
  FOR UPDATE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'pastor', 'group_leader')
  );

-- Admins / pastors / leaders can delete
CREATE POLICY "gs_delete" ON group_schedules
  FOR DELETE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('super_admin', 'pastor', 'group_leader')
  );

-- Migrate existing single-schedule data from groups.meeting_schedule
INSERT INTO group_schedules (group_id, meeting_day, meeting_time, meeting_venue)
SELECT
  id,
  trim(split_part(meeting_schedule, ' · ', 1)) AS meeting_day,
  trim(split_part(meeting_schedule, ' · ', 2))::TIME AS meeting_time,
  NULLIF(trim(split_part(meeting_schedule, ' · ', 3)), '') AS meeting_venue
FROM groups
WHERE meeting_schedule IS NOT NULL
  AND trim(split_part(meeting_schedule, ' · ', 1)) != ''
  AND trim(split_part(meeting_schedule, ' · ', 2)) ~ '^[0-9]{1,2}:[0-9]{2}'
ON CONFLICT DO NOTHING;
;