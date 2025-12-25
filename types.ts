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
  id: string;
  username: string;
  full_name: string;
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'manager' | 'supervisor' | 'member' | 'admin';
  created_at: Date;
  companyId?: string;
}

export interface Attachment {
  name: string;
  size: number;
  type: string;
  url: string;
}

export interface Correspondence {
  id: number;
  barcode: string;
  barcodeId: string;
  companyId: string;
  type: DocType;
  title: string;
  sender: string;
  /** fallback variant for some data sources */
  from?: string;
  receiver: string;
  /** fallback variant for some data sources */
  to?: string;
  recipient: string;
  referenceNumber: string;
  internalRef: string;
  documentDate: string;
  archiveDate: string;
  date: string;
  dateHijri?: string;
  dateGregorian?: string;
  subject: string;
  description: string;
  status: string;
  security: string;
  priority: string;
  category: string;
  physicalLocation: string;
  attachmentCount: number;
  attachments: Attachment[];
  signatory: string;
  tags: string[];
  created_at: Date;
  createdBy?: string;
  pdfFile?: {
    name: string;
    size: string;
    url: string;
  };
  user_id?: number;
  updated_at: Date;
  notes: string;
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
