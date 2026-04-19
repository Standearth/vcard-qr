// headless-api/scripts/benchmark.mjs
import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
const isLive = args.includes('--live');

// Configure the target URL
let baseUrl = 'http://localhost:8080/api/v1/qr';
if (isLive) {
  const apiDomain = process.env.API_DOMAIN;
  if (!apiDomain) {
    console.error('❌ Error: API_DOMAIN is missing from your .env file.');
    process.exit(1);
  }
  baseUrl = `https://${apiDomain}/api/v1/qr`;
}

console.log(`\n====================================`);
console.log(`🚀 RUNNING BENCHMARK: ${isLive ? 'LIVE' : 'LOCAL'}`);
console.log(`🎯 Target: ${baseUrl}`);
console.log(`====================================\n`);

// Create a directory to save the output images
const OUT_DIR = path.join(process.cwd(), 'benchmark-results');

async function fetchQr(id, batchName) {
  const url = `${baseUrl}/email/generate?email_to=test_${batchName}_${id}@example.com`;
  const start = performance.now();

  try {
    const res = await fetch(url);

    if (!res.ok) {
      console.error(`[Req ${batchName}-${id}] Failed: ${res.status}`);
      return;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const time = (performance.now() - start).toFixed(2);

    // Save the image to disk
    const fileName = `qr-${batchName}-${id}.png`;
    const filePath = path.join(OUT_DIR, fileName);
    fs.writeFileSync(filePath, buffer);

    console.log(
      `[Req ${batchName}-${id}] Finished in ${time}ms (Size: ${buffer.length} bytes) -> Saved: ${fileName}`
    );
  } catch (err) {
    console.error(`[Req ${batchName}-${id}] Error: ${err.message}`);
  }
}

async function runBenchmark() {
  console.log(`Cleaning old results in ${OUT_DIR}...`);
  if (fs.existsSync(OUT_DIR)) {
    fs.readdirSync(OUT_DIR).forEach((f) => fs.rmSync(path.join(OUT_DIR, f)));
  } else {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  console.log('\n====================================');
  console.log('1. TESTING COLD BOOT (1 Request)');
  console.log('====================================');

  const coldStart = performance.now();
  await fetchQr('1', 'boot');
  console.log(
    `Total Cold Boot Phase: ${(performance.now() - coldStart).toFixed(2)}ms`
  );

  console.log('\n====================================');
  console.log('2. TESTING CONCURRENCY SPIN-UP (10 Requests)');
  console.log('====================================');

  const warmStart = performance.now();
  let promises = [];

  for (let i = 1; i <= 10; i++) {
    promises.push(fetchQr(i, 'spinup'));
  }

  await Promise.all(promises);
  console.log(
    `Total Concurrency Spin-up Phase: ${(performance.now() - warmStart).toFixed(2)}ms`
  );

  console.log('\n====================================');
  console.log('3. TESTING FULLY WARMED POOL (10 Requests)');
  console.log('====================================');

  await new Promise((r) => setTimeout(r, 500));

  const hotStart = performance.now();
  promises = [];

  for (let i = 1; i <= 10; i++) {
    promises.push(fetchQr(i, 'hot'));
  }

  await Promise.all(promises);
  console.log(
    `Total Fully Warmed Phase: ${(performance.now() - hotStart).toFixed(2)}ms\n`
  );
}

runBenchmark();
