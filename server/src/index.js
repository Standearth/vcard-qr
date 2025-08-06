
const express = require('express');
const { PKPass } = require('passkit-generator');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;

async function startServer() {
  const certs = {
    wwdr: await fs.readFile(path.join(__dirname, '../certs/signerCert.pem')), // Using self-signed cert as WWDR for dev
    signerCert: await fs.readFile(path.join(__dirname, '../certs/signerCert.pem')),
    signerKey: await fs.readFile(path.join(__dirname, '../certs/signerKey.pem')),
  };

  app.post('/api/create-pass', async (req, res) => {
    try {
      const passTemplatePath = path.join(__dirname, '../models/pass.pass');

      const pass = await PKPass.from({
        model: passTemplatePath,
        certificates: certs,
      });

      // Add dynamic data from the client request
      pass.serialNumber = `sn-${Date.now()}`;
      pass.description = 'vCard';
      pass.organizationName = req.body.org || 'Your Organization';

      pass.generic.primaryFields[0].value = `${req.body.firstName} ${req.body.lastName}`;
      pass.generic.secondaryFields[0].value = req.body.officePhone;
      pass.generic.auxiliaryFields[0].value = req.body.email;


      const passBuffer = await pass.asBuffer();

      res.set('Content-Type', 'application/vnd.apple.pkpass');
      res.status(200).send(passBuffer);

    } catch (error) {
      console.error(error);
      res.status(500).send('Error generating pass.');
    }
  });

  app.get('/', (req, res) => {
    res.send('Hello from the vCard QR code server!');
  });

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

startServer();
