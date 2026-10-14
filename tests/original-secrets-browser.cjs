/* Follow original secrets through the delivered controls without loading WebGL. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const dist = path.resolve(__dirname, '../dist');
const artifacts = path.resolve(__dirname, 'artifacts');
const key = 'cryonexus.simulation.v1';
const SCENES = ['chamber', 'eclipse', 'ice-ring', 'nodes', 'terminal', 'void'];
const ORIGINAL = ['homecoming', 'witness', 'reply'];

async function saved(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), key); }
function discovered(state, id) { return !!state.journey && state.journey.secrets.includes(id); }
async function view(page, name) {
  const button = page.locator(`#journal-view-controls [data-journal-view="${name}"]`);
  await button.click();
  assert.equal(await button.getAttribute('aria-pressed'), 'true');
}
async function inspect(page, id) {
  await page.locator(`.scene-inspect[data-inspect="${id}"]`).click();
  assert((await saved(page)).journey.inspected.includes(id), 'Real scene controls must save inspection evidence');
  const text = await page.locator(`[data-discovery="${id}"]`).textContent();
  assert(text.trim(), 'Inspection must expose its actual scene clue');
  return text;
}
async function signal(page, code) {
  await view(page, 'secrets');
  await page.locator('#signal-code').fill(code);
  await page.locator('#signal-form button[type="submit"]').click();
}
async function echo(page, word) {
  await view(page, 'secrets');
  await page.locator('#echo-word').fill(word);
  await page.locator('#echo-form button[type="submit"]').click();
}
async function fit(page, label) {
  const sizes = await page.evaluate(() => ({ width: innerWidth,
    root: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  assert(sizes.root <= sizes.width + 1 && sizes.body <= sizes.width + 1,
    label + ' must fit the viewport: ' + JSON.stringify(sizes));
}
async function unchanged(page, action, message) {
  const before = await saved(page);
  await action();
  assert.deepEqual(await saved(page), before, message);
}

async function route(browser, url, mobile) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1365, height: 900 },
    reducedMotion: 'reduce'
  });
  const page = await context.newPage();
  const errors = [];
  const graphics = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (/\/(?:three\.min|scenes)\.js(?:\?|$)/.test(request.url())) graphics.push(request.url());
  });
  const label = mobile ? 'mobile' : 'desktop';
  try {
    await page.goto(url, { waitUntil: 'load' });
    await page.locator('[data-quest-id="arrival"]').waitFor();
    assert.equal((await saved(page)).tick, 0, 'Reduced motion must retain manual time');
    await page.locator('#journal-open').click();
    await view(page, 'secrets');
    await fit(page, label + ' secrets');
    const cards = page.locator('#journal-secret-list [data-secret-id]');
    assert.equal(await cards.count(), 6, 'The journal must expose all six original and existing secret slots');
    assert.equal(await page.locator('#journal-secret-list [data-discovered="false"]').count(), 6);
    assert.match(await page.locator('#journal-progress').innerText(), /0\s*\/\s*6 Signale/);
    for (const id of ORIGINAL) {
      const card = page.locator('#journal-secret-' + id);
      assert.match(await card.locator('h4').innerText(), /^Unbekanntes Signal/);
      assert.equal(await card.locator('details').getAttribute('open'), null, 'Hints must start closed');
      await card.locator('summary').click();
      const hint = await card.locator('.journal-hint').innerText();
      assert(hint.trim());
      assert(!/\bHIER\b|13091-46-004/i.test(hint), 'Hints must invite exploration without handing over answers');
      await card.locator('summary').click();
    }
    assert(await page.locator('#echo-word').isVisible(), 'The word puzzle needs a visible form outside the terminal');
    assert.match(await page.locator('#echo-word').getAttribute('aria-describedby'), /echo-feedback/);
    await unchanged(page, () => echo(page, 'HIER'), 'Correct words with missing clues must preserve the fresh model');
    assert.equal(await page.locator('#echo-word').getAttribute('aria-invalid'), 'false', 'Missing clues are a progress gate');
    assert((await page.locator('#echo-feedback').innerText()).trim());
    await unchanged(page, () => signal(page, '13091-46-004'), 'The reply cannot open before the initial frequency');
    assert.equal(await page.locator('#signal-code').getAttribute('aria-invalid'), 'false');
    await unchanged(page, () => echo(page, 'HEIR'), 'Wrong words must preserve every model field');
    assert.equal(await page.locator('#echo-word').getAttribute('aria-invalid'), 'true');
    await page.locator('#simulation-reset').click();
    await page.locator('#simulation-reset').click();
    assert.equal(await page.locator('#echo-feedback').innerText(), '', 'Reset must clear local echo errors on a fresh model');
    assert.equal(await page.locator('#signal-feedback').innerText(), '', 'Reset must clear local signal gates on a fresh model');
    assert.equal(await page.locator('#echo-word').getAttribute('aria-invalid'), 'false');
    assert.equal(await page.locator('#signal-code').getAttribute('aria-invalid'), 'false');

    const clues = {};
    for (const id of SCENES) clues[id] = await inspect(page, id);
    assert.equal(discovered(await saved(page), 'homecoming'), false, 'The sixth scene must not substitute for a return');
    await inspect(page, 'chamber');
    assert(discovered(await saved(page), 'homecoming'));
    await view(page, 'secrets');
    assert.equal(await page.locator('#journal-secret-homecoming').getAttribute('data-discovered'), 'true');

    const word = clues.nodes.trim().split('\n').slice(-4).map(line => line.trim()[0]).join('');
    assert.equal(word, 'HIER', 'The displayed clue must itself yield the word puzzle answer');
    assert.match(clues.terminal, /Anfangsbuchstaben/);
    assert.match(clues.void, /siebte Stimme/);
    const input = page.locator('#echo-word');
    await input.fill('Hi');
    await input.focus();
    const element = await input.elementHandle();
    const tick = (await saved(page)).tick;
    const receipt = await page.locator('#journal-message').innerText();
    await page.evaluate(() => document.querySelector('#simulation-step').click());
    assert.equal((await saved(page)).tick, tick + 1, 'Stable focus must be verified against a real market tick');
    assert(await element.evaluate(node => node.isConnected && node === document.activeElement));
    assert.equal(await input.inputValue(), 'Hi', 'A tick must preserve the partly entered word');
    assert.equal(await page.locator('#journal-message').innerText(), receipt);
    await page.evaluate(() => document.querySelector('.scene-inspect[data-inspect="nodes"]').click());
    assert(await element.evaluate(node => node.isConnected && node === document.activeElement));
    assert.equal(await input.inputValue(), 'Hi', 'A scene inspection must preserve a partly entered word');
    await echo(page, '  ' + word + '  ');
    assert(discovered(await saved(page), 'witness'), 'The visible form must send its trimmed word to the model');
    assert.equal(await input.getAttribute('aria-invalid'), 'false');
    assert.match(await page.locator('#echo-feedback').innerText(), /GEHEIMNIS ENTDECKT/);
    await unchanged(page, () => echo(page, 'hIeR'), 'Repeated case-insensitive answers must not grant another reward');
    assert.equal(await input.getAttribute('aria-invalid'), 'false', 'An already discovered word is valid input');

    const chamber = clues.chamber.match(/Kammer (\d+)/);
    const count = clues['ice-ring'].match(/(\d+) Kristallschollen/);
    const index = clues['ice-ring'].match(/Brechungsindex beträgt (\d+),(\d+)/);
    assert(chamber && count && index);
    const fields = [chamber[1].padStart(3, '0'), count[1], index[1] + index[2]];
    const outgoing = fields.join('-');
    const reply = fields.slice().reverse().join('-');
    await unchanged(page, () => signal(page, reply), 'Even a complete map cannot replace receiving the original frequency');
    await signal(page, outgoing);
    assert(discovered(await saved(page), 'frequency'));
    await view(page, 'codex');
    assert.match(await page.locator('[data-lore-id="secret-frequency"]').innerText(), /III — II — I/);
    await unchanged(page, () => signal(page, '19031-64-400'), 'Reversing digits instead of fields must be rejected atomically');
    assert.equal(await page.locator('#signal-code').getAttribute('aria-invalid'), 'true');
    await signal(page, reply);
    assert(discovered(await saved(page), 'reply'));
    assert.equal(await page.locator('#signal-code').getAttribute('aria-invalid'), 'false');
    await unchanged(page, () => signal(page, reply), 'Repeating the reply must not change any saved state');
    assert.equal(await page.locator('#signal-code').getAttribute('aria-invalid'), 'false');

    await page.locator('#journal-pause').click();
    assert.equal((await saved(page)).paused, true);
    await inspect(page, 'void');
    assert(discovered(await saved(page), 'silence'));
    await page.locator('#phase-controls [data-phase="3"]').click();
    await inspect(page, 'ice-ring');
    assert(discovered(await saved(page), 'refraction'));
    await view(page, 'secrets');
    assert.equal(await page.locator('#journal-secret-list [data-discovered="true"]').count(), 6);
    assert.match(await page.locator('#journal-progress').innerText(), /6\s*\/\s*6 Signale/);
    await view(page, 'codex');
    assert.equal(await page.locator('#journal-codex [data-lore-id]').count(), 6);
    for (const id of ORIGINAL) assert(await page.locator('[data-lore-id="secret-' + id + '"]').isVisible());
    await fit(page, label + ' complete archive');

    if (mobile) {
      await view(page, 'secrets');
      for (const selector of ['#echo-word', '#signal-code']) {
        const font = await page.locator(selector).evaluate(node => parseFloat(getComputedStyle(node).fontSize));
        assert(font >= 16, selector + ' needs a readable mobile font without focus zoom');
      }
      const sizes = await page.locator('#echo-form button, #signal-form button, #journal-view-controls button, .scene-inspect')
        .evaluateAll(nodes => nodes.filter(node => node.getClientRects().length).map(node => {
          const box = node.getBoundingClientRect();
          return { text: node.textContent.trim(), width: box.width, height: box.height };
        }));
      assert(sizes.length >= 11, 'Touch checks must include both forms, navigation and all six scene controls');
      for (const size of sizes) assert(size.width >= 44 && size.height >= 44,
        'Touch controls need 44px targets: ' + JSON.stringify(size));
      for (const name of ['quests', 'secrets', 'codex']) { await view(page, name); await fit(page, 'mobile ' + name); }
    }
    const completed = await saved(page);
    await page.reload({ waitUntil: 'load' });
    await page.locator('[data-quest-id="arrival"]').waitFor();
    assert.deepEqual(await saved(page), completed, 'Reload must preserve the six earned discoveries and the market');
    await view(page, 'secrets');
    assert.equal(await page.locator('#journal-secret-list [data-discovered="true"]').count(), 6);
    assert.match(await page.locator('#journal-progress').innerText(), /6\s*\/\s*6 Signale/);
    await view(page, 'codex');
    for (const id of ORIGINAL) assert(await page.locator('[data-lore-id="secret-' + id + '"]').isVisible());
    await page.locator('#journal').evaluate(node => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.screenshot({ path: path.join(artifacts, 'original-secrets-' + label + '.png') });
    await page.locator('#simulation-reset').click();
    await page.locator('#simulation-reset').click();
    const cleared = await saved(page);
    assert.equal(cleared.journey?.secrets.length || 0, 0);
    assert.equal(cleared.journey?.inspected.length || 0, 0);
    await view(page, 'secrets');
    assert.equal(await page.locator('#journal-secret-list [data-discovered="false"]').count(), 6);
    assert.equal(await page.locator('#echo-feedback').innerText(), '');
    assert.equal(await page.locator('#signal-feedback').innerText(), '');
    assert.equal(await page.locator('#echo-word').getAttribute('aria-invalid'), 'false');
    assert.equal(await page.locator('#signal-code').getAttribute('aria-invalid'), 'false');
    assert.match(await page.locator('#journal-progress').innerText(), /0\s*\/\s*6 Signale/);
    await view(page, 'codex');
    assert.equal(await page.locator('#journal-codex [data-lore-id]').count(), 0);
    assert.deepEqual(graphics, [], 'Original secrets must work without requesting scene scripts or Three.js');
    assert.deepEqual(errors, [], 'The complete route must not throw page errors');
    console.log('PASS original secrets browser: ' + label + ' real clue route, form gates, six counters, archive, reload, reset' +
      (mobile ? ', touch targets and viewport fit' : ', input focus and partial answer preservation'));
  } finally { await context.close(); }
}

async function main() {
  await fs.mkdir(artifacts, { recursive: true });
  const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' };
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
    await route(browser, url, false);
    await route(browser, url, true);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
