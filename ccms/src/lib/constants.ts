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

// Where each role lands after login / on the root path.
// finance_officer and group_leader cannot see Dashboard.
export const ROLE_HOME_ROUTE: Record<string, string> = {
  super_admin: '/dashboard',
  admin: '/dashboard',
  finance_officer: '/donations',
  group_leader: '/groups',
}