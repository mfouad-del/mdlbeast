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
  // Admin/manager/supervisor can access everything (no tenant scoping exists in DB)
  if (user.role === 'admin' || user.role === 'manager' || user.role === 'supervisor') return true
  // member/regular user: only own documents
  if (doc.user_id && user.id && Number(doc.user_id) === Number(user.id)) return true
  return false
}
