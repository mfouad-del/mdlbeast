import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawn } from 'child_process'
import { uploadBuffer, getSignedDownloadUrl, deleteObject } from './r2-storage'
import { query } from '../config/database'

export async function createAndUploadBackup(opts: { encryptAES?: boolean, gpgRecipient?: string, encryptGpg?: boolean, retentionCount?: number } = {}) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const nameBase = `project-backup-${timestamp}`
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'full-backup-'))
  let archivePath = ''
  let gpgOutPath = ''
  try {
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) throw new Error('DATABASE_URL not configured')
    const dbFile = path.join(tmp, 'db.dump')
    await new Promise((resolve, reject) => {
      const args = ['--format=custom', `--dbname=${dbUrl}`, '-f', dbFile]
      const child = spawn('pg_dump', args)
      child.on('error', (e) => reject(e))
      child.on('exit', (code) => code === 0 ? resolve(true) : reject(new Error('pg_dump failed ' + code)))
    })

    // copy uploads
    const uploadsSrc = path.resolve(process.cwd(), 'uploads')
    const uploadsDest = path.join(tmp, 'uploads')
    if (fs.existsSync(uploadsSrc)) fs.cpSync(uploadsSrc, uploadsDest, { recursive: true })

    // system snapshot
    let settings: any = {}
    try {
      const r = await query('SELECT name, value FROM system_settings')
      if (r && r.rows) settings = r.rows.reduce((acc: any, row: any) => ((acc[row.name] = row.value), acc), {})
    } catch (e) {
      settings = { orgName: process.env.ORG_NAME || null, orgNameEn: process.env.ORG_NAME_EN || null }
    }
    fs.writeFileSync(path.join(tmp, 'settings.json'), JSON.stringify({ snapshotAt: new Date().toISOString(), settings }, null, 2))

    const archiveName = `${nameBase}.tar.gz`
    const archivePath = path.join(os.tmpdir(), archiveName)
    await new Promise((resolve, reject) => {
      const tar = spawn('tar', ['-czf', archivePath, '-C', tmp, '.'])
      tar.on('error', (e) => reject(e))
      tar.on('exit', (code) => code === 0 ? resolve(true) : reject(new Error('tar failed ' + code)))
    })

    // encryption: GPG preferred if encryptGpg true and recipient provided
    let finalBuf = fs.readFileSync(archivePath)
    let uploadKey = `backups/${archiveName}`

    if (opts.encryptGpg && opts.gpgRecipient) {
      gpgOutPath = archivePath + '.gpg'
      await new Promise((resolve, reject) => {
        const gpg: any = spawn('gpg', ['--yes', '--batch', '--output', gpgOutPath, '--encrypt', '--recipient', String(opts.gpgRecipient), archivePath])
        gpg.on('error', (e: any) => reject(e))
        gpg.on('exit', (code: number) => code === 0 ? resolve(true) : reject(new Error('gpg failed ' + code)))
      })
      finalBuf = fs.readFileSync(gpgOutPath)
      uploadKey = `backups/${archiveName}.gpg`
    } else if (opts.encryptAES && process.env.BACKUP_ENC_KEY) {
      const crypto = await import('crypto')
      const key = Buffer.from(String(process.env.BACKUP_ENC_KEY || ''), 'base64')
      if (key.length !== 32) throw new Error('BACKUP_ENC_KEY must be base64 32 bytes')
      const iv = crypto.randomBytes(12)
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
      const enc = Buffer.concat([cipher.update(finalBuf), cipher.final()])
      const tag = cipher.getAuthTag()
      finalBuf = Buffer.concat([Buffer.from('GCMv1'), iv, tag, enc])
      uploadKey = `backups/${archiveName}.enc`
    }

    const uploadRes = await uploadBuffer(uploadKey, finalBuf, 'application/gzip', 'private, max-age=0')

    // insert backups table record if present
    try {
      await query('INSERT INTO backups (name, uploaded_by, created_at) VALUES ($1,$2,NOW())', [uploadKey, null])
    } catch (e) {
      // ignore
    }

    // retention: delete older backups leaving retentionCount
    const retention = Number(opts.retentionCount || Number(process.env.BACKUP_RETENTION_COUNT || 6)) || 6
    try {
      const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = await import('@aws-sdk/client-s3')
      const BUCKET = process.env.CF_R2_BUCKET || ''
      const ENDPOINT = (process.env.CF_R2_ENDPOINT || '').replace(/\/$/, '')
      if (BUCKET && ENDPOINT) {
        const client = new S3Client({ region: process.env.CF_R2_REGION || 'auto', endpoint: ENDPOINT, credentials: { accessKeyId: process.env.CF_R2_ACCESS_KEY_ID || '', secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY || '' } })
        const list = new ListObjectsV2Command({ Bucket: BUCKET, Prefix: 'backups/' })
        const resp = await client.send(list)
        const items = (resp.Contents || []).sort((a: any, b: any) => (a.LastModified || 0) - (b.LastModified || 0))
        const toDelete = items.slice(0, Math.max(0, items.length - retention)).map((i: any) => ({ Key: i.Key }))
        if (toDelete.length) {
          const delCmd = new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: toDelete } })
          await client.send(delCmd)
        }
      }
    } catch (e) {
      // ignore retention errors
    }

    return { key: uploadKey, url: uploadRes }
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }) } catch (e) {}
    try { fs.rmSync(archivePath) } catch (e) {}
  }
}

export async function listBackups() {
  const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3')
  const BUCKET = process.env.CF_R2_BUCKET || ''
  const ENDPOINT = (process.env.CF_R2_ENDPOINT || '').replace(/\/$/, '')
  if (!BUCKET || !ENDPOINT) throw new Error('R2 not configured')
  const client = new S3Client({ region: process.env.CF_R2_REGION || 'auto', endpoint: ENDPOINT, credentials: { accessKeyId: process.env.CF_R2_ACCESS_KEY_ID || '', secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY || '' } })
  const cmd = new ListObjectsV2Command({ Bucket: BUCKET, Prefix: 'backups/' })
  const resp = await client.send(cmd)
  return (resp.Contents || []).map((c: any) => ({ key: c.Key, size: c.Size, lastModified: c.LastModified }))
}

export async function deleteBackup(key: string) {
  await deleteObject(key)
}

export async function getBackupSignedUrl(key: string, expires = 60 * 20) {
  return getSignedDownloadUrl(key, expires)
}
