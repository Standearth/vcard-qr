// src/services/google-wallet.service.ts
import { PassData } from '../types/index.js';
import { GoogleAuth, GoogleAuthOptions } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import { googleWalletPassClass as passClass } from '../config/google-wallet-templates.js';

// Helper to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This function will be called by the API route
export async function generateGoogleWalletPass(
  data: PassData
): Promise<string> {
  let authOptions: GoogleAuthOptions;

  if (process.env.NODE_ENV === 'production') {
    // In production, use the credentials from the environment variable
    if (!process.env.GOOGLE_WALLET_CREDENTIALS) {
      throw new Error('GOOGLE_WALLET_CREDENTIALS environment variable not set in production');
    }
    authOptions = {
      credentials: JSON.parse(process.env.GOOGLE_WALLET_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
    };
  } else {
    // In local development, use a key file. The path can be overridden by an environment variable.
    const defaultKeyPath = path.join(__dirname, '../../certs/google-wallet-sa-key.json');
    const keyFilePath = process.env.GOOGLE_WALLET_KEY_PATH || defaultKeyPath;
    authOptions = {
      keyFile: keyFilePath,
      scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
    };
  }

  const auth = new GoogleAuth(authOptions);

  const client = await auth.getClient();
  const credentials = await (client as any).getCredentials();

  // Define the pass object with the user's data.
  const passObject = {
    id: `${process.env.GOOGLE_ISSUER_ID}.${data.firstName}-${data.lastName}`,
    classId: passClass.id,
    genericType: 'GENERIC_TYPE_UNSPECIFIED',
    hexBackgroundColor: '#4285f4',
    logo: {
      sourceUri: {
        uri: 'https://storage.googleapis.com/wallet-lab-tools-codelab-artifacts-public/pass_google_logo.jpg',
      },
    },
    cardTitle: {
      defaultValue: {
        language: 'en',
        value: 'vCard',
      },
    },
    subheader: {
      defaultValue: {
        language: 'en',
        value: 'Digital Business Card',
      },
    },
    header: {
      defaultValue: {
        language: 'en',
        value: `${data.firstName} ${data.lastName}`,
      },
    },
    textModulesData: [
      {
        id: 'title',
        header: 'Title',
        body: data.title,
      },
      {
        id: 'email',
        header: 'Email',
        body: data.email,
      },
      {
        id: 'phone',
        header: 'Phone',
        body: data.phone,
      },
    ],
  };

  const claims = {
    iss: credentials.client_email,
    aud: 'google',
    typ: 'savetowallet',
    payload: {
      genericObjects: [passObject],
    },
  };

  // The final JWT will be created by signing the pass object
  const token = jwt.sign(claims, credentials.private_key, {
    algorithm: 'RS256',
  });

  return token;
}

