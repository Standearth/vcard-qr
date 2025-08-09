// src/config/certificates.ts
import path from 'path';
import { promises as fs } from 'fs';
import { Certs } from '../types/index.js';

export async function loadCertificates(): Promise<Certs> {
  const certsDir = path.join(__dirname, '../../certs');
  return {
    wwdr: await fs.readFile(path.join(certsDir, 'AppleWWDRCAG4.pem')),
    signerCert: await fs.readFile(path.join(certsDir, 'Stand-PassKit.pem')),
    signerKey: await fs.readFile(path.join(certsDir, 'Stand-PassKit.key')),
  };
}
