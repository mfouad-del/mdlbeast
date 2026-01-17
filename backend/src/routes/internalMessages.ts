import { Router, type Response } from 'express'
import type { AuthRequest } from '../types'
import { authenticateToken } from '../middleware/auth'
import { query } from '../config/database'

const router = Router()

router.use(authenticateToken)

const roleLower = (req: AuthRequest) => String(req.user?.role || '').toLowerCase()

// In-memory typing indicators (userId -> timestamp)
const typingUsers: Map<number, { user_id: number, full_name: string, timestamp: number }> = new Map()

// Get users for mentions
router.get('/users', async (_req: AuthRequest, res: Response) => {
  try {
    const r = await query(`SELECT id, full_name, username, role FROM users WHERE is_active = true ORDER BY full_name`)
    return res.json({ data: r.rows })
  } catch (err: any) {
    console.error('Get users error:', err)
    return res.status(500).json({ error: String(err?.message || err) })
  }
})

// Get updates (messages with additional info for real-time feel)
router.get('/updates', async (req: AuthRequest, res: Response) => {
  try {
    const since = req.query.since ? new Date(String(req.query.since)) : new Date(0)
    const limit = Math.min(Number(req.query.limit || 50), 200)

    const r = await query(
      `SELECT m.id, m.channel, m.user_id, u.full_name, u.username, m.content, m.attachments, 
              m.is_pinned, m.is_starred, m.reactions, m.created_at, m.updated_at
       FROM internal_messages m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.created_at > $1 OR m.updated_at > $1
       ORDER BY m.created_at DESC
       LIMIT $2`,
      [since, limit]
    )

    // Clean up old typing indicators
    const now = Date.now()
    for (const [userId, data] of typingUsers.entries()) {
      if (now - data.timestamp > 5000) {
        typingUsers.delete(userId)
      }
    }

    return res.json({ 
      data: r.rows, 
      typing: Array.from(typingUsers.values())
    })
  } catch (err: any) {
    console.error('Get updates error:', err)
    return res.status(500).json({ error: String(err?.message || err) })
  }
})

// Typing indicator
router.post('/typing', async (req: AuthRequest, res: Response) => {
  try {
    const userId = Number(req.user?.id)
    const fullName = String(req.user?.full_name || req.user?.username || 'Unknown')
    
    typingUsers.set(userId, {
      user_id: userId,
      full_name: fullName,
      timestamp: Date.now()
    })
    
    return res.json({ success: true })
  } catch (err: any) {
    console.error('Typing error:', err)
    return res.status(500).json({ error: String(err?.message || err) })
  }
})

// List channels (derived)
router.get('/channels', async (_req: AuthRequest, res: Response) => {
  try {
    const r = await query(
      `SELECT channel, COUNT(*)::int as message_count, MAX(created_at) as last_message_at
       FROM internal_messages
       GROUP BY channel
       ORDER BY MAX(created_at) DESC`
    )
    const channels = r.rows.map((x: any) => ({
      channel: x.channel || 'general',
      message_count: Number(x.message_count || 0),
      last_message_at: x.last_message_at,
    }))
    // Ensure 'general' always exists
    if (!channels.find((c: any) => c.channel === 'general')) {
      channels.push({ channel: 'general', message_count: 0, last_message_at: null })
    }
    return res.json({ data: channels })
  } catch (err: any) {
    console.error('List channels error:', err)
    return res.status(500).json({ error: String(err?.message || err) })
  }
})

// List messages by channel
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const channel = String(req.query.channel || 'general').trim() || 'general'
    const limit = Math.min(Number(req.query.limit || 100), 300)
    const offset = Math.max(Number(req.query.offset || 0), 0)

    const r = await query(
      `SELECT m.id, m.channel, m.user_id, u.full_name, u.username, m.content, m.attachments, m.is_pinned, m.created_at, m.updated_at
       FROM internal_messages m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.channel = $1
       ORDER BY m.is_pinned DESC, m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [channel, limit, offset]
    )

    return res.json({ data: r.rows, meta: { channel, limit, offset } })
  } catch (err: any) {
    console.error('List messages error:', err)
    return res.status(500).json({ error: String(err?.message || err) })
  }
})

// Post message
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = Number(req.user?.id)
    const channel = String(req.body?.channel || 'general').trim() || 'general'
    const content = String(req.body?.content || '').trim()
    const attachments = Array.isArray(req.body?.attachments) ? req.body.attachments : []

    if (!content) return res.status(400).json({ error: 'content is required' })

    const r = await query(
      `INSERT INTO internal_messages (channel, user_id, content, attachments)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id, channel, user_id, content, attachments, is_pinned, created_at`,
      [channel, userId, content, JSON.stringify(attachments)]
    )

    return res.status(201).json(r.rows[0])
  } catch (err: any) {
    console.error('Create message error:', err)
    return res.status(500).json({ error: String(err?.message || err) })
  }
})

// Pin/unpin message (admin/manager only)
router.post('/:id/pin', async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id)
    const role = roleLower(req)
    if (!['admin', 'manager', 'supervisor'].includes(role)) {
      return res.status(403).json({ error: 'Not authorized' })
    }

    const pinned = Boolean(req.body?.pinned)

    const r = await query(
      `UPDATE internal_messages
       SET is_pinned = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, is_pinned`,
      [pinned, id]
    )

    if (r.rows.length === 0) return res.status(404).json({ error: 'Message not found' })
    return res.json(r.rows[0])
  } catch (err: any) {
    console.error('Pin message error:', err)
    return res.status(500).json({ error: String(err?.message || err) })
  }
})

// Star/unstar message
router.post('/:id/star', async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id)
    
    // Toggle star status
    const existing = await query('SELECT is_starred FROM internal_messages WHERE id = $1', [id])
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Message not found' })
    
    const newStarred = !existing.rows[0].is_starred
    
    const r = await query(
      `UPDATE internal_messages
       SET is_starred = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, is_starred`,
      [newStarred, id]
    )

    return res.json(r.rows[0])
  } catch (err: any) {
    console.error('Star message error:', err)
    return res.status(500).json({ error: String(err?.message || err) })
  }
})

// React to message
router.post('/:id/react', async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id)
    const userId = Number(req.user?.id)
    const emoji = String(req.body?.emoji || '👍')
    
    // Get current reactions
    const existing = await query('SELECT reactions FROM internal_messages WHERE id = $1', [id])
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Message not found' })
    
    let reactions = existing.rows[0].reactions || {}
    if (typeof reactions === 'string') {
      try { reactions = JSON.parse(reactions) } catch { reactions = {} }
    }
    
    // Toggle reaction for this user
    if (!reactions[emoji]) {
      reactions[emoji] = [userId]
    } else if (reactions[emoji].includes(userId)) {
      reactions[emoji] = reactions[emoji].filter((id: number) => id !== userId)
      if (reactions[emoji].length === 0) delete reactions[emoji]
    } else {
      reactions[emoji].push(userId)
    }
    
    const r = await query(
      `UPDATE internal_messages
       SET reactions = $1::jsonb, updated_at = NOW()
       WHERE id = $2
       RETURNING id, reactions`,
      [JSON.stringify(reactions), id]
    )

    return res.json(r.rows[0])
  } catch (err: any) {
    console.error('React message error:', err)
    return res.status(500).json({ error: String(err?.message || err) })
  }
})

// Update message (author only)
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id)
    const userId = Number(req.user?.id)
    const role = roleLower(req)
    const content = String(req.body?.content || '').trim()

    if (!content) return res.status(400).json({ error: 'content is required' })

    const existing = await query('SELECT user_id FROM internal_messages WHERE id = $1', [id])
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Message not found' })

    const authorId = Number(existing.rows[0].user_id)
    const isPrivileged = ['admin', 'manager', 'supervisor'].includes(role)
    if (!isPrivileged && authorId !== userId) return res.status(403).json({ error: 'Not authorized' })

    const r = await query(
      `UPDATE internal_messages
       SET content = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, content, updated_at`,
      [content, id]
    )

    return res.json(r.rows[0])
  } catch (err: any) {
    console.error('Update message error:', err)
    return res.status(500).json({ error: String(err?.message || err) })
  }
})

// Delete message (author or admin/manager)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id)
    const userId = Number(req.user?.id)
    const role = roleLower(req)

    const existing = await query('SELECT user_id FROM internal_messages WHERE id = $1', [id])
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Message not found' })

    const authorId = Number(existing.rows[0].user_id)
    const isPrivileged = ['admin', 'manager', 'supervisor'].includes(role)
    if (!isPrivileged && authorId !== userId) return res.status(403).json({ error: 'Not authorized' })

    await query('DELETE FROM internal_messages WHERE id = $1', [id])
    return res.json({ success: true })
  } catch (err: any) {
    console.error('Delete message error:', err)
    return res.status(500).json({ error: String(err?.message || err) })
  }
})

export default router
