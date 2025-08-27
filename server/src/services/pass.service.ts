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
import {
  loadPassConfig,
  getTemplateForEmail,
} from '../config/pass-templates.js';

export async function generatePassBuffer(
  data: PassData,
  photoBuffer: Buffer | null
): Promise<Buffer> {
  const certs = await loadCertificates();
  const config = await loadPassConfig();
  const template = getTemplateForEmail(data.email, config);

  const passOptions = {
    passTypeIdentifier: template.passTypeIdentifier,
    teamIdentifier: template.teamIdentifier,
    organizationName:
      data.organization || template.organizationName || 'Organization',
    description:
      template.description ||
      (data.organization ? data.organization + ' Business Card' : false) ||
      'Business Card',
    serialNumber: Date.now().toString(),
    foregroundColor: template.foregroundColor,
    backgroundColor: template.backgroundColor,
    labelColor: template.labelColor,
  };

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const modelPath = path.join(__dirname, `../../models/${template.model}`);

  const pass = await PKPass.from(
    {
      model: modelPath,
      certificates: certs,
    },
    passOptions
  );

  // ... (rest of your field population logic remains the same)

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
    let officePhoneWithExt = formatPhoneNumber(data.officePhone, 'CUSTOM');
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

  if (data.signal) {
    pass.backFields.push({
      key: 'signal',
      label: 'Signal',
      value: data.signal,
    });
  }

  if (data.notes) {
    pass.backFields.push({
      key: 'notes',
      label: 'Notes',
      value: data.notes,
    });
  }

  if (photoBuffer) {
    pass.addBuffer('thumbnail.png', photoBuffer);
  }

  const vCardString = generateVCardString(data, true);

  pass.setBarcodes({
    message: vCardString,
    format: 'PKBarcodeFormatQR',
    messageEncoding: 'iso-8859-1',
  });

  return pass.getAsBuffer();
}
