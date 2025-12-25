import { validateEnv, redactedEnvPresent } from './validateEnv'

describe('validateEnv', () => {
  const OLD = process.env.JWT_SECRET
  afterEach(() => { process.env.JWT_SECRET = OLD })

  test('throws if JWT_SECRET missing', () => {
    process.env.JWT_SECRET = ''
    expect(() => validateEnv()).toThrow(/JWT_SECRET missing\/weak/)
  })

  test('throws if JWT_SECRET is weak default', () => {
    process.env.JWT_SECRET = 'your-secret-key-change-this'
    expect(() => validateEnv()).toThrow(/JWT_SECRET missing\/weak/)
  })

  test('does not throw if JWT_SECRET is present and strong', () => {
    process.env.JWT_SECRET = 'super-strong-secret-please-rotate'
    expect(() => validateEnv()).not.toThrow()
  })
})
