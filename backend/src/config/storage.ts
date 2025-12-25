// Centralized storage configuration helpers
// USE_R2_ONLY: when true, storage logic must use Cloudflare R2 only and avoid any Supabase client imports at runtime.
// Default: true (per the new single-step migration request). To disable, set USE_R2_ONLY=false in env.

export const USE_R2_ONLY = (() => {
  const raw = String(process.env.USE_R2_ONLY ?? '')
  if (raw === '') return true // default to true for one-step migration
  return raw.toLowerCase() === 'true'
})()

export const SUPABASE_CONFIGURED = USE_R2_ONLY ? false : (!!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.SUPABASE_URL && !!process.env.SUPABASE_BUCKET)

export const R2_CONFIGURED = !!process.env.CF_R2_ACCESS_KEY_ID && !!process.env.CF_R2_SECRET_ACCESS_KEY && !!process.env.CF_R2_ENDPOINT && !!process.env.CF_R2_BUCKET

// Helper: ensure we prefer R2 when USE_R2_ONLY true, otherwise prefer explicit STORAGE_PROVIDER or env presence
export function preferR2(): boolean {
  if (USE_R2_ONLY) return true
  return String(process.env.STORAGE_PROVIDER || '').toLowerCase() === 'r2' || Boolean(process.env.CF_R2_ENDPOINT)
}
