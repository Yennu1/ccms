export type UserRole = 
  | 'super_admin' 
  | 'pastor' 
  | 'finance_officer' 
  | 'group_leader' 
  | 'member'

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  full_name: string
  branch_id: string | null
  org_id: string
}