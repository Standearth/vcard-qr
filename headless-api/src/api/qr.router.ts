// headless-api/src/api/qr.router.ts
import express, { Router } from 'express';
import puppeteer, { Browser, Page } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const router: Router = Router();
const isDebug = (process.env.LOG_LEVEL || '').toLowerCase() === 'debug';

let globalBrowser: Browser | null = null;
let hotPage: Page | null = null;
let pageLock: Promise<void> = Promise.resolve();
let requestCount = 0;

// List of all supported frontend tabs
const VALID_MODES = [
  'vcard',
  'link',
  'wifi',
  'sms',
  'phone',
  'email',
  'custom',
];

async function getHotPage(): Promise<Page> {
  if (!globalBrowser) {
    if (isDebug) console.log('Launching persistent headless browser...');

    const isProduction = process.env.NODE_ENV === 'production';

    globalBrowser = await puppeteer.launch({
      args: isProduction
        ? chromium.args
        : [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--ignore-certificate-errors',
            '--disable-gpu',
            '--disable-extensions',
            '--no-first-run',
            '--no-zygote',
          ],
      defaultViewport: { width: 1920, height: 1080 },
      executablePath: isProduction
        ? await chromium.executablePath()
        : process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      headless: true,
      acceptInsecureCerts: true,
    });

    globalBrowser.on('disconnected', () => {
      globalBrowser = null;
      hotPage = null;
    });
  }

  if (!hotPage || hotPage.isClosed()) {
    if (isDebug) console.log('Booting new hot-reload page...');
    hotPage = await globalBrowser.newPage();

    const port = process.env.PORT || 8080;
    const targetUrl = `http://localhost:${port}/#/custom/`;

    await hotPage.goto(targetUrl, { waitUntil: 'networkidle0' });

    await hotPage.waitForFunction(
      () => typeof (window as any).appInstance !== 'undefined'
    );
  }

  return hotPage;
}

// 1. Define the shared handler
// Explicitly use express.Request and express.Response
const generateQrHandler = async (
  req: express.Request,
  res: express.Response
): Promise<void> => {
  // If mode isn't in the path parameters, default to 'custom'
  const mode = String(req.params.mode || 'custom').toLowerCase();

  // Validate the mode
  if (!VALID_MODES.includes(mode)) {
    res
      .status(400)
      .send(`Invalid mode. Must be one of: ${VALID_MODES.join(', ')}`);
    return;
  }

  const timerLabel = `Hot-Request-${Math.random().toString(36).substring(7)}`;

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
    if (isDebug) console.time(timerLabel);
    const page = await getHotPage();

    const queryString = new URLSearchParams(
      req.query as Record<string, string>
    ).toString();

    // 3. Pass BOTH the query string and the mode into the headless browser context
    const result = await page.evaluate(
      async ({ qs, targetMode }) => {
        const marks: Record<string, number> = {};
        marks.start = performance.now();

        interface ExtendedWindow extends Window {
          appInstance: {
            handleRouteChange: () => Promise<void>;
          };
        }
        const browserWindow = window as unknown as ExtendedWindow;

        // Step 1: Update URL with the dynamic mode
        window.history.replaceState(null, '', `#/${targetMode}/?${qs}`);
        marks.replaceState = performance.now();

        // --- ASYNC IMAGE TRACKER ---
        const imageLoadPromises: Promise<void>[] = [];
        const originalImageSrc = Object.getOwnPropertyDescriptor(
          HTMLImageElement.prototype,
          'src'
        );

        if (originalImageSrc) {
          Object.defineProperty(HTMLImageElement.prototype, 'src', {
            set: function (this: HTMLImageElement, value: string) {
              if (value) {
                // 1. Initialize with a no-op function to satisfy TS control-flow analysis
                let res: () => void = () => {};
                imageLoadPromises.push(
                  new Promise((r) => {
                    res = r;
                  })
                );

                this.addEventListener('load', res, { once: true });
                this.addEventListener('error', res, { once: true });
              }

              // 2. Explicitly check if the native setter exists before calling it
              if (originalImageSrc.set) {
                originalImageSrc.set.call(this, value);
              }
            },
          });
        }

        // Step 2: Trigger UI update
        // This synchronously draws the background and starts downloading the async logo
        await browserWindow.appInstance.handleRouteChange();
        marks.routeChange = performance.now();

        // Step 3: Dynamic Image Wait
        if (imageLoadPromises.length > 0) {
          // Wait for all images to load (with our 2000ms safety net for cold boots)
          const fallbackTimer = new Promise((resolve) =>
            setTimeout(resolve, 2000)
          );
          await Promise.race([Promise.all(imageLoadPromises), fallbackTimer]);

          // Give the event loop 10ms to execute the library's img.onload callback
          // so it has time to actually paint the loaded image to the canvas.
          await new Promise((r) => setTimeout(r, 10));
        }

        // Restore pristine browser behavior
        if (originalImageSrc) {
          Object.defineProperty(
            HTMLImageElement.prototype,
            'src',
            originalImageSrc
          );
        }
        marks.paintWait = performance.now();

        // Step 4: Extract the fully painted image
        const canvas = document.querySelector(
          '#canvas canvas'
        ) as HTMLCanvasElement;
        const base64 = canvas.toDataURL('image/png').split(',')[1];
        marks.canvasExtract = performance.now();

        return {
          base64String: base64,
          metrics: {
            replaceStateMs: (marks.replaceState - marks.start).toFixed(2),
            routeChangeMs: (marks.routeChange - marks.replaceState).toFixed(2),
            paintWaitMs: (marks.paintWait - marks.routeChange).toFixed(2),
            canvasExtractMs: (marks.canvasExtract - marks.paintWait).toFixed(2),
            totalBrowserMs: (marks.canvasExtract - marks.start).toFixed(2),
          },
        };
      },
      { qs: queryString, targetMode: mode }
    );

    if (isDebug)
      console.log(`[${timerLabel}] Browser Metrics:`, result.metrics);

    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Type', 'image/png');
    res.send(Buffer.from(result.base64String, 'base64'));

    if (isDebug) console.timeEnd(timerLabel);

    // Memory Leak Protection
    requestCount++;
    if (requestCount > 100) {
      hotPage?.close().catch(() => {});
      hotPage = null;
      requestCount = 0;
    }
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).send('Internal Server Error generating QR code.');
    hotPage = null;
  } finally {
    releaseLock!();
  }
};

// 2. Bind the shared handler to both the legacy and new dynamic routes
router.get('/generate', generateQrHandler);
router.get('/:mode/generate', generateQrHandler);

// Pre-warm browser during startup
getHotPage()
  .then(() => {
    console.log('🔥 Browser and Hot Page pre-warmed and ready.');
  })
  .catch((err) => console.error('Failed to pre-warm browser:', err));

export default router;
