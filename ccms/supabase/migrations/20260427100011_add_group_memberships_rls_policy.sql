
create policy "Admins can view group memberships"
  on group_memberships for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.org_id = (
        select org_id from members m 
        where m.id = group_memberships.member_id
      )
    )
  );
;