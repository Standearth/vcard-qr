// src/services/pass.service.ts
import { PKPass } from 'passkit-generator';
import path from 'path';
import { fileURLToPath } from 'url';
import parsePhoneNumberFromString from 'libphonenumber-js';
import { loadCertificates } from '../config/certificates.js';
import { PassData } from '../types/index.js';
import { generateVCardString, formatPhoneNumber } from '@vcard-qr/shared-utils';

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

  // Define pass options with fallbacks for the new environment variables
  const passOptions = {
    passTypeIdentifier: process.env.PASS_TYPE_ID || 'pass.com.example.vcard',
    teamIdentifier: process.env.PASS_TEAM_ID || 'A1B2C3D4E5',
    organizationName: process.env.VITE_ORG_NAME || 'Example Organization',
    description: process.env.PASS_DESCRIPTION || 'Example Business Card',
    serialNumber: Date.now().toString(),
    fappearance: {
      styles: {
        light: {
          foregroundColor: process.env.PASS_FOREGROUND || 'rgb(16, 16, 18)',
          backgroundColor: process.env.PASS_BACKGROUND || 'rgb(245, 244, 237)',
          labelColor: process.env.PASS_LABEL || 'rgb(16, 16, 18)',
        },
        dark: {
          foregroundColor:
            process.env.PASS_DARK_FOREGROUND || 'rgb(245, 244, 237)',
          backgroundColor:
            process.env.PASS_DARK_BACKGROUND || 'rgb(29, 29, 31)',
          labelColor: process.env.PASS_DARK_LABEL || 'rgb(245, 244, 237)',
        },
      },
    },
  };

  // Get the directory of the current module
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  // Construct an absolute path to the model directory
  const modelPath = path.join(__dirname, '../../models/vcard');

  // Create the pass from the template model.
  const pass = await PKPass.from(
    {
      model: modelPath,
      certificates: certs,
    },
    passOptions
  );

  // --- Populate Pass Fields ---

  // Primary Field (Name & Title)
  pass.primaryFields.push({
    key: 'name',
    value: `${data.firstName} ${data.lastName}`,
  });

  pass.headerFields.push({
    key: 'title',
    value: `${data.title}`,
  });

  // Primary Field (Name & Title)
  pass.primaryFields.push({
    key: 'name',
    value: `${data.firstName} ${data.lastName},\n${data.title}`,
  });

  // Secondary Fields (Direct Line & Office Phone)
  pass.secondaryFields.push({
    key: 'work_phone',
    label: 'Direct Line',
    value: formatPhoneNumber(data.workPhone, 'CUSTOM'),
  });

  pass.secondaryFields.push({
    key: 'office_phone',
    label: 'Office Phone',
    value: data.officePhone
      ? `${formatPhoneNumber(data.officePhone, 'CUSTOM')} x${data.extension}`
      : '',
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
      value: formatPhoneNumber(data.cellPhone, 'CUSTOM'),
    }
  );

  // Back Fields (Links and Notes)
  pass.backFields.push(
    {
      key: 'organization',
      label: 'Organization',
      value: `${data.organization}`,
    },
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
