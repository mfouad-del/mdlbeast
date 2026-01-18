/**
 * File Validation Utilities
 * Provides secure file type validation using magic numbers (file signatures)
 */

// Magic number signatures for allowed file types
const FILE_SIGNATURES: Record<string, { signature: number[]; offset: number }[]> = {
  'application/pdf': [
    { signature: [0x25, 0x50, 0x44, 0x46], offset: 0 } // %PDF
  ],
  'image/png': [
    { signature: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], offset: 0 }
  ],
  'image/jpeg': [
    { signature: [0xFF, 0xD8, 0xFF], offset: 0 }
  ],
  'image/webp': [
    { signature: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF
    // Additional check for WEBP at offset 8 done separately
  ],
  'image/gif': [
    { signature: [0x47, 0x49, 0x46, 0x38], offset: 0 } // GIF8
  ]
}

/**
 * Validates file content against magic number signatures
 * @param buffer - File buffer to validate
 * @param claimedMimeType - The MIME type claimed by the upload
 * @returns true if file matches claimed type, false otherwise
 */
export function validateFileMagicNumber(buffer: Buffer, claimedMimeType: string): boolean {
  const mimeType = claimedMimeType.toLowerCase()
  const signatures = FILE_SIGNATURES[mimeType]
  
  if (!signatures) {
    // Unknown mime type - fail closed for security
    return false
  }

  for (const { signature, offset } of signatures) {
    if (buffer.length < offset + signature.length) {
      continue
    }

    let matches = true
    for (let i = 0; i < signature.length; i++) {
      if (buffer[offset + i] !== signature[i]) {
        matches = false
        break
      }
    }

    if (matches) {
      // Special case for WEBP - check for WEBP signature at offset 8
      if (mimeType === 'image/webp') {
        if (buffer.length >= 12) {
          const webpSig = [0x57, 0x45, 0x42, 0x50] // WEBP
          let webpMatches = true
          for (let i = 0; i < webpSig.length; i++) {
            if (buffer[8 + i] !== webpSig[i]) {
              webpMatches = false
              break
            }
          }
          return webpMatches
        }
        return false
      }
      return true
    }
  }

  return false
}

/**
 * Detects actual file type from buffer based on magic numbers
 * @param buffer - File buffer to analyze
 * @returns Detected MIME type or null if unknown
 */
export function detectFileType(buffer: Buffer): string | null {
  for (const [mimeType, signatures] of Object.entries(FILE_SIGNATURES)) {
    for (const { signature, offset } of signatures) {
      if (buffer.length < offset + signature.length) continue

      let matches = true
      for (let i = 0; i < signature.length; i++) {
        if (buffer[offset + i] !== signature[i]) {
          matches = false
          break
        }
      }

      if (matches) {
        // Special case for WEBP
        if (mimeType === 'image/webp' && buffer.length >= 12) {
          const webpSig = [0x57, 0x45, 0x42, 0x50]
          let webpMatches = true
          for (let i = 0; i < webpSig.length; i++) {
            if (buffer[8 + i] !== webpSig[i]) {
              webpMatches = false
              break
            }
          }
          if (!webpMatches) continue
        }
        return mimeType
      }
    }
  }
  return null
}

/**
 * List of allowed MIME types for upload
 */
export const ALLOWED_MIME_TYPES = Object.keys(FILE_SIGNATURES)

/**
 * Validates both claimed MIME type and actual file content
 * @param buffer - File buffer
 * @param claimedMimeType - MIME type from upload headers
 * @returns Object with validation result and detected type
 */
export function validateUploadedFile(buffer: Buffer, claimedMimeType: string): {
  valid: boolean
  detectedType: string | null
  error?: string
} {
  const claimed = claimedMimeType.toLowerCase()
  
  // Check if claimed type is allowed
  if (!ALLOWED_MIME_TYPES.includes(claimed)) {
    return {
      valid: false,
      detectedType: null,
      error: `File type '${claimed}' is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`
    }
  }

  // Detect actual type
  const detectedType = detectFileType(buffer)
  
  if (!detectedType) {
    return {
      valid: false,
      detectedType: null,
      error: 'Could not verify file type from content'
    }
  }

  // Check if detected type matches claimed type
  if (detectedType !== claimed) {
    return {
      valid: false,
      detectedType,
      error: `File content does not match claimed type. Claimed: ${claimed}, Detected: ${detectedType}`
    }
  }

  return {
    valid: true,
    detectedType
  }
}
