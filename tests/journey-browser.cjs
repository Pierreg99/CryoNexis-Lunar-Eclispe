/* Exercise the delivered quest journal without requesting graphics or a GPU. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const dist = path.resolve(__dirname, '../dist');
const artifacts = path.resolve(__dirname, 'artifacts');
const key = 'cryonexus.simulation.v1';
const CODE = '004-46-13091';
const SCENES = ['chamber', 'eclipse', 'ice-ring', 'nodes', 'terminal', 'void'];

async function saved(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), key); }
async function view(page, name) {
  const button = page.locator(`#journal-view-controls [data-journal-view="${name}"]`);
  await button.click();
  assert.equal(await button.getAttribute('aria-pressed'), 'true', 'The journal must expose the selected view');
}
async function accept(page, id) {
  await view(page, 'quests');
  const card = page.locator(`[data-quest-id="${id}"]`);
  const button = card.locator('[data-quest-action="quest"]');
  assert(await button.isEnabled(), id + ' must be available to accept');
  await button.click();
  assert((await saved(page)).journey.accepted.includes(id));
  assert((await page.locator('#journal-message').innerText()).trim(), 'Acceptance must produce a local receipt');
}
async function claim(page, id) {
  await view(page, 'quests');
  const card = page.locator(`[data-quest-id="${id}"]`);
  assert.equal(await card.getAttribute('data-status'), 'ready', id + ' must be ready from actual evidence');
  const button = card.locator('[data-quest-action="claim"]');
  assert(await button.isEnabled());
  await button.click();
  assert((await saved(page)).journey.claimed.includes(id));
  assert.equal(await card.getAttribute('data-status'), 'claimed');
}
async function inspect(page, id) {
  const button = page.locator(`.scene-inspect[data-inspect="${id}"]`);
  await button.click();
  assert((await saved(page)).journey.inspected.includes(id));
  const discovery = page.locator(`[data-discovery="${id}"]`);
  assert((await discovery.innerText()).trim(), 'Inspection must reveal a local scene clue');
}
async function step(page) {
  const before = (await saved(page)).tick;
  await page.locator('#simulation-step').click();
  assert.equal((await saved(page)).tick, before + 1);
}
async function expand(page, id) {
  const node = page.locator(`[data-node="${id}"]`);
  const trigger = node.locator('.node-trigger');
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
  assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
  return node;
}
async function signal(page, code) {
  await view(page, 'secrets');
  await page.locator('#signal-code').fill(code);
  await page.locator('#signal-form button[type="submit"]').click();
}
async function terminal(page, command) {
  const input = page.locator('#terminal-input');
  await input.fill(command);
  await input.press('Enter');
}
async function fit(page, label) {
  const sizes = await page.evaluate(() => ({ width: innerWidth, root: document.documentElement.scrollWidth,
    body: document.body.scrollWidth }));
  assert(sizes.root <= sizes.width + 1 && sizes.body <= sizes.width + 1,
    label + ' must fit the viewport: ' + JSON.stringify(sizes));
}
async function open(browser, url, viewport) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  const graphics = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (/\/(?:three\.min|scenes)\.js(?:\?|$)/.test(request.url())) graphics.push(request.url());
  });
  await page.goto(url, { waitUntil: 'load' });
  await page.locator('[data-quest-id="arrival"] [data-quest-action="quest"]').waitFor();
  assert.equal((await saved(page)).tick, 0, 'Reduced-motion visits must start with manual simulation time');
  return { context, page, errors, graphics };
}

async function desktopJourney(browser, url) {
  const { context, page, errors, graphics } = await open(browser, url, { width: 1365, height: 900 });
  try {
    await page.locator('#journal-open').click();
    assert.equal(await page.locator('#journal').getAttribute('role'), 'region');
    await fit(page, 'Desktop journal');
    const locked = page.locator('[data-quest-id="edge"] [data-quest-action]');
    assert(await locked.isDisabled(), 'The next quest must explain its gate before the first reward');

    const untouched = await saved(page);
    assert.equal(Object.hasOwn(untouched, 'journey'), false, 'The reset regression starts before any successful story action');
    await signal(page, 'wrong');
    assert.deepEqual(await saved(page), untouched, 'A rejected first signal must leave the model untouched');
    assert.equal(await page.locator('#signal-code').getAttribute('aria-invalid'), 'true');
    assert((await page.locator('#signal-feedback').innerText()).trim());
    await page.locator('#simulation-reset').click();
    await page.locator('#simulation-reset').click();
    assert.deepEqual(await saved(page), untouched, 'Reset may leave already-fresh model facts unchanged');
    assert.equal(await page.locator('#signal-feedback').innerText(), '',
      'Reset must clear a rejected signal receipt even when there is no saved story progress');
    assert.equal(await page.locator('#signal-code').getAttribute('aria-invalid'), 'false',
      'Reset must clear the stale puzzle error independently of model evidence changes');

    await signal(page, CODE);
    assert.equal((await saved(page)).journey?.secrets.includes('frequency') || false, false);
    assert((await page.locator('#signal-feedback').innerText()).trim(), 'Missing clues must explain the signal gate');
    assert.notEqual(await page.locator('#signal-code').getAttribute('aria-invalid'), 'true',
      'A correct signal without clues must report the clue gate rather than a malformed code');
    await accept(page, 'arrival');
    const receipt = await page.locator('#journal-message').innerText();
    await view(page, 'secrets');
    const input = page.locator('#signal-code');
    await input.fill('004-46-');
    await input.focus();
    const original = await input.elementHandle();
    const tick = (await saved(page)).tick;
    await page.evaluate(() => document.querySelector('#simulation-step').click());
    assert.equal((await saved(page)).tick, tick + 1, 'Focus preservation needs a real model update');
    assert(await original.evaluate(element => element === document.activeElement && element.isConnected),
      'A market step must preserve the active input element and its focus');
    assert.equal(await input.inputValue(), '004-46-');
    assert.equal(await page.locator('#journal-message').innerText(), receipt, 'Ticks must preserve the latest journal receipt');

    await inspect(page, 'chamber');
    const chamberClue = await page.locator('[data-discovery="chamber"]').innerText();
    await step(page);
    assert.equal(await page.locator('[data-discovery="chamber"]').innerText(), chamberClue,
      'Market updates must preserve the discovered clue next to its scene');
    await claim(page, 'arrival');
    await accept(page, 'edge');
    await inspect(page, 'eclipse');
    assert(!((await saved(page)).journey.ready.includes('edge')), 'The eclipse clue in Kontakt cannot finish Korona evidence');
    await page.locator('#journal .journal-time-controls a[href="#phase-controls"]').click();
    await page.locator('#phase-controls [data-phase="2"]').click();
    assert.equal((await saved(page)).phase, 2);
    await inspect(page, 'eclipse');
    await claim(page, 'edge');
    await accept(page, 'cartographer');
    const nextScene = page.locator('[data-quest-target="cartographer"]');
    const originalTarget = await nextScene.elementHandle();
    assert.equal(await nextScene.getAttribute('href'), '#ice-ring', 'The route must lead to the first scene not yet inspected');
    await view(page, 'secrets');
    await input.fill('004-46-');
    await input.focus();
    await page.evaluate(() => document.querySelector('.scene-inspect[data-inspect="ice-ring"]').click());
    assert((await saved(page)).journey.inspected.includes('ice-ring'), 'The next-scene update must follow a real inspection action');
    assert.equal(await originalTarget.getAttribute('href'), '#nodes', 'A new Nexus inspection must advance the route to the market');
    assert(await originalTarget.evaluate(element => element.isConnected && element === document.querySelector('[data-quest-target="cartographer"]')),
      'Changing the next destination must preserve the existing objective link');
    assert(await original.evaluate(element => element === document.activeElement && element.isConnected),
      'A story update must preserve another active input and its focus');
    assert.equal(await input.inputValue(), '004-46-', 'A new scene clue must not erase an in-progress puzzle answer');
    for (const id of SCENES) await inspect(page, id);
    await claim(page, 'cartographer');

    const beforeWrong = await saved(page);
    await signal(page, '004-46-13090');
    assert.deepEqual(await saved(page), beforeWrong, 'Wrong puzzle input must preserve all progression and economic state');
    assert.equal(await page.locator('#signal-code').getAttribute('aria-invalid'), 'true');
    const wrongMessage = await page.locator('#signal-feedback').innerText();
    assert(wrongMessage.trim(), 'A wrong code must produce local guidance');
    await page.locator('#signal-code').focus();
    await page.evaluate(() => document.querySelector('#simulation-step').click());
    assert.equal(await page.locator('#signal-feedback').innerText(), wrongMessage, 'A market step must retain the puzzle result');
    assert.equal(await page.locator('#signal-code').evaluate(element => element === document.activeElement), true);
    await signal(page, CODE);
    assert((await saved(page)).journey.secrets.includes('frequency'));
    assert.equal(await page.locator('#signal-code').getAttribute('aria-invalid'), 'false');
    await view(page, 'codex');
    const ember = page.locator('[data-theme="ember"]');
    assert(await ember.isEnabled(), 'The solved signal must unlock its cosmetic reward');
    await ember.click();
    assert.equal((await saved(page)).journey.theme, 'ember');
    assert.equal(await page.locator('body').getAttribute('data-signal-theme'), 'ember');

    await accept(page, 'beacon');
    const alpha = await expand(page, 'CN-ALPHA-01');
    await alpha.locator('[data-action="link"]').click();
    assert.equal((await saved(page)).journey.ready.includes('beacon'), false, 'A binding must not replace stabilization evidence');
    await alpha.locator('[data-action="stabilize"]').click();
    assert((await saved(page)).journey.ready.includes('beacon'));
    await claim(page, 'beacon');
    await accept(page, 'yield');
    for (const id of ['CN-BOREALIS', 'CN-KRYO-7X']) {
      const node = await expand(page, id);
      await node.locator('[data-action="link"]').click();
      assert((await saved(page)).nodes.find(node => node.id === id).bound);
    }
    assert.equal(await page.locator('#vault-state').innerText(), 'ZEITFENSTER OFFEN');
    await page.locator('#vault-amount').fill('1000');
    await page.locator('#vault-deposit').click();
    assert.equal((await saved(page)).vault.balance, 1000);
    assert.equal((await saved(page)).journey.ready.includes('yield'), false);
    await step(page);
    assert((await saved(page)).vault.earned > 0);
    await claim(page, 'yield');
    await accept(page, 'remembrance');
    const journalPause = page.locator('#journal-pause');
    assert.equal(await journalPause.getAttribute('aria-pressed'), 'false');
    await journalPause.click();
    assert.equal((await saved(page)).paused, true);
    assert.equal(await journalPause.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#simulation-pause').getAttribute('aria-pressed'), 'true',
      'Journal and simulation time controls must reflect the same paused model');
    assert.match(await page.locator('#journal-time-mode').innerText(), /PAUSIERT/);
    await inspect(page, 'void');
    assert((await saved(page)).journey.secrets.includes('silence'));
    await claim(page, 'remembrance');
    await view(page, 'codex');
    const aurora = page.locator('[data-theme="aurora"]');
    assert(await aurora.isEnabled(), 'The final quest must unlock the aurora theme');
    await aurora.click();
    assert.equal(await page.locator('body').getAttribute('data-signal-theme'), 'aurora');
    await page.locator('.phases [data-phase="3"]').click();
    await inspect(page, 'ice-ring');
    assert((await saved(page)).journey.secrets.includes('refraction'));
    await terminal(page, 'echo 42');
    assert((await saved(page)).journey.eggs.includes('answer'), 'The hidden terminal response must record the discovered egg');
    await terminal(page, 'quests');
    assert((await page.locator('#terminal-output').innerText()).includes('6'), 'Terminal quest guidance must reflect the same progression');
    await view(page, 'codex');
    assert.equal(await page.locator('#journal-codex [data-lore-id]').count(), 10);
    assert(await page.locator('[data-lore-id="quest-remembrance"]').isVisible());
    assert(await page.locator('[data-lore-id="secret-frequency"]').isVisible());
    assert(await page.locator('[data-lore-id="egg-answer"]').isVisible());
    const completed = await saved(page);
    await page.reload({ waitUntil: 'load' });
    await page.locator('[data-quest-id="arrival"]').waitFor();
    assert.deepEqual(await saved(page), completed, 'Reload must restore the actual journal and market state');
    assert.equal(await page.locator('body').getAttribute('data-signal-theme'), 'aurora');
    await view(page, 'quests');
    assert.equal(await page.locator('[data-quest-id][data-status="claimed"]').count(), 6);
    assert.match(await page.locator('#journal-progress').innerText(), /6/);
    await page.locator('#journal').evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.screenshot({ path: path.join(artifacts, 'journey-desktop.png') });
    assert.deepEqual(graphics, [], 'Reduced-motion quests must work without downloading scene scripts or Three.js');
    assert.deepEqual(errors, []);
    console.log('PASS journey browser: complete real quest route, puzzle gates, causal rewards, stable focus/receipts, codex and reload');
  } finally { await context.close(); }
}

async function mobileJourney(browser, url) {
  const { context, page, errors, graphics } = await open(browser, url, { width: 390, height: 844 });
  try {
    await page.locator('#journal-open').click();
    await fit(page, 'Mobile quest journal');
    await accept(page, 'arrival');
    await inspect(page, 'chamber');
    await claim(page, 'arrival');
    await accept(page, 'edge');
    await page.locator('.phases [data-phase="2"]').click();
    await inspect(page, 'eclipse');
    await claim(page, 'edge');
    await accept(page, 'beacon');
    const alpha = await expand(page, 'CN-ALPHA-01');
    await alpha.locator('[data-action="link"]').click();
    await alpha.locator('[data-action="stabilize"]').click();
    await claim(page, 'beacon');
    await inspect(page, 'ice-ring');
    await signal(page, 'wrong');
    assert.equal(await page.locator('#signal-code').getAttribute('aria-invalid'), 'true');
    await signal(page, CODE);
    assert((await saved(page)).journey.secrets.includes('frequency'));
    assert(parseFloat(await page.locator('#signal-code').evaluate(element => getComputedStyle(element).fontSize)) >= 16,
      'The mobile puzzle input must be readable without focus zoom');
    const signalSize = await page.locator('#signal-form button').boundingBox();
    assert(signalSize.width >= 44 && signalSize.height >= 44, 'The mobile signal submission needs a usable touch area');
    await view(page, 'codex');
    await page.locator('[data-theme="ember"]').click();
    assert.equal(await page.locator('body').getAttribute('data-signal-theme'), 'ember');
    const targets = await page.locator('#journal-pause, #journal-view-controls button, #journal-themes button, #signal-form button, .scene-inspect')
      .evaluateAll(elements => elements.filter(element => element.getClientRects().length).map(element => {
        const rect = element.getBoundingClientRect();
        return { name: element.textContent.trim(), width: rect.width, height: rect.height };
      }));
    assert(targets.length >= 10, 'Mobile checks must include journal and scene controls');
    for (const target of targets) assert(target.width >= 44 && target.height >= 44,
      'Mobile target needs a usable touch area: ' + JSON.stringify(target));
    for (const name of ['quests', 'secrets', 'codex']) {
      await view(page, name);
      await fit(page, 'Mobile ' + name);
    }
    assert(await page.locator('[data-lore-id="secret-frequency"]').isVisible());
    await page.locator('#journal').evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.screenshot({ path: path.join(artifacts, 'journey-mobile.png') });
    const final = await saved(page);
    await page.reload({ waitUntil: 'load' });
    await page.locator('[data-quest-id="arrival"]').waitFor();
    assert.deepEqual(await saved(page), final);
    assert.equal(await page.locator('body').getAttribute('data-signal-theme'), 'ember');
    assert.deepEqual(graphics, []);
    assert.deepEqual(errors, []);
    console.log('PASS journey browser: mobile quest/scene/node controls, signal reward, theme persistence, codex and touch targets');
  } finally { await context.close(); }
}

async function main() {
  await fs.mkdir(artifacts, { recursive: true });
  const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.txt': 'text/plain' };
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = path.resolve(dist, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!file.startsWith(dist + path.sep)) throw new Error('Invalid path');
      const data = await fs.readFile(file);
      response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
      response.end(data);
    } catch (_) { response.writeHead(404); response.end('File not found'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let executablePath = process.env.CHROMIUM_PATH;
  if (!executablePath) {
    try { await fs.access('/usr/bin/chromium'); executablePath = '/usr/bin/chromium'; }
    catch (_) { executablePath = chromium.executablePath(); }
  }
  let browser;
  try {
    browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
    const url = `http://127.0.0.1:${server.address().port}/`;
    await desktopJourney(browser, url);
    await mobileJourney(browser, url);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
