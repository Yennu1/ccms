export type UserRole = 
  | 'super_admin' 
  | 'admin' 
  | 'finance_officer' 
  | 'group_leader'

  
export interface AuthUser {
  id: string
  email: string
  role: UserRole
  full_name: string
  branch_id: string | null
  org_id: string
}