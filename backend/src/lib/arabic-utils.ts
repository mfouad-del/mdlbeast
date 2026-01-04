import bidiFactory from 'bidi-js';
import ArabicReshaper from 'arabic-reshaper';

// Initialize bidi-js once
let bidi: any;

try {
  bidi = bidiFactory();
} catch (e) {
  console.error('Failed to initialize bidi-js:', e);
}

export function processArabicText(text: string): string {
  if (!text) return '';

  try {
    // 1. Get levels from Original String (which has correct types)
    // We use the original string because bidi-js might not recognize Presentation Forms as RTL
    let levels;
    if (bidi) {
      levels = bidi.getEmbeddingLevels(text, 'rtl');
    }

    // 2. Reshape: Connects isolated Arabic letters
    // Use convertArabic if available (v1.1.0+), otherwise fallback or use reshape
    const convert = (ArabicReshaper as any).convertArabic || (ArabicReshaper as any).reshape || ((s: string) => s);
    const reshaped = convert(String(text));

    // 3. Reorder: Generates the Visual LTR string for pdf-lib
    if (bidi && levels) {
      // If length matches, use original levels (best for mixed text)
      if (reshaped.length === text.length) {
        return bidi.getReorderedString(reshaped, levels);
      } else {
        // If length changed (ligatures), we must recalculate levels on reshaped string
        const reshapedLevels = bidi.getEmbeddingLevels(reshaped, 'rtl');
        return bidi.getReorderedString(reshaped, reshapedLevels);
      }
    } else {
      // Fallback if bidi-js fails: simple reverse (will break numbers)
      return reshaped.split('').reverse().join('');
    }
  } catch (error) {
    console.error('Error processing Arabic text:', error);
    return text;
  }
}

// Export function to split text into individual glyphs with positions
// This is used to manually position each character in the PDF
export function getGlyphPositions(text: string, font: any, fontSize: number, baseX: number, baseY: number): Array<{char: string, x: number, y: number}> {
  const processed = processArabicText(text);
  const positions: Array<{char: string, x: number, y: number}> = [];
  let currentX = baseX;
  
  for (let i = 0; i < processed.length; i++) {
    const char = processed[i];
    positions.push({ char, x: currentX, y: baseY });
    
    // Calculate the width of this character to position the next one
    try {
      const charWidth = font.widthOfTextAtSize(char, fontSize);
      currentX += charWidth;
    } catch (e) {
      // If character width calculation fails, use a default spacing
      currentX += fontSize * 0.5;
    }
  }
  
  return positions;
}
