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
        const reordered = bidi.getReorderedString(reshaped, levels);
        // 4. Wrap with LTR override to force pdf-lib to NOT reorder the text again
        // U+202D = LEFT-TO-RIGHT OVERRIDE, U+202C = POP DIRECTIONAL FORMATTING
        return '\u202D' + reordered + '\u202C';
      } else {
        // If length changed (ligatures), we must recalculate levels on reshaped string
        const reshapedLevels = bidi.getEmbeddingLevels(reshaped, 'rtl');
        const reordered = bidi.getReorderedString(reshaped, reshapedLevels);
        return '\u202D' + reordered + '\u202C';
      }
    } else {
      // Fallback if bidi-js fails: simple reverse (will break numbers)
      const reversed = reshaped.split('').reverse().join('');
      return '\u202D' + reversed + '\u202C';
    }
  } catch (error) {
    console.error('Error processing Arabic text:', error);
    return text;
  }
}
