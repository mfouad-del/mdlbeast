import { Request, Response, NextFunction } from 'express'

/**
 * Middleware to prevent HTML pages being served for .js requests.
 * When a .js request would send HTML (starts with '<' / DOCTYPE), buffer the response
 * and instead return a small JS stub that logs a clear warning. This prevents
 * "Unexpected token '<'" and other parse errors from crashing client pages.
 */
export default function blockHtmlJsResponses(req: Request, res: Response, next: NextFunction) {
  try {
    const isJsReq = /\.js($|\?)|\.mjs($|\?)/i.test(req.path)
    if (!isJsReq) return next()

    const chunks: Buffer[] = []
    const origWrite = res.write.bind(res)
    const origEnd = res.end.bind(res)

    // Buffer writes for JS requests
    // Note: this is conservative and may increase memory usage for very large files;
    // it's intended to catch mis-served HTML error pages which are small.
    (res as any).write = function (chunk: any, encoding?: any, cb?: any) {
      try {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), encoding))
      } catch (e) {
        // if buffering fails, fall back to writing directly
        return origWrite(chunk, encoding, cb)
      }
      if (typeof cb === 'function') cb()
      return true
    }

    ;(res as any).end = function (chunk?: any, encoding?: any, cb?: any) {
      try {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), encoding))
        const buf = Buffer.concat(chunks)
        const txt = buf.toString('utf8').trimStart()

        if (txt.length > 0 && (txt.startsWith('<') || /<!doctype/i.test(txt) || txt.startsWith('<!--'))) {
          // Detected HTML being sent for a JS request — don't forward it.
          console.warn('blockHtmlJsResponses: blocking HTML response for JS request', { path: req.originalUrl })
          const stub = `/* blocked HTML served as JS for ${req.originalUrl} */\nconsole.warn('Blocked HTML response at ${req.originalUrl} — check CDN/origin/cache.');`
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
          res.setHeader('Content-Length', String(Buffer.byteLength(stub, 'utf8')))
          origWrite(Buffer.from(stub, 'utf8'))
          return origEnd(undefined as any, undefined as any, undefined as any)
        }

        // No HTML detected — forward original buffered content
        origWrite(buf)
        return origEnd(undefined as any, undefined as any, undefined as any)
      } catch (e: any) {
        console.error('blockHtmlJsResponses error:', e)
        // on error, attempt to flush what we have
        try { origWrite(Buffer.concat(chunks)) } catch (_) {}
        return origEnd(undefined as any, undefined as any, undefined as any)
      }
    }
  } catch (err: any) {
    console.error('blockHtmlJsResponses initialization error:', err)
  }

  return next()
}
