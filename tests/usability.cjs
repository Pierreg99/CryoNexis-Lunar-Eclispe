/* Regression checks for actionable controls, local feedback and deliberate sound. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const dist = path.resolve(__dirname, '../dist');

async function open(browser, url, viewport) {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport });
  await context.addInitScript(() => {
    window.__usabilityAudio = [];
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (Audio) {
      class ObservedAudioContext extends Audio {
        constructor(...args) {
          super(...args);
          window.__usabilityAudio.push({ context: this, gesture: navigator.userActivation.isActive });
        }
      }
      window.AudioContext = ObservedAudioContext;
      if (window.webkitAudioContext) window.webkitAudioContext = ObservedAudioContext;
    }
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url, { waitUntil: 'load' });
  await page.locator('[data-node="CN-ALPHA-01"] .node-trigger').waitFor();
  return { context, page, errors };
}

async function saved(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('cryonexus.simulation.v1')));
}

async function expand(page, id) {
  const node = page.locator(`[data-node="${id}"]`);
  const trigger = node.locator('.node-trigger');
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
  assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(await node.locator('.node-details').evaluate(element => element.inert), false);
  return node;
}

async function step(page) {
  const before = (await saved(page)).tick;
  await page.locator('#simulation-step').click();
  assert.equal((await saved(page)).tick, before + 1, 'The feedback check must include a real market step');
}

async function desktopControls(browser, url) {
  const { context, page, errors } = await open(browser, url, { width: 1280, height: 900 });
  try {
    await page.locator('h1').click();
    assert.equal(await page.locator('#audio-toggle').getAttribute('aria-pressed'), 'false',
      'A general pointer interaction must leave sound off');
    assert.equal(await page.evaluate(() => __usabilityAudio.length), 0,
      'An unrelated interaction must not create an audio context');
    await page.locator('#audio-toggle').click();
    await page.waitForFunction(() => document.querySelector('#audio-toggle').getAttribute('aria-pressed') === 'true');
    const audio = await page.evaluate(() => __usabilityAudio.map(item => ({ state: item.context.state, gesture: item.gesture })));
    assert.equal(audio.length, 1);
    assert(audio.every(item => item.gesture && item.state === 'running'), 'Sound must start from explicit user activation');
    await page.locator('#audio-toggle').click();
    await page.waitForFunction(() => document.querySelector('#audio-toggle').getAttribute('aria-pressed') === 'false');

    const alpha = page.locator('[data-node="CN-ALPHA-01"]');
    const trigger = alpha.locator('.node-trigger');
    await trigger.scrollIntoViewIfNeeded();
    assert(await alpha.locator('.node-disclosure').isVisible(), 'Collapsed cards must visibly disclose their actions');
    assert.match(await alpha.locator('.node-disclosure').innerText(), /Details|Aktionen/i);
    await trigger.focus();
    await trigger.press('Enter');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true', 'Enter expands node details');
    await trigger.press('Space');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false', 'Space collapses node details');
    assert.equal(await alpha.locator('.node-details').evaluate(element => element.inert), true);
    await trigger.press('Enter');

    const quantity = alpha.locator('.node-quantity');
    const quote = alpha.locator('.node-quote');
    const unchanged = await saved(page);
    await quantity.fill('-1');
    assert.equal(await quantity.getAttribute('aria-invalid'), 'true');
    assert.match(await quote.innerText(), /positiv|Menge/i);
    assert(await alpha.locator('[data-action="buy"]').isDisabled());
    assert(await alpha.locator('[data-action="sell"]').isDisabled());
    assert.deepEqual(await saved(page), unchanged, 'Invalid edits must not mutate the simulation');
    const descriptions = (await quantity.getAttribute('aria-describedby') || '').split(/\s+/);
    assert(descriptions.includes(await quote.getAttribute('id')), 'Quantity errors must be associated with their field');
    assert(descriptions.includes(await alpha.locator('.node-feedback').getAttribute('id')),
      'Trade outcomes must be associated with their quantity field');

    await quantity.fill('1000');
    assert.notEqual(await quantity.getAttribute('aria-invalid'), 'true', 'Lack of funds does not make a valid quantity malformed');
    assert(await alpha.locator('[data-action="buy"]').isDisabled());
    assert.match(await quote.innerText(), /Guthaben reicht nicht|nicht genügend|fehlen|zu wenig/i,
      'An unaffordable quote must explain the disabled purchase');
    await quantity.fill('1');
    await alpha.locator('[data-action="buy"]').click();
    assert.equal((await saved(page)).nodes[0].quantity, 1, 'The trade must execute before checking its receipt');
    const tradeFeedback = await alpha.locator('.node-feedback').innerText();
    assert.match(tradeFeedback, /gekauft|Kauf/i);
    await step(page);
    assert.equal(await alpha.locator('.node-feedback').innerText(), tradeFeedback,
      'A market update must not erase the result next to the control');

    const guide = page.locator('#vault-guide-status');
    const guideLink = page.locator('#vault-guide-link');
    const initialGuide = await guide.innerText();
    assert(initialGuide.trim(), 'The guide must describe the next action');
    assert.equal(await guideLink.getAttribute('href'), '#node-grid');
    let bindingFeedback;
    for (const id of ['CN-ALPHA-01', 'CN-BOREALIS', 'CN-KRYO-7X']) {
      const node = await expand(page, id);
      await node.locator('[data-action="link"]').click();
      assert((await saved(page)).nodes.find(item => item.id === id).bound, `${id} must actually become bound`);
      bindingFeedback = await node.locator('.node-feedback').innerText();
      assert.match(bindingFeedback, /gebunden|Bindung/i);
      if (id === 'CN-ALPHA-01') {
        assert.notEqual(bindingFeedback, tradeFeedback, 'The newer binding action must replace its trade result');
        await step(page);
        assert.equal(await node.locator('.node-feedback').innerText(), bindingFeedback);
      }
    }
    assert.notEqual(await guide.innerText(), initialGuide, 'The guide must respond to completed bindings');
    assert.equal(await guideLink.getAttribute('href'), '#void', 'Three bindings should lead to phase selection');
    await page.locator('.phases [data-phase="2"]').click();
    assert.equal(await page.locator('#vault-state').innerText(), 'ZEITFENSTER OFFEN');
    assert.equal(await guideLink.getAttribute('href'), '#terminal', 'An open Vault should lead to its controls');
    assert.match(await guide.innerText(), /offen/i);

    const amount = page.locator('#vault-amount');
    const vaultFeedback = page.locator('#vault-feedback');
    await amount.fill('0');
    assert.equal(await amount.getAttribute('aria-invalid'), 'true');
    assert.match(await vaultFeedback.innerText(), /positiv|Betrag/i);
    const beforeInvalidDeposit = await saved(page);
    if (!(await page.locator('#vault-deposit').isDisabled())) await page.locator('#vault-deposit').click();
    assert.deepEqual(await saved(page), beforeInvalidDeposit, 'An invalid Vault amount must preserve all balances');
    await amount.fill('1000');
    assert.notEqual(await amount.getAttribute('aria-invalid'), 'true');
    await page.locator('#vault-deposit').click();
    assert.equal((await saved(page)).vault.balance, 1000);
    const depositFeedback = await vaultFeedback.innerText();
    assert.match(depositFeedback, /eingezahlt|eingelagert|Einlage/i);
    await step(page);
    assert((await saved(page)).vault.balance > 1000, 'The feedback check must include an interest-bearing step');
    assert.equal(await vaultFeedback.innerText(), depositFeedback, 'A tick must preserve the Vault transaction result');
    await amount.fill('0');
    await page.locator('#simulation-reset').click();
    await page.locator('#simulation-reset').click();
    const resetState = await saved(page);
    assert.equal(resetState.cash, 100000);
    assert.equal(resetState.vault.balance, 0);
    assert(resetState.nodes.every(node => node.quantity === 0 && !node.bound));
    assert.equal(await alpha.locator('.node-feedback').innerText(), '', 'Reset must remove obsolete node receipts');
    assert.equal(await amount.getAttribute('aria-invalid'), 'true', 'Reset must preserve validation for an invalid field');
    assert.match(await vaultFeedback.innerText(), /positiven Betrag|positiv/i,
      'Reset must retain relevant field guidance instead of the obsolete Vault receipt');
    assert.notEqual(await vaultFeedback.innerText(), depositFeedback);
    await amount.fill('1000');
    assert.equal(await amount.getAttribute('aria-invalid'), 'false');
    assert.equal(await vaultFeedback.innerText(), '', 'Correcting the reset field must clear its validation guidance');
    assert.deepEqual(errors, []);
    console.log('PASS usability: deliberate sound, keyboard disclosure, contextual trade and Vault feedback, next-step guide');
  } finally { await context.close(); }
}

async function mobileNavigation(browser, url) {
  const { context, page, errors } = await open(browser, url, { width: 390, height: 844 });
  try {
    await expand(page, 'CN-ALPHA-01');
    for (const selector of ['.node-quantity', '#vault-amount', '#terminal-input']) {
      const sizes = await page.locator(selector).evaluateAll(elements => elements.map(element => parseFloat(getComputedStyle(element).fontSize)));
      assert(sizes.length && sizes.every(size => size >= 16), `${selector} must be readable without mobile focus zoom`);
    }
    for (const id of ['eclipse', 'ice-ring', 'nodes', 'terminal', 'void', 'chamber']) {
      await page.locator(`#${id}`).evaluate(section => section.scrollIntoView({ behavior: 'instant', block: 'start' }));
      await page.waitForFunction(expected => {
        const active = Array.from(document.querySelectorAll('header nav a[aria-current="location"]'));
        return active.length === 1 && active[0].getAttribute('href') === '#' + expected;
      }, id);
      const dimensions = await page.evaluate(() => ({
        viewport: innerWidth, root: document.documentElement.scrollWidth, body: document.body.scrollWidth
      }));
      assert(dimensions.root <= dimensions.viewport + 1 && dimensions.body <= dimensions.viewport + 1,
        `Section ${id} must fit the mobile viewport: ${JSON.stringify(dimensions)}`);
    }
    assert.deepEqual(errors, []);
    console.log('PASS usability: reduced-motion active navigation, readable mobile fields and viewport fit');
  } finally { await context.close(); }
}

async function main() {
  const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.txt': 'text/plain' };
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = path.resolve(dist, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!file.startsWith(`${dist}${path.sep}`)) throw new Error('Invalid path');
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
    const args = ['--no-sandbox'];
    if (process.env.USE_SOFTWARE_GPU !== '0') args.push('--enable-unsafe-swiftshader', '--use-angle=swiftshader');
    browser = await chromium.launch({ executablePath, headless: true, args });
    const url = `http://127.0.0.1:${server.address().port}/`;
    await desktopControls(browser, url);
    await mobileNavigation(browser, url);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
