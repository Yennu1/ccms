export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  FINANCE_OFFICER: 'finance_officer',
  GROUP_LEADER: 'group_leader',
} as const

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Branch Admin',
  finance_officer: 'Finance Officer',
  group_leader: 'Group Leader',
}