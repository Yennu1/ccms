
create policy "Admins can update members"
  on members for update
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.org_id = members.org_id
      and p.role in ('super_admin', 'pastor', 'finance_officer')
    )
  );
;