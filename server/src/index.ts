import express, { Request, Response } from 'express';
import { PKPass } from 'passkit-generator';
import fs from 'fs/promises';
import path from 'path';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;

// Create a client for the Secret Manager
const secretManagerClient = new SecretManagerServiceClient();

interface VCardData {
  firstName?: string;
  lastName?: string;
  org?: string;
  title?: string;
  email?: string;
  officePhone?: string;
  extension?: string;
  workPhone?: string;
  cellPhone?: string;
  website?: string;
  linkedin?: string;
  notes?: string;
}

async function startServer() {
  // Helper function to fetch secrets
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

  // Fetch all secrets concurrently for faster startup
  const [signerKey, signerCert, wwdrCert] = await Promise.all([
    getSecret('SIGNER_KEY_SECRET'),
    getSecret('SIGNER_CERT_SECRET'),
    getSecret('WWDR_CERT_SECRET'),
  ]);

  const certs = {
    wwdr: wwdrCert,
    signerCert: signerCert,
    signerKey: signerKey,
  };

  app.post('/api/create-pass', async (req: Request, res: Response) => {
    try {
      const passTemplatePath = path.join(__dirname, '../models/pass.pass');
      const {
        firstName = '',
        lastName = '',
        org = 'Stand.earth',
        title = '',
        email = '',
        officePhone = '',
        extension = '',
        workPhone = '',
        cellPhone = '',
        website = '',
        linkedin = '',
        notes = '',
      }: VCardData = req.body;

      const pass = await PKPass.from(
        {
          model: passTemplatePath,
          certificates: certs,
        },
        {
          serialNumber: `sn-${Date.now()}`,
          description: 'Stand.earth vCard',
          organizationName: org,
        }
      );

      pass.primaryFields[0].value = `${firstName} ${lastName}`.trim();
      pass.secondaryFields[0].value =
        officePhone + (extension ? ` x${extension}` : '');
      pass.auxiliaryFields[0].value = email;
      pass.backFields[0].value = org;
      pass.backFields[1].value = title;
      pass.backFields[2].value = workPhone;
      pass.backFields[3].value = cellPhone;
      pass.backFields[4].value = website;
      pass.backFields[5].value = linkedin;
      pass.backFields[6].value = notes;

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
