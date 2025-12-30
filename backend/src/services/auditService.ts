import { query } from "../config/database"

export interface AuditLogEntry {
  userId?: number | null
  action: string
  entityType?: string
  entityId?: string
  details?: string
  ipAddress?: string
  userAgent?: string
}

export const logAudit = async (entry: AuditLogEntry) => {
  try {
    const sql = `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `
    const values = [
      entry.userId || null,
      entry.action,
      entry.entityType || null,
      entry.entityId || null,
      entry.details || null,
      entry.ipAddress || null,
      entry.userAgent || null
    ]
    
    await query(sql, values)
  } catch (error) {
    console.error('Failed to write audit log:', error)
    // We don't throw here to avoid breaking the main flow if logging fails
  }
}
