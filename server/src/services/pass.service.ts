// src/services/pass.service.ts

import { PKPass } from 'passkit-generator';
import { loadCertificates } from '../config/certificates';
import { PassData } from '../types';
import { generateVCardString } from '../../../packages/shared-utils/src/vcard';

/**
 * Generates a .pkpass file buffer from user data and an optional photo.
 * This service encapsulates all logic for creating and populating the pass.
 * @param data The user information for the pass.
 * @param photoBuffer A buffer containing the user's photo, or null.
 * @returns A promise that resolves with the generated .pkpass file as a Buffer.
 */
export async function generatePassBuffer(
  data: PassData,
  photoBuffer: Buffer | null
): Promise<Buffer> {
  // Load necessary certificates from the config module
  const certs = await loadCertificates();

  // Create the pass from the template model.
  // The model path is relative to the project root where the script is executed.
  const pass = await PKPass.from(
    {
      model: 'models/vcard',
      certificates: certs,
    },
    {
      serialNumber: Date.now().toString(),
    }
  );

  // --- Populate Pass Fields ---

  // Primary Field (Name and Title)
  pass.primaryFields.push({
    key: 'name',
    value: `${data.firstName} ${data.lastName}\n${data.title}`,
  });

  // Secondary Field (Work Phone)
  pass.secondaryFields.push({
    key: 'work_phone',
    label: 'Direct Line',
    value: data.workPhone || '',
  });

  // Auxiliary Fields (Email and Cell)
  pass.auxiliaryFields.push(
    {
      key: 'email',
      label: 'Email',
      value: data.email || '',
    },
    {
      key: 'cell_phone',
      label: 'Cell Phone',
      value: data.cellPhone || '',
    }
  );

  // Back Fields (Links and Notes)
  pass.backFields.push(
    {
      key: 'website',
      label: 'Website',
      value: data.website || 'https://stand.earth',
    },
    {
      key: 'linkedin',
      label: 'LinkedIn',
      value: data.linkedin || '',
    },
    {
      key: 'notes',
      label: 'Notes',
      value: data.notes || '',
    }
  );

  // Add the photo to the pass if it exists
  if (photoBuffer) {
    console.log('Photo found, adding thumbnail.png to pass.');
    pass.addBuffer('thumbnail.png', photoBuffer);
  } else {
    console.log('No photo found, pass will not have a thumbnail.');
  }

  // --- Build and set the QR code ---
  // The vCard string is constructed to be embedded in the QR code.
  let vCardString = `BEGIN:VCARD\r\nVERSION:3.0\r\n`;
  vCardString += `N:${data.lastName};${data.firstName}\r\n`;
  vCardString += `FN:${data.firstName} ${data.lastName}\r\n`;
  vCardString += `ORG:${data.organization}\r\n`;
  vCardString += `TITLE:${data.title}\r\n`;
  if (data.email) vCardString += `EMAIL:${data.email}\r\n`;
  // highlight-start
  // Add the office phone with extension
  if (data.officePhone)
    vCardString += `TEL;TYPE=WORK,VOICE:${data.officePhone}${data.extension ? `;ext=${data.extension}` : ''}\r\n`;
  // highlight-end
  if (data.workPhone)
    vCardString += `TEL;TYPE=WORK,VOICE:${data.workPhone}\r\n`;

  pass.setBarcodes({
    message: vCardString,
    format: 'PKBarcodeFormatQR',
    messageEncoding: 'iso-8859-1',
  });

  // Return the final pass as a buffer
  return pass.getAsBuffer();
}
