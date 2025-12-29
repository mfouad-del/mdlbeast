import { Request, Response, NextFunction } from 'express'

const polyfillScript = `\n<script>try{new MessageChannel()}catch(e){(function(){function Port(){this.onmessage=null;}Port.prototype.postMessage=function(m){var s=this;setTimeout(function(){try{if(typeof s.onmessage==='function')s.onmessage({data:m})}catch(e){}},0)};window.MessageChannel=function(){return{port1:new Port(),port2:new Port()}}})()}try{new CustomEvent('__zaco_test',{detail:{}})}catch(e){(function(){function CustomEventPoly(t,p){p=p||{bubbles:false,cancelable:false,detail:null};var ev=document.createEvent('CustomEvent');ev.initCustomEvent(t,p.bubbles,p.cancelable,p.detail);return ev}CustomEventPoly.prototype=(window.Event||function(){}).prototype;window.CustomEvent=CustomEventPoly})();} </script>\n`

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

        // Also remove known problematic chunk references (hotfix):
        // This avoids loading the minified chunk that is causing runtime crashes in affected clients.
        try {
          body = body.replace(new RegExp(`<script[^>]*src=["'][^"']*249261e921aeebba\\.js(?:\\?[^"']*)?["'][^>]*>\\s*<\\/script>`, 'gi'), `<!-- removed problematic chunk 249261e921aeebba.js -->`)
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
