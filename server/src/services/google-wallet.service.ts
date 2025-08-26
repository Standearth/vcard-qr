// src/services/google-wallet.service.ts
import { PassData } from '../types/index.js';
import { GoogleAuth, GoogleAuthOptions } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import { googleWalletPassClass as passClass } from '../config/google-wallet-templates.js';
import { v4 as uuidv4 } from 'uuid';
import { generateVCardString } from '@vcard-qr/shared-utils'; // Import vCard generator

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

  // Use the utility to generate a vCard string for the QR code
  const vCardString = generateVCardString(data, false);

  // Define the new pass object structure based on the Pass Builder output
  const passObject = {
    id: objectId,
    classId: passClass.id,
    logo: {
      sourceUri: {
        uri: 'https://qr.stand.earth/Stand-Logo-google-wallet-logo.png',
      },
      contentDescription: {
        defaultValue: {
          language: 'en-US',
          value: 'Stand.earth Logo',
        },
      },
    },
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
    // The barcode now contains the full vCard data
    barcode: {
      type: 'QR_CODE',
      value: vCardString,
      alternateText: `vCard for ${data.firstName} ${data.lastName}`.trim(),
    },
    hexBackgroundColor: '#f5f1ea', // Stand.earth brand color
    heroImage: {
      sourceUri: {
        uri: 'https://qr.stand.earth/Stand-Logo-google-wallet-hero.png',
      },
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
    ].filter((module) => module.body), // This will remove any empty fields
  };

  const claims = {
    iss: credentials.client_email,
    aud: 'google',
    typ: 'savetowallet',
    payload: {
      genericClasses: [passClass],
      genericObjects: [passObject],
    },
  };

  if (process.env.NODE_ENV !== 'production') {
    console.log('--- Google Wallet Local Debug ---');
    console.log('Service Account Email:', credentials.client_email);
    console.log('Pass Class ID:', passClass.id);
    console.log('Full Pass Object:', JSON.stringify(passObject, null, 2));
    console.log('JWT Claims Payload:', JSON.stringify(claims, null, 2));
    console.log('---------------------------------');
  }

  const token = jwt.sign(claims, credentials.private_key, {
    algorithm: 'RS256',
  });

  return token;
}
