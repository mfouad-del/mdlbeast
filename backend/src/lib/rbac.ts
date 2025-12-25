import type { User } from "../types"

export function isManager(user?: Partial<User>) {
  return !!user && (user.role === 'manager' || user.role === 'admin')
}

export function isSupervisor(user?: Partial<User>) {
  return !!user && (user.role === 'supervisor' || isManager(user))
}

export function isMember(user?: Partial<User>) {
  return !!user && user.role === 'member'
}

export function canAccessDocument(user: Partial<User> | undefined, doc: any) {
  if (!user) return false
  // admin bypass
  if (user.role === 'admin') return true
  // manager & supervisor: same tenant
  if ((user.role === 'manager' || user.role === 'supervisor') && user.tenant_id && doc.tenant_id && user.tenant_id === doc.tenant_id) return true
  // member: only owner
  if (user.role === 'member' && doc.user_id && user.id && doc.user_id === user.id) return true
  return false
}
