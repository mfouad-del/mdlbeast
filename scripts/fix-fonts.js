const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

async function fetchAndWrite(url, outPath) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, buf)
  return { size: buf.length, head: buf.slice(0, 16).toString('hex'), sha256: crypto.createHash('sha256').update(buf).digest('hex') }
}

async function main() {
  const urls = {
    regular: 'https://github.com/googlefonts/noto-fonts/raw/main/phaseIII_only/unhinted/ttf/NotoSansArabic/NotoSansArabic-Regular.ttf',
    bold: 'https://github.com/googlefonts/noto-fonts/raw/main/phaseIII_only/unhinted/ttf/NotoSansArabic/NotoSansArabic-Bold.ttf'
  }
  const targets = [
    path.resolve(process.cwd(), 'backend', 'assets', 'fonts', 'NotoSansArabic-Regular.ttf'),
    path.resolve(process.cwd(), 'backend', 'assets', 'fonts', 'NotoSansArabic-Bold.ttf')
  ]
  for (let t of targets) {
    const which = t.toLowerCase().includes('bold') ? 'bold' : 'regular'
    try {
      const r = await fetchAndWrite(urls[which], t)
      console.log(`${t}: ok size=${r.size} head=${r.head} sha256=${r.sha256}`)
    } catch (e) {
      console.error(`${t}: failed`, e && e.message)
    }
  }
}

main().catch(e=>{console.error(e); process.exit(1)})