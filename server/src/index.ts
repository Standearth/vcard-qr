import express, { Request, Response } from 'express';
import { PKPass } from 'passkit-generator';
import path from 'path';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import fs from 'fs';

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

async function loadCertificates(): Promise<Certs> {
  const certsDir = path.join(__dirname, '../certs');
  const keyPath = path.join(certsDir, SIGNER_KEY_FILE);
  const certPath = path.join(certsDir, SIGNER_CERT_FILE);
  const wwdrPath = path.join(certsDir, WWDR_CERT_FILE);

  let signerKey: string;
  let signerCert: string;
  let wwdr: string;

  try {
    // Attempt to fetch all secrets from Secret Manager first
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

    // Fallback to local files if Secret Manager fails for any cert
    if (
      fs.existsSync(keyPath) &&
      fs.existsSync(certPath) &&
      fs.existsSync(wwdrPath)
    ) {
      console.log('Loading certificates from local files...');
      signerKey = fs.readFileSync(keyPath, 'utf8');
      signerCert = fs.readFileSync(certPath, 'utf8');
      wwdr = fs.readFileSync(wwdrPath, 'utf8');
    } else {
      throw new Error(
        'Neither Secret Manager nor local files could provide all necessary certificates.'
      );
    }
  }

  return {
    wwdr,
    signerCert,
    signerKey,
  };
}

async function startServer() {
  const certs = await loadCertificates();

  app.post('/api/create-pass', async (req: Request, res: Response) => {
    try {
      const passTemplatePath = path.join(__dirname, '../models/pass.pass');
      const { vcard, anniversaryLogo }: VCardData = req.body;

      const pass = await PKPass.from(
        {
          model: passTemplatePath,
          certificates: certs,
        },
        {
          serialNumber: `sn-${Date.now()}`,
          description: 'Stand.earth vCard',
          organizationName: 'Stand.earth',
          logoText: 'Stand.earth',
          backgroundColor: 'rgb(245, 244, 237)',
          foregroundColor: 'rgb(16, 16, 18)',
          labelColor: 'rgb(16, 16, 18)',
          // IMPORTANT: Replace with your actual Apple Developer Team Identifier
          teamIdentifier: 'YOUR_TEAM_IDENTIFIER',
        }
      );

      pass.setBarcodes({
        format: 'PKBarcodeFormatQR',
        message: vcard,
        messageEncoding: 'iso-8859-1',
      });

      const passBuffer = pass.getAsBuffer();

      res.set('Content-Type', 'application/vnd.apple.pkpass');
      res.status(200).send(passBuffer);
    } catch (error) {
      console.error(error);
      res.status(500).send('Error generating pass.');
    }
  });

  app.get('/', (req: Request, res: Response) => {
    res.send('Hello from the vCard QR code server!');
  });

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

startServer();
