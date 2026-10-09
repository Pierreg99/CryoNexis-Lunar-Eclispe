/* Exercise the delivered files in Chromium without a build or runtime server dependency. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const artifacts = path.join(__dirname, 'artifacts');
const sectionIds = ['chamber', 'eclipse', 'ice-ring', 'nodes', 'terminal', 'void'];
const sceneIds = ['cn-chamber', 'cn-eclipse', 'cn-nexus', 'cn-crystal', 'cn-vault', 'cn-void'];
const report = { browser: '', payloadBytes: 0, runs: [], blocked: [], status: 'running' };
const suites = new Set((process.env.ACCEPTANCE_SUITE || 'all').split(','));
const enabled = suite => suites.has('all') || suites.has(suite);

async function files(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory()
    ? files(path.join(directory, entry.name)) : [path.join(directory, entry.name)]));
  return nested.flat();
}

async function staticAcceptance() {
  const delivered = await files(dist);
  report.payloadBytes = (await Promise.all(delivered.map(file => fs.stat(file))))
    .reduce((sum, stat) => sum + stat.size, 0);
  assert(report.payloadBytes < 1_200_000, `Payload ${report.payloadBytes} exceeds 1.2 MB`);
  const expected = ['index.html', 'assets/css/main.css', 'assets/js/scenes.js',
    'assets/js/app.js', 'assets/vendor/three.min.js', 'assets/vendor/cinema_engine.js'];
  await Promise.all(expected.map(file => fs.access(path.join(dist, file))));
  const html = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
  const scripts = Array.from(html.matchAll(/<script\s+src="([^"]+)"/g), match => match[1]);
  assert.deepEqual(scripts, ['assets/vendor/three.min.js', 'assets/vendor/cinema_engine.js',
    'assets/js/scenes.js', 'assets/js/app.js']);
  assert.match(html, /<html lang="de"/);
  const css = await fs.readFile(path.join(dist, 'assets/css/main.css'), 'utf8');
  assert.deepEqual(Array.from(css.matchAll(/\/\*\s*(\d{2})\s*[—-]/g), match => Number(match[1])),
    Array.from({ length: 20 }, (_, index) => index + 1));
  const app = await fs.readFile(path.join(dist, 'assets/js/app.js'), 'utf8');
  assert.doesNotMatch(app, /\bTHREE\b|\bcinema\.boot\s*\(|\bWebGLRenderer\b/,
    'The interface layer must not construct 3D scenes');
  for (const file of delivered.filter(file => /\.(html|css|js)$/.test(file) && !file.endsWith('three.min.js'))) {
    assert.doesNotMatch(await fs.readFile(file, 'utf8'), /\bTODO\b|\bFIXME\b/,
      `Unfinished marker in ${path.relative(dist, file)}`);
  }
}

function instrument() {
  const monitor = window.__acceptance = {
    rafRequests: 0, rafCallbacks: 0, contexts: [], builds: [], audioContexts: [],
    gestures: [], phaseEvents: [], phaseTimers: [], contextEvents: { lost: 0, restored: 0 },
  };
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...args) {
    const context = getContext.call(this, type, ...args);
    if (/^webgl2?$|^experimental-webgl$/.test(type) && context && !monitor.contexts.includes(context)) {
      monitor.contexts.push(context);
      this.addEventListener('webglcontextlost', () => monitor.contextEvents.lost++);
      this.addEventListener('webglcontextrestored', () => monitor.contextEvents.restored++);
    }
    return context;
  };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = callback => {
    monitor.rafRequests++;
    return raf(time => { monitor.rafCallbacks++; callback(time); });
  };
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (Audio) {
    class ObservedAudioContext extends Audio {
      constructor(...args) {
        super(...args);
        monitor.audioContexts.push({ context: this, gesture: navigator.userActivation.isActive });
      }
    }
    window.AudioContext = ObservedAudioContext;
    if (window.webkitAudioContext) window.webkitAudioContext = ObservedAudioContext;
  }
  const interval = window.setInterval.bind(window), clearInterval = window.clearInterval.bind(window);
  window.setInterval = (callback, delay, ...args) => {
    const marker = Number(delay) === 5200 ? { delay: Number(delay), scheduledAt: performance.now(), ticks: [], active: true } : null;
    const id = interval(marker && typeof callback === 'function' ? function (...values) {
      marker.ticks.push(performance.now()); callback.apply(window, values);
    } : callback, delay, ...args);
    if (marker) { marker.id = id; monitor.phaseTimers.push(marker); }
    return id;
  };
  window.clearInterval = id => {
    const marker = monitor.phaseTimers.find(timer => timer.id === id);
    if (marker) marker.active = false;
    clearInterval(id);
  };
  document.addEventListener('pointerdown', () => monitor.gestures.push('pointer'), true);
  document.addEventListener('keydown', () => monitor.gestures.push('keyboard'), true);
  document.addEventListener('cryonexus:scene', event => monitor.builds.push(event.detail));
  document.addEventListener('cryonexus:phase', event => monitor.phaseEvents.push(event.detail));
}

async function open(browser, url, options = {}) {
  const context = await browser.newContext({
    viewport: options.viewport || { width: 1440, height: 900 },
    reducedMotion: options.reduced ? 'reduce' : 'no-preference',
    deviceScaleFactor: 1,
  });
  await context.addInitScript(instrument);
  if (options.freezeIntervals) await context.addInitScript(() => {
    window.setInterval = () => 0;
    window.clearInterval = () => {};
    const timeout = window.setTimeout.bind(window);
    window.setTimeout = function (callback, delay, ...args) {
      if (delay !== 4200 || typeof callback !== 'function') return timeout(callback, delay, ...args);
      const timer = window.__acceptance.bootTimer = { scheduledAt: performance.now(), delay };
      return timeout(() => {
        callback(...args);
        timer.completedAt = performance.now();
        const boot = document.getElementById('boot');
        timer.released = !!boot && boot.classList.contains('done') && getComputedStyle(boot).pointerEvents === 'none';
      }, delay);
    };
  });
  const page = await context.newPage();
  const faults = [], environmentWarnings = [], external = [], requests = [];
  page.on('console', message => {
    // Chromium's software GPU warns on screenshot readback; keep that evidence separate.
    if (message.type() === 'warning' && /GPU stall due to ReadPixels/.test(message.text())) {
      environmentWarnings.push(message.text()); return;
    }
    if (['warning', 'error'].includes(message.type())) faults.push(`${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', error => faults.push(`pageerror: ${error.message}`));
  page.on('requestfailed', request => faults.push(`requestfailed: ${request.url()} ${request.failure()?.errorText}`));
  page.on('response', response => {
    if (response.status() >= 400) faults.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  page.on('request', request => {
    const requested = request.url(); requests.push(requested);
    if (!requested.startsWith('data:') && !requested.startsWith('blob:') &&
      (url.startsWith('file:') ? !requested.startsWith('file:') : new URL(requested).origin !== new URL(url).origin)) {
      external.push(requested);
    }
  });
  try { await page.goto(url, { waitUntil: 'load' }); }
  catch (error) { await context.close(); throw error; }
  await page.waitForFunction(() => window.cinema && document.querySelectorAll('.node-trigger').length === 6,
    null, { polling: 50 });
  await page.waitForFunction(() => {
    const boot = document.querySelector('#boot');
    return getComputedStyle(boot).display === 'none' || boot.classList.contains('done') || boot.hidden;
  }, null, { timeout: 5000, polling: 50 });
  await page.waitForTimeout(options.reduced ? 80 : 600);
  return { page, context, faults, environmentWarnings, external, requests };
}

async function clean(run) {
  assert.deepEqual(run.external, [], 'External runtime requests are forbidden');
  assert.deepEqual(run.faults, [], 'The browser console and all local asset requests must be clean');
}

async function assertNoAnimations(page, label) {
  const animations = await page.evaluate(() => document.getAnimations().map(animation => {
    const effect = animation.effect, target = effect && effect.target;
    const timing = effect ? effect.getTiming() : {};
    return {
      type: animation.constructor.name,
      name: animation.animationName || animation.transitionProperty || '',
      target: target ? `${target.tagName.toLowerCase()}${target.id ? '#' + target.id : ''}.${Array.from(target.classList).join('.')}` : '',
      pseudo: effect && effect.pseudoElement || '',
      playState: animation.playState,
      currentTime: animation.currentTime,
      duration: String(timing.duration),
      iterations: String(timing.iterations),
    };
  }));
  assert.deepEqual(animations, [], `${label}: reduced motion must leave no CSS animations or transitions`);
}

async function scrollTo(page, id) {
  await page.evaluate(section => {
    document.documentElement.style.scrollBehavior = 'auto';
    document.getElementById(section).scrollIntoView({ behavior: 'instant', block: 'start' });
  }, id);
  await page.waitForTimeout(400);
}

async function assertVisibility(page) {
  await page.waitForFunction(() => {
    const inView = Array.from(document.querySelectorAll('section')).filter(section => {
      const r = section.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight;
    }).map(section => section.querySelector('canvas').id);
    const scenes = cinema.getStats().scenes;
    return scenes.some(scene => scene.running) && scenes.filter(scene => scene.running)
      .every(scene => inView.includes(scene.id));
  }, null, { timeout: 10_000, polling: 100 });
  const snapshot = await page.evaluate(() => ({
    stats: cinema.getStats(),
    contexts: __acceptance.contexts.length,
    inView: Array.from(document.querySelectorAll('section')).filter(section => {
      const r = section.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight;
    }).map(section => section.querySelector('canvas').id),
  }));
  assert(snapshot.contexts <= 2 && snapshot.stats.contexts <= 2, 'More than two WebGL contexts allocated');
  assert(snapshot.stats.running <= 2, 'More than two scenes are running');
  assert(snapshot.stats.scenes.every(scene => !scene.failed), 'A scene failed to render');
  for (const scene of snapshot.stats.scenes.filter(scene => scene.running)) {
    assert(snapshot.inView.includes(scene.id), `${scene.id} is running outside the viewport`);
  }
  const paused = snapshot.stats.scenes.filter(scene => !scene.running);
  await page.waitForTimeout(250);
  const later = await page.evaluate(() => cinema.getStats());
  for (const scene of paused) {
    assert.equal(later.scenes.find(item => item.id === scene.id).frames, scene.frames,
      `${scene.id} rendered while offscreen`);
  }
  return later;
}

async function commands(page) {
  const input = page.locator('#terminal-input');
  const output = page.locator('#terminal-output');
  for (const [command, expected] of [
    ['help', /help.*status.*nodes.*phase.*eclipse.*vault.*clear/is],
    ['status', /KAMMER|SYSTEM|STATUS/i],
    ['nodes', /CN-ALPHA-01.*CN-HALO/s],
    ['phase', /Kontakt|Diamantring|Korona|Freisteller|Reset/],
    ['eclipse', /99[.,]97|Korona|Finsternis/i],
    ['vault', /VAULT|ZUGRIFF|VERSCHLÜSSEL/i],
  ]) {
    const previous = await output.locator('p').count();
    await input.fill(command); await input.press('Enter');
    assert.equal(await input.inputValue(), '', `${command} did not clear the input`);
    const added = (await output.locator('p').allTextContents()).slice(previous).join('\n');
    assert.match(added, expected, `${command} did not produce its expected information`);
  }
  await input.fill('unbekannter-befehl'); await input.press('Enter');
  assert.match(await output.innerText(), /unbekannt|nicht gefunden|ungültig/i);
  assert(await output.locator('.terminal-error').count() > 0, 'Unknown command must report a readable error');
  await input.fill('clear'); await input.press('Enter');
  assert.equal((await output.innerText()).trim(), '', 'clear must clear terminal history');
  await input.fill('help'); await input.press('Enter');
  assert.match(await output.innerText(), /help/i, 'Terminal must remain usable after clear');
}

async function keyboard(page) {
  const targets = await page.evaluate(() => Array.from(document.querySelectorAll(
    'nav a,.node-trigger,#terminal-input,#audio-toggle,[data-phase]')).map(element => ({
      tag: element.tagName, disabled: element.disabled, tabIndex: element.tabIndex,
    })));
  assert.equal(targets.length, 17);
  assert(targets.every(target => !target.disabled && target.tabIndex >= 0), 'Every required control must be keyboard reachable');
  await page.locator('.node-trigger').first().focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('.node-trigger').first().getAttribute('aria-expanded'), 'true');
  const focus = await page.locator('.node-trigger').first().evaluate(element => ({
    visible: element.matches(':focus-visible'), outline: getComputedStyle(element).outlineStyle,
    width: parseFloat(getComputedStyle(element).outlineWidth),
  }));
  assert(focus.visible && focus.outline !== 'none' && focus.width >= 1, 'Keyboard focus must remain visible');
  await page.keyboard.press('Space');
  assert.equal(await page.locator('.node-trigger').first().getAttribute('aria-expanded'), 'false');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement === document.querySelectorAll('.node-trigger')[1]), true,
    'Tab did not move to the next node control');
  await page.locator('nav a').first().focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  assert.equal(await page.evaluate(() => location.hash), '#eclipse');
}

async function fullRun(browser, url, name, viewport) {
  const run = await open(browser, url, { viewport });
  const { page } = run;
  const cold = await page.evaluate(() => ({ stats: cinema.getStats(),
    builds: __acceptance.builds.length, audio: __acceptance.audioContexts.length }));
  assert(cold.stats.scenes.length >= 1 && cold.stats.scenes.length <= 2, 'Lazy build must only prepare nearby initial scenes');
  assert.equal(cold.audio, 0, 'Audio initialized before user interaction');
  assert.equal(cold.builds, cold.stats.scenes.length, 'Every build must emit one scene event');
  assert(await page.locator('#clock').innerText() !== '00:00:00', 'UTC clock did not initialize');
  await clean(run);
  await page.waitForFunction(() => cinema.getStats().scenes.some(scene => scene.id === 'cn-chamber' && scene.frames > 2),
    null, { timeout: 10_000, polling: 100 });
  const beforeFps = await page.evaluate(() => ({ t: performance.now(), frames: cinema.getStats().scenes.find(scene => scene.id === 'cn-chamber').frames }));
  await page.waitForTimeout(1200);
  const afterFps = await page.evaluate(() => ({ t: performance.now(), frames: cinema.getStats().scenes.find(scene => scene.id === 'cn-chamber').frames, hud: document.querySelector('#fps').textContent }));
  const measuredFps = (afterFps.frames - beforeFps.frames) * 1000 / (afterFps.t - beforeFps.t);
  assert(measuredFps > 0, `Visible chamber scene did not render: ${JSON.stringify({ cold, beforeFps, afterFps,
    latest: await page.evaluate(() => ({ hidden: document.hidden, stats: cinema.getStats() })) })}`);
  assert(Number(afterFps.hud) > 0, 'Live HUD FPS did not update');
  await page.screenshot({ path: path.join(artifacts, `${name}-hero.png`) });
  const visits = [];
  for (const id of sectionIds) {
    await scrollTo(page, id);
    visits.push(await assertVisibility(page));
    await page.waitForFunction(section => {
      const element = document.querySelector(`#${section} .reveal`);
      return element && Number(getComputedStyle(element).opacity) > 0;
    }, id, { timeout: 10_000, polling: 100 });
    if (process.env.CAPTURE_ALL_SECTIONS === '1') {
      await page.screenshot({ path: path.join(artifacts, `${name}-${id}.png`) });
    }
  }
  const final = visits.at(-1);
  assert.deepEqual(final.scenes.map(scene => scene.id).sort(), sceneIds.slice().sort());
  assert.equal(await page.evaluate(() => __acceptance.builds.length), 6, 'All scenes must build exactly once');
  assert.equal(await page.locator('#scene-count').innerText(), '6');
  for (const id of sectionIds.slice().reverse()) {
    await scrollTo(page, id); await assertVisibility(page);
  }
  assert.equal(await page.evaluate(() => __acceptance.builds.length), 6, 'Revisiting sections rebuilt scene geometry');
  await scrollTo(page, 'nodes');
  await keyboard(page);
  const panel = page.locator('[data-tilt]').first();
  const tiltBefore = await panel.evaluate(element => getComputedStyle(element).transform);
  const bounds = await panel.boundingBox();
  await page.mouse.move(bounds.x + 20, bounds.y + 20);
  await page.waitForFunction(before => getComputedStyle(document.querySelector('[data-tilt]')).transform !== before,
    tiltBefore, { timeout: 10_000, polling: 100 });
  const tiltAfter = await panel.evaluate(element => ({ transform: getComputedStyle(element).transform,
    mx: getComputedStyle(element).getPropertyValue('--mx') }));
  assert.notEqual(tiltAfter.transform, tiltBefore, 'Pointer tilt did not affect the visible panel transform');
  assert.notEqual(tiltAfter.mx.trim(), '50%', 'Pointer gloss position did not update');
  await page.mouse.move(1, 1);
  for (const [value, formatted] of [['99.97', '99,97'], ['1.3091', '1,3091'], ['46', '46']]) {
    await page.waitForFunction(expected => document.querySelector(`[data-count="${expected.value}"]`).textContent === expected.formatted,
      { value, formatted }, { timeout: 10_000, polling: 100 });
    assert.equal(await page.locator(`[data-count="${value}"]`).innerText(), formatted,
      `Counter ${value} did not finish with German formatting`);
  }
  await scrollTo(page, 'nodes');
  const prices = await page.locator('.node-price').allTextContents();
  await page.waitForFunction(initial => Array.from(document.querySelectorAll('.node-price'))
    .some((element, index) => element.textContent !== initial[index]), prices, { timeout: 5500, polling: 100 });
  await page.locator('.node-trigger').nth(1).click();
  assert.equal(await page.locator('.node-trigger').nth(1).getAttribute('aria-expanded'), 'true');
  await page.locator('.node').nth(1).locator('.node-details').waitFor({ state: 'visible', timeout: 10_000 });
  await page.locator('.node-trigger').nth(1).click();
  assert.equal(await page.locator('.node-trigger').nth(1).getAttribute('aria-expanded'), 'false');
  await scrollTo(page, 'terminal');
  await commands(page);
  await scrollTo(page, 'void');
  await page.locator('[data-phase="3"]').click();
  assert.equal(await page.locator('[data-phase="3"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('[data-phase][aria-pressed="true"]').count(), 1);
  const phaseDescription = await page.locator('#phase-description').innerText();
  assert(phaseDescription.length > 10);
  const phaseTimer = await page.evaluate(() => __acceptance.phaseTimers.filter(timer => timer.active).at(-1));
  assert(phaseTimer && phaseTimer.delay === 5200, 'Automatic phases must use the specified5.2-second interval');
  try {
    await page.waitForFunction(() => document.querySelector('[data-phase="3"]').getAttribute('aria-pressed') === 'false',
      null, { timeout: 10_000, polling: 100 });
  } catch (error) {
    const state = await page.evaluate(() => ({ hidden: document.hidden, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      phase: document.querySelector('[data-phase][aria-pressed="true"]').dataset.phase,
      timers: __acceptance.phaseTimers, events: __acceptance.phaseEvents }));
    throw new Error(`${error.message}\nPhase diagnostics: ${JSON.stringify(state)}`);
  }
  assert.equal(await page.locator('[data-phase][aria-pressed="true"]').count(), 1);
  // An earlier node pointer gesture can activate the drone; explicit toggle still must work both ways.
  if (await page.locator('#audio-toggle').getAttribute('aria-pressed') === 'true') await page.locator('#audio-toggle').click();
  await page.locator('#audio-toggle').click();
  await page.waitForFunction(() => document.querySelector('#audio-toggle').getAttribute('aria-pressed') === 'true',
    null, { polling: 50 });
  const audio = await page.evaluate(() => __acceptance.audioContexts.map(item => ({
    state: item.context.state, gesture: item.gesture,
  })));
  assert.equal(audio.length, 1, 'One audio context must service all toggles');
  assert(audio.every(item => item.gesture && item.state === 'running'), 'Audio must start from a valid user gesture');
  await page.locator('#audio-toggle').click();
  assert.equal(await page.locator('#audio-toggle').getAttribute('aria-pressed'), 'false');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => matchMedia('(prefers-reduced-motion: reduce)').matches && cinema.getStats().running === 0,
    null, { timeout: 10_000, polling: 100 });
  const reducedState = await page.evaluate(() => ({ requests: __acceptance.rafRequests,
    frames: cinema.getStats().scenes.map(scene => scene.frames), running: cinema.getStats().running }));
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(() => __acceptance.rafRequests), reducedState.requests,
    'Animation frames continue after a live reduced-motion preference change');
  assert.deepEqual(await page.evaluate(() => cinema.getStats().scenes.map(scene => scene.frames)), reducedState.frames);
  assert.equal(reducedState.running, 0);
  await assertNoAnimations(page, `${name} live preference change`);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await assertVisibility(page);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horizontal overflow at viewport width');
  await clean(run);
  report.runs.push({ name, mode: 'full', requests: run.requests.length, cold, final, audio,
    measuredFps, hudFps: afterFps.hud, environmentWarnings: run.environmentWarnings });
  await run.context.close();
  console.log(`PASS ${name}: all scenes, viewport suspension, commands, keyboard, phases, audio, local requests`);
}

async function contextRecovery(browser, url) {
  const run = await open(browser, url);
  const { page } = run;
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    scrollTo({ top: document.getElementById('eclipse').offsetTop - innerHeight / 2, behavior: 'instant' });
  });
  await page.waitForFunction(() => cinema.getStats().running === 2 && __acceptance.contexts.length === 2,
    null, { timeout: 10_000, polling: 100 });
  const supported = await page.evaluate(() => {
    __acceptance.lossExtensions = __acceptance.contexts.map(context => context.getExtension('WEBGL_lose_context'));
    return __acceptance.lossExtensions.every(Boolean);
  });
  assert(supported, 'Chromium must expose WEBGL_lose_context for the recovery check');
  await page.evaluate(() => __acceptance.lossExtensions.forEach(extension => extension.loseContext()));
  await page.waitForFunction(() => __acceptance.contextEvents.lost === 2 && cinema.getStats().running === 0,
    null, { timeout: 10_000, polling: 100 });
  await commands(page);
  const lostFrames = await page.evaluate(() => Object.fromEntries(cinema.getStats().scenes.map(scene => [scene.id, scene.frames])));
  await page.evaluate(() => __acceptance.lossExtensions[0].restoreContext());
  await page.waitForFunction(before => {
    const stats = cinema.getStats(), active = stats.scenes.find(scene => scene.running);
    if (__acceptance.contextEvents.restored !== 1 || stats.running !== 1 || !active || active.frames <= (before[active.id] || 0)) return false;
    const rect = document.getElementById(active.id).closest('section').getBoundingClientRect();
    return rect.bottom > 0 && rect.top < innerHeight;
  }, lostFrames, { timeout: 10_000, polling: 100 });
  await clean(run);
  const restored = await page.evaluate(() => ({
    lost: __acceptance.contexts.map(context => context.isContextLost()), stats: cinema.getStats(),
  }));
  assert.deepEqual(restored.lost, [false, true], 'Restoring one slot must leave the other slot lost');
  assert.equal(restored.stats.running, 1, 'A still-lost slot must never be reassigned');
  const running = restored.stats.scenes.find(scene => scene.running);
  await page.waitForFunction(before => cinema.getStats().scenes.find(scene => scene.id === before.id).frames > before.frames,
    running, { timeout: 10_000, polling: 100 });
  await page.evaluate(() => __acceptance.lossExtensions[1].restoreContext());
  await page.waitForFunction(() => __acceptance.contextEvents.restored === 2,
    null, { timeout: 10_000, polling: 100 });
  await page.evaluate(() => scrollTo({ top: document.getElementById('eclipse').offsetTop - innerHeight / 2, behavior: 'instant' }));
  await page.waitForFunction(() => cinema.getStats().running === 2,
    null, { timeout: 10_000, polling: 100 });
  const final = await assertVisibility(page);
  assert.equal(await page.evaluate(() => __acceptance.contexts.length), 2, 'Context recovery allocated another context');
  assert.equal(await page.evaluate(() => new Set(__acceptance.builds.map(build => build.id)).size === __acceptance.builds.length), true,
    'Context recovery rebuilt a scene');
  await clean(run);
  report.runs.push({ name: 'context-recovery', restored, final, environmentWarnings: run.environmentWarnings });
  await run.context.close();
  console.log('PASS context loss: UI stays usable, slots restore independently, no context allocation or scene rebuild');
}

async function reducedRun(browser, url, name) {
  const run = await open(browser, url, { reduced: true, viewport: { width: 390, height: 844 } });
  const { page } = run;
  const prices = await page.locator('.node-price').allTextContents();
  const initialPhase = await page.locator('[data-phase][aria-pressed="true"]').getAttribute('data-phase');
  for (const id of sectionIds) await scrollTo(page, id);
  const state = await page.evaluate(() => ({
    stats: cinema.getStats(), contexts: __acceptance.contexts.length,
    rafRequests: __acceptance.rafRequests, animations: document.getAnimations().length,
    visibleContent: Array.from(document.querySelectorAll('.reveal')).every(element => getComputedStyle(element).opacity === '1'),
    renderedCanvas: Array.from(document.querySelectorAll('canvas')).some(element => getComputedStyle(element).display !== 'none'),
  }));
  assert.equal(state.contexts, 0, 'Reduced motion must avoid creating graphics contexts');
  assert.equal(state.stats.running, 0);
  assert.equal(state.rafRequests, 0, 'Reduced motion must not schedule animation frames');
  await assertNoAnimations(page, `${name} initial reduced motion`);
  assert(state.visibleContent && !state.renderedCanvas, 'Reduced motion must preserve all readable content');
  await page.waitForTimeout(3000);
  assert.deepEqual(await page.locator('.node-price').allTextContents(), prices, 'Market animation continues in reduced motion');
  assert.equal(await page.locator('[data-phase][aria-pressed="true"]').getAttribute('data-phase'), initialPhase,
    'Phase timeline advances despite reduced motion');
  await scrollTo(page, 'nodes');
  await page.locator('.node-trigger').first().focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('.node-trigger').first().getAttribute('aria-expanded'), 'true');
  await scrollTo(page, 'terminal'); await commands(page);
  await scrollTo(page, 'void'); await page.locator('[data-phase="4"]').click();
  assert.equal(await page.locator('[data-phase="4"]').getAttribute('aria-pressed'), 'true');
  await page.waitForTimeout(60);
  assert.equal(await page.evaluate(() => __acceptance.rafRequests), 0);
  await assertNoAnimations(page, `${name} reduced motion after controls`);
  await page.screenshot({ path: path.join(artifacts, `${name}-reduced.png`) });
  // A preference change must prepare the preceding section inside the lazy margin too.
  await page.evaluate(() => {
    const eclipse = document.getElementById('eclipse');
    scrollTo({ top: eclipse.getBoundingClientRect().top + scrollY + 100, behavior: 'instant' });
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => CryoScenes.built().includes('cn-chamber') && CryoScenes.built().includes('cn-eclipse'),
    null, { timeout: 10_000, polling: 100 });
  await assertVisibility(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => cinema.getStats().running === 0,
    null, { timeout: 10_000, polling: 100 });
  assert.equal(await page.evaluate(() => cinema.getStats().running), 0);
  await assertNoAnimations(page, `${name} return to reduced motion`);
  await clean(run);
  report.runs.push({ name, mode: 'reduced', state, environmentWarnings: run.environmentWarnings });
  await run.context.close();
  console.log(`PASS ${name}: reduced motion zero RAF, animations and WebGL contexts; controls remain usable`);
}

async function bootFailsafe(browser, url) {
  const run = await open(browser, url, { freezeIntervals: true });
  const timer = await run.page.evaluate(() => __acceptance.bootTimer);
  assert(timer && timer.delay === 4200, 'An independent 4.2-second timer must be scheduled');
  const elapsed = timer.completedAt - timer.scheduledAt;
  assert(timer.released, 'The deadline did not release the overlay with progress intervals stopped');
  assert(elapsed >= 4200 && elapsed < 4700, `Boot deadline callback took ${elapsed}ms after scheduling`);
  await clean(run);
  await run.context.close();
  report.runs.push({ name: 'boot-failsafe', elapsed, timer });
  console.log('PASS boot failsafe: overlay closes with all progress intervals stopped');
}

async function main() {
  assert(Array.from(suites).every(suite => ['all', 'desktop', 'mobile', 'reduced', 'recovery', 'boot'].includes(suite)),
    'Unknown ACCEPTANCE_SUITE; use all, desktop, mobile, reduced, recovery or boot');
  report.suites = Array.from(suites);
  await fs.mkdir(artifacts, { recursive: true });
  await staticAcceptance();
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
  const local = `http://127.0.0.1:${server.address().port}/`;
  const file = pathToFileURL(path.join(dist, 'index.html')).href;
  let executablePath = process.env.CHROMIUM_PATH;
  if (!executablePath) {
    try { await fs.access('/usr/bin/chromium'); executablePath = '/usr/bin/chromium'; }
    catch (_) { executablePath = chromium.executablePath(); }
  }
  const args = ['--no-sandbox'];
  if (process.env.USE_SOFTWARE_GPU !== '0') args.push('--enable-unsafe-swiftshader', '--use-angle=swiftshader');
  const browser = await chromium.launch({ executablePath, headless: true, args }).catch(async error => {
    await new Promise(resolve => server.close(resolve));
    throw error;
  });
  report.browser = browser.version();
  try {
    let fileAllowed = true;
    const attemptFile = async (name, action) => {
      if (fileAllowed) {
        try { await action(); return; }
        catch (error) { if (!/ERR_BLOCKED_BY_ADMINISTRATOR/.test(error.message)) throw error; }
      }
      fileAllowed = false;
      report.blocked.push({ name, reason: 'Managed Chromium URL policy blocks file:// navigation.' });
      console.log('BLOCKED file://: Chromium administrator URL policy; HTTP tests will continue');
    };
    if (enabled('desktop')) {
      await attemptFile('file-desktop', () => fullRun(browser, file, 'file-desktop'));
      await fullRun(browser, local, 'http-desktop');
    }
    if (enabled('mobile')) await fullRun(browser, local, 'http-mobile', { width: 390, height: 844 });
    if (enabled('reduced')) {
      await attemptFile('file-mobile-reduced', () => reducedRun(browser, file, 'file-mobile'));
      await reducedRun(browser, local, 'http-mobile');
    }
    if (enabled('recovery')) await contextRecovery(browser, local);
    if (enabled('boot')) await bootFailsafe(browser, local);
    console.log(`PASS payload ${report.payloadBytes} bytes; Chromium ${report.browser}; ${report.runs.length} browser runs; ${report.blocked.length} policy-blocked runs`);
    if (!fileAllowed && process.env.REQUIRE_FILE_TEST === '1') throw new Error('Required file:// browser validation was blocked by administrator policy');
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed'; report.error = error.message; throw error;
  } finally {
    await fs.writeFile(path.join(artifacts, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
