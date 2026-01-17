/**
 * ============================================================================
 * Session Configuration - إعدادات الجلسات
 * ============================================================================
 */

// Session timeout in milliseconds (default: 12 hours)
export const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT_MS || '43200000', 10)

// Refresh token expiry (default: 7 days)
export const REFRESH_TOKEN_EXPIRY = parseInt(process.env.REFRESH_TOKEN_EXPIRY_MS || '604800000', 10)

// Access token expiry (default: 1 hour)
export const ACCESS_TOKEN_EXPIRY = parseInt(process.env.ACCESS_TOKEN_EXPIRY_MS || '3600000', 10)

// Auto-logout on inactivity (default: true)
export const AUTO_LOGOUT_ENABLED = process.env.AUTO_LOGOUT_ENABLED !== 'false'

// Session config for Express
export const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'mdlbeast-session-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: SESSION_TIMEOUT,
    sameSite: 'lax' as const
  }
}

// Log configuration on startup
console.log('📋 Session Configuration:')
console.log(`  - Session Timeout: ${SESSION_TIMEOUT / 1000 / 60} minutes`)
console.log(`  - Access Token Expiry: ${ACCESS_TOKEN_EXPIRY / 1000 / 60} minutes`)
console.log(`  - Refresh Token Expiry: ${REFRESH_TOKEN_EXPIRY / 1000 / 60 / 60 / 24} days`)
console.log(`  - Auto Logout: ${AUTO_LOGOUT_ENABLED ? 'Enabled' : 'Disabled'}`)
