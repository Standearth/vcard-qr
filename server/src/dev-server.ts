// src/dev-server.ts
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import app from './app.js';

const port = process.env.PORT || 3000;

// Get the directory name in an ES module context
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define paths to the new self-signed certificate
const keyPath = path.join(__dirname, '../certs/localhost.key');
const certPath = path.join(__dirname, '../certs/localhost.pem');

try {
  const httpsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };

  https.createServer(httpsOptions, app).listen(port, () => {
    console.log(`✅ Secure dev server is running on https://localhost:${port}`);
  });
} catch (error) {
  console.error('❌ Could not start HTTPS server.:', error);
  console.error('Did you forget to run "make add-local-https-certs"?');

  // Fallback to HTTP if certs are missing
  console.log('✅ Starting regular HTTP server instead.');
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}
