import ArabicReshaper from 'arabic-reshaper';

/**
 * Process Arabic text for PDF rendering.
 * 
 * pdf-lib renders text left-to-right, but Arabic needs right-to-left display.
 * So we need to:
 * 1. Reshape Arabic letters (connect isolated forms into proper glyphs)
 * 2. REVERSE the string so when pdf-lib draws LTR, it appears RTL visually
 */
export function processArabicText(text: string): string {
  if (!text) return '';

  try {
    // Step 1: Reshape Arabic letters (connect glyphs)
    const convert = (ArabicReshaper as any).convertArabic || (ArabicReshaper as any).reshape || ((s: string) => s);
    const reshaped = convert(String(text));
    
    // Step 2: Reverse the string for RTL display in pdf-lib
    // pdf-lib draws left-to-right, so we reverse to make it appear right-to-left
    const reversed = [...reshaped].reverse().join('');
    
    console.debug('processArabicText:', { input: text, reshaped, reversed });
    return reversed;
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
