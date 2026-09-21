-- Personal vs collective giving categories.
--
-- Adds a per-category flag deciding whether an income category appears on the
-- "Personal Offering" tab of Record Giving (a gift attributed to one member).
-- The Collective Offering tab always shows every income category regardless.
--
-- Default FALSE: a newly created income category is HIDDEN from the Personal
-- tab until an admin turns it on in Settings. This is deliberate — nothing
-- shows up as personally-giveable by accident.
--
-- Only income categories are affected. Expense categories never appear on
-- Record Giving at all (the page now filters to type = 'income'), so the flag
-- is irrelevant for them.

ALTER TABLE public.transaction_categories
  ADD COLUMN IF NOT EXISTS allow_individual boolean NOT NULL DEFAULT false;

-- Seed sensible defaults for the categories a member most obviously gives
-- personally, so existing orgs aren't left with an empty Personal tab on day
-- one. Admins can change any of these afterwards in Settings.
UPDATE public.transaction_categories
SET allow_individual = true
WHERE type = 'income'
  AND lower(name) IN (
    'tithe', 'welfare', 'building fund', 'thanksgiving', 'youth fund',
    'first fruit', 'firstfruit', 'seed', 'pledge'
  );
