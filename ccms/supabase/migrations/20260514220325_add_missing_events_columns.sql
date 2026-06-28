
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS expected_attendance integer,
  ADD COLUMN IF NOT EXISTS location text;

ALTER TABLE public.events
  ALTER COLUMN recurrence_rule TYPE jsonb USING
    CASE
      WHEN recurrence_rule IS NULL THEN NULL
      WHEN recurrence_rule ~ '^\{' THEN recurrence_rule::jsonb
      ELSE to_jsonb(recurrence_rule)
    END;
;