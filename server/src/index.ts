// server/index.ts

import express, { Request, Response } from 'express';
import { PKPass } from 'passkit-generator';
import path from 'path';
import { promises as fs } from 'fs';
import { findPersonAndPhoto } from './photoLookup';

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;

// Interface for structured pass data from the frontend
interface PassData {
  firstName: string;
  lastName: string;
  organization: string;
  title: string;
  email?: string;
  workPhone?: string;
  cellPhone?: string;
  website?: string;
  linkedin?: string;
  notes?: string;
  anniversaryLogo: boolean;
}

// Certificate Loading
interface Certs {
  wwdr: Buffer;
  signerCert: Buffer;
  signerKey: Buffer;
}
async function loadCertificates(): Promise<Certs> {
  const certsDir = path.join(__dirname, '../certs');
  return {
    wwdr: await fs.readFile(path.join(certsDir, 'AppleWWDRCAG4.pem')),
    signerCert: await fs.readFile(path.join(certsDir, 'Stand-PassKit.pem')),
    signerKey: await fs.readFile(path.join(certsDir, 'Stand-PassKit.key')),
  };
}

// --- Main /vcard Endpoint ---
app.post('/vcard', async (req: Request, res: Response) => {
  try {
    const passData: PassData = req.body;
    if (!passData.firstName || !passData.lastName) {
      return res.status(400).send('First and Last name are required.');
    }

    const fullName = `${passData.firstName} ${passData.lastName}`;
    console.log(`Searching for photo for: ${fullName}`);

    const photoResult = await findPersonAndPhoto(fullName);

    const pass = await createPass(
      passData,
      photoResult.match ? photoResult.photo : null
    );

    const passBuffer = pass.getAsBuffer();
    const fileName = `${fullName.replace(/[^a-z0-9]/gi, '_')}.pkpass`;

    res.set({
      'Content-Type': 'application/vnd.apple.pkpass',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    res.status(200).send(passBuffer);
  } catch (error) {
    console.error('Error generating pass:', error);
    res.status(500).send('Failed to generate pass.');
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

// --- CORRECTED createPass Function ---
async function createPass(
  data: PassData,
  photoBuffer: Buffer | null
): Promise<PKPass> {
  const certs = await loadCertificates();
  const passModelPath = path.join(__dirname, '../models/vcard.pass');

  // Step 1: Create the pass from the model without overrides for fields
  const pass = await PKPass.from(
    {
      model: 'models/vcard',
      certificates: certs,
    },
    { serialNumber: Date.now().toString() }
  );

  // Step 2: Directly access and set the field values on the pass instance
  // Note: We replace the entire array to clear any default values from the model.
  pass.primaryFields.push({
    key: 'name',
    value: `${data.firstName} ${data.lastName}\n${data.title}`,
  });

  pass.secondaryFields.push({
    key: 'work_phone',
    label: 'Direct Line',
    value: data.workPhone || '',
  });

  pass.auxiliaryFields.push(
    {
      key: 'email',
      label: 'Email',
      value: data.email || '',
    },
    {
      key: 'cell_phone',
      label: 'Cell Phone',
      value: data.cellPhone || '',
    }
  );

  pass.backFields.push(
    {
      key: 'website',
      label: 'Website',
      value: data.website || 'https://stand.earth',
    },
    {
      key: 'linkedin',
      label: 'LinkedIn',
      value: data.linkedin || '',
    },
    {
      key: 'notes',
      label: 'Notes',
      value: data.notes || '',
    }
  );

  // Add the photo buffer
  if (photoBuffer) {
    console.log('Photo found, adding thumbnail.png to pass.');
    pass.addBuffer('thumbnail.png', photoBuffer);
  } else {
    console.log('No photo found, pass will not have a thumbnail.');
  }

  // Build and set the QR code
  let vCardString = `BEGIN:VCARD\r\nVERSION:3.0\r\n`;
  vCardString += `N:${data.lastName};${data.firstName}\r\n`;
  vCardString += `FN:${data.firstName} ${data.lastName}\r\n`;
  vCardString += `ORG:${data.organization}\r\n`;
  vCardString += `TITLE:${data.title}\r\n`;
  if (data.email) vCardString += `EMAIL:${data.email}\r\n`;
  if (data.workPhone)
    vCardString += `TEL;TYPE=WORK,VOICE:${data.workPhone}\r\n`;
  if (data.cellPhone) vCardString += `TEL;TYPE=CELL:${data.cellPhone}\r\n`;
  if (data.website) vCardString += `URL:${data.website}\r\n`;
  if (data.linkedin) vCardString += `URL:${data.linkedin}\r\n`;
  if (data.notes) vCardString += `NOTE:${data.notes.replace(/\n/g, '\\n')}\r\n`;
  vCardString += `END:VCARD`;

  pass.setBarcodes({
    message: vCardString,
    format: 'PKBarcodeFormatQR',
    messageEncoding: 'iso-8859-1',
  });

  return pass;
}
