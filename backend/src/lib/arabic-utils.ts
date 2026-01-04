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
    // 1. Reshape: Connects isolated Arabic letters
    // Use convertArabic if available (v1.1.0+), otherwise fallback or use reshape
    const convert = (ArabicReshaper as any).convertArabic || (ArabicReshaper as any).reshape || ((s: string) => s);
    const reshaped = convert(String(text));

    // 2. BiDi: Calculate embedding levels with RTL base direction
    if (bidi) {
      const levels = bidi.getEmbeddingLevels(reshaped, 'rtl');
      
      // 3. Reorder: Generates the Visual LTR string for pdf-lib
      // This handles mixed text (Arabic + Numbers) correctly
      return bidi.getReorderedString(reshaped, levels);
    } else {
      // Fallback if bidi-js fails: simple reverse (will break numbers)
      return reshaped.split('').reverse().join('');
    }
  } catch (error) {
    console.error('Error processing Arabic text:', error);
    return text;
  }
}
