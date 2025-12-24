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

    // Prefer Supabase Storage when SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY are present
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseBucket = process.env.SUPABASE_BUCKET || process.env.S3_BUCKET || ''

    if (supabaseUrl && supabaseKey && supabaseBucket) {
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
        const body = fs.readFileSync(f.path)
        const key = `uploads/${Date.now()}-${f.filename}`
        const { error: uploadError } = await supabase.storage.from(supabaseBucket).upload(key, body, { contentType: f.mimetype })
        if (uploadError) throw uploadError

        // Try public URL first, otherwise create a signed URL
        const { data: publicUrlData } = supabase.storage.from(supabaseBucket).getPublicUrl(key)
        let url = (publicUrlData as any)?.publicUrl
        if (!url) {
          const { data: signedData, error: signedErr } = await supabase.storage.from(supabaseBucket).createSignedUrl(key, 60 * 60)
          if (signedErr) throw signedErr
          url = (signedData as any)?.signedUrl || (signedData as any)?.signedURL || ''
        }

        try { fs.unlinkSync(f.path) } catch (e) {}
        return res.json({ url, name: f.originalname, size: f.size, storage: 'supabase' })
      } catch (e: any) {
        console.error('Supabase upload failed, falling back to S3/local', e)
      }
    }

    // If S3 env vars are present, upload to S3-compatible storage (legacy/compat fallback)
    const s3Key = process.env.S3_ACCESS_KEY
    const s3Secret = process.env.S3_SECRET_KEY
    const s3Endpoint = process.env.S3_ENDPOINT
    const s3Region = process.env.S3_REGION || 'ap-southeast-1'
    const s3Bucket = process.env.S3_BUCKET || ''

    if (s3Key && s3Secret && s3Endpoint && s3Bucket) {
      try {
        const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
        const client = new S3Client({ region: s3Region, endpoint: s3Endpoint, credentials: { accessKeyId: s3Key, secretAccessKey: s3Secret } })
        const body = fs.readFileSync(f.path)
        const key = `uploads/${Date.now()}-${f.filename}`
        await client.send(new PutObjectCommand({ Bucket: s3Bucket, Key: key, Body: body, ContentType: f.mimetype }))
        const url = `${s3Endpoint}/${s3Bucket}/${key}`
        // remove local file
        try { fs.unlinkSync(f.path) } catch (e) {}
        return res.json({ url, name: f.originalname, size: f.size, storage: 's3' })
      } catch (e: any) {
        console.error('S3 upload failed, falling back to local:', e?.message || e)
      }
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
