import { Request, Response, NextFunction } from 'express'

const polyfillScript = `\n<script>\n(function polyfillWebAPIs(){\n  'use strict';\n  try{if(typeof window==='undefined')return;}catch(e){}\n  // MessageChannel polyfill\n  try{ new MessageChannel(); }catch(e){\n    (function(){\n      function MessagePortPoly(){ this.onmessage = null; }\n      MessagePortPoly.prototype.postMessage = function(msg){ var self=this; setTimeout(function(){ try{ if(typeof self.onmessage === 'function') self.onmessage({ data: msg }); } catch(e){} }, 0); };\n      MessagePortPoly.prototype.start = function(){};\n      MessagePortPoly.prototype.close = function(){};\n      function MessageChannelPoly(){ this.port1 = new MessagePortPoly(); this.port2 = new MessagePortPoly(); }\n      MessageChannelPoly.prototype.constructor = MessageChannelPoly;\n      try{ window.MessageChannel = MessageChannelPoly; }catch(e){}\n    })();\n  }\n  // CustomEvent polyfill\n  try{ new CustomEvent('__mdlbeast_test', { detail: {} }); }catch(e){\n    (function(){\n      function CustomEventPoly(type, params){ params = params || { bubbles: false, cancelable: false, detail: undefined }; var evt = document.createEvent('CustomEvent'); evt.initCustomEvent(type, params.bubbles, params.cancelable, params.detail); return evt; }\n      try{ CustomEventPoly.prototype = window.Event.prototype; window.CustomEvent = CustomEventPoly; }catch(e){}\n    })();\n  }\n})();\n</script>\n`

export default function injectHtmlPolyfill(req: Request, res: Response, next: NextFunction) {
  // Only target GET requests for archive pages that return HTML
  if (req.method !== 'GET') return next()
  if (!req.path.startsWith('/archive')) return next()

  const originalSend = res.send.bind(res)

  res.send = function (body?: any) {
    try {
      if (typeof body === 'string' && body.indexOf('<head') !== -1) {
        // Insert polyfill right after opening <head> tag
        body = body.replace(/<head(.*?)>/i, match => match + polyfillScript)

        // NOTE: previously we removed a specific chunk (249261e921aeebba.js) as an emergency hotfix.
        // Removing that strip so we don't mask the root cause; instead log occurrences so we can diagnose in production.
        try {
          if (/<script[^>]*src=["'][^"']*249261e921aeebba\\.js(?:\\?[^"']*)?["'][^>]*>/i.test(body)) {
            try { console.warn('[injectHtmlPolyfill] detected reference to problematic chunk 249261e921aeebba.js for', req.path) } catch(e) {}
          }
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // ignore
    }

    return originalSend(body)
  }

  next()
}
