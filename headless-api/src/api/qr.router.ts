// headless-api/src/api/qr.router.ts
import { Router } from 'express';
import puppeteer from 'puppeteer-core';

const router: Router = Router();

router.get('/generate', async (req, res) => {
  let browser;
  try {
    const frontendDomain = process.env.FRONTEND_DOMAIN || 'qr.stand.earth';
    const queryString = new URLSearchParams(
      req.query as Record<string, string>
    ).toString();
    const targetUrl = `https://${frontendDomain}/#/custom/?${queryString}`;

    browser = await puppeteer.launch({
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--ignore-certificate-errors', // for local dev https
      ],
    });

    const page = await browser.newPage();

    // Wait until network is idle
    await page.goto(targetUrl, { waitUntil: 'networkidle0' });

    // Wait for appInstance AND for the QR data to actually be populated
    await page.waitForFunction(
      () => {
        const app = (window as any).appInstance;
        return (
          typeof app !== 'undefined' &&
          typeof app.getQRCodeData === 'function' &&
          app.getQRCodeData().length > 0
        );
      },
      { timeout: 10000 }
    ); // Give it up to 10s to render

    const base64String = await page.evaluate(async () => {
      interface ExtendedWindow extends Window {
        appInstance: {
          getQrCode: () => { getRawData: (type: string) => Promise<Blob> };
        };
      }
      const browserWindow = window as unknown as ExtendedWindow;
      const qrCode = browserWindow.appInstance.getQrCode();
      const blob = await qrCode.getRawData('png');

      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          // reader.result is a Data URL like "data:image/png;base64,iVBORw0..."
          // We split it to only return the raw base64 string
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        // Read the blob as a base64 Data URL instead of an ArrayBuffer
        reader.readAsDataURL(blob);
      });
    });

    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Type', 'image/png');

    // Decode the base64 string back into a Buffer in Node.js
    res.send(Buffer.from(base64String, 'base64'));
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).send('Internal Server Error generating QR code.');
  } finally {
    if (browser) await browser.close();
  }
});

export default router;
