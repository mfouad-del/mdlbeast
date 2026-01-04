import request from 'supertest'
import express from 'express'
import fs from 'fs'
import path from 'path'

jest.mock('../lib/r2-storage', () => ({
  uploadBuffer: jest.fn(async (key: string, buf: Buffer, contentType: string, cacheControl?: string) => {
    return `https://r2.example.com/${key}`
  }),
  getPublicUrl: jest.fn((k: string) => `https://r2.example.com/${k}`),
}))

jest.mock('../middleware/auth', () => ({ 
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { id: 1, role: 'admin' }
    next()
  } 
}))

import uploadsRouter from './uploads'

describe('uploads (R2-only)', () => {
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

  it('uploads file to R2 when USE_R2_ONLY=true', async () => {
    const app = express()
    app.use('/uploads', uploadsRouter)

    const filePath = path.resolve(__dirname, '..', 'test-fixtures', 'dummy.pdf')
    // ensure test fixture exists
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, 'PDF-DUMMY')
    }

    const res = await request(app)
      .post('/uploads')
      .attach('file', filePath)
      .expect(200)

    expect(res.body.storage).toBe('r2')
    expect(res.body.url).toMatch(/https?:\/\/r2.example.com\//)
  })
})
