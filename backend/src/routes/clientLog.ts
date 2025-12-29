import express from 'express'
const router = express.Router()

router.post('/', express.json(), (req, res) => {
  try {
    const { message, stack, ua, href, filename } = req.body || {}
    // Log to server console and into logBuffer via global override
    console.warn('[client-log]', { message, filename, href, ua, stack })
    return res.json({ ok: true })
  } catch (err: any) {
    console.error('client-log error', err)
    return res.status(500).json({ error: 'failed' })
  }
})

export default router
