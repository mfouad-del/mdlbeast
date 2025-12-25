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
  if (file.mimetype !== 'application/pdf') return cb(new Error('Only PDF allowed'))
  cb(null, true)
}})

router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const f: any = (req as any).file
    if (!f) return res.status(400).json({ error: 'No file' })

    // Use Supabase Storage exclusively (preferred). In production fail fast if misconfigured.
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKeyRaw = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const supabaseKey = String(supabaseKeyRaw).trim()
    const supabaseBucket = process.env.SUPABASE_BUCKET || ''

    // If in production, require Supabase configuration to be present
    const inProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production'

    console.log('DEBUG: /api/uploads supabase key rawLen=', supabaseKeyRaw.length, 'trimmedLen=', supabaseKey.length, 'startsWith=', supabaseKey.slice(0,8))

    // If STORAGE_PROVIDER=r2 (or CF_R2_* env present) use R2
    const useR2 = String(process.env.STORAGE_PROVIDER || '').toLowerCase() === 'r2' || Boolean(process.env.CF_R2_ENDPOINT)
    if (useR2) {
      try {
        const { uploadBuffer, getPublicUrl } = await import('../lib/r2-storage')
        const body = fs.readFileSync(f.path)
        const ext = path.extname(f.originalname || f.filename || '') || ''
        const safeBase = `${Date.now()}-${Math.random().toString(36).slice(2,9)}`
        const key = `uploads/${safeBase}${ext}`
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

    if (!supabaseUrl || !supabaseKey || !supabaseBucket) {
      const msg = 'Supabase storage not configured. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_BUCKET.'
      console.error(msg, { supabaseUrl: !!supabaseUrl, supabaseKey: !!supabaseKey, supabaseBucket: !!supabaseBucket })
      if (inProd) return res.status(500).json({ error: msg })
      // in non-prod, fall back to local (useful for CI/dev)
      const url = `/uploads/${f.filename}`
      return res.json({ url, name: f.originalname, size: f.size, storage: 'local' })
    }

    // Validate service role key format quickly (trimmed). Accept jwt-like or sb_secret_ prefix.
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

    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
      const body = fs.readFileSync(f.path)
      // Generate an ASCII-safe storage key: keep original name in response but avoid non-ASCII in object key
      const ext = path.extname(f.originalname || f.filename || '') || ''
      const safeBase = `${Date.now()}-${Math.random().toString(36).slice(2,9)}`
      const key = `uploads/${safeBase}${ext}`
      console.log('Uploading to supabase with key=', key, 'originalName=', f.originalname)
      // use upsert=true so re-runs are idempotent
      const uploadOptions: any = { contentType: f.mimetype, upsert: true, cacheControl: '0' }
      const uploadRes = await supabase.storage.from(supabaseBucket).upload(key, body, uploadOptions)
      console.debug('Uploads: supabase.upload response', uploadRes)
      const uploadError = uploadRes?.error
      if (uploadError) throw uploadError

      // Prefer public URL if available, otherwise use signed URL
      const publicRes = supabase.storage.from(supabaseBucket).getPublicUrl(key) as any
      let url = publicRes?.data?.publicUrl
      if (!url) {
        const { data: signedData, error: signedErr } = await supabase.storage.from(supabaseBucket).createSignedUrl(key, 60 * 60)
        if (signedErr) throw signedErr
        url = (signedData as any)?.signedUrl || ''
      }

      // Clean up local temporary file
      try { fs.unlinkSync(f.path) } catch (e) {}
      return res.json({ url, name: f.originalname, size: f.size, storage: 'supabase', key })
    } catch (e: any) {
      console.error('Supabase upload failed:', e)
      // If the storage API flagged an invalid key (filename), return a clear 400 for client to retry with sanitized name
      const msg = String(e?.message || e)
      if (msg.includes('Invalid key')) {
        // Provide a helpful but non-sensitive message
        return res.status(400).json({ error: 'Invalid file name for storage. Try renaming file to use basic Latin characters (a-z, 0-9, - and _). The server will attempt to sanitize next upload.' })
      }

      // In production return a generic message unless DEBUG=true (safe for staging)
      if (inProd) {
        if (process.env.DEBUG === 'true') {
          return res.status(500).json({ error: 'Supabase upload failed; check SUPABASE_SERVICE_ROLE_KEY and SUPABASE_BUCKET settings.', details: String(e?.message || e) })
        }
        return res.status(500).json({ error: 'Supabase upload failed; check SUPABASE_SERVICE_ROLE_KEY and SUPABASE_BUCKET settings.' })
      }

      const url = `/uploads/${f.filename}`
      return res.json({ url, name: f.originalname, size: f.size, storage: 'local' })
    }


    // default local behavior
    const url = `/uploads/${f.filename}`
    res.json({ url, name: f.originalname, size: f.size, storage: 'local' })
  } catch (err: any) {
    console.error('Upload error:', err)
    res.status(500).json({ error: err.message || 'Upload failed' })
  }
})

export default router
