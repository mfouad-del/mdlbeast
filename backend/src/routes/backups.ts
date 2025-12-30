import express from 'express'
import { allowDebugAccess } from '../config/validateEnv'
import { authenticateToken } from '../middleware/auth'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawn } from 'child_process'
import { uploadBuffer, getSignedDownloadUrl, downloadToBuffer, deleteObject } from '../lib/r2-storage'
import { query } from '../config/database'

const router = express.Router()

// Apply authentication middleware to all backup routes
router.use(authenticateToken)

// Require admin-level debug access for all backups endpoints
async function requireAdmin(req: any, res: any) {
  if (!allowDebugAccess(req, true)) {
    res.status(404).json({ error: 'Not found' })
    return false
  }
  return true
}

// Helper: create temporary folder
function mkTempDir(prefix = 'backup') {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`))
  return base
}

// Create a full project backup: DB dump + uploads + metadata JSON
router.post('/', async (req: any, res: any) => {
  if (!await requireAdmin(req, res)) return
  try {
    // Decide encryption options safely: if AES requested but key missing/invalid, skip AES and warn
    const wantAES = String(process.env.BACKUP_ENCRYPTION || '').toLowerCase() === 'true'
    let encryptAES = wantAES
    if (wantAES) {
      const encKey = String(process.env.BACKUP_ENC_KEY || '')
      try {
        const k = Buffer.from(encKey, 'base64')
        if (k.length !== 32) {
          console.warn('BACKUP_ENC_KEY is not valid base64 32 bytes; proceeding without AES encryption')
          encryptAES = false
        }
      } catch (e) {
        console.warn('Failed to parse BACKUP_ENC_KEY; proceeding without AES encryption')
        encryptAES = false
      }
    }

    const encGpg = String(process.env.BACKUP_ENCRYPTION_GPG || '').toLowerCase() === 'true'
    const retention = Number(process.env.BACKUP_RETENTION_COUNT || 6)

    const service = await import('../lib/backup-service')
    const result = await service.createAndUploadBackup({ encryptAES, encryptGpg: encGpg, gpgRecipient: process.env.BACKUP_GPG_RECIPIENT, retentionCount: retention })

    res.json({ ok: true, key: result.key })
  } catch (err: any) {
    console.error('Full backup failed:', err)
    res.status(500).json({ error: 'Failed to create full backup: ' + String(err?.message || err) })
  }
})

// List backups
router.get('/', async (req: any, res: any) => {
  if (!await requireAdmin(req, res)) return
  try {
    // List objects under backups/ using S3 ListObjectsV2
    const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3')
    const BUCKET = process.env.CF_R2_BUCKET || ''
    const ENDPOINT = (process.env.CF_R2_ENDPOINT || '').replace(/\/$/, '')
    if (!BUCKET || !ENDPOINT) return res.status(500).json({ error: 'R2 not configured' })
    const client = new S3Client({ region: process.env.CF_R2_REGION || 'auto', endpoint: ENDPOINT, credentials: { accessKeyId: process.env.CF_R2_ACCESS_KEY_ID || '', secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY || '' } })
    const cmd = new ListObjectsV2Command({ Bucket: BUCKET, Prefix: 'backups/' })
    const resp = await client.send(cmd)
    const items = (resp.Contents || []).map((c: any) => ({ key: c.Key, size: c.Size, lastModified: c.LastModified }))
    res.json({ ok: true, items })
  } catch (err: any) {
    console.error('List backups failed:', err)
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Download a backup (returns signed URL)
router.get('/download', async (req: any, res: any) => {
  if (!await requireAdmin(req, res)) return
  try {
    const key = String(req.query.key || '')
    if (!key) return res.status(400).json({ error: 'key is required' })
    const url = await getSignedDownloadUrl(key, 60 * 20)
    res.json({ ok: true, url })
  } catch (err: any) {
    console.error('Get backup signed url failed:', err)
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Delete backup
router.delete('/', async (req: any, res: any) => {
  if (!await requireAdmin(req, res)) return
  try {
    const key = String(req.query.key || '')
    if (!key) return res.status(400).json({ error: 'key is required' })
    await deleteObject(key)
    res.json({ ok: true })
  } catch (err: any) {
    console.error('Delete backup failed:', err)
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// JSON backup (DB export as JSON) - returns single JSON file with selected tables and uploads list
router.post('/json', async (req: any, res: any) => {
  if (!await requireAdmin(req, res)) return
  try {
    const docs = (await query("SELECT id, barcode, type, sender, receiver, date, subject, statement, priority, status, classification, notes, attachments, tenant_id, created_at, updated_at FROM documents")).rows
    const barcodes = (await query("SELECT id, barcode, type, created_at FROM barcodes")).rows
    const tenants = (await query("SELECT id, name, slug FROM tenants")).rows
    let settings: any = {}
    try {
      const r = await query('SELECT name, value FROM system_settings')
      settings = r.rows.reduce((acc: any, row: any) => (acc[row.name] = row.value, acc), {})
    } catch (e) {
      settings = { orgName: process.env.ORG_NAME || null, orgNameEn: process.env.ORG_NAME_EN || null }
    }

    // uploads list (filenames only)
    const uploadsDir = path.resolve(process.cwd(), 'uploads')
    const uploads: string[] = []
    function walk(dir: string) {
      if (!fs.existsSync(dir)) return
      for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f)
        const st = fs.statSync(p)
        if (st.isDirectory()) walk(p)
        else uploads.push(path.relative(uploadsDir, p).replace('\\', '/'))
      }
    }
    walk(uploadsDir)

    const payload = { generatedAt: new Date().toISOString(), tables: { docs, barcodes, tenants, settings }, uploads }

    const filename = `backup-json-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return res.send(JSON.stringify(payload, null, 2))
  } catch (err: any) {
    console.error('JSON backup failed:', err)
    return res.status(500).json({ error: String(err?.message || err) })
  }
})

// Restore from JSON backup (non-destructive upsert) - body: full JSON or multipart file 'file'
const multer2 = require('multer')
const uploadJson = multer2({ dest: os.tmpdir(), limits: { fileSize: 200 * 1024 * 1024 } })
router.post('/json/restore', uploadJson.single('file'), async (req: any, res: any) => {
  if (!await requireAdmin(req, res)) return
  try {
    let data: any = null
    if (req.file && req.file.path) {
      const buf = fs.readFileSync(req.file.path)
      data = JSON.parse(buf.toString('utf8'))
    } else {
      // application/json body
      data = req.body
    }
    if (!data || !data.tables) return res.status(400).json({ error: 'Invalid JSON backup format' })

    const { docs = [], tenants = [] } = data.tables

    await query('BEGIN')
    try {
      // Upsert tenants by slug
      const tenantMap: Record<string, number> = {}
      for (const t of tenants) {
        if (!t.slug) continue
        const r = await query("INSERT INTO tenants (name, slug) VALUES ($1,$2) ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name RETURNING id", [t.name, t.slug])
        tenantMap[t.slug] = r.rows[0].id
      }

      // Upsert documents by barcode
      for (const d of docs) {
        if (!d.barcode) continue
        const q = await query("SELECT id FROM documents WHERE lower(barcode)=lower($1) LIMIT 1", [d.barcode])
        if (q.rows.length > 0) {
          const id = q.rows[0].id
          await query("UPDATE documents SET type=$1, sender=$2, receiver=$3, date=$4, subject=$5, statement=$6, priority=$7, status=$8, classification=$9, notes=$10, attachments=$11, tenant_id=$12, updated_at=NOW() WHERE id=$13", [d.type, d.sender, d.receiver, d.date, d.subject, d.statement, d.priority, d.status, d.classification, d.notes, JSON.stringify(d.attachments || []), d.tenant_id || null, id])
        } else {
          await query("INSERT INTO documents (barcode, type, sender, receiver, date, subject, statement, priority, status, classification, notes, attachments, tenant_id, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)", [d.barcode, d.type, d.sender, d.receiver, d.date, d.subject, d.statement, d.priority, d.status, d.classification, d.notes, JSON.stringify(d.attachments || []), d.tenant_id || null, d.created_at || new Date(), d.updated_at || new Date()])
        }
      }

      await query('COMMIT')
      return res.json({ ok: true, message: 'Restore JSON applied (non-destructive upsert). Note: attachments files are not restored; upload files must be restored separately.' })
    } catch (e) {
      await query('ROLLBACK')
      throw e
    }
  } catch (err: any) {
    console.error('JSON restore failed:', err)
    return res.status(500).json({ error: String(err?.message || err) })
  }
})

// Restore backup (destructive) - requires FEATURE flag
// Body: { key }
router.post('/restore', async (req: any, res: any) => {
  if (!await requireAdmin(req, res)) return
  if (String(process.env.BACKUP_RESTORE_ENABLED || '').toLowerCase() !== 'true') return res.status(403).json({ error: 'Restore not enabled' })
  try {
    const key = String(req.body?.key || '')
    if (!key) return res.status(400).json({ error: 'key is required' })

    // Download backup
    const buf = await downloadToBuffer(key)
    // optional decrypt
    let archiveBuf = buf
    if (String(process.env.BACKUP_ENCRYPTION || '').toLowerCase() === 'true') {
      const encKey = process.env.BACKUP_ENC_KEY || ''
      if (!encKey) return res.status(500).json({ error: 'Backup encryption key not configured' })
      const crypto = await import('crypto')
      const keyBuf = Buffer.from(encKey, 'base64')
      const marker = archiveBuf.slice(0,5).toString()
      if (marker !== 'GCMv1') return res.status(400).json({ error: 'Invalid encrypted backup format' })
      const iv = archiveBuf.slice(5, 17)
      const tag = archiveBuf.slice(17, 33)
      const enc = archiveBuf.slice(33)
      const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, iv)
      decipher.setAuthTag(tag)
      archiveBuf = Buffer.concat([decipher.update(enc), decipher.final()])
    }

    // Write to temp file
    const tmpFile = path.join(os.tmpdir(), `restore-${Date.now()}.tar.gz`)
    fs.writeFileSync(tmpFile, archiveBuf)

    // Extract to temp dir
    const extractDir = mkTempDir('restore')
    await new Promise((resolve, reject) => {
      const tar = spawn('tar', ['-xzf', tmpFile, '-C', extractDir])
      tar.on('error', (e) => reject(e))
      tar.on('exit', (code) => code === 0 ? resolve(true) : reject(new Error('tar extract failed ' + code)))
    })

    // Expect db.dump inside extractDir
    const dbDump = path.join(extractDir, 'db.dump')
    if (!fs.existsSync(dbDump)) return res.status(400).json({ error: 'db.dump not found in archive' })

    // Warning: destructive. Use pg_restore --clean --if-exists --dbname=$DATABASE_URL
    const dbUrl = process.env.DATABASE_URL
    await new Promise((resolve, reject) => {
      const args = ['--clean', '--if-exists', `--dbname=${dbUrl}`, dbDump]
      const child = spawn('pg_restore', args)
      child.on('error', (e) => reject(e))
      child.on('exit', (code) => code === 0 ? resolve(true) : reject(new Error('pg_restore failed ' + code)))
    })

    // optional: restore uploads - copy uploads back (overwrite)
    const uploadsDir = path.resolve(process.cwd(), 'uploads')
    const uploadsSrc = path.join(extractDir, 'uploads')
    if (fs.existsSync(uploadsSrc)) {
      // remove existing uploads carefully
      try { fs.rmSync(uploadsDir, { recursive: true, force: true }) } catch (e) {}
      fs.cpSync(uploadsSrc, uploadsDir, { recursive: true })
    }

    // audit log
    try { await query('INSERT INTO backups (name, uploaded_by, created_at) VALUES ($1,$2,NOW())', [key, (req as any).user?.id || null]) } catch (e) {}

    res.json({ ok: true })
  } catch (err: any) {
    console.error('Restore failed:', err)
    res.status(500).json({ error: String(err?.message || err) })
  }
})

// Restore via uploaded file (multipart/form-data) - admin only
const multer = require('multer')
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 500 * 1024 * 1024 } })
router.post('/restore-upload', upload.single('file'), async (req: any, res: any) => {
  if (!await requireAdmin(req, res)) return
  if (String(process.env.BACKUP_RESTORE_ENABLED || '').toLowerCase() !== 'true') return res.status(403).json({ error: 'Restore not enabled' })
  try {
    if (!req.file || !req.file.path) return res.status(400).json({ error: 'File is required' })
    const tmpFile = req.file.path

    // optional decrypt if encrypted
    let archiveBuf = fs.readFileSync(tmpFile)
    if (String(process.env.BACKUP_ENCRYPTION || '').toLowerCase() === 'true') {
      const encKey = process.env.BACKUP_ENC_KEY || ''
      if (!encKey) return res.status(500).json({ error: 'Backup encryption key not configured' })
      const crypto = await import('crypto')
      const keyBuf = Buffer.from(encKey, 'base64')
      const marker = archiveBuf.slice(0,5).toString()
      if (marker !== 'GCMv1') return res.status(400).json({ error: 'Invalid encrypted backup format' })
      const iv = archiveBuf.slice(5, 17)
      const tag = archiveBuf.slice(17, 33)
      const enc = archiveBuf.slice(33)
      const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, iv)
      decipher.setAuthTag(tag)
      archiveBuf = Buffer.concat([decipher.update(enc), decipher.final()])
    }

    const extractDir = mkTempDir('restore-upload')
    const extractPath = path.join(os.tmpdir(), `upload-${Date.now()}.tar.gz`)
    fs.writeFileSync(extractPath, archiveBuf)

    await new Promise((resolve, reject) => {
      const tar = spawn('tar', ['-xzf', extractPath, '-C', extractDir])
      tar.on('error', (e) => reject(e))
      tar.on('exit', (code) => code === 0 ? resolve(true) : reject(new Error('tar extract failed ' + code)))
    })

    const dbDump = path.join(extractDir, 'db.dump')
    if (!fs.existsSync(dbDump)) return res.status(400).json({ error: 'db.dump not found in archive' })

    const dbUrl = process.env.DATABASE_URL
    await new Promise((resolve, reject) => {
      const args = ['--clean', '--if-exists', `--dbname=${dbUrl}`, dbDump]
      const child = spawn('pg_restore', args)
      child.on('error', (e) => reject(e))
      child.on('exit', (code) => code === 0 ? resolve(true) : reject(new Error('pg_restore failed ' + code)))
    })

    // restore uploads
    const uploadsDir = path.resolve(process.cwd(), 'uploads')
    const uploadsSrc = path.join(extractDir, 'uploads')
    if (fs.existsSync(uploadsSrc)) {
      try { fs.rmSync(uploadsDir, { recursive: true, force: true }) } catch (e) {}
      fs.cpSync(uploadsSrc, uploadsDir, { recursive: true })
    }

    // audit
    try { await query('INSERT INTO backups (name, uploaded_by, created_at) VALUES ($1,$2,NOW())', [`upload-${Date.now()}`, (req as any).user?.id || null]) } catch (e) {}

    res.json({ ok: true })
  } catch (err: any) {
    console.error('Restore upload failed:', err)
    res.status(500).json({ error: String(err?.message || err) })
  }
})

export default router
