// headless-api/src/api/qr.router.ts
import express, { Router } from 'express';
import puppeteer, { Browser, Page } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const router: Router = Router();
const isDebug = (process.env.LOG_LEVEL || '').toLowerCase() === 'debug';

const MAX_PAGES = parseInt(process.env.PAGE_POOL_SIZE || '4', 10);
const MAX_USES_PER_PAGE = 100;

let globalBrowser: Browser | null = null;

const VALID_MODES = [
  'vcard',
  'link',
  'wifi',
  'sms',
  'phone',
  'email',
  'custom',
];

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

async function initBrowser(): Promise<void> {
  if (globalBrowser) return;
  if (isDebug) console.log('Launching persistent headless browser...');

  const isProduction = process.env.NODE_ENV === 'production';

  const baseArgs = [
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
  ];

  const launchArgs = isProduction
    ? [...chromium.args, ...baseArgs]
    : [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--ignore-certificate-errors',
        '--disable-gpu',
        '--disable-extensions',
        '--no-first-run',
        '--no-zygote',
        ...baseArgs,
      ];

  globalBrowser = await puppeteer.launch({
    args: launchArgs,
    defaultViewport: { width: 1920, height: 1080 },
    executablePath: isProduction
      ? await chromium.executablePath()
      : process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    headless: true,
    acceptInsecureCerts: true,
  });

  globalBrowser.on('disconnected', () => {
    globalBrowser = null;
    pagePool.reset();
  });
}

async function createHotPage(): Promise<Page> {
  if (!globalBrowser) throw new Error('Browser not initialized');

  const page = await globalBrowser.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error(`[Browser Error]: ${msg.text()}`);
    }
  });

  await page.evaluateOnNewDocument(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      let retries = 3;
      while (retries > 0) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        try {
          const reqOpts = (args[1] || {}) as RequestInit;
          reqOpts.signal = controller.signal;
          const res = await originalFetch(args[0], reqOpts);
          clearTimeout(timeoutId);
          if (res.ok) return res;
        } catch (e) {
          clearTimeout(timeoutId);
          console.warn(
            `[Fetch Retry] Failed fetching ${args[0]}, retries left: ${retries}`
          );
        }
        retries--;
        await new Promise((r) => setTimeout(r, 200));
      }
      return originalFetch(...args);
    };
  });

  const port = process.env.PORT || 8080;
  await page.goto(`http://localhost:${port}/#/custom/?custom_content=prewarm`, {
    waitUntil: 'domcontentloaded',
  });

  await page.waitForFunction(
    () => typeof (window as any).appInstance !== 'undefined'
  );
  await page.waitForSelector('#canvas canvas', { timeout: 10000 });

  return page;
}

class PagePool {
  private idlePages: Page[] = [];
  private activeCount = 0;
  private waitingQueue: (() => void)[] = [];
  private pageUsageCount = new WeakMap<Page, number>();

  async acquire(): Promise<Page> {
    while (true) {
      if (!globalBrowser) await initBrowser();

      if (this.idlePages.length > 0) {
        const page = this.idlePages.pop()!;
        if (!page.isClosed()) return page;
        this.activeCount--;
        continue;
      }

      if (this.activeCount < MAX_PAGES) {
        this.activeCount++;
        try {
          const staggerMs = this.activeCount * 100;
          if (staggerMs > 0) await new Promise((r) => setTimeout(r, staggerMs));

          const page = await createHotPage();
          this.pageUsageCount.set(page, 0);
          return page;
        } catch (error) {
          this.activeCount--;
          if (this.waitingQueue.length > 0) this.waitingQueue.shift()!();
          throw error;
        }
      }

      await new Promise<void>((resolve) => this.waitingQueue.push(resolve));
    }
  }

  release(page: Page | null, forceRecycle = false): void {
    if (!page) {
      if (this.waitingQueue.length > 0) this.waitingQueue.shift()!();
      return;
    }

    if (forceRecycle || page.isClosed()) {
      page.close().catch(() => {});
      this.activeCount--;
    } else {
      const uses = (this.pageUsageCount.get(page) || 0) + 1;
      this.pageUsageCount.set(page, uses);

      if (uses >= MAX_USES_PER_PAGE) {
        if (isDebug) console.log(`Recycling page after ${uses} uses.`);
        page.close().catch(() => {});
        this.activeCount--;
      } else {
        this.idlePages.push(page);
      }
    }

    if (this.waitingQueue.length > 0) {
      const next = this.waitingQueue.shift();
      next!();
    }
  }

  reset() {
    this.idlePages = [];
    this.activeCount = 0;
    while (this.waitingQueue.length > 0) {
      this.waitingQueue.shift()!();
    }
  }
}

const pagePool = new PagePool();

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
  let page: Page | null = null;
  let forceRecycle = false;

  try {
    if (isDebug) console.time(timerLabel);

    page = await pagePool.acquire();

    const safeQuery: Record<string, string> = {};
    for (const key of ALLOWED_PARAMS) {
      if (req.query[key] !== undefined) {
        safeQuery[key] = String(req.query[key]);
      }
    }
    const queryString = new URLSearchParams(safeQuery).toString();

    const evaluatePromise = page.evaluate(
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

        let hasStartedDrawing = false;
        let lastDrawTime = performance.now();

        const originalFillRect = CanvasRenderingContext2D.prototype.fillRect;
        CanvasRenderingContext2D.prototype.fillRect = function (
          this: CanvasRenderingContext2D,
          ...args: any[]
        ) {
          hasStartedDrawing = true;
          lastDrawTime = performance.now();
          return (originalFillRect as any).apply(this, args);
        };

        const originalFill = CanvasRenderingContext2D.prototype.fill;
        CanvasRenderingContext2D.prototype.fill = function (
          this: CanvasRenderingContext2D,
          ...args: any[]
        ) {
          hasStartedDrawing = true;
          lastDrawTime = performance.now();
          return (originalFill as any).apply(this, args);
        };

        const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage = function (
          this: CanvasRenderingContext2D,
          ...args: any[]
        ) {
          hasStartedDrawing = true;
          lastDrawTime = performance.now();
          return (originalDrawImage as any).apply(this, args);
        };

        try {
          await browserWindow.appInstance.handleRouteChange();
          marks.routeChange = performance.now();

          if (expectsLogo && imageLoadPromises.length > 0) {
            const fallbackTimer = new Promise<void>((resolve) =>
              setTimeout(resolve, 2000)
            );
            await Promise.race([Promise.all(imageLoadPromises), fallbackTimer]);
          }

          // 1. Wait for Cloud Run to allocate CPU and React to trigger the first draw
          const waitStart = performance.now();
          while (!hasStartedDrawing && performance.now() - waitStart < 2500) {
            await new Promise((r) => setTimeout(r, 10));
          }

          // 2. Wait until there is a 50ms period of absolute drawing silence
          if (hasStartedDrawing) {
            while (performance.now() - lastDrawTime < 50) {
              await new Promise((r) => setTimeout(r, 10));
            }
          }

          const finalCanvas = document.querySelector(
            '#canvas canvas'
          ) as HTMLCanvasElement | null;
          if (finalCanvas) {
            const ctx = finalCanvas.getContext('2d');
            if (ctx) ctx.getImageData(0, 0, 1, 1); // Flush pipeline
          }

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
          if (originalImageSrc)
            Object.defineProperty(
              HTMLImageElement.prototype,
              'src',
              originalImageSrc
            );
          CanvasRenderingContext2D.prototype.fillRect = originalFillRect;
          CanvasRenderingContext2D.prototype.fill = originalFill;
          CanvasRenderingContext2D.prototype.drawImage = originalDrawImage;
        }
      },
      { qs: queryString, targetMode: mode }
    );

    const resultTimer = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Evaluate timeout')), 10000)
    );
    const result = await Promise.race([evaluatePromise, resultTimer]);

    if (isDebug) {
      console.log(`[${timerLabel}] Browser Metrics:`, result.metrics);
    }

    if (!result.base64String || result.base64String.length < 50) {
      res
        .status(400)
        .send('Invalid parameters provided. Unable to generate QR code.');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Content-Type', 'image/png');
      res.send(Buffer.from(result.base64String, 'base64'));
    }

    if (isDebug) console.timeEnd(timerLabel);

    if (
      result.metrics?.paintWaitMs &&
      parseFloat(result.metrics.paintWaitMs) >= 2400
    ) {
      if (isDebug)
        console.log(
          `[${timerLabel}] Fallback timeout hit. Forcing page recycle.`
        );
      forceRecycle = true;
    }
  } catch (error) {
    console.error(`[${timerLabel}] Error generating QR code:`, error);
    res.status(500).send('Internal Server Error generating QR code.');
    forceRecycle = true;
  } finally {
    pagePool.release(page, forceRecycle);
  }
};

router.get('/generate', generateQrHandler);
router.get('/:mode/generate', generateQrHandler);

initBrowser().catch((err) => console.error('Failed to init browser:', err));

export default router;
