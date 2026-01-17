import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'

jest.mock('../lib/r2-storage', () => ({
  getSignedDownloadUrl: jest.fn(async (key: string, ttl: number) => `https://r2.example.com/${key}?sig=abc`),
  getPublicUrl: jest.fn((k: string) => `https://r2.example.com/${k}`),
}))

jest.mock('../config/database', () => ({
  query: jest.fn(async (q: string, params?: any[]) => {
    if (q.includes('SELECT * FROM users')) {
      return { rows: [{ id: 1, username: 'test', role: 'admin' }] }
    }
    if (q.includes('FROM documents') && q.includes('attachments')) {
      return { rows: [{ user_id: 1, attachments: JSON.stringify([{ key: 'uploads/test.pdf' }]) }] }
    }
    return { rows: [] }
  })
}))

import documentsRouter from './documents'

describe('documents preview (R2-only)', () => {
  beforeAll(() => {
    process.env.USE_R2_ONLY = 'true'
    process.env.CF_R2_BUCKET = 'test-bucket'
    process.env.CF_R2_ENDPOINT = 'https://r2.example.com'
    process.env.JWT_SECRET = 'test-secret-1'
  })

  afterAll(() => {
    delete process.env.USE_R2_ONLY
    delete process.env.CF_R2_BUCKET
    delete process.env.CF_R2_ENDPOINT
    delete process.env.JWT_SECRET
  })

  it('returns signed R2 preview-url when in R2-only mode', async () => {
    const app = express()
    app.use('/', documentsRouter)

    const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET as string, { algorithm: 'HS256' })

    const res = await request(app).get('/somebarcode/preview-url')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(res.body.previewUrl).toMatch(/https?:\/\/r2.example.com\/.+\?sig=/)
  })
})
