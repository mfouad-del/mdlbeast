// Simple diagnostic: list font files and print first bytes + whether they look like TTF/OTF/WOFF/WOFF2
const fs = require('fs')
const path = require('path')

const fontDirs = [
  path.resolve(process.cwd(), 'backend', 'assets', 'fonts'),
  path.resolve(process.cwd(), 'assets', 'fonts'),
  path.resolve(process.cwd(), 'assets'),
  path.resolve(process.cwd(), 'fonts'),
]

const candidates = []
for (const d of fontDirs) {
  try {
    if (fs.existsSync(d)) {
      const files = fs.readdirSync(d).filter(f => /\.(ttf|otf|woff2?|woff|ttc)$/i.test(f))
      for (const f of files) candidates.push(path.join(d, f))
    }
  } catch (e) {
    // ignore
  }
}

if (candidates.length === 0) {
  console.error('No font files found in expected locations. Please place NotoSansArabic-Regular.ttf and NotoSansArabic-Bold.ttf in backend/assets/fonts/')
  process.exit(2)
}

let ok = false
for (const p of candidates) {
  try {
    const buf = fs.readFileSync(p)
    const head = buf.slice(0, 8)
    const head4 = buf.slice(0,4)
    const headHex = head.toString('hex')
    const headAscii = head.toString('ascii')
    const isTTF = head4.equals(Buffer.from([0x00,0x01,0x00,0x00]))
    const isOTF = headAscii === 'OTTO'
    const isTTC = headAscii === 'ttcf'
    const isWOFF2 = headHex.startsWith('774f4632')
    const isWOFF = headAscii.toLowerCase().startsWith('wof') || headHex.startsWith('774f4630')
    console.log(`${p}  size=${buf.length} head=${headHex}  TTF=${isTTF} OTF=${isOTF} TTC=${isTTC} WOFF2=${isWOFF2} WOFF=${isWOFF}`)
    if (isTTF || isOTF || isTTC) ok = true
  } catch (e) {
    console.error(`${p} - read error: ${e.message}`)
  }
}

if (!ok) {
  console.error('\nNo valid TTF/OTF font files detected. Please download and place NotoSansArabic TTF files in backend/assets/fonts/')
  process.exit(3)
}

console.log('\nFont check passed: at least one TTF/OTF font found.')
process.exit(0)
