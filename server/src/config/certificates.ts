// server/src/config/certificates.ts
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { Certs } from '../types/index.js';

// Helper function to fetch the latest version of a secret
async function fetchSecret(
  client: SecretManagerServiceClient,
  secretName: string
): Promise<Buffer> {
  try {
    const [version] = await client.accessSecretVersion({ name: secretName });
    if (!version.payload?.data) {
      throw new Error(`Secret ${secretName} has no payload.`);
    }
    return Buffer.from(version.payload.data);
  } catch (error) {
    console.error(`Failed to fetch secret: ${secretName}`, error);
    throw error;
  }
}

export async function loadCertificates(): Promise<Certs> {
  // Production: Fetch secrets from Google Secret Manager
  if (process.env.NODE_ENV === 'production') {
    const client = new SecretManagerServiceClient();
    const wwdrSecret =
      process.env.WWDR_CERT_SECRET ||
      'projects/project/secrets/secret/versions/latest';
    const signerCertSecret =
      process.env.SIGNER_CERT_SECRET ||
      'projects/project/secrets/secret/versions/latest';
    const signerKeySecret =
      process.env.SIGNER_KEY_SECRET ||
      'projects/project/secrets/secret/versions/latest';

    return {
      wwdr: await fetchSecret(client, wwdrSecret),
      signerCert: await fetchSecret(client, signerCertSecret),
      signerKey: await fetchSecret(client, signerKeySecret),
    };
  }

  // Development: Read secrets from the local filesystem
  else {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const certsDir = path.join(__dirname, '../../certs');

    return {
      wwdr: await fs.readFile(
        path.join(certsDir, process.env.CERT_WWDR || 'AppleWWDRCAG4.pem')
      ),
      signerCert: await fs.readFile(
        path.join(certsDir, process.env.CERT_SIGNER_CERT || 'signerCert.pem')
      ),
      signerKey: await fs.readFile(
        path.join(certsDir, process.env.CERT_SIGNER_KEY || 'signerKey.key')
      ),
    };
  }
}
