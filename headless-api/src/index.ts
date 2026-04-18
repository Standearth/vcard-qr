import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import qrRouter from './api/qr.router.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

const isProduction = process.env.NODE_ENV === 'production';
const frontendPath = isProduction
  ? path.join(__dirname, '../frontend-dist')
  : path.join(__dirname, '../../frontend/dist');

if (!isProduction && !fs.existsSync(frontendPath)) {
  console.warn(
    `⚠️ Frontend build not found at ${frontendPath}. Did you forget to run 'pnpm --filter frontend build'?`
  );
}

app.use(express.static(frontendPath));

app.use('/api/v1/qr', qrRouter);

app.listen(port, () => {
  console.log(`Headless API listening on port ${port}`);
});
