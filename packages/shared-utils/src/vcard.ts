// packages/shared-utils/src/vcard.ts
import { formatPhoneNumber, generateWhatsAppLink } from './phone.js';

// Define a simple type for the data this function needs.
interface VCardData {
  firstName?: string;
  lastName?: string;
  org?: string;
  title?: string;
  email?: string;
  officePhone?: string;
  extension?: string;
  workPhone?: string;
  cellPhone?: string;
  website?: string;
  linkedin?: string;
  whatsapp?: string;
  signal?: string;
  notes?: string;
}

/**
 * Generates a vCard string (VCF format).
 * @param data The contact information.
 * @param useCRLF Determines the line ending type (\r\n for Wallet, \n for QR codes).
 * @returns A formatted vCard string.
 */
export function generateVCardString(data: VCardData, useCRLF = false): string {
  const eol = useCRLF ? '\r\n' : '\n';

  const whatsAppLink = generateWhatsAppLink(data.whatsapp);

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${data.lastName || ''};${data.firstName || ''}`,
    `FN:${`${data.firstName || ''} ${data.lastName || ''}`.trim()}`,
    data.org ? `ORG:${data.org}` : '',
    data.title ? `TITLE:${data.title}` : '',
    data.email ? `EMAIL:${data.email}` : '',
    data.officePhone
      ? `TEL;TYPE=office,VOICE:${formatPhoneNumber(data.officePhone)}${data.extension ? `;ext${data.extension}` : ''}`
      : '',
    data.workPhone
      ? `TEL;TYPE=work,PREF,VOICE,MSG:${formatPhoneNumber(data.workPhone)}`
      : '',
    data.cellPhone
      ? `TEL;TYPE=cell,VOICE,MSG:${formatPhoneNumber(data.cellPhone)}`
      : '',
    data.website ? `URL;TYPE=Website:${data.website}` : '',
    data.linkedin ? `URL;TYPE=LinkedIn:${data.linkedin}` : '',
    whatsAppLink ? `URL;TYPE=WhatsApp:${whatsAppLink}` : '',
    data.signal ? `URL;TYPE=Signal:${data.signal}` : '',
    data.notes ? `NOTE:${data.notes.replace(/\n/g, '\\n')}` : '',
    'END:VCARD',
  ];

  return lines.filter(Boolean).join(eol);
}