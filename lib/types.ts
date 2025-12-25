export enum DocType {
  INCOMING = "INCOMING",
  OUTGOING = "OUTGOING",
}

export enum Priority {
  NORMAL = "عادي",
  HIGH = "عاجل",
  IMMEDIATE = "عاجل جداً",
}

export enum SecurityLevel {
  PUBLIC = "عام",
  CONFIDENTIAL = "سري",
  TOP_SECRET = "سري للغاية",
}

export enum DocStatus {
  PENDING = "وارد",
  SENT = "صادر",
  ARCHIVED = "محفوظ",
}

export interface Correspondence {
  id: number
  barcode: string
  barcodeId: string
  type: string
  sender: string
  receiver: string
  recipient: string
  date: string
  dateHijri?: string
  dateGregorian?: string
  documentDate: string
  archiveDate?: string
  subject: string
  title: string
  priority: string
  status: string
  classification?: string
  security?: string
  notes?: string
  description?: string
  attachments: Attachment[]
  pdfFile?: {
    name: string
    size: string
    url: string
  }
  physicalLocation?: string
  signatory?: string
  internalRef?: string
  referenceNumber?: string
  attachmentCount?: number
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

export interface User {
  id: number
  username: string
  full_name: string
  name?: string
  role: string
  created_at: Date
}

export interface SystemSettings {
  primaryColor?: string
  footerText?: string
  showStamp?: boolean
  orgName?: string
  orgNameEn?: string
  logoUrl?: string
  companies?: any[]
}
