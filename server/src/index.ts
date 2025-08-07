import express, { Request, Response } from 'express';
import { PKPass } from 'passkit-generator';
import fs from 'fs/promises';
import path from 'path';

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;

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
  const certs = {
    wwdr: await fs.readFile(path.join(__dirname, '../certs/signerCert.pem')),
    signerCert: await fs.readFile(
      path.join(__dirname, '../certs/signerCert.pem')
    ),
    signerKey: await fs.readFile(
      path.join(__dirname, '../certs/signerKey.pem')
    ),
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

      // Correct: Use the 'props' getter for reliable logging
      console.log('Generated pass data:', JSON.stringify(pass.props, null, 2));

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
