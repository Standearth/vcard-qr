// src/services/google-wallet.service.ts
import { PassData } from '../types/index.js';
import { GoogleAuth, GoogleAuthOptions } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import { getTemplateForEmail } from '../config/google-wallet-templates.js';
import { v4 as uuidv4 } from 'uuid';
import {
  generateVCardString,
  generateWhatsAppLink,
} from '@vcard-qr/shared-utils';

// Helper to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generateGoogleWalletPass(
  data: PassData
): Promise<string> {
  let authOptions: GoogleAuthOptions;

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.GOOGLE_WALLET_SA_KEY) {
      throw new Error(
        'GOOGLE_WALLET_SA_KEY environment variable not set in production'
      );
    }
    authOptions = {
      credentials: JSON.parse(process.env.GOOGLE_WALLET_SA_KEY),
      scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
    };
  } else {
    const defaultKeyPath = path.join(
      __dirname,
      '../../certs/google-wallet-sa-key.json'
    );
    const keyFilePath = process.env.GOOGLE_WALLET_KEY_PATH || defaultKeyPath;
    authOptions = {
      keyFile: keyFilePath,
      scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
    };
  }

  const auth = new GoogleAuth(authOptions);
  const client = await auth.getClient();
  const credentials = await (client as any).getCredentials();
  const objectId = `${process.env.GOOGLE_ISSUER_ID}.${uuidv4()}`;
  const vCardString = generateVCardString(data, false);

  const template = getTemplateForEmail(data.email);

  const passObject: any = {
    id: objectId,
    classId: template.id,
    logo: template.logo,
    cardTitle: {
      defaultValue: {
        language: 'en-US',
        value: data.organization || 'Business Card',
      },
    },
    subheader: {
      defaultValue: {
        language: 'en-US',
        value: data.title || '',
      },
    },
    header: {
      defaultValue: {
        language: 'en-US',
        value: `${data.firstName} ${data.lastName}`.trim(),
      },
    },
    barcode: {
      type: 'QR_CODE',
      value: vCardString,
    },
    hexBackgroundColor: template.hexBackgroundColor,
    linksModuleData: {
      uris: [],
    },
    textModulesData: [
      {
        id: 'direct_line',
        header: 'Direct Line',
        body: data.workPhone,
      },
      {
        id: 'office_phone',
        header: 'Office Phone',
        body: data.extension
          ? `${data.officePhone} x${data.extension}`
          : data.officePhone,
      },
      {
        id: 'email',
        header: 'Email',
        body: data.email,
      },
      {
        id: 'cell_phone',
        header: 'Cell Phone',
        body: data.cellPhone,
      },
      {
        id: 'notes',
        header: 'Notes',
        body: data.notes,
      },
    ].filter((module) => module.body),
  };

  if (template.heroImage) {
    passObject.heroImage = template.heroImage;
  }

  if (data.website) {
    passObject.linksModuleData.uris.push({
      uri: data.website,
      description: 'Website',
      id: 'website',
    });
  }
  if (data.linkedin) {
    passObject.linksModuleData.uris.push({
      uri: data.linkedin,
      description: 'LinkedIn',
      id: 'linkedin',
    });
  }
  const whatsAppLink = generateWhatsAppLink(data.whatsapp);
  if (whatsAppLink) {
    passObject.linksModuleData.uris.push({
      uri: whatsAppLink,
      description: 'WhatsApp',
      id: 'whatsapp',
    });
  }

  const claims = {
    iss: credentials.client_email,
    aud: 'google',
    typ: 'savetowallet',
    payload: {
      genericClasses: [template.class],
      genericObjects: [passObject],
    },
  };

  const token = jwt.sign(claims, credentials.private_key, {
    algorithm: 'RS256',
  });

  return token;
}
