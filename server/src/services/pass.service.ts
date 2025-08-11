// src/services/pass.service.ts
import { PKPass } from 'passkit-generator';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadCertificates } from '../config/certificates.js';
import { PassData } from '../types/index.js';
import {
  generateVCardString,
  formatPhoneNumber,
  generateWhatsAppLink,
} from '@vcard-qr/shared-utils';

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
    foregroundColor: process.env.PASS_FOREGROUND || 'rgba(159, 51, 69, 1)',
    backgroundColor: process.env.PASS_BACKGROUND || 'rgb(245, 244, 237)',
    labelColor: process.env.PASS_LABEL || 'rgb(16, 16, 18)',
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
  if (data.firstName || data.lastName) {
    pass.primaryFields.push({
      key: 'name',
      value: `${data.firstName} ${data.lastName}`.trim(),
    });
  }

  if (data.title) {
    pass.headerFields.push({
      key: 'title',
      value: data.title,
    });
  }

  // Secondary Fields (Direct Line & Office Phone)
  if (data.workPhone) {
    pass.secondaryFields.push({
      key: 'work_phone',
      label: 'Direct Line',
      value: formatPhoneNumber(data.workPhone, 'CUSTOM'),
    });
  }

  if (data.officePhone) {
    var officePhoneWithExt = formatPhoneNumber(data.officePhone, 'CUSTOM');
    if (data.extension) {
      officePhoneWithExt += ` x${data.extension}`;
    }
    pass.secondaryFields.push({
      key: 'office_phone',
      label: 'Office Phone',
      value: officePhoneWithExt,
    });
  }

  // Auxiliary Fields (Email and Cell)
  if (data.email) {
    pass.auxiliaryFields.push({
      key: 'email',
      label: 'Email',
      value: data.email,
    });
  }

  if (data.cellPhone) {
    pass.auxiliaryFields.push({
      key: 'cell_phone',
      label: 'Cell Phone',
      value: formatPhoneNumber(data.cellPhone, 'CUSTOM'),
    });
  }

  // Back Fields (Links and Notes)
  if (data.organization) {
    pass.backFields.push({
      key: 'organization',
      label: 'Organization',
      value: data.organization,
    });
  }

  if (data.website) {
    pass.backFields.push({
      key: 'website',
      label: 'Website',
      value: data.website,
    });
  }

  if (data.linkedin) {
    pass.backFields.push({
      key: 'linkedin',
      label: 'LinkedIn',
      value: data.linkedin,
    });
  }

  if (data.whatsapp) {
    pass.backFields.push({
      key: 'whatsapp',
      label: 'WhatsApp',
      value: generateWhatsAppLink(data.whatsapp),
    });
  }

  if (data.notes) {
    pass.backFields.push({
      key: 'notes',
      label: 'Notes',
      value: data.notes,
    });
  }

  // Add the photo to the pass if it exists
  if (photoBuffer) {
    pass.addBuffer('thumbnail.png', photoBuffer);
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
