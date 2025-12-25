import request from 'supertest'
import express from 'express'

jest.mock('../lib/r2-storage', () => ({
  getSignedDownloadUrl: jest.fn(async (key: string, ttl: number) => `https://r2.example.com/${key}?sig=abc`),
  getPublicUrl: jest.fn((k: string) => `https://r2.example.com/${k}`),
}))

jest.mock('../config/database', () => ({
  query: jest.fn(async (q: string, params?: any[]) => ({ rows: [{ attachments: JSON.stringify([{ key: 'uploads/test.pdf' }]) }] }))
}))

import documentsRouter from './documents'

describe('documents preview (R2-only)', () => {
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

  it('returns signed R2 preview-url when in R2-only mode', async () => {
    const app = express()
    app.use('/', documentsRouter)

    const res = await request(app).get('/somebarcode/preview-url')
      .expect(200)

    expect(res.body.previewUrl).toMatch(/https?:\/\/r2.example.com\/.+\?sig=/)
  })
})
