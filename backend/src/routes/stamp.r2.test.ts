import request from 'supertest'
import express from 'express'

jest.mock('../lib/r2-storage', () => ({
  downloadToBuffer: jest.fn(async (key: string) => {
    // minimal valid PDF (1 page) to be loadable by pdf-lib
    const pdf = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n5 0 obj\n<< /Length 44 >>\nstream\nBT /F1 24 Tf 72 720 Td (Hello) Tj ET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \n0000000220 00000 n \n0000000300 00000 n \ntrailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n350\n%%EOF`;
    return Buffer.from(pdf)
  }),
  uploadBuffer: jest.fn(async (key: string, buf: Buffer, contentType: string) => {
    return `https://r2.example.com/${key}`
  }),
  getSignedDownloadUrl: jest.fn(async (key: string, ttl: number) => `https://r2.example.com/${key}?sig=abc`),
  getPublicUrl: jest.fn((k: string) => `https://r2.example.com/${k}`),
}))

const mockQuery = jest.fn(async (q: string, params?: any[]) => {
  // initial documents SELECT
  if (/SELECT \* FROM documents/i.test(q)) {
    return { rows: [{ id: 1, barcode: 'TEST123', attachments: [{ key: 'uploads/test.pdf', url: 'https://r2.example.com/uploads/test.pdf' }], tenant_id: null, company: 'شركة الاختبار', company_en: 'Test Co', type: 'outgoing' }] }
  }
  // UPDATE documents
  if (/UPDATE documents SET attachments/i.test(q)) {
    return { rows: [{ id: 1, attachments: JSON.stringify([{ key: 'uploads/test.pdf', url: 'https://r2.example.com/uploads/test.pdf', size: 1234 }]) }] }
  }
  // tenant name lookup fallback
  if (/SELECT name FROM tenants/i.test(q)) {
    return { rows: [{ name: 'Test Tenant' }] }
  }
  return { rows: [] }
})

jest.mock('../config/database', () => ({ query: (q: string, p?: any[]) => mockQuery(q, p) }))

jest.mock('../middleware/auth', () => ({ 
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { id: 1, role: 'admin' }
    next()
  } 
}))

jest.mock('../lib/rbac', () => ({ canAccessDocument: jest.fn(() => true) }))

import stampRouter from './stamp'

describe('stamp (R2-only)', () => {
  beforeAll(() => {
    process.env.USE_R2_ONLY = 'true'
    process.env.CF_R2_BUCKET = 'test-bucket'
    process.env.CF_R2_ENDPOINT = 'https://r2.example.com'
  })

  afterAll(() => {
    delete process.env.USE_R2_ONLY
    delete process.env.CF_R2_BUCKET
    delete process.env.CF_R2_ENDPOINT
  })

  it('stamps a PDF in R2 and returns previewUrl', async () => {
    const app = express()
    app.use('/api/documents', stampRouter)

    const res = await request(app)
      .post('/api/documents/TEST123/stamp')
      .send({ x: 20, y: 20, stampWidth: 140 })
      .expect(200)

    expect(res.body.previewUrl).toMatch(/https?:\/\/r2.example.com\//)
    expect(res.body.attachments).toBeDefined()
    expect(mockQuery).toHaveBeenCalled()
  })
})
