import ArabicReshaper from 'arabic-reshaper';

let _bidi: any | null = null;

function getBidi(): any {
  if (_bidi) return _bidi;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const bidiFactory = require('bidi-js');
  const factoryFn = (bidiFactory && (bidiFactory.default || bidiFactory)) as any;
  _bidi = typeof factoryFn === 'function' ? factoryFn() : null;
  return _bidi;
}

/**
 * Process Arabic text for PDF rendering.
 *
 * pdf-lib does not implement complex text shaping for Arabic. We use arabic-reshaper to
 * convert Arabic letters to presentation forms so they render connected.
 *
 * We also apply the Unicode BiDi algorithm to produce a visual-ready string.
 * The stamp drawing code then renders that visual string RTL.
 */
export function processArabicText(text: string): string {
  if (!text) return '';

  try {
    const convert = (ArabicReshaper as any).convertArabic || (ArabicReshaper as any).reshape || ((s: string) => s);
    const cleaned = String(text)
      .normalize('NFC')
      // remove common bidi controls / isolates that can render as odd glyphs
      .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const reshaped = convert(cleaned);

    const bidi = getBidi();
    if (!bidi || typeof bidi.getEmbeddingLevels !== 'function' || typeof bidi.getReorderedString !== 'function') {
      console.warn('processArabicText: bidi-js unavailable; returning reshaped only');
      console.debug('processArabicText:', { input: text, reshaped, output: reshaped });
      return reshaped;
    }

    const embedding = bidi.getEmbeddingLevels(reshaped, 'rtl');

    // Apply mirroring (e.g., parentheses) before reordering.
    let mirroredText = reshaped;
    try {
      if (typeof bidi.getMirroredCharactersMap === 'function') {
        const map: Map<number, string> = bidi.getMirroredCharactersMap(reshaped, embedding);
        if (map && map.size) {
          const arr = Array.from(reshaped);
          for (const [idx, rep] of map.entries()) {
            if (idx >= 0 && idx < arr.length) arr[idx] = rep;
          }
          mirroredText = arr.join('');
        }
      }
    } catch {
      // ignore
    }

    const visual = bidi.getReorderedString(mirroredText, embedding);
    console.debug('processArabicText:', { input: text, reshaped, output: visual });
    return visual;
  } catch (error) {
    console.error('Error processing Arabic text:', error);
    return text;
  }
}

// Export function to get glyph positions (kept for potential future use)
export function getGlyphPositions(text: string, font: any, fontSize: number, baseX: number, baseY: number): Array<{char: string, x: number, y: number}> {
  const processed = processArabicText(text);
  const positions: Array<{char: string, x: number, y: number}> = [];
  let currentX = baseX;
  
  for (let i = 0; i < processed.length; i++) {
    const char = processed[i];
    positions.push({ char, x: currentX, y: baseY });
    
    try {
      const charWidth = font.widthOfTextAtSize(char, fontSize);
      currentX += charWidth;
    } catch (e) {
      currentX += fontSize * 0.5;
    }
  }
  
  return positions;
}
