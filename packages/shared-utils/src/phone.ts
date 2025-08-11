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

  // Strip characters other than numbers and plus
  const cleaned = number.replace(/[^0-9+]/g, '');
  let phoneNumber: PhoneNumber | undefined;

  // Check for North American numbers
  let potentialNANPNumber: string | undefined;
  if (cleaned.startsWith('+1') && cleaned.length === 12) {
    potentialNANPNumber = cleaned.substring(2);
  } else if (cleaned.startsWith('1') && cleaned.length === 11) {
    potentialNANPNumber = cleaned.substring(1);
  } else if (cleaned.length === 10) {
    potentialNANPNumber = cleaned;
  }

  // If it matches a NANP structure, parse it with a "US" hint
  // A valid 10-digit NANP number does not start with 0 or 1.
  if (potentialNANPNumber && !['0', '1'].includes(potentialNANPNumber[0])) {
    phoneNumber = parsePhoneNumberFromString(cleaned, 'US');
  }
  // Check for UK-like numbers (11 digits, starts with 0)
  else if (cleaned.startsWith('0') && cleaned.length === 11) {
    phoneNumber = parsePhoneNumberFromString(cleaned, 'GB');
  }
  // Fallback for all other numbers (including other international formats)
  else {
    phoneNumber = parsePhoneNumberFromString(cleaned);
  }

  // Return the parsed object or the cleaned number if parsing fails
  console.log('Parsed phone number:', phoneNumber);
  return phoneNumber || cleaned;
}

/**
 * Formats a phone number for display or data using a specific format.
 *
 * @param number The raw phone number string.
 * @param format The desired output format (e.g., 'E.164', 'NATIONAL').
 * @returns The formatted phone number string.
 */
export function formatPhoneNumber(
  number?: string,
  format: NumberFormat = 'E.164'
): string {
  const result = parsePhoneNumber(number);

  // If the result is a string, it means parsing failed, so return the cleaned input
  if (typeof result === 'string') {
    return result;
  }

  // Otherwise, return the number in the requested format
  return result.format(format);
}
