import parsePhoneNumberFromString, {
  PhoneNumber,
  NumberFormat,
} from 'libphonenumber-js';

/**
 * Cleans and intelligently parses a phone number string based on common patterns.
 *
 * @param number The raw phone number string.
 * @returns A PhoneNumber object if parsing is successful, otherwise the cleaned string.
 */
function parsePhoneNumber(number?: string): PhoneNumber | string {
  if (!number) return '';

  // 1. Strip characters other than numbers and plus
  const cleaned = number.replace(/[^0-9+]/g, '');
  let phoneNumber: PhoneNumber | undefined;

  // 2. Check for North American numbers (10, 11, or 12 digits)
  let potentialNANPNumber: string | undefined;
  if (cleaned.startsWith('+1') && cleaned.length === 12) {
    potentialNANPNumber = cleaned.substring(2);
  } else if (cleaned.startsWith('1') && cleaned.length === 11) {
    potentialNANPNumber = cleaned.substring(1);
  } else if (cleaned.length === 10) {
    potentialNANPNumber = cleaned;
  }

  // 2.1, 2.2, 2.3. If it matches a NANP structure, parse it with a "US" hint
  if (potentialNANPNumber && !['0', '1'].includes(potentialNANPNumber[0])) {
    phoneNumber = parsePhoneNumberFromString(cleaned, 'US');
  }
  // 4. Check for UK-like numbers (11 digits, starts with 0)
  else if (cleaned.startsWith('0') && cleaned.length === 11) {
    phoneNumber = parsePhoneNumberFromString(cleaned, 'GB');
  }
  // 5. Fallback for all other numbers (including other international formats)
  else {
    phoneNumber = parsePhoneNumberFromString(cleaned);
  }

  // 6. Return the parsed object or the cleaned number if parsing fails
  return phoneNumber || cleaned;
}

/**
 * Formats a phone number for display or data using a specific format.
 *
 * @param number The raw phone number string.
 * @param format The desired output format (e.g., 'E.164', 'NATIONAL', 'CUSTOM').
 * @returns The formatted phone number string.
 */
export function formatPhoneNumber(
  number?: string,
  format: NumberFormat | 'CUSTOM' = 'E.164'
): string {
  const result = parsePhoneNumber(number);

  if (typeof result === 'string') {
    return result;
  }

  if (format === 'CUSTOM') {
    // For North American numbers, return the simple national format
    if (result.country === 'US' || result.country === 'CA') {
      return result.format('NATIONAL');
    }
    // For UK numbers, format as +44 (0)7...
    if (result.country === 'GB') {
      const national = result.format('NATIONAL');
      if (national.startsWith('0')) {
        return `+${result.countryCallingCode} (0)${national.substring(1)}`;
      }
    }
    // For all other countries, return a formatted international number
    return `+${result.countryCallingCode} ${result.formatNational()}`;
  }

  return result.format(format);
}
