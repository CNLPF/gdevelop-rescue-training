// Runs the official GDevelop gameplay-test harness directly in the generated
// preview. Used when the editor's embedded test launcher fails to handshake.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const preview = process.env.GD_PREVIEW_DIR
  ? path.resolve(process.env.GD_PREVIEW_DIR)
  : path.join(process.env.TEMP, 'GDTMP--1', 'gameplay-test-preview');
const gameFile = path.join(root, 'game.json');
const filters = new Set(process.argv.slice(2));

if (!fs.existsSync(preview)) throw new Error(`Generated GDevelop preview not found: ${preview}`);
const game = JSON.parse(fs.readFileSync(gameFile, 'utf8'));
const tests = (game.tests || []).filter(test => !filters.size || filters.has(test.name));
if (!tests.length) throw new Error('No matching embedded gameplay tests were found.');

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.wasm': 'application/wasm', '.css': 'text/css', '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg', '.wav': 'audio/wav',
};

const server = http.createServer((request, response) => {
  if (request.url === '/favicon.ico') {
    response.writeHead(204).end();
    return;
  }
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.resolve(preview, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(preview + path.sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    let data = fs.readFileSync(file);
    if (file.endsWith('index.html')) {
      const original = data.toString('utf8');
      const marker = 'var game = new gdjs.RuntimeGame';
      if (!original.includes(marker)) throw new Error('Generated index does not expose a RuntimeGame constructor.');
      data = Buffer.from(original.replace(marker, 'var game = window.__rescueGame = new gdjs.RuntimeGame'));
    }
    response.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    response.end(data);
  } catch {
    response.writeHead(404).end();
  }
});

(async () => {
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const url = `http://127.0.0.1:${server.address().port}/`;
    const results = [];

    for (const test of tests) {
      const context = await browser.newContext({ viewport: { width: 960, height: 640 } });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(String(error.stack || error)));
      page.on('console', message => {
        if (message.type() === 'error') pageErrors.push(message.text().slice(0, 1000));
        if (message.type() === 'log' && process.env.GD_TEST_LOGS) console.log(message.text());
      });
      await page.route('**/*', route => {
        const target = new URL(route.request().url());
        if (target.hostname === '127.0.0.1' || target.protocol === 'data:') route.continue();
        else route.abort();
      });

      console.log(`[GDevelop] ${test.name}: booting generated preview`);
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__rescueGame && !window.__rescueGame.isStartingUp(), null, { timeout: 15000 });
      const result = await page.evaluate(async payload => {
        let lastProgress = null;
        const report = await gdjs.gameplayTests.runGameplayTest(
          window.__rescueGame,
          {
            testName: payload.name,
            source: payload.source,
            timeoutMs: 60000,
            loadingTimeoutMs: 15000,
            renderingMode: 'onScreenshot',
            maxScreenshots: 2,
          },
          progress => { lastProgress = progress; }
        );
        return { report, lastProgress };
      }, { name: test.name, source: Array.isArray(test.source) ? test.source.join('\n') : test.source });

      const report = result.report;
      const errors = [...(report.errors || []), ...pageErrors];
      results.push({ ...report, browserErrors: pageErrors });
      console.log(`[GDevelop] ${test.name}: ${report.status} (${report.framesExecuted} frames)`);
      if (errors.length) console.error(errors.join('\n'));
      await context.close();
    }

    const evidence = path.join(root, 'evidence', 'native-gameplay-results.json');
    fs.mkdirSync(path.dirname(evidence), { recursive: true });
    fs.writeFileSync(evidence, JSON.stringify(results, null, 2));
    if (results.some(result => result.status !== 'passed' || result.browserErrors.length)) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(error => {
  console.error(error.stack || error);
  server.close();
  process.exitCode = 1;
});
