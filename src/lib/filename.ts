/**
 * Utility functions for dynamic PDF filename generation, smart sanitization,
 * and cross-platform operating system compliance.
 */

// Characters disallowed in filenames across Windows, macOS, Linux, iOS, and Android
// Windows disallows: < > : " / \ | ? * and control chars (0x00-0x1F)
// Unix/macOS disallows: / and \0 (colon also disallowed in classic Finder/HFS)
const INVALID_FILENAME_CHARS_REGEX = /[<>:"/\\|?*\x00-\x1F\x7F]/g;

// Trailing or duplicate .pdf extensions (e.g., .pdf, .PDF, .pdf.pdf)
const TRAILING_PDF_EXT_REGEX = /(?:\.pdf)+$/i;

/**
 * Generates the dynamic default PDF filename using the user's current local date.
 * Format: htmltopdfbyauranixtech-YYYY-MM-DD.pdf
 *
 * @param date Optional Date object, defaults to new Date()
 * @returns Standard dynamic default filename
 */
export function getDefaultPdfFilename(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `htmltopdfbyauranixtech-${yyyy}-${mm}-${dd}.pdf`;
}

/**
 * Sanitizes a raw filename string:
 * - Strips illegal filesystem characters (< > : " / \ | ? * and control chars)
 * - Strips redundant or duplicate .pdf extensions (.pdf.pdf -> stem)
 * - Collapses consecutive spaces
 * - Trims leading and trailing spaces and dots (Windows disallows trailing dots/spaces)
 * - Preserves meaningful hyphens (-), underscores (_), and alphanumeric characters
 *
 * @param input Raw user-supplied filename
 * @returns Clean filename stem without trailing extension
 */
export function sanitizePdfStem(input: string): string {
  if (!input) return "";

  let cleaned = input
    // Normalize unicode if supported
    .normalize("NFKD")
    // Replace invalid characters with empty string
    .replace(INVALID_FILENAME_CHARS_REGEX, "")
    // Collapse whitespace tabs/spaces
    .replace(/\s+/g, " ")
    .trim();

  // Repeatedly strip any trailing .pdf extensions (e.g. "report.pdf.pdf" -> "report")
  cleaned = cleaned.replace(TRAILING_PDF_EXT_REGEX, "");

  // Strip leading/trailing dots and spaces (Windows restriction & hidden file prevention)
  cleaned = cleaned.replace(/^[.\s]+|[.\s]+$/g, "");

  // Again strip trailing .pdf in case a dot was removed revealing another extension
  cleaned = cleaned.replace(TRAILING_PDF_EXT_REGEX, "");

  return cleaned.trim();
}

/**
 * Formats the final, download-ready PDF filename:
 * - Sanitizes the user input
 * - Falls back to dynamic default date filename if input is empty or resolves to empty
 * - Guarantees single `.pdf` extension
 *
 * @param input Raw user input
 * @param fallbackDate Optional date for default fallback
 * @returns Final download-ready PDF filename
 */
export function formatFinalPdfFilename(input?: string | null, fallbackDate: Date = new Date()): string {
  const stem = sanitizePdfStem(input || "");
  if (!stem) {
    return getDefaultPdfFilename(fallbackDate);
  }
  return `${stem}.pdf`;
}

export interface FilenameValidationResult {
  isValid: boolean;
  sanitizedStem: string;
  finalFilename: string;
  isDefault: boolean;
  hasInvalidChars: boolean;
  hasDuplicateExt: boolean;
}

/**
 * Validates a filename input and provides detailed status for the UI.
 *
 * @param rawInput User-entered filename string
 * @param date Optional date for default fallback
 */
export function validatePdfFilename(rawInput: string, date: Date = new Date()): FilenameValidationResult {
  const defaultFilename = getDefaultPdfFilename(date);
  const defaultStem = defaultFilename.replace(TRAILING_PDF_EXT_REGEX, "");

  const hasInvalidChars = INVALID_FILENAME_CHARS_REGEX.test(rawInput);
  const hasDuplicateExt = /(?:\.pdf){2,}$/i.test(rawInput.trim());

  const sanitizedStem = sanitizePdfStem(rawInput);
  const isDefault = !sanitizedStem || sanitizedStem === defaultStem;
  const finalFilename = formatFinalPdfFilename(rawInput, date);

  return {
    isValid: true,
    sanitizedStem,
    finalFilename,
    isDefault,
    hasInvalidChars,
    hasDuplicateExt
  };
}
