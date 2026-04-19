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

const VALID_MODES = [
  'vcard',
  'link',
  'wifi',
  'sms',
  'phone',
  'email',
  'custom',
];

// STRICT WHITELIST
const ALLOWED_PARAMS = [
  'presets',
  'first_name',
  'last_name',
  'org',
  'title',
  'email',
  'office_phone',
  'extension',
  'work_phone',
  'cell_phone',
  'website',
  'linkedin',
  'whatsapp',
  'signal',
  'notes',
  'link_url',
  'wifi_ssid',
  'wifi_password',
  'wifi_encryption',
  'wifi_hidden',
  'sms_phone',
  'sms_message',
  'call_phone',
  'email_to',
  'email_subject',
  'email_body',
  'custom_content',
  'width',
  'height',
  'margin',
  'optimize_size',
  'round_size',
  'show_image',
  'dots_type',
  'dots_color',
  'corners_square_type',
  'corners_square_color',
  'corners_dot_type',
  'corners_dot_color',
  'background_color',
  'hide_background_dots',
  'wrap_size',
  'image_size',
  'image_margin',
  'qr_type_number',
  'qr_error_correction_level',
  'logo_url',
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

    // Boot with dummy data to ensure the library mounts the canvas on cold start
    await hotPage.goto(
      `http://localhost:${port}/#/custom/?custom_content=prewarm`,
      {
        waitUntil: 'networkidle0',
      }
    );

    await hotPage.waitForFunction(
      () => typeof (window as any).appInstance !== 'undefined'
    );
    await hotPage.waitForSelector('#canvas canvas', { timeout: 10000 });
  }

  return hotPage;
}

const generateQrHandler = async (
  req: express.Request,
  res: express.Response
): Promise<void> => {
  const mode = String(req.params.mode || 'custom').toLowerCase();

  if (!VALID_MODES.includes(mode)) {
    res
      .status(400)
      .send(`Invalid mode. Must be one of: ${VALID_MODES.join(', ')}`);
    return;
  }

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

    const safeQuery: Record<string, string> = {};
    for (const key of ALLOWED_PARAMS) {
      if (req.query[key] !== undefined) {
        safeQuery[key] = String(req.query[key]);
      }
    }
    const queryString = new URLSearchParams(safeQuery).toString();

    const result = await page.evaluate(
      async ({ qs, targetMode }) => {
        const marks: Record<string, number> = {};
        marks.start = performance.now();

        interface ExtendedWindow extends Window {
          appInstance: { handleRouteChange: () => Promise<void> };
        }
        const browserWindow = window as unknown as ExtendedWindow;

        const canvas = document.querySelector(
          '#canvas canvas'
        ) as HTMLCanvasElement | null;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        window.history.replaceState(null, '', `#/${targetMode}/?${qs}`);

        let expectsLogo = false;
        const imageLoadPromises: Promise<void>[] = [];

        const originalImageSrc = Object.getOwnPropertyDescriptor(
          HTMLImageElement.prototype,
          'src'
        );
        if (originalImageSrc) {
          Object.defineProperty(HTMLImageElement.prototype, 'src', {
            set: function (this: HTMLImageElement, value: string) {
              if (value) {
                expectsLogo = true;
                let res: () => void = () => {};
                imageLoadPromises.push(
                  new Promise((r) => {
                    res = r;
                  })
                );
                this.addEventListener('load', res, { once: true });
                this.addEventListener('error', res, { once: true });
              }
              if (originalImageSrc.set) originalImageSrc.set.call(this, value);
            },
          });
        }

        try {
          await browserWindow.appInstance.handleRouteChange();
          marks.routeChange = performance.now();

          if (expectsLogo && imageLoadPromises.length > 0) {
            const fallbackTimer = new Promise<void>((resolve) =>
              setTimeout(resolve, 2000)
            );
            await Promise.race([Promise.all(imageLoadPromises), fallbackTimer]);
          }

          // --- OPTIMIZED HARDWARE SYNC ---
          const finalCanvas = document.querySelector(
            '#canvas canvas'
          ) as HTMLCanvasElement | null;

          // 1. Force the Canvas API to synchronously flush all pending drawImage commands
          if (finalCanvas) {
            const ctx = finalCanvas.getContext('2d');
            if (ctx) ctx.getImageData(0, 0, 1, 1);
          }

          // 2. Synchronize with the browser's render cycle.
          // requestAnimationFrame runs *right before* the browser paints.
          // By putting a tiny setTimeout inside it, we guarantee our extraction runs
          // *immediately after* the browser finishes painting the buffer to the screen.
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              setTimeout(resolve, 15);
            });
          });

          marks.paintWait = performance.now();

          const base64 = finalCanvas
            ? finalCanvas.toDataURL('image/png').substring(22)
            : '';
          marks.canvasExtract = performance.now();

          return {
            base64String: base64,
            metrics: {
              routeChangeMs: (marks.routeChange - marks.start).toFixed(2),
              paintWaitMs: (marks.paintWait - marks.routeChange).toFixed(2),
              canvasExtractMs: (marks.canvasExtract - marks.paintWait).toFixed(
                2
              ),
              totalBrowserMs: (marks.canvasExtract - marks.start).toFixed(2),
            },
          };
        } finally {
          if (originalImageSrc) {
            Object.defineProperty(
              HTMLImageElement.prototype,
              'src',
              originalImageSrc
            );
          }
        }
      },
      { qs: queryString, targetMode: mode }
    );

    if (isDebug) {
      console.log(`[${timerLabel}] Browser Metrics:`, result.metrics);
    }

    if (!result.base64String || result.base64String.length < 500) {
      res
        .status(400)
        .send('Invalid parameters provided. Unable to generate QR code.');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Content-Type', 'image/png');
      res.send(Buffer.from(result.base64String, 'base64'));
    }

    if (isDebug) console.timeEnd(timerLabel);

    const tookTooLong =
      result.metrics?.paintWaitMs &&
      parseFloat(result.metrics.paintWaitMs) >= 1900;
    requestCount++;

    if (tookTooLong || requestCount > 100) {
      if (isDebug && tookTooLong)
        console.log(
          `[${timerLabel}] Fallback timeout hit. Recycling page state...`
        );
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

router.get('/generate', generateQrHandler);
router.get('/:mode/generate', generateQrHandler);

getHotPage()
  .then(() => {
    console.log('🔥 Browser and Hot Page pre-warmed and ready.');
  })
  .catch((err) => console.error('Failed to pre-warm browser:', err));

export default router;
