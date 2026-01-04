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
        // This might fail for some mixed text if bidi-js doesn't know Presentation Forms,
        // but it's the best fallback if lengths differ.
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
