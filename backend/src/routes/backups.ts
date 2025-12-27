import express from 'express'
import { allowDebugAccess } from '../config/validateEnv'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawn } from 'child_process'
import { uploadBuffer, getSignedDownloadUrl, downloadToBuffer, deleteObject } from '../lib/r2-storage'
import { query } from '../config/database'

const router = express.Router()

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
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const name = `project-backup-${timestamp}.tar.gz`
    const tmp = mkTempDir('full-backup')

    // 1) DB dump via pg_dump (custom format)
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) return res.status(500).json({ error: 'DATABASE_URL not configured' })

    const dbFile = path.join(tmp, 'db.dump')

    await new Promise((resolve, reject) => {
      const args = ['--format=custom', `--dbname=${dbUrl}`, `-f`, dbFile]
      const child = spawn('pg_dump', args)
      child.on('error', (e) => reject(e))
      child.on('exit', (code) => code === 0 ? resolve(true) : reject(new Error('pg_dump failed with ' + code)))
    })

    // 2) Copy uploads
    const uploadsSrc = path.resolve(process.cwd(), 'uploads')
    const uploadsDest = path.join(tmp, 'uploads')
    if (fs.existsSync(uploadsSrc)) {
      // use simple copy (recursive)
      fs.cpSync(uploadsSrc, uploadsDest, { recursive: true })
    }

    // 3) Write metadata (system settings snapshot)
    let settings: any = {}
    try {
      const r = await query('SELECT name, value FROM system_settings')
      if (r && r.rows) settings = r.rows.reduce((acc: any, row: any) => (acc[row.name] = row.value, acc), {})
    } catch (e) {
      // fallback to env-based settings
      settings = { orgName: process.env.ORG_NAME || null, orgNameEn: process.env.ORG_NAME_EN || null }
    }
    fs.writeFileSync(path.join(tmp, 'settings.json'), JSON.stringify({ snapshotAt: new Date().toISOString(), settings }, null, 2))

    // 4) Create the tar.gz archive
    const archivePath = path.join(os.tmpdir(), name)
    await new Promise((resolve, reject) => {
      // tar -czf <archive> -C <tmp> .
      const tar = spawn('tar', ['-czf', archivePath, '-C', tmp, '.'])
      tar.on('error', (e) => reject(e))
      tar.on('exit', (code) => code === 0 ? resolve(true) : reject(new Error('tar failed ' + code)))
    })

    // 5) Optional encryption
    const encKey = process.env.BACKUP_ENC_KEY || ''
    let uploadBuf = fs.readFileSync(archivePath)
    if (process.env.BACKUP_ENCRYPTION === 'true' && encKey) {
      // simple AES-256-GCM encryption
      const crypto = await import('crypto')
      const key = Buffer.from(encKey, 'base64')
      if (key.length !== 32) throw new Error('BACKUP_ENC_KEY must be base64-encoded 32 bytes')
      const iv = crypto.randomBytes(12)
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
      const enc = Buffer.concat([cipher.update(uploadBuf), cipher.final()])
      const tag = cipher.getAuthTag()
      uploadBuf = Buffer.concat([Buffer.from('GCMv1'), iv, tag, enc])
    }

    // 6) Upload to R2 (delegated to backup-service if available)
    let key: string = `backups/${name}${process.env.BACKUP_ENCRYPTION === 'true' ? '.enc' : ''}`
    try {
      const service = await import('../lib/backup-service')
      const encGpg = String(process.env.BACKUP_ENCRYPTION_GPG || '').toLowerCase() === 'true'
      const res = await service.createAndUploadBackup({ encryptAES: String(process.env.BACKUP_ENCRYPTION || '').toLowerCase() === 'true', encryptGpg: encGpg, gpgRecipient: process.env.BACKUP_GPG_RECIPIENT, retentionCount: Number(process.env.BACKUP_RETENTION_COUNT || 6) })
      key = res.key
    } catch (e) {
      // fallback to previous upload path
      await uploadBuffer(key, uploadBuf, 'application/gzip', 'private, max-age=0')
    }

    // 7) cleanup
    try { fs.rmSync(tmp, { recursive: true, force: true }) } catch (e) {}
    try { fs.rmSync(archivePath) } catch (e) {}

    res.json({ ok: true, key })
  } catch (err: any) {
    console.error('Full backup failed:', err)
    res.status(500).json({ error: String(err?.message || err) })
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

export default router
