// Browser QA for the sanitized mobile build. This serves the exact dist payload
// and aborts every non-local request to prove offline operation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const web = path.join(root, 'dist', 'mobile-web');
const evidence = path.join(root, 'evidence', 'mobile-browser');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.wasm': 'application/wasm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};

if (!fs.existsSync(path.join(web, 'index.html'))) {
  throw new Error('dist/mobile-web is missing. Run npm run build:mobile first.');
}
fs.mkdirSync(evidence, { recursive: true });

const server = http.createServer((request, response) => {
  if (request.url === '/favicon.ico') {
    response.writeHead(204).end();
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(web, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(web + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    let data = fs.readFileSync(file);
    if (file.endsWith('index.html')) {
      const html = data.toString('utf8');
      const marker = 'var game = new gdjs.RuntimeGame';
      if (!html.includes(marker)) throw new Error('Runtime bootstrap marker missing');
      data = Buffer.from(html.replace(marker, 'var game = window.__rescueGame = new gdjs.RuntimeGame'));
    }
    response.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    response.end(data);
  } catch {
    response.writeHead(404).end();
  }
});

async function openPage(context, url) {
  const page = await context.newPage();
  const errors = [];
  const external = [];
  page.on('pageerror', error => errors.push(String(error.stack || error)));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text().slice(0, 1000));
  });
  await page.route('**/*', route => {
    const target = new URL(route.request().url());
    if (target.hostname === '127.0.0.1' || target.protocol === 'data:') return route.continue();
    external.push(target.href);
    return route.abort();
  });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__rescueGame && !window.__rescueGame.isStartingUp(), null, { timeout: 20000 });
  await page.waitForTimeout(500);
  return { page, errors, external };
}

async function state(page) {
  return page.evaluate(() => {
    const game = window.__rescueGame;
    const scene = game.getSceneStack().getCurrentScene();
    const vars = scene.getVariables();
    const value = name => vars.get(name).getAsNumber();
    const string = name => vars.get(name).getAsString();
    const player = scene.getObjects('Player')[0];
    const buttons = scene.getObjects('TouchButton').map(object => {
      const variables = object.getVariables();
      return {
        action: variables.get('Action').getAsString(),
        x: object.getX(), y: object.getY(), width: object.getWidth(), height: object.getHeight(),
        hidden: object.isHidden(),
      };
    });
    const rotate = scene.getObjects('TouchRotateOverlay')[0];
    return {
      loaded: true,
      mode: string('GameMode'),
      touchVisible: vars.get('TouchControlsVisible').getAsBoolean(),
      playerX: player ? player.getX() : null,
      jumps: value('Jumps'),
      shots: value('EnergyShots') + value('CannonShots') + value('MissileShots'),
      gameplayTimeScale: scene.getLayer('Gameplay').getTimeScale(),
      buttons,
      rotateHidden: rotate ? rotate.isHidden() : null,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      coarse: window.matchMedia('(pointer: coarse)').matches,
      maxTouchPoints: navigator.maxTouchPoints,
    };
  });
}

function assertSafeButtonLayout(snapshot) {
  assert.equal(snapshot.buttons.length, 7);
  assert.equal(new Set(snapshot.buttons.map(button => button.action)).size, 7);
  for (const button of snapshot.buttons) {
    assert.ok(button.width >= 60 && button.height >= 60, `${button.action} has a minimum 60px hit area`);
    assert.ok(button.x >= 0 && button.y >= 0, `${button.action} starts inside the reference canvas`);
    assert.ok(button.x + button.width <= 960, `${button.action} stays horizontally inside the canvas`);
    assert.ok(button.y + button.height <= 640, `${button.action} stays vertically inside the canvas`);
  }
  for (let left = 0; left < snapshot.buttons.length; left += 1) {
    for (let right = left + 1; right < snapshot.buttons.length; right += 1) {
      const a = snapshot.buttons[left];
      const b = snapshot.buttons[right];
      const overlap = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
      assert.equal(overlap, false, `${a.action} and ${b.action} hit areas do not overlap`);
    }
  }
}

let browser;
(async () => {
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}/`;
    browser = await chromium.launch({ channel: 'msedge', headless: true });

    const desktopContext = await browser.newContext({ viewport: { width: 960, height: 640 } });
    const desktop = await openPage(desktopContext, url);
    const desktopStart = await state(desktop.page);
    assert.equal(desktopStart.mode, 'Playing');
    assert.equal(desktopStart.touchVisible, false, 'desktop auto mode hides touch controls');
    await desktop.page.keyboard.down('ArrowRight');
    await desktop.page.waitForTimeout(250);
    await desktop.page.keyboard.up('ArrowRight');
    await desktop.page.waitForTimeout(100);
    const desktopMoved = await state(desktop.page);
    assert.ok(desktopMoved.playerX > desktopStart.playerX + 20, 'desktop keyboard remains functional');
    await desktop.page.screenshot({ path: path.join(evidence, 'desktop-960x640.png') });
    assert.deepEqual(desktop.errors, []);
    assert.deepEqual(desktop.external, []);
    await desktopContext.close();

    const mobileContext = await browser.newContext({
      viewport: { width: 844, height: 390 },
      screen: { width: 844, height: 390 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/136 Safari/537.36',
    });
    const mobile = await openPage(mobileContext, url);
    const mobileStart = await state(mobile.page);
    assert.equal(mobileStart.touchVisible, true, 'landscape touch device shows controls');
    assert.equal(mobileStart.rotateHidden, true);
    assertSafeButtonLayout(mobileStart);
    await mobile.page.screenshot({ path: path.join(evidence, 'mobile-landscape-844x390.png') });

    const canvas = mobile.page.locator('canvas').first();
    const box = await canvas.boundingBox();
    assert.ok(box && box.width > 0 && box.height > 0, 'game canvas has a visible size');
    const point = (x, y, id) => ({ x: box.x + x * box.width / 960, y: box.y + y * box.height / 640, id, radiusX: 4, radiusY: 4, force: 1 });
    const client = await mobileContext.newCDPSession(mobile.page);
    const touchPoints = [point(144, 568, 10), point(856, 564, 11), point(760, 572, 12)];
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
    await mobile.page.waitForTimeout(420);
    const combined = await state(mobile.page);
    assert.ok(combined.playerX > mobileStart.playerX + 5, 'right touch moves the player');
    assert.ok(combined.shots > mobileStart.shots, 'attack touch fires the equipped weapon');
    assert.ok(combined.jumps >= 1, 'jump touch reaches the real jump input');
    await mobile.page.screenshot({ path: path.join(evidence, 'mobile-multitouch.png') });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await mobile.page.waitForTimeout(350);
    const released = await state(mobile.page);
    assert.ok(released.shots <= combined.shots + 1, 'released attack stops continuous fire');

    await mobile.page.setViewportSize({ width: 390, height: 844 });
    await mobile.page.waitForTimeout(450);
    const portrait = await state(mobile.page);
    assert.equal(portrait.touchVisible, false, 'portrait hides the landscape controls');
    assert.equal(portrait.rotateHidden, false, 'portrait shows the rotate overlay');
    assert.equal(portrait.gameplayTimeScale, 0, 'portrait pauses gameplay');
    await mobile.page.screenshot({ path: path.join(evidence, 'mobile-portrait-390x844.png') });

    await mobile.page.setViewportSize({ width: 844, height: 390 });
    await mobile.page.waitForTimeout(450);
    const restored = await state(mobile.page);
    assert.equal(restored.touchVisible, true, 'returning to landscape restores touch controls');
    assert.equal(restored.gameplayTimeScale, 1, 'returning to landscape resumes gameplay');
    assert.deepEqual(mobile.errors, []);
    assert.deepEqual(mobile.external, []);

    const report = {
      status: 'passed',
      build: 'dist/mobile-web',
      desktop: { viewport: '960x640', touchHidden: true, keyboardMovement: true },
      mobile: {
        viewport: '844x390',
        touchVisible: true,
        multiTouch: ['right', 'attack', 'jump'],
        portraitOverlay: true,
        gameplayPausedInPortrait: true,
        restoredLandscape: true,
      },
      externalRequests: 0,
      errors: 0,
      safeLayout: '7 unique buttons, all >=60x60 reference pixels, no overlaps, inside 960x640',
      limitation: 'Headless browser emulation is not a physical phone, notch, background-resume or Android install test.',
    };
    fs.writeFileSync(path.join(evidence, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    await mobileContext.close();
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(error => {
  console.error(error.stack || error);
  server.close();
  process.exitCode = 1;
});