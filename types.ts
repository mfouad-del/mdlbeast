export enum DocType {
  INCOMING = 'INCOMING',
  OUTGOING = 'OUTGOING'
}

export enum DocStatus {
  PENDING = 'وارد',
  SENT = 'صادر',
  ARCHIVED = 'محفوظ',
  COMPLETED = 'COMPLETED',
  URGENT = 'URGENT'
}

export enum SecurityLevel {
  PUBLIC = 'عام',
  CONFIDENTIAL = 'سري',
  TOP_SECRET = 'سري للغاية'
}

export enum Priority {
  NORMAL = 'عادي',
  HIGH = 'عاجل',
  IMMEDIATE = 'عاجل جداً'
}

export interface Company {
  id: string;
  nameAr: string;
  nameEn: string;
  logoUrl: string;
  registrationNumber?: string;
}

export interface User {
  id: string | number
  username: string
  full_name: string
  email?: string
  role: 'admin' | 'manager' | 'supervisor' | 'member'
  created_at?: Date | string
  manager_id?: number | null
  signature_url?: string
  stamp_url?: string
}

export interface ApprovalRequest {
  id: number
  requester_id: number
  manager_id: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  title: string
  description?: string
  attachment_url: string
  signed_attachment_url?: string
  rejection_reason?: string
  created_at: string
  updated_at: string
  requester?: User
  manager?: User
}


export interface Attachment {
  name: string;
  size: number;
  type: string;
  url: string;
}

export interface Correspondence {
  id: number
  barcode: string // Primary ID for all operations
  companyId?: string
  tenant_id?: number
  type: DocType
  title: string
  subject: string
  sender: string
  receiver: string
  recipient?: string // Alias for receiver
  referenceNumber?: string
  internalRef?: string
  documentDate: string // ISO date string
  date?: string // Formatted display date (should match documentDate)
  dateHijri?: string
  dateGregorian?: string
  archiveDate?: string
  status: string // 'وارد' | 'صادر' | 'محفوظ'
  security: string
  priority: string
  category?: string
  physicalLocation?: string
  attachmentCount?: number
  attachments: Attachment[]
  signatory?: string
  tags?: string[]
  created_at?: Date | string
  updated_at?: Date | string
  createdBy?: string
  notes?: string
  description?: string
  statement?: string
  displayDate?: string // Server-provided formatted date
  pdfFile?: {
    name: string
    size: string | number
    url: string
    key?: string
    bucket?: string
    storage?: string
  }
  user_id?: number
}

export interface SystemSettings {
  primaryColor: string;
  footerText: string;
  showStamp: boolean;
  companies: Company[];
  orgName?: string;
  orgNameEn?: string;
  logoUrl?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  user: string;
  timestamp: string;
}
