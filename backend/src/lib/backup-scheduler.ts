import cron from 'node-cron'
import { createAndUploadBackup } from './backup-service'

export function startBackupScheduler() {
  const cronExpr = process.env.BACKUP_CRON || ''
  const intervalDays = Number(process.env.BACKUP_INTERVAL_DAYS || '15')
  const retention = Number(process.env.BACKUP_RETENTION_COUNT || '6')

  if (String(process.env.BACKUPS_ENABLED || '').toLowerCase() !== 'true') {
    console.info('Backup scheduler disabled by BACKUPS_ENABLED != true')
    return
  }

  if (cronExpr) {
    try {
      cron.schedule(cronExpr, async () => {
        console.info('Running scheduled backup (cron)')
        try { await createAndUploadBackup({ encryptAES: String(process.env.BACKUP_ENCRYPTION || '').toLowerCase() === 'true', encryptGpg: String(process.env.BACKUP_ENCRYPTION_GPG || '').toLowerCase() === 'true', gpgRecipient: process.env.BACKUP_GPG_RECIPIENT, retentionCount: retention }) } catch (e) { console.error('Scheduled backup failed:', e) }
      })
      console.info('Backup scheduler started with cron', cronExpr)
      return
    } catch (e) {
      console.warn('Invalid BACKUP_CRON expression, falling back to interval days', e)
    }
  }

  // fallback: setInterval by days
  const ms = intervalDays * 24 * 60 * 60 * 1000
  setInterval(async () => {
    console.info('Running scheduled backup (interval days)')
    try { await createAndUploadBackup({ encryptAES: String(process.env.BACKUP_ENCRYPTION || '').toLowerCase() === 'true', encryptGpg: String(process.env.BACKUP_ENCRYPTION_GPG || '').toLowerCase() === 'true', gpgRecipient: process.env.BACKUP_GPG_RECIPIENT, retentionCount: retention }) } catch (e) { console.error('Scheduled backup failed:', e) }
  }, ms)
  console.info('Backup scheduler started with intervalDays', intervalDays)
}
