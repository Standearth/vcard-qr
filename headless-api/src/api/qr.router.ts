// headless-api/src/api/qr.router.ts
import { Router } from 'express';
import puppeteer, { Browser } from 'puppeteer-core';

const router: Router = Router();

// 1. Maintain a single global browser instance
let globalBrowser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!globalBrowser) {
    console.log('Launching persistent headless browser...');
    globalBrowser = await puppeteer.launch({
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--ignore-certificate-errors',
      ],
    });

    // If the browser crashes, clear the reference so it restarts on the next request
    globalBrowser.on('disconnected', () => {
      console.log('Browser disconnected. It will restart on the next request.');
      globalBrowser = null;
    });
  }
  return globalBrowser;
}

router.get('/generate', async (req, res) => {
  let page;
  try {
    const frontendDomain = process.env.FRONTEND_DOMAIN || 'qr.stand.earth';
    const queryString = new URLSearchParams(
      req.query as Record<string, string>
    ).toString();
    const targetUrl = `https://${frontendDomain}/#/custom/?${queryString}`;

    // Get the persistent browser instead of launching a new one
    const browser = await getBrowser();
    page = await browser.newPage();

    // 3. Block unnecessary resources (Fonts, CSS, Media) to speed up loading
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (
        resourceType === 'stylesheet' ||
        resourceType === 'font' ||
        resourceType === 'media'
      ) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // 2. Use domcontentloaded instead of networkidle0 to skip the mandatory 500ms delay
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

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
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.readAsDataURL(blob);
      });
    });

    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Type', 'image/png');

    res.send(Buffer.from(base64String, 'base64'));
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).send('Internal Server Error generating QR code.');
  } finally {
    if (page) await page.close();
  }
});

export default router;
