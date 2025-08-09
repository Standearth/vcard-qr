// packages/shared-utils/src/vcard.ts

// Define a simple type for the data this function needs.
// This decouples it from the larger TabState or PassData types.
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

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${data.lastName || ''};${data.firstName || ''}`,
    `FN:${`${data.firstName || ''} ${data.lastName || ''}`.trim()}`,
    data.org ? `ORG:${data.org}` : '',
    data.title ? `TITLE:${data.title}` : '',
    data.email ? `EMAIL:${data.email}` : '',
    data.officePhone
      ? `TEL;TYPE=WORK,VOICE:${data.officePhone}${data.extension ? `;ext=${data.extension}` : ''}`
      : '',
    data.workPhone ? `TEL;TYPE=WORK,VOICE,MSG,PREF:${data.workPhone}` : '',
    data.cellPhone ? `TEL;TYPE=CELL:${data.cellPhone}` : '',
    data.website ? `URL:${data.website}` : '',
    data.linkedin ? `URL:${data.linkedin}` : '',
    data.notes ? `NOTE:${data.notes.replace(/\n/g, '\\n')}` : '',
    'END:VCARD',
  ];

  return lines.filter(Boolean).join(eol);
}
