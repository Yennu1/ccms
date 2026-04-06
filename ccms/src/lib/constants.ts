export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  PASTOR: 'pastor',
  FINANCE_OFFICER: 'finance_officer',
  GROUP_LEADER: 'group_leader',
  MEMBER: 'member',
} as const

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  pastor: 'Pastor / Admin',
  finance_officer: 'Finance Officer',
  group_leader: 'Group Leader',
  member: 'Member',
}
