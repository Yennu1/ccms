
-- Create event_occurrences if it doesn't exist
CREATE TABLE IF NOT EXISTS event_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  occurrence_number INTEGER NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE event_occurrences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_occurrences_select" ON event_occurrences;
DROP POLICY IF EXISTS "event_occurrences_insert" ON event_occurrences;

CREATE POLICY "event_occurrences_select" ON event_occurrences
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE org_id = event_occurrences.org_id
    )
  );

CREATE POLICY "event_occurrences_insert" ON event_occurrences
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles WHERE org_id = event_occurrences.org_id AND role IN ('super_admin', 'pastor')
    )
  );

-- RLS for events table
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events_select" ON events;
DROP POLICY IF EXISTS "events_insert" ON events;
DROP POLICY IF EXISTS "events_update" ON events;
DROP POLICY IF EXISTS "events_delete" ON events;

CREATE POLICY "events_select" ON events
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM profiles WHERE org_id = events.org_id)
  );

CREATE POLICY "events_insert" ON events
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT id FROM profiles WHERE org_id = events.org_id AND role IN ('super_admin', 'pastor'))
  );

CREATE POLICY "events_update" ON events
  FOR UPDATE USING (
    auth.uid() IN (SELECT id FROM profiles WHERE org_id = events.org_id AND role IN ('super_admin', 'pastor'))
  );

CREATE POLICY "events_delete" ON events
  FOR DELETE USING (
    auth.uid() IN (SELECT id FROM profiles WHERE org_id = events.org_id AND role IN ('super_admin', 'pastor'))
  );

-- RLS for attendance table
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_select" ON attendance;
DROP POLICY IF EXISTS "attendance_all" ON attendance;

CREATE POLICY "attendance_select" ON attendance
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM profiles WHERE org_id = attendance.org_id)
  );

CREATE POLICY "attendance_all" ON attendance
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM profiles WHERE org_id = attendance.org_id AND role IN ('super_admin', 'pastor', 'group_leader'))
  );

-- Add missing columns to events if needed
ALTER TABLE events ADD COLUMN IF NOT EXISTS parent_event_id UUID REFERENCES events(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS occurrence_number INTEGER;
ALTER TABLE events ADD COLUMN IF NOT EXISTS speaker TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence_rule JSONB;
;