// src/config/certificates.ts
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { Certs } from '../types/index.js';

// Define default filenames
const DEFAULT_WWDR_CERT = 'AppleWWDRCAG4.pem';
const DEFAULT_SIGNER_CERT = 'signerCert.pem';
const DEFAULT_SIGNER_KEY = 'signerKey.key';

export async function loadCertificates(): Promise<Certs> {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const certsDir = path.join(__dirname, '../../certs');

  return {
    wwdr: await fs.readFile(
      path.join(certsDir, process.env.CERT_WWDR || DEFAULT_WWDR_CERT)
    ),
    signerCert: await fs.readFile(
      path.join(certsDir, process.env.CERT_SIGNER_CERT || DEFAULT_SIGNER_CERT)
    ),
    signerKey: await fs.readFile(
      path.join(certsDir, process.env.CERT_SIGNER_KEY || DEFAULT_SIGNER_KEY)
    ),
  };
}
