// headless-api/src/api/qr.router.ts
import { Router } from 'express';
import puppeteer, { Browser, Page } from 'puppeteer-core';

const router: Router = Router();

// Check if debug logging is enabled
const isDebug = (process.env.LOG_LEVEL || '').toLowerCase() === 'debug';

let globalBrowser: Browser | null = null;
let hotPage: Page | null = null;
let pageLock: Promise<void> = Promise.resolve(); // Our simple Mutex Queue
let requestCount = 0; // Used to prevent memory leaks

async function getHotPage(): Promise<Page> {
  // 1. Launch the browser if it doesn't exist
  if (!globalBrowser) {
    if (isDebug) console.log('Launching persistent headless browser...');
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

    globalBrowser.on('disconnected', () => {
      if (isDebug) console.log('Browser disconnected. Resetting instances.');
      globalBrowser = null;
      hotPage = null;
    });
  }

  // 2. Open the Hot Page if it doesn't exist
  if (!hotPage || hotPage.isClosed()) {
    if (isDebug) console.log('Booting new hot-reload page...');
    hotPage = await globalBrowser.newPage();

    await hotPage.setRequestInterception(true);
    hotPage.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    const frontendDomain = process.env.FRONTEND_DOMAIN || 'qr.stand.earth';
    const targetUrl = `https://${frontendDomain}/#/custom/`;

    // We only pay the 444ms page.goto penalty ONCE
    await hotPage.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    // Ensure the app instance is bound to the window before returning
    await hotPage.waitForFunction(
      () => typeof (window as any).appInstance !== 'undefined'
    );
  }

  return hotPage;
}

router.get('/generate', async (req, res) => {
  // --- MUTEX LOCK START ---
  let releaseLock: () => void;
  const localLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  const previousLock = pageLock;
  pageLock = previousLock.then(() => localLock);

  await previousLock;
  // --- MUTEX LOCK END ---

  try {
    if (isDebug) console.time('Total-Hot-Request');
    const page = await getHotPage();

    const queryString = new URLSearchParams(
      req.query as Record<string, string>
    ).toString();

    // 3. Inject new parameters, force a redraw, and extract the image instantly
    const base64String = await page.evaluate(async (qs) => {
      interface ExtendedWindow extends Window {
        appInstance: {
          handleRouteChange: () => Promise<void>;
          getQrCode: () => { getRawData: (type: string) => Promise<Blob> };
        };
      }
      const browserWindow = window as unknown as ExtendedWindow;

      window.location.hash = `#/custom/?${qs}`;

      // Directly await your App's built-in state compiler to guarantee the canvas is fully redrawn
      await browserWindow.appInstance.handleRouteChange();

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
    }, queryString);

    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Type', 'image/png');
    res.send(Buffer.from(base64String, 'base64'));

    if (isDebug) console.timeEnd('Total-Hot-Request');

    // Memory Leak Protection: Recycle the page every 100 requests
    requestCount++;
    if (requestCount > 100) {
      hotPage?.close().catch(() => {});
      hotPage = null;
      requestCount = 0;
    }
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).send('Internal Server Error generating QR code.');
    hotPage = null; // Force a fresh page on error
  } finally {
    releaseLock!();
  }
});

export default router;
