import { authenticateToken } from './auth'
import jwt from 'jsonwebtoken'

// Mock a minimal DB module
jest.mock('../config/database', () => ({
  query: jest.fn(async (q: string, params?: any[]) => {
    if (q.includes('SELECT * FROM users')) {
      return { rows: [{ id: 1, username: 'alice', role: 'admin' }] }
    }
    return { rows: [] }
  })
}))

const mockReq = (token: string) => ({ headers: { authorization: `Bearer ${token}` } } as any)
const mockRes = () => ({ status: jest.fn(() => ({ json: jest.fn(), send: jest.fn() })), json: jest.fn(), send: jest.fn() } as any)

describe('authenticateToken', () => {
  const OLD = process.env.JWT_SECRET
  beforeEach(() => { process.env.JWT_SECRET = 'test-secret-1' })
  afterAll(() => { process.env.JWT_SECRET = OLD })

  test('calls jwt.verify with HS256 algorithm', async () => {
    const spy = jest.spyOn(jwt, 'verify')
    const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET as string, { algorithm: 'HS256' })

    const req = mockReq(token)
    const res = mockRes()
    const next = jest.fn()

    await authenticateToken(req, res, next)

    expect(spy).toHaveBeenCalledWith(expect.any(String), expect.any(String), expect.objectContaining({ algorithms: ['HS256'] }))
    spy.mockRestore()
  })
})
