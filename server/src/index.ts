import express, { Request, Response } from 'express';
import { PKPass } from 'passkit-generator';
import path from 'path';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { promises as fs } from 'fs';
// You'll also need the synchronous methods for your cert loading fallback
import { existsSync, readFileSync } from 'fs';
import { findPersonAndPhoto } from './photoLookup';

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;

// Create a client for the Secret Manager
const secretManagerClient = new SecretManagerServiceClient();

interface VCardData {
  vcard: string;
  anniversaryLogo: boolean;
}

interface Certs {
  wwdr: string;
  signerCert: string;
  signerKey: string;
}

// Certificate filenames
const SIGNER_KEY_FILE = 'Stand-PassKit.key';
const SIGNER_CERT_FILE = 'Stand-PassKit.pem';
const WWDR_CERT_FILE = 'AppleWWDRCAG4.pem';

// Helper function to fetch secrets from Secret Manager
async function getSecret(secretEnvVar: string): Promise<string> {
  const secretResourceName = process.env[secretEnvVar];
  if (!secretResourceName) {
    throw new Error(`Environment variable ${secretEnvVar} is not set.`);
  }
  const [version] = await secretManagerClient.accessSecretVersion({
    name: secretResourceName,
  });
  const payload = version.payload?.data?.toString();
  if (!payload) {
    throw new Error(`Secret payload for ${secretEnvVar} is empty.`);
  }
  return payload;
}

// Corrected certificate loading function
async function loadCertificates(): Promise<Certs> {
  const certsDir = path.join(__dirname, '../certs');
  const keyPath = path.join(certsDir, SIGNER_KEY_FILE);
  const certPath = path.join(certsDir, SIGNER_CERT_FILE);
  const wwdrPath = path.join(certsDir, WWDR_CERT_FILE);

  let signerKey: string;
  let signerCert: string;
  let wwdr: string;

  try {
    [signerKey, signerCert, wwdr] = await Promise.all([
      getSecret('SIGNER_KEY_SECRET'),
      getSecret('SIGNER_CERT_SECRET'),
      getSecret('WWDR_CERT_SECRET'),
    ]);
    console.log('Certificates loaded from Secret Manager.');
  } catch (secretError) {
    console.warn(
      'Could not load certificates from Secret Manager. Attempting to load from local files...',
      secretError
    );

    // Use the specific synchronous imports here
    if (existsSync(keyPath) && existsSync(certPath) && existsSync(wwdrPath)) {
      console.log('Loading certificates from local files...');
      signerKey = readFileSync(keyPath, 'utf8');
      signerCert = readFileSync(certPath, 'utf8');
      wwdr = readFileSync(wwdrPath, 'utf8');
    } else {
      throw new Error(
        'Neither Secret Manager nor local files could provide all necessary certificates.'
      );
    }
  }

  return { wwdr, signerCert, signerKey };
}

async function startServer() {
  app.post('/vcard', async (req: Request, res: Response) => {
    try {
      const passTemplatePath = path.join(__dirname, '../models/pass.pass');
      const { vcard }: VCardData = req.body;

      let firstName = '';
      let lastName = '';

      const fnMatch = vcard.match(/^FN:(.*)$/m);
      const nMatch = vcard.match(/^N:(.*)$/m);

      if (nMatch && nMatch[1]) {
        const nParts = nMatch[1].split(';');
        lastName = nParts[0].trim();
        firstName = nParts[1].trim();
      } else if (fnMatch && fnMatch[1]) {
        const fnParts = fnMatch[1].trim().split(' ');
        firstName = fnParts[0];
        lastName = fnParts.slice(1).join(' ');
      }

      if (!firstName && !lastName) {
        firstName = 'contact';
        lastName = 'vcard';
      }

      const sanitizeFileName = (name: string): string => {
        return name.replace(/[^a-z0-9-_\s]/gi, '_').replace(/\s+/g, '-');
      };

      const fullName = [firstName, lastName].filter(Boolean).join(' ');
      const fileName = sanitizeFileName(`${fullName} vCard`) + '.pkpass';

      const pass = await createPass();

      const passBuffer = pass.getAsBuffer();

      res.set('Content-Type', 'application/vnd.apple.pkpass');
      res.set('Content-Disposition', `attachment; filename="${fileName}"`);
      res.status(200).send(passBuffer);
    } catch (error) {
      console.error(error);
      res.status(500).send('Error generating pass.');
    }
  });

  app.get('/', (req: Request, res: Response) => {
    res.redirect('https://stand.earth');
  });

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

async function createPass() {
  const certs = await loadCertificates();

  const pass = await PKPass.from(
    {
      model: 'models/vcard',
      certificates: certs,
    },
    { serialNumber: Date.now().toString() }
  );

  pass.setBarcodes({
    format: 'PKBarcodeFormatQR',
    message:
      'BEGIN:VCARD\r\nVERSION:3.0\r\nN:Carroll;Matthew\r\nFN:Matthew Carroll\r\nORG:Stand.earth\r\nTITLE:Senior IT Manager\r\nEMAIL:matthew.carroll@stand.earth\r\nTEL;TYPE=WORK,VOICE:+16043316201;x=209\r\nTEL;TYPE=WORK,VOICE,MSG,PREF:+14155323811\r\nTEL;TYPE=CELL:+12505091026\r\nURL:https://stand.earth\r\nURL:https://www.linkedin.com/in/matthewfcarroll/\r\nNOTE:Test notes\r\nEND:VCARD',
  });

  return pass;
}

async function main() {
  const nameToFind = 'Gisela Hurtado';
  console.log(`Searching for: ${nameToFind}...`);

  // Call the function with the debug flag set to true
  const result = await findPersonAndPhoto(nameToFind);

  if (result.match) {
    console.log(`✅ Match found!`);
    console.log(`Name on page: ${result.name}`);

    // This will save the final photo from the function's return object
    const outputPath = './matched_photo.png';
    await fs.writeFile(outputPath, result.photo);
    console.log(`Photo saved to ${outputPath}`);
  } else {
    console.log(`❌ No match found for "${nameToFind}".`);
  }
}

main();

main();

startServer();
