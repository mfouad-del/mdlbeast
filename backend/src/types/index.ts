import type { Request } from 'express'

export interface User {
  id: number
  username: string
  password?: string
  full_name?: string
  role: "admin" | "manager" | "supervisor" | "member" | "user"
  tenant_id?: number | null
  created_at: Date
  updated_at: Date
}

export interface Document {
  id: number
  barcode: string
  type: string
  sender: string
  receiver: string
  date: string
  subject: string
  priority: "عادي" | "عاجل" | "عاجل جداً"
  status: "وارد" | "صادر" | "محفوظ"
  classification?: string
  notes?: string
  attachments: Attachment[]
  user_id?: number
  created_at: Date
  updated_at: Date
}

export interface Attachment {
  name: string
  size: number
  type: string
  url: string
}

export interface AuthRequest extends Request {
  user?: {
    id: number
    username?: string
    role?: string
    tenant_id?: number | null
  }
}
