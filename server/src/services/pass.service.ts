// src/services/pass.service.ts

import { PKPass } from 'passkit-generator';
import { loadCertificates } from '../config/certificates.js';
import { PassData } from '../types/index.js';
import { generateVCardString } from '@vcard-qr/shared-utils';

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
      // Dynamically override the critical identifiers
      passTypeIdentifier: process.env.PASS_TYPE_ID || 'pass.com.example.vcard',
      teamIdentifier: process.env.PASS_TEAM_ID || 'A1B2C3D4E5',
      organizationName: process.env.VITE_ORG_NAME || 'Example Organization',
      description: process.env.PASS_DESCRIPTION || 'Example Business Card',
      serialNumber: Date.now().toString(),
    }
  );

  // --- Populate Pass Fields ---

  // Primary Field (Name & Title)
  pass.primaryFields.push({
    key: 'name',
    value: `${data.firstName} ${data.lastName},\n${data.title}`,
  });

  // Secondary Fields (Direct Line & Office Phone)
  pass.secondaryFields.push({
    key: 'work_phone',
    label: 'Direct Line',
    value: data.workPhone || '',
  });

  pass.secondaryFields.push({
    key: 'office_phone',
    label: 'Office Phone',
    value: data.officePhone + ' x' + data.extension || '',
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
      value: data.website || '',
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
  const vCardString = generateVCardString(data, true);

  pass.setBarcodes({
    message: vCardString,
    format: 'PKBarcodeFormatQR',
    messageEncoding: 'iso-8859-1',
  });

  // Return the final pass as a buffer
  return pass.getAsBuffer();
}
