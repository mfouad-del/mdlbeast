import express from 'express'
import type { Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

const router = express.Router()

const uploadsDir = path.resolve(process.cwd(), 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req: any, file: any, cb: (err: any, dest: string) => void) => cb(null, uploadsDir),
  filename: (req: any, file: any, cb: (err: any, filename: string) => void) => {
    const safe = String(file.originalname || '').replace(/[^a-z0-9.\-\_\u0600-\u06FF]/gi, '-')
    cb(null, `${Date.now()}-${safe}`)
  }
})

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 }, fileFilter: (req: any, file: any, cb: (err: Error | null, accept?: boolean) => void) => {
  const ok = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
  ].includes(String(file.mimetype || '').toLowerCase())
  if (!ok) return cb(new Error('Only PDF or image files are allowed'))
  cb(null, true)
}})

router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const f: any = (req as any).file
    if (!f) return res.status(400).json({ error: 'No file' })

    // Optional folder selection: documents | approvals | signatures | ...
    // Keep it safe: only allow a-z 0-9 _ - /
    const rawFolder = String((req as any).query?.folder || '').trim()
    const safeFolder = rawFolder && /^[a-z0-9\/_-]+$/i.test(rawFolder) ? rawFolder.replace(/^\/+|\/+$/g, '') : ''

    const mt = String(f.mimetype || '').toLowerCase()
    const isPdf = mt === 'application/pdf'

    // Defaults:
    // - PDFs default to "documents" unless folder specified
    // - Images default to "signatures" unless folder specified
    const defaultFolder = isPdf ? 'documents' : 'signatures'
    const folder = safeFolder || defaultFolder

    // Storage decision: prefer R2 when configured OR when USE_R2_ONLY is enabled
    const { USE_R2_ONLY, R2_CONFIGURED, preferR2 } = await import('../config/storage')
    const inProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production'

    const useR2 = preferR2()

    // R2 path (preferred and enforced when USE_R2_ONLY is true)
    if (useR2) {
      try {
        const { uploadBuffer, getPublicUrl } = await import('../lib/r2-storage')
        const body = fs.readFileSync(f.path)
        const ext = path.extname(f.originalname || f.filename || '') || ''
        const safeBase = `${Date.now()}-${Math.random().toString(36).slice(2,9)}`
        const key = `uploads/${folder}/${safeBase}${ext}`
        console.log('Uploading to R2 with key=', key, 'originalName=', f.originalname)
        const url = await uploadBuffer(key, body, f.mimetype, 'public, max-age=0')
        try { fs.unlinkSync(f.path) } catch (e) {}
        return res.json({ url, name: f.originalname, size: f.size, storage: 'r2', key, bucket: process.env.CF_R2_BUCKET || null })
      } catch (e: any) {
        console.error('R2 upload failed:', e)
        if (inProd) return res.status(500).json({ error: 'R2 upload failed; check CF_R2_* settings' })
        const url = `/uploads/${f.filename}`
        return res.json({ url, name: f.originalname, size: f.size, storage: 'local' })
      }
    }

    // If we reach here, R2 is not preferred/available and we're allowed to use Supabase (legacy path).
    // NOTE: This legacy Supabase block is intentionally guarded so the default migration to R2 can be reverted by setting USE_R2_ONLY=false.
    // Supabase usage remains behind a guard for rollback safety.
    const supabaseUrl = USE_R2_ONLY ? '' : process.env.SUPABASE_URL
    const supabaseKeyRaw = USE_R2_ONLY ? '' : (process.env.SUPABASE_SERVICE_ROLE_KEY || '')
    const supabaseKey = String(supabaseKeyRaw).trim()
    const supabaseBucket = USE_R2_ONLY ? '' : (process.env.SUPABASE_BUCKET || '')

    console.debug('UPLOADS: supabase configured=', !!supabaseUrl && !!supabaseKey && !!supabaseBucket)

    if (!supabaseUrl || !supabaseKey || !supabaseBucket) {
      const msg = 'Supabase storage not configured. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_BUCKET.'
      console.error(msg, { supabaseUrl: !!supabaseUrl, supabaseKey: !!supabaseKey, supabaseBucket: !!supabaseBucket })
      if (inProd) return res.status(500).json({ error: msg })
      // in non-prod, fall back to local (useful for CI/dev)
      const url = `/uploads/${f.filename}`
      return res.json({ url, name: f.originalname, size: f.size, storage: 'local' })
    }

    // Validate service role key quickly (trimmed). Accept jwt-like or sb_secret_ prefix.
    const jwtLike = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(supabaseKey)
    const sbPrefixed = supabaseKey.startsWith('sb_secret_')
    if (!jwtLike && !sbPrefixed) {
      const snippet = String(supabaseKey).slice(0, 6) + '…' + String(supabaseKey).slice(-6)
      console.error('Supabase service key invalid format; aborting upload. keySnippet=', snippet, 'rawLen=', supabaseKeyRaw.length)
      if (inProd) return res.status(400).json({ error: 'SUPABASE_SERVICE_ROLE_KEY does not look like a Service Role JWT or sb_secret_ key. Replace with the Service Role Key from Supabase settings.', keySnippet: snippet })
      const url = `/uploads/${f.filename}`
      return res.json({ url, name: f.originalname, size: f.size, storage: 'local' })
    }

    if (sbPrefixed && !jwtLike) {
      console.warn('Warning: SUPABASE_SERVICE_ROLE_KEY starts with sb_secret_. Proceeding to attempt Supabase upload to verify acceptance at runtime.')
    }

    // Supabase upload path disabled — project migrated to R2. If you need to re-enable Supabase for rollback, set USE_R2_ONLY=false and restore the original code.
    return res.status(500).json({ error: 'Supabase uploads are disabled: server is R2-only. Set USE_R2_ONLY=false to re-enable legacy path.' })

    // default local behavior
    const url = `/uploads/${f.filename}`
    res.json({ url, name: f.originalname, size: f.size, storage: 'local' })
  } catch (err: any) {
    console.error('Upload error:', err)
    res.status(500).json({ error: err.message || 'Upload failed' })
  }
})

export default router
