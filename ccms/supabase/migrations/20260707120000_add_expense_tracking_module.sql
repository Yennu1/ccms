-- Expense Tracking Module
-- Reuses transaction_categories (already supports type='expense')
-- New expenses table, separate from transactions (keeps all
-- existing income-side features untouched)

INSERT INTO public.transaction_categories (org_id, name, type, is_default)
SELECT o.id, c.name, 'expense', true
FROM public.organisations o
CROSS JOIN (VALUES
  ('Salaries'), ('Utilities'), ('Events'), ('Outreach'), ('Welfare'), ('Maintenance')
) AS c(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.transaction_categories tc
  WHERE tc.org_id = o.id AND tc.name = c.name AND tc.type = 'expense'
);

CREATE TABLE public.expenses (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  branch_id     uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  category_id   uuid REFERENCES public.transaction_categories(id) ON DELETE SET NULL,
  amount        numeric NOT NULL,
  payment_method text DEFAULT 'cash',
  expense_date  date DEFAULT CURRENT_DATE,
  notes         text,
  recorded_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_expenses_org_id ON public.expenses(org_id);
CREATE INDEX idx_expenses_branch_id ON public.expenses(branch_id);
CREATE INDEX idx_expenses_category_id ON public.expenses(category_id);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_select" ON public.expenses FOR SELECT
USING (get_my_role() = 'super_admin' OR (get_my_role() IN ('admin', 'finance_officer') AND org_id = get_my_org_id() AND branch_id = get_my_branch_id()));

CREATE POLICY "expenses_insert" ON public.expenses FOR INSERT
WITH CHECK (get_my_role() = 'super_admin' OR (get_my_role() IN ('admin', 'finance_officer') AND org_id = get_my_org_id() AND branch_id = get_my_branch_id()));

CREATE POLICY "expenses_update" ON public.expenses FOR UPDATE
USING (get_my_role() = 'super_admin' OR (get_my_role() IN ('admin', 'finance_officer') AND org_id = get_my_org_id() AND branch_id = get_my_branch_id()));

CREATE POLICY "expenses_delete" ON public.expenses FOR DELETE
USING (get_my_role() = 'super_admin' OR (get_my_role() IN ('admin', 'finance_officer') AND org_id = get_my_org_id() AND branch_id = get_my_branch_id()));