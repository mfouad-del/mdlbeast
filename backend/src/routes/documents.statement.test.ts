import request from 'supertest'
import express from 'express'

jest.mock('../lib/r2-storage', () => ({
  getSignedDownloadUrl: jest.fn(async (key: string, ttl: number) => `https://r2.example.com/${key}?sig=abc`),
  getPublicUrl: jest.fn((k: string) => `https://r2.example.com/${k}`),
}))

jest.mock('../config/database', () => ({
  query: jest.fn(async (q: string, params?: any[]) => ({ rows: [{ barcode: 'ABC123', sender: 'الجهة', receiver: 'المستلم', date: '2025-12-24T00:00:00Z', statement: null }] }))
}))

jest.mock('../lib/rbac', () => ({
  canAccessDocument: jest.fn(() => true)
}))

jest.mock('../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => { req.user = { role: 'admin', id: 1 }; return next() }
}))

import documentsRouter from './documents'

describe('statement PDF endpoint', () => {
  it('returns a PDF even when statement is missing', async () => {
    const app = express()
    app.use('/', documentsRouter)

    const res = await request(app).get('/ABC123/statement.pdf')
      .expect(200)

    expect(res.header['content-type']).toMatch(/application\/pdf/i)
    expect(res.header['content-disposition']).toMatch(/statement\.pdf/i)
    // Body should be non-empty PDF bytes
    expect(res.body && res.body.length).toBeGreaterThan(100)
  }, 10000)

  it('returns the statement text JSON (empty if none)', async () => {
    const app = express()
    app.use('/', documentsRouter)

    const res = await request(app).get('/ABC123/statement')
      .expect(200)

    expect(res.body).toHaveProperty('statement')
    expect(typeof res.body.statement).toBe('string')
  })
})