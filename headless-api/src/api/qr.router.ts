// headless-api/src/api/qr.router.ts
import { Router } from 'express';
import puppeteer, { Browser, Page } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const router: Router = Router();
const isDebug = (process.env.LOG_LEVEL || '').toLowerCase() === 'debug';

let globalBrowser: Browser | null = null;
let hotPage: Page | null = null;
let pageLock: Promise<void> = Promise.resolve();
let requestCount = 0;

async function getHotPage(): Promise<Page> {
  if (!globalBrowser) {
    if (isDebug) console.log('Launching persistent headless browser...');

    // Check if we are running locally or in production
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

    // Wait for canvass and internal scripts to load
    await hotPage.goto(targetUrl, { waitUntil: 'networkidle0' });

    await hotPage.waitForFunction(
      () => typeof (window as any).appInstance !== 'undefined'
    );
  }

  return hotPage;
}

router.get('/generate', async (req, res) => {
  const timerLabel = `Hot-Request-${Math.random().toString(36).substring(7)}`;
  let releaseLock: () => void;
  const localLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  const previousLock = pageLock;
  pageLock = previousLock.then(() => localLock);

  await previousLock;

  try {
    if (isDebug) console.time(timerLabel);
    const page = await getHotPage();

    const queryString = new URLSearchParams(
      req.query as Record<string, string>
    ).toString();

    // 3. Inject new parameters, force a redraw, and extract the image instantly
    const result = await page.evaluate(async (qs) => {
      const marks: Record<string, number> = {};
      marks.start = performance.now();

      interface ExtendedWindow extends Window {
        appInstance: {
          handleRouteChange: () => Promise<void>;
          getQrCode: () => any; // Cast to any to access internal _options
        };
      }
      const browserWindow = window as unknown as ExtendedWindow;

      // Step 1: Update URL without triggering duplicate hashchange events
      window.history.replaceState(null, '', `#/custom/?${qs}`);
      marks.replaceState = performance.now();

      // --- DYNAMIC LOGO PAINT DETECTOR ---
      let isLogoDrawn = false;
      // 1. Initialize with a no-op function to satisfy TS control-flow analysis
      let resolveDraw: () => void = () => {};
      const logoDrawPromise = new Promise<void>((res) => {
        resolveDraw = res;
      });
      let drawTimeout: any;

      // Temporarily intercept the native canvas drawing method
      const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;

      // 2. Cast the prototype to 'any' to bypass the strict overload signature check
      (CanvasRenderingContext2D.prototype as any).drawImage = function (
        this: any,
        ...args: any[]
      ) {
        // 3. Cast originalDrawImage to 'any' or 'Function' to bypass the strict array length check
        (originalDrawImage as any).apply(this, args);

        isLogoDrawn = true;

        // Debounce resolution by 5ms in case the library draws multiple elements
        clearTimeout(drawTimeout);
        drawTimeout = setTimeout(resolveDraw, 5);
      };

      // Step 2: Trigger UI update
      await browserWindow.appInstance.handleRouteChange();
      marks.routeChange = performance.now();

      // Step 3: Wait dynamically ONLY if a logo is expected
      const qrCode = browserWindow.appInstance.getQrCode();
      const hasLogo = !!qrCode._options?.image;

      if (hasLogo && !isLogoDrawn) {
        // Wait for the exact millisecond the logo is painted
        // Safety fallback of 250ms just in case the image fails to load internally
        const fallbackTimer = setTimeout(resolveDraw, 250);
        await logoDrawPromise;
        clearTimeout(fallbackTimer);
      }

      // Restore the pristine native canvas function for the next request
      CanvasRenderingContext2D.prototype.drawImage = originalDrawImage;
      marks.paintWait = performance.now();

      // Step 4: Rip the image directly from the fully-painted DOM canvas
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
    }, queryString);

    // Print the micro-benchmarks to Cloud Run logs
    if (isDebug)
      console.log(`[${timerLabel}] Browser Metrics:`, result.metrics);

    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Type', 'image/png');
    res.send(Buffer.from(result.base64String, 'base64'));

    if (isDebug) console.timeEnd(timerLabel);

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

// Pre-warm browser during startup
getHotPage()
  .then(() => {
    console.log('🔥 Browser and Hot Page pre-warmed and ready.');
  })
  .catch((err) => console.error('Failed to pre-warm browser:', err));

export default router;
