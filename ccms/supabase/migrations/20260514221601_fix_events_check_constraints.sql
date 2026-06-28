
ALTER TABLE public.events DROP CONSTRAINT events_event_type_check;
ALTER TABLE public.events DROP CONSTRAINT events_status_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_event_type_check CHECK (
    event_type = ANY (ARRAY[
      'sunday_service',
      'midweek_service',
      'prayer_meeting',
      'youth_service',
      'special_programme',
      'outreach',
      'conference',
      'funeral_burial_service',
      'custom'
    ])
  );

ALTER TABLE public.events
  ADD CONSTRAINT events_status_check CHECK (
    status = ANY (ARRAY['scheduled', 'completed', 'cancelled', 'draft'])
  );
;