/**
 * ============================================================================
 * Email Queue Service - قائمة انتظار البريد الإلكتروني
 * ============================================================================
 * Handles email queueing, retry logic, and tracking
 */

import { query } from '../config/database'
import { sendEmailWithResult } from './emailService'

export interface QueueEmailParams {
  to: string
  subject: string
  html: string
  locale?: 'en' | 'ar'
  maxAttempts?: number
}

/**
 * Add email to queue
 */
export async function queueEmail(params: QueueEmailParams): Promise<number> {
  const result = await query(
    `INSERT INTO email_queue (to_email, subject, html, locale, max_attempts, status)
     VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id`,
    [
      params.to,
      params.subject,
      params.html,
      params.locale || 'en',
      params.maxAttempts || 3
    ]
  )
  return result.rows[0].id
}

/**
 * Process pending emails (call this from cron or background worker)
 */
export async function processPendingEmails(): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0

  try {
    // Get pending emails
    const result = await query(
      `SELECT * FROM email_queue 
       WHERE status = 'pending' 
       AND attempts < max_attempts
       ORDER BY created_at ASC
       LIMIT 50`
    )

    for (const email of result.rows) {
      try {
        // Attempt to send
        const sendResult = await sendEmailWithResult({
          to: email.to_email,
          subject: email.subject,
          html: email.html
        })

        if (sendResult.success) {
          // Mark as sent
          await query(
            `UPDATE email_queue 
             SET status = 'sent', sent_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [email.id]
          )
          sent++
        } else {
          // Increment attempts
          await query(
            `UPDATE email_queue 
             SET attempts = attempts + 1, 
                 error_message = $2,
                 status = CASE 
                   WHEN attempts + 1 >= max_attempts THEN 'failed'
                   ELSE 'pending'
                 END,
                 updated_at = NOW()
             WHERE id = $1`,
            [email.id, sendResult.error || 'Unknown error']
          )
          failed++
        }
      } catch (error: any) {
        // Handle unexpected errors
        await query(
          `UPDATE email_queue 
           SET attempts = attempts + 1,
               error_message = $2,
               status = CASE 
                 WHEN attempts + 1 >= max_attempts THEN 'failed'
                 ELSE 'pending'
               END,
               updated_at = NOW()
           WHERE id = $1`,
          [email.id, error.message || 'Unknown error']
        )
        failed++
      }
    }
  } catch (error) {
    console.error('Email queue processing error:', error)
  }

  return { sent, failed }
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  const result = await query(`
    SELECT 
      status,
      COUNT(*) as count,
      MAX(created_at) as latest
    FROM email_queue
    GROUP BY status
  `)
  
  return result.rows.reduce((acc, row) => {
    acc[row.status] = { count: parseInt(row.count), latest: row.latest }
    return acc
  }, {} as Record<string, { count: number; latest: string }>)
}

/**
 * Retry failed emails
 */
export async function retryFailedEmails(): Promise<number> {
  const result = await query(
    `UPDATE email_queue 
     SET status = 'pending', attempts = 0, error_message = NULL, updated_at = NOW()
     WHERE status = 'failed'
     RETURNING id`
  )
  return result.rows.length
}

/**
 * Clean old emails (older than 30 days)
 */
export async function cleanOldEmails(): Promise<number> {
  const result = await query(
    `DELETE FROM email_queue 
     WHERE created_at < NOW() - INTERVAL '30 days'
     AND status IN ('sent', 'failed')
     RETURNING id`
  )
  return result.rows.length
}
