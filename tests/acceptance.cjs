/* Exercise the delivered files in Chromium without a build or runtime server dependency. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { createHash } = require('node:crypto');
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
    'assets/js/simulation.js', 'assets/js/app.js', 'assets/vendor/three.min.js', 'assets/vendor/cinema_engine.js'];
  await Promise.all(expected.map(file => fs.access(path.join(dist, file))));
  const html = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
  const scripts = Array.from(html.matchAll(/<script\s+src="([^"]+)"/g), match => match[1]);
  assert.deepEqual(scripts.map(source => source.split('?')[0]), ['assets/vendor/cinema_engine.js', 'assets/js/simulation.js', 'assets/js/terminal.js', 'assets/js/app.js']);
  for (const source of scripts) {
    const url = new URL(source, 'http://localhost/');
    const digest = createHash('sha256').update(await fs.readFile(path.join(dist, url.pathname))).digest('hex').slice(0, 8);
    assert.equal(url.searchParams.get('v'), digest, 'Changed critical scripts must have a new cache URL');
  }
  assert.equal((html.match(/<script[^>]+ defer>/g) || []).length, 4, 'Critical scripts must not block HTML parsing');
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
    rafRequests: 0, rafCallbacks: 0, contexts: [], builds: [], audioContexts: [], invalidRenderFrames: [],
    gpuResources: [], gpuBaseline: [], targetsCreated: 0, targetsDisposed: 0, frameTargetAllocations: [],
    gestures: [], phaseEvents: [], phaseTimers: [], contextEvents: { lost: 0, restored: 0 },
  };
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...args) {
    const context = getContext.call(this, type, ...args);
    if (/^webgl2?$|^experimental-webgl$/.test(type) && context && !monitor.contexts.includes(context)) {
      monitor.contexts.push(context);
      const resources = { buffers: new Set(), textures: new Set(), framebuffers: new Set(), renderbuffers: new Set(), vertexArrays: new Set() };
      monitor.gpuResources.push(resources);
      for (const [name, kind] of [['Buffer', 'buffers'], ['Texture', 'textures'], ['Framebuffer', 'framebuffers'], ['Renderbuffer', 'renderbuffers'], ['VertexArray', 'vertexArrays']]) {
        if (typeof context[`create${name}`] !== 'function') continue;
        const create = context[`create${name}`].bind(context), remove = context[`delete${name}`].bind(context);
        context[`create${name}`] = function (...args) {
          const resource = create(...args); if (resource) resources[kind].add(resource); return resource;
        };
        context[`delete${name}`] = function (resource) { resources[kind].delete(resource); return remove(resource); };
      }
      if (!monitor.targetsPatched) {
        monitor.targetsPatched = true;
        const OriginalTarget = THREE.WebGLRenderTarget;
        THREE.WebGLRenderTarget = class extends OriginalTarget {
          constructor(...args) {
            super(...args); monitor.targetsCreated++;
            const index = monitor.gpuResources.length - 1;
            if (!monitor.gpuBaseline[index]) monitor.gpuBaseline[index] = Object.fromEntries(
              Object.entries(monitor.gpuResources[index]).map(([key, value]) => [key, value.size]));
            this.addEventListener('dispose', () => monitor.targetsDisposed++);
          }
        };
      }
      this.addEventListener('webglcontextlost', () => {
        monitor.contextEvents.lost++;
        Object.values(resources).forEach(set => set.clear());
      });
      this.addEventListener('webglcontextrestored', () => monitor.contextEvents.restored++);
    }
    return context;
  };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = callback => {
    monitor.rafRequests++;
    return raf(time => {
      monitor.rafCallbacks++;
      const before = window.cinema ? cinema.getStats().scenes : [];
      const targetsBefore = monitor.targetsCreated;
      callback(time);
      if (window.cinema) cinema.getStats().scenes.forEach(scene => {
        const previous = before.find(item => item.id === scene.id);
        if (scene.frames <= (previous ? previous.frames : 0)) return;
        if (monitor.targetsCreated !== targetsBefore) monitor.frameTargetAllocations.push(scene.id);
        const rect = document.getElementById(scene.id).closest('section').getBoundingClientRect();
        if (document.hidden || rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth) {
          monitor.invalidRenderFrames.push({ id: scene.id, top: rect.top, bottom: rect.bottom });
        }
      });
    });
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
    deviceScaleFactor: options.deviceScaleFactor || 1,
  });
  await context.addInitScript(instrument);
  if (options.savedStorage !== undefined) await context.addInitScript(value => {
    localStorage.setItem('cryonexus.simulation.v1', value);
  }, options.savedStorage);
  if (options.storageFailure) await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true,
      get() { throw new DOMException('Storage disabled by the acceptance test', 'SecurityError'); } });
  });
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
  }, null, { timeout: 30_000, polling: 50 });
  if (!options.reduced) await page.waitForFunction(() => window.CryoScenes, null, { timeout: 30_000, polling: 50 });
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
  await page.waitForTimeout(250);
  const current = await page.evaluate(() => ({ stats: cinema.getStats(), invalid: __acceptance.invalidRenderFrames,
    inView: Array.from(document.querySelectorAll('section')).filter(section => {
      const rect = section.getBoundingClientRect(); return rect.bottom > 0 && rect.top < innerHeight;
    }).map(section => section.querySelector('canvas').id) }));
  const later = current.stats;
  assert.deepEqual(current.invalid, [], 'A render frame occurred outside the viewport');
  // The per-frame monitor remains valid through delayed observer delivery and layout changes.
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
  await page.waitForFunction(previous => cinema.getStats().scenes.find(scene => scene.id === 'cn-chamber').frames > previous,
    beforeFps.frames, { timeout: 10_000, polling: 100 });
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
    try {
      await page.waitForFunction(section => {
        const element = document.querySelector(`#${section} .reveal`);
        return element && Number(getComputedStyle(element).opacity) > 0;
      }, id, { timeout: 30_000, polling: 100 });
    } catch (error) {
      const diagnostic = await page.evaluate(section => {
        const element = document.querySelector(`#${section} .reveal`);
        const rect = element.getBoundingClientRect();
        return { section, scrollY, viewport: innerHeight, top: rect.top, bottom: rect.bottom,
          height: rect.height, opacity: getComputedStyle(element).opacity, classes: element.className };
      }, id);
      throw new Error(`${error.message}\nReveal diagnostics: ${JSON.stringify(diagnostic)}`);
    }
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
    .some((element, index) => element.textContent !== initial[index]), prices, { timeout: 10_000, polling: 100 });
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

async function gpuMemoryRun(browser, url) {
  const run = await open(browser, url, { viewport: { width: 640, height: 360 }, deviceScaleFactor: 2 });
  const { page } = run;
  const sample = async () => page.evaluate(() => ({
    stats: cinema.getStats(), dpr: devicePixelRatio,
    created: __acceptance.targetsCreated, frameAllocations: __acceptance.frameTargetAllocations,
    built: __acceptance.builds.length,
    gpu: __acceptance.gpuResources.map(resources => Object.fromEntries(
      Object.entries(resources).map(([key, value]) => [key, value.size]))),
    baseline: __acceptance.gpuBaseline,
    rects: Object.fromEntries(Array.from(document.querySelectorAll('section')).map(section => {
      const rect = section.getBoundingClientRect(); return [section.querySelector('canvas').id, { width: rect.width, height: rect.height }];
    })),
  }));
  const check = snapshot => {
    assert.equal(snapshot.dpr, 2, 'Memory regression must exercise a high-DPR display');
    assert(snapshot.stats.contexts <= 2 && snapshot.stats.running <= 2);
    assert.equal(snapshot.created, snapshot.stats.contexts * 3, 'Targets must be allocated once per context, without clones');
    assert.deepEqual(snapshot.frameAllocations, [], 'A rendered frame allocated a new target');
    assert(snapshot.stats.renderTargetBytes <= 24_700_000, 'Target storage exceeds the conservative two-slot budget');
    assert(snapshot.stats.scenes.every(scene => !scene.failed));
    assert(snapshot.stats.scenes.filter(scene => scene.resident).every(scene => scene.running),
      'An offscreen scene retained uploaded GPU resources');
    snapshot.stats.slots.forEach(slot => {
      assert.equal(slot.targets.length, 3);
      if (!slot.owner) return;
      const [main, bright, horizontal] = slot.targets, rect = snapshot.rects[slot.owner];
      assert(main.width * main.height <= 950000, 'Full-resolution target exceeds the pixel budget');
      assert(main.width <= rect.width * 1.5 && main.height <= rect.height * 1.5, 'DPR cap was exceeded');
      assert.equal(bright.width, Math.max(1, main.width >> 2));
      assert.equal(bright.height, Math.max(1, main.height >> 2));
      assert.deepEqual(horizontal, bright, 'Bloom ping-pong targets must share quarter dimensions');
    });
  };
  await page.waitForFunction(() => cinema.getStats().scenes.some(scene => scene.frames >= 3), null, { timeout: 30_000 });
  const samples = [];
  const forward = sectionIds;
  for (const id of [...forward, ...forward.slice().reverse()]) {
    await scrollTo(page, id);
    await assertVisibility(page);
    const before = await page.evaluate(section => cinema.getStats().scenes.find(scene => scene.id ===
      document.querySelector(`#${section} canvas`).id).frames, id);
    await page.waitForFunction(({ id, before }) => cinema.getStats().scenes.find(scene => scene.id ===
      document.querySelector(`#${id} canvas`).id).frames > before, { id, before }, { timeout: 30_000 });
    const current = await sample(); check(current); samples.push(current);
  }
  assert.equal(samples.at(-1).built, 6, 'Memory reclamation must preserve all six cached scene builds');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await assertVisibility(page);
  const large = await sample(); check(large);
  await page.evaluate(() => {
    const spacer = document.createElement('div'); spacer.id = 'gpu-idle-spacer'; spacer.style.height = '200vh';
    document.body.append(spacer); spacer.scrollIntoView({ block: 'start', behavior: 'instant' });
  });
  await page.waitForFunction(() => cinema.getStats().running === 0 && cinema.getStats().renderTargetBytes === 0,
    null, { timeout: 30_000 });
  const idle = await sample(); check(idle);
  assert.equal(idle.built, 6);
  assert(idle.stats.scenes.every(scene => !scene.resident), 'Idle scenes must relinquish their GPU allocations');
  idle.stats.slots.forEach(slot => {
    assert.equal(slot.width, 1); assert.equal(slot.height, 1);
    assert.equal(slot.textures, 0, 'Idle target textures must actually be deleted');
    assert(slot.geometries <= 1, 'Only the shared fullscreen quad may retain geometry');
    assert(slot.programs <= 3, 'Scene shader programs must be released');
  });
  idle.gpu.forEach((resources, index) => {
    const baseline = idle.baseline[index];
    // Three.js keeps tiny empty sampler textures created before any scene or target.
    assert.equal(resources.textures, baseline.textures);
    assert.equal(resources.framebuffers, baseline.framebuffers);
    assert.equal(resources.renderbuffers, baseline.renderbuffers);
    assert(resources.buffers <= baseline.buffers + 4, 'Offscreen instance matrices or scene vertex buffers leaked');
    assert(resources.vertexArrays <= baseline.vertexArrays + 3, 'Scene vertex arrays retained released buffer references');
  });
  await page.evaluate(() => document.getElementById('gpu-idle-spacer').remove());
  await page.setViewportSize({ width: 640, height: 360 });
  await scrollTo(page, 'nodes'); await assertVisibility(page);
  const resumed = await sample(); check(resumed);
  assert.equal(resumed.built, 6, 'Returning to an evicted scene must reuse its CPU geometry');
  assert.equal(resumed.stats.contexts, idle.stats.contexts, 'Returning to the page must reuse the two contexts');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => cinema.getStats().renderTargetBytes === 0 && cinema.getStats().running === 0);
  const reduced = await sample(); check(reduced);
  assert(reduced.gpu.every((resources, index) => resources.textures === reduced.baseline[index].textures &&
    resources.buffers <= reduced.baseline[index].buffers + 4));
  await clean(run);
  report.runs.push({ name: 'gpu-memory', samples, large, idle, resumed, reduced, environmentWarnings: run.environmentWarnings });
  await run.context.close();
  console.log('PASS GPU memory: DPR 2, quarter bloom, no frame allocations, two contexts, actual GPU deletion and cached-scene return');
}

async function contextRecovery(browser, url) {
  const run = await open(browser, url);
  const { page } = run;
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    scrollTo({ top: document.getElementById('eclipse').offsetTop - innerHeight / 2, behavior: 'instant' });
  });
  try {
    await page.waitForFunction(() => cinema.getStats().running === 2 && __acceptance.contexts.length === 2,
      null, { timeout: 30_000, polling: 100 });
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({ stats: cinema.getStats(), contexts: __acceptance.contexts.length,
      targets: __acceptance.targetsCreated, rects: Array.from(document.querySelectorAll('section')).map(section => {
        const rect = section.getBoundingClientRect(); return { id: section.id, top: rect.top, bottom: rect.bottom };
      }) }));
    throw new Error(`${error.message}; two-slot setup: ${JSON.stringify(diagnostic)}; faults: ${JSON.stringify(run.faults)}`);
  }
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
  assert(!run.requests.some(url => /three\.min\.js|scenes\.js/.test(url)), 'Reduced-motion startup must not download graphics scripts');
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
  await page.waitForFunction(() => window.CryoScenes && CryoScenes.built().includes('cn-chamber') && CryoScenes.built().includes('cn-eclipse'),
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

async function readSimulation(page) {
  return page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('cryonexus.simulation.v1'));
    if (!raw) throw new Error('The application did not persist its simulation state');
    // Read a derived view from a separate instance; every mutation below uses the UI.
    return { raw, state: CryoSimulation.create({ saved: raw }).snapshot() };
  });
}

function deNumber(text) {
  return Number(text.trim().replace(/\./g, '').replace(',', '.').replace(/−/g, '-').replace(/[^\d.+-]/g, ''));
}

function near(actual, expected, label, tolerance = .0002) {
  assert(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, received ${actual}`);
}

async function simulationCommand(page, command) {
  const output = page.locator('#terminal-output');
  const count = await output.locator('p').count();
  await page.locator('#terminal-input').fill(command);
  await page.locator('#terminal-input').press('Enter');
  assert.equal(await page.locator('#terminal-input').inputValue(), '');
  return (await output.locator('p').allTextContents()).slice(count).join('\n');
}

async function expandNode(page, id) {
  const node = page.locator(`[data-node="${id}"]`);
  if (await node.locator('.node-trigger').getAttribute('aria-expanded') !== 'true') {
    await node.locator('.node-trigger').click();
  }
  await node.locator('.node-details').waitFor({ state: 'visible' });
  return node;
}

async function captureAppliedVisuals(page) {
  const visuals = {};
  for (let index = 0; index < sectionIds.length; index++) {
    const id = sceneIds[index];
    const before = await page.evaluate(sceneId => cinema.getStats().scenes.find(scene => scene.id === sceneId)?.frames || 0, id);
    await scrollTo(page, sectionIds[index]);
    await page.waitForFunction(expected => {
      const scene = cinema.getStats().scenes.find(item => item.id === expected.id);
      return scene && scene.running && scene.frames > expected.before && scene.visual && Object.keys(scene.visual).length > 0;
    }, { id, before }, { timeout: 20_000, polling: 100 });
    await assertVisibility(page);
    visuals[id] = await page.evaluate(sceneId => cinema.getStats().scenes.find(scene => scene.id === sceneId).visual, id);
  }
  return visuals;
}

async function simulationRun(browser, url) {
  const run = await open(browser, url, { reduced: true, viewport: { width: 960, height: 700 } });
  const { page } = run;
  let current = await readSimulation(page);
  assert.equal(current.state.cash, 100000);
  assert.equal(current.state.tick, 0);
  assert.equal(await page.locator('#vault-state').innerText(), 'GESPERRT');
  assert(await page.locator('#vault-deposit').isDisabled());
  assert(await page.locator('#vault-withdraw').isDisabled());
  await page.locator('#simulation-pause').click();
  assert.equal((await readSimulation(page)).state.paused, true);
  assert.equal(await page.locator('#simulation-pause').getAttribute('aria-pressed'), 'true');

  const alpha = await expandNode(page, 'CN-ALPHA-01');
  await alpha.locator('.node-quantity').fill('2');
  const quote = await alpha.locator('.node-quote').innerText();
  const quotedTotal = deNumber(quote.match(/Kauf:\s*([\d.,]+)/)[1]);
  const quotedFee = deNumber(quote.match(/Gebühr\s*([\d.,]+)/)[1]);
  const beforeBuy = (await readSimulation(page)).state;
  await alpha.locator('[data-action="buy"]').click();
  const afterBuy = (await readSimulation(page)).state;
  assert.equal(afterBuy.nodes[0].quantity, 2);
  near(beforeBuy.cash - afterBuy.cash, quotedTotal, 'Executed buy matches the displayed total', .011);
  near(afterBuy.feesPaid - beforeBuy.feesPaid, quotedFee, 'Executed buy charges the displayed fee');
  assert(afterBuy.cash < beforeBuy.cash && afterBuy.feesPaid > beforeBuy.feesPaid);
  near(deNumber((await alpha.locator('.node-held').innerText()).split('/')[0]), 2, 'Visible holdings reflect the purchase');
  near(deNumber(await page.locator('#sim-cash').innerText()), afterBuy.cash, 'Visible cash reflects the purchase', .011);
  near(deNumber(await page.locator('#sim-equity').innerText()), afterBuy.equity, 'Equity includes the purchased position', .011);

  const beforeInvalidQuantity = (await readSimulation(page)).raw;
  await alpha.locator('.node-quantity').fill('-1');
  assert(await alpha.locator('[data-action="buy"]').isDisabled());
  assert(await alpha.locator('[data-action="sell"]').isDisabled());
  assert.match(await alpha.locator('.node-quote').innerText(), /positiv|Menge/i);
  assert.deepEqual((await readSimulation(page)).raw, beforeInvalidQuantity);
  await alpha.locator('.node-quantity').fill('0,5');
  const beforeSell = (await readSimulation(page)).state;
  await alpha.locator('[data-action="sell"]').click();
  current = await readSimulation(page);
  assert.equal(current.state.nodes[0].quantity, 1.5);
  assert(current.state.cash > beforeSell.cash && current.state.feesPaid > beforeSell.feesPaid);
  assert.match(await simulationCommand(page, 'buy CN-BOREALIS 1,25'), /gekauft/);
  assert.match(await simulationCommand(page, 'sell CN-BOREALIS 0,25'), /verkauft/);
  assert.equal((await readSimulation(page)).state.nodes[1].quantity, 1);

  for (const id of ['CN-ALPHA-01', 'CN-BOREALIS', 'CN-KRYO-7X']) {
    const node = await expandNode(page, id), before = (await readSimulation(page)).state;
    await node.locator('[data-action="link"]').click();
    const after = (await readSimulation(page)).state;
    near(before.cash - after.cash, 1200, 'Binding charges its stated cost');
    assert(after.nodes.find(item => item.id === id).bound);
    assert(await node.evaluate(element => element.classList.contains('bound')));
  }
  const beforePhase = (await readSimulation(page)).state;
  await page.locator('[data-phase="2"]').click();
  current = await readSimulation(page);
  assert.equal(current.state.phase, 2);
  near(beforePhase.coherence - current.state.coherence, 18, 'Manual Korona consumes coherence');
  assert.notEqual(current.state.nodes[2].price, beforePhase.nodes[2].price, 'Phase changes the market calibration');
  assert.notEqual(current.state.nodes[2].spread, beforePhase.nodes[2].spread, 'Phase changes market risk and spread');
  assert(current.state.vault.open, 'Three bound nodes and the Korona thresholds must open the gate');
  assert.equal(await page.locator('#vault-conditions li[data-met="true"]').count(), 4);
  assert.equal(await page.locator('#vault-state').innerText(), 'ZEITFENSTER OFFEN');
  await page.locator('#vault-amount').fill('1000');
  const beforeDeposit = current.state;
  await page.locator('#vault-deposit').click();
  current = await readSimulation(page);
  near(current.state.vault.balance, 1000, 'Deposit moves funds into the Vault');
  near(beforeDeposit.cash - current.state.cash, 1000, 'Deposit removes funds from free cash');
  near(current.state.equity, beforeDeposit.equity, 'Deposit preserves total equity');
  const beforeStep = current.state;
  await page.locator('#simulation-step').click();
  current = await readSimulation(page);
  assert(current.state.paused && current.state.tick === beforeStep.tick + 1);
  assert.equal(current.state.minutes - beforeStep.minutes, 5);
  assert(current.state.vault.balance > beforeStep.vault.balance && current.state.vault.earned > 0,
    'A forced step credits yield in the open Vault while paused');
  assert(current.state.nodes.some((node, index) => node.price !== beforeStep.nodes[index].price));
  current.state.nodes.forEach((node, index) => assert(Math.abs(node.price / beforeStep.nodes[index].price - 1) <= .00601));
  assert.match(await page.locator('#sim-time').innerText(), /5 MIN.*PAUSIERT/);
  assert(deNumber((await page.locator('#vault-earned').innerText()).replace(' CNX', '')) > 0);
  assert.match(await simulationCommand(page, 'resume'), /fortgesetzt/);
  const reducedTick = (await readSimulation(page)).state.tick;
  await page.waitForTimeout(2400);
  assert.equal((await readSimulation(page)).state.tick, reducedTick, 'Reduced motion must not advance the market automatically');
  assert.match(await simulationCommand(page, 'pause'), /pausiert/);
  assert.match(await simulationCommand(page, 'step'), /Simulationszeit/);
  assert.equal((await readSimulation(page)).state.tick, reducedTick + 1);

  const kryo = await expandNode(page, 'CN-KRYO-7X');
  const beforeClosed = (await readSimulation(page)).state;
  await kryo.locator('[data-action="unlink"]').click();
  current = await readSimulation(page);
  assert(!current.state.vault.open);
  near(current.state.vault.balance, beforeClosed.vault.balance, 'Closing a gate preserves its funds');
  assert(await page.locator('#vault-withdraw').isDisabled());
  const closedRaw = current.raw;
  assert.match(await simulationCommand(page, 'withdraw 100'), /geschlossen/);
  assert.deepEqual((await readSimulation(page)).raw, closedRaw, 'Closed-gate withdrawal must be atomic');
  assert.match(await simulationCommand(page, 'step'), /Simulationszeit/);
  current = await readSimulation(page);
  near(current.state.vault.balance, beforeClosed.vault.balance, 'Closed Vault earns no yield');
  near(current.state.vault.earned, beforeClosed.vault.earned, 'Closed Vault preserves earned yield');
  assert.match(await simulationCommand(page, 'link CN-KRYO-7X'), /gebunden/);
  assert((await readSimulation(page)).state.vault.open, 'Rebinding restores the missing gate condition');
  await page.locator('#vault-amount').fill('250');
  const beforeWithdrawal = (await readSimulation(page)).state;
  await page.locator('#vault-withdraw').click();
  current = await readSimulation(page);
  near(current.state.vault.balance, beforeWithdrawal.vault.balance - 250, 'Withdrawal debits the Vault');
  near(current.state.cash, beforeWithdrawal.cash + 250, 'Withdrawal restores free cash');
  for (const command of ['buy CN-ALPHA-01 -1', 'sell CN-ALPHA-01 999', 'buy UNKNOWN 1', 'deposit Infinity', 'withdraw 999999', 'phase 9']) {
    const before = (await readSimulation(page)).raw;
    await simulationCommand(page, command);
    assert.deepEqual((await readSimulation(page)).raw, before, `${command} must not mutate valid state`);
    assert(await page.locator('#terminal-output .terminal-error').count() > 0);
  }
  const umbra = await expandNode(page, 'CN-UMBRA'), beforeStabilize = (await readSimulation(page)).state;
  await umbra.locator('[data-action="stabilize"]').click();
  current = await readSimulation(page);
  assert(current.state.nodes[4].strength > beforeStabilize.nodes[4].strength);
  assert(current.state.coherence > beforeStabilize.coherence && current.state.stability > beforeStabilize.stability);
  near(beforeStabilize.cash - current.state.cash, 700, 'Stabilization charges its stated cost');
  const historyItems = await page.locator('#simulation-history li').allTextContents();
  assert.equal(historyItems.length, Math.min(20, current.state.history.length));
  assert.match(historyItems[0], /T\+15 MIN.*stabilisiert/);
  assert.match(await simulationCommand(page, 'portfolio'), /VERMÖGEN.*Positionen.*Vault/s);
  assert.match(await simulationCommand(page, 'history'), /T\+15 MIN.*stabilisiert/s);
  const persistent = (await readSimulation(page)).raw;
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelectorAll('.node-trigger').length === 6, null, { polling: 50 });
  assert.deepEqual((await readSimulation(page)).raw, persistent, 'Reload must restore holdings, cash, Vault and history exactly');
  assert.equal(await page.locator('#simulation-pause').getAttribute('aria-pressed'), 'true');
  await assertNoAnimations(page, 'Manual simulation controls');
  assert.equal(await page.evaluate(() => __acceptance.rafRequests), 0);
  assert.equal(await page.evaluate(() => __acceptance.contexts.length), 0);
  console.log('PASS simulation ledger: trades, fees, invalid input, gate, yield, history and persistence');

  // Animation is enabled only for two applied-visual snapshots; model time stays paused.
  await page.setViewportSize({ width: 640, height: 650 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const visualBefore = await captureAppliedVisuals(page);
  assert.equal(visualBefore['cn-eclipse'].phase, 2);
  assert.equal(visualBefore['cn-nexus'].boundCount, 3);
  assert(visualBefore['cn-crystal'].holdings[0] > 0);
  assert(visualBefore['cn-vault'].vaultOpen && visualBefore['cn-vault'].gridSeparation > 0);
  await simulationCommand(page, 'unlink CN-KRYO-7X');
  await simulationCommand(page, 'phase 1');
  await simulationCommand(page, 'sell CN-ALPHA-01 1,5');
  await simulationCommand(page, 'step');
  const visualAfter = await captureAppliedVisuals(page);
  assert(visualAfter['cn-chamber'].coherence < visualBefore['cn-chamber'].coherence);
  assert.notEqual(visualAfter['cn-chamber'].frost, visualBefore['cn-chamber'].frost);
  assert.equal(visualAfter['cn-eclipse'].phase, 0);
  assert.notEqual(visualAfter['cn-eclipse'].moonOffset, visualBefore['cn-eclipse'].moonOffset);
  assert(visualAfter['cn-eclipse'].coronaExposure < visualBefore['cn-eclipse'].coronaExposure);
  assert.equal(visualAfter['cn-nexus'].boundCount, 2);
  assert(visualAfter['cn-nexus'].connection < visualBefore['cn-nexus'].connection);
  assert.equal(visualAfter['cn-crystal'].holdings[0], 0);
  assert(visualAfter['cn-crystal'].strengths[3] < visualBefore['cn-crystal'].strengths[3]);
  assert(!visualAfter['cn-vault'].vaultOpen && visualAfter['cn-vault'].gridSeparation === 0);
  assert(visualAfter['cn-void'].echoes > visualBefore['cn-void'].echoes && visualAfter['cn-void'].echoScale > visualBefore['cn-void'].echoScale);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => cinema.getStats().running === 0, null, { timeout: 10_000, polling: 100 });
  const beforeReset = (await readSimulation(page)).raw;
  await simulationCommand(page, 'reset');
  assert.deepEqual((await readSimulation(page)).raw, beforeReset, 'An unconfirmed CLI reset must preserve progress');
  await page.locator('#simulation-reset').click();
  assert.deepEqual((await readSimulation(page)).raw, beforeReset, 'The first reset click must only arm confirmation');
  assert.match(await page.locator('#simulation-reset').innerText(), /bestätigen/);
  await page.locator('#simulation-reset').click();
  const reset = (await readSimulation(page)).state;
  assert.equal(reset.cash, 100000); assert.equal(reset.tick, 0); assert.equal(reset.phase, 0);
  assert.equal(reset.feesPaid, 0); assert.equal(reset.vault.balance, 0); assert.equal(reset.history.length, 0);
  assert(reset.nodes.every(node => node.quantity === 0 && !node.bound));
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await assertNoAnimations(page, 'Simulation reset in reduced motion');
  await clean(run);
  report.runs.push({ name: 'simulation', mode: 'causal', persistent, reset,
    visualBefore, visualAfter, environmentWarnings: run.environmentWarnings });
  await run.context.close();
  console.log('PASS simulation visuals: all six scenes apply shared decisions; reset requires explicit confirmation');
  await storageRecovery(browser, url);
}

async function storageRecovery(browser, url) {
  const corrupt = await open(browser, url, { reduced: true, savedStorage: '{malformed-json' });
  const fresh = await readSimulation(corrupt.page);
  assert.equal(fresh.state.cash, 100000);
  assert.equal(fresh.state.tick, 0);
  assert(fresh.state.nodes.every(node => !node.bound && node.quantity === 0));
  await corrupt.page.locator('#simulation-message').scrollIntoViewIfNeeded();
  assert(await corrupt.page.locator('#simulation-message').isVisible());
  assert.match(await corrupt.page.locator('#simulation-message').innerText(), /beschädigt|ungültig/);
  assert.equal(await corrupt.page.evaluate(() => __acceptance.contexts.length), 0);
  await clean(corrupt);
  report.runs.push({ name: 'simulation-storage-corrupt', mode: 'reduced', cash: fresh.state.cash,
    recoveryMessage: await corrupt.page.locator('#simulation-message').innerText() });
  await corrupt.context.close();
  const blocked = await open(browser, url, { reduced: true, storageFailure: true });
  assert.equal(await blocked.page.locator('#simulation-storage').innerText(), 'SITZUNG OHNE DAUERHAFTEN SPEICHER');
  const node = await expandNode(blocked.page, 'CN-ALPHA-01');
  const cashBefore = deNumber(await blocked.page.locator('#sim-cash').innerText());
  await node.locator('.node-quantity').fill('1');
  await node.locator('[data-action="buy"]').click();
  const cashAfter = deNumber(await blocked.page.locator('#sim-cash').innerText());
  assert(cashAfter < cashBefore, 'Trading must work without durable storage');
  assert.equal(deNumber((await node.locator('.node-held').innerText()).split('/')[0]), 1);
  await blocked.page.locator('#simulation-step').click();
  assert.match(await blocked.page.locator('#sim-time').innerText(), /5 MIN/);
  assert.match(await simulationCommand(blocked.page, 'portfolio'), /VERMÖGEN.*CN-ALPHA-01: 1/s);
  await assertNoAnimations(blocked.page, 'Unavailable storage fallback');
  assert.equal(await blocked.page.evaluate(() => __acceptance.rafRequests), 0);
  assert.equal(await blocked.page.evaluate(() => __acceptance.contexts.length), 0);
  await clean(blocked);
  report.runs.push({ name: 'simulation-storage-unavailable', mode: 'reduced', cashBefore, cashAfter,
    time: await blocked.page.locator('#sim-time').innerText() });
  await blocked.context.close();
  console.log('PASS storage fallback: corrupt JSON recovers visibly; unavailable storage preserves trading and manual time');
}

async function terminalRun(browser, url) {
  const run = await open(browser, url, { reduced: true, viewport: { width: 390, height: 844 } });
  const { page } = run;
  const command = async text => {
    await simulationCommand(page, text);
    return await page.locator('#terminal-output p').last().innerText();
  };
  const initial = await readSimulation(page);
  for (const name of await page.evaluate(() => CryoTerminal.commands)) {
    assert.match(await command('help ' + name), /Eingabe:[\s\S]*Beispiel:/);
  }
  for (const name of ['status', 'nodes', 'phase', 'eclipse', 'vault', 'portfolio', 'history', 'tasks']) {
    assert((await command(name)).length > 30);
  }
  for (const text of ['buy CN-ALPHA-01', 'buy CN-ALPHA-01 1 extra', 'reset confirm extra', 'unknown', 'help constructor']) {
    await command(text);
    assert.equal(await page.locator('#terminal-output p').last().getAttribute('class'), 'terminal-error');
  }
  assert.deepEqual((await readSimulation(page)).raw, initial.raw, 'Read-only and invalid commands must preserve saved state');
  const quote = await page.evaluate(() => CryoSimulation.create({ saved: JSON.parse(localStorage.getItem('cryonexus.simulation.v1')) }).quote('buy', 'CN-ALPHA-01', 2.5));
  assert.match(await command('buy CN-ALPHA-01 2,5'), /2,5 Einheiten[\s\S]*Gesamtabzug:[\s\S]*Bestand: 2,5/);
  near((await readSimulation(page)).state.cash, initial.state.cash - quote.total, 'Terminal receipt cash');
  assert.match(await command('sell CN-ALPHA-01 0,5'), /Nettoerlös:[\s\S]*Bestand: 2 Einheiten/);
  for (const node of initial.state.nodes.slice(0, 3)) assert.match(await command('link ' + node.id), /gebunden/);
  assert.match(await command('stabilize CN-ALPHA-01'), /stabilisiert/);
  assert.match(await command('phase 3'), /Aktive Phase: 3 \/ Korona/);
  assert.match(await command('deposit 1000'), /Vault-Guthaben: 0,0000 → 1\.000,0000/);
  assert.match(await command('pause'), /PAUSIERT/);
  assert.match(await command('step'), /Simulationszeit: 0 → 5 Minuten/);
  assert.match(await command('tasks'), /6 von 6 aktuell erfüllt/);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Terminal results must fit the mobile viewport');
  await page.locator('.terminal').screenshot({ path: path.join(artifacts, 'terminal-tasks-mobile.png') });
  assert.match(await command('withdraw 250'), /aus dem Vault ausgezahlt/);
  assert.match(await command('resume'), /MANUELL/);
  assert.match(await command('unlink CN-ALPHA-01'), /Vault-Fenster: GESCHLOSSEN/);
  assert.match(await command('withdraw 1'), /NICHT AUSGEFÜHRT[\s\S]*Gate ist geschlossen/);
  const beforeReset = await readSimulation(page);
  await command('reset');
  assert.deepEqual((await readSimulation(page)).raw, beforeReset.raw);
  assert.match(await command('reset confirm'), /100\.000/);
  assert.equal((await readSimulation(page)).state.cash, 100000);
  await simulationCommand(page, 'clear');
  assert.equal((await page.locator('#terminal-output').innerText()).trim(), '');
  await command('help');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'terminal-input');
  await assertNoAnimations(page, 'Terminal outcomes with reduced motion');
  await clean(run);
  await run.context.close();
  report.runs.push({ name: 'terminal-outcomes', commands: 21 });
  console.log('PASS terminal outcomes: every help entry, safe syntax, actual receipts, all six tasks and reset');
}

async function startupRun(browser, url) {
  const context = await browser.newContext({ viewport: { width: 640, height: 360 }, reducedMotion: 'no-preference' });
  await context.addInitScript(instrument);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let release;
  const held = new Promise(resolve => { release = resolve; });
  let requested = 0;
  await page.route('**/three.min.js', async route => {
    requested += 1;
    await held;
    await route.continue();
  });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => performance.getEntriesByName('cryonexus:ui-ready').length === 1);
    await page.waitForFunction(() => document.querySelectorAll('.node-trigger').length === 6);
    const startup = await page.evaluate(() => ({
      uiReadyMs: performance.getEntriesByName('cryonexus:ui-ready')[0].startTime,
      bootDisplay: getComputedStyle(document.getElementById('boot')).display,
      contexts: cinema.getStats().contexts, threeLoaded: !!window.THREE,
      criticalScripts: [...document.querySelectorAll('script[defer]')].map(script => script.src),
    }));
    assert.equal(startup.bootDisplay, 'none', 'UI must be uncovered while graphics download is stalled');
    assert.equal(startup.contexts, 0);
    assert.equal(startup.threeLoaded, false);
    await page.locator('#simulation-pause').click();
    const before = await readSimulation(page);
    await page.locator('#simulation-step').click();
    const after = await readSimulation(page);
    assert.notDeepEqual(after, before, 'Simulation controls must work before graphics arrive');
    await page.locator('[data-phase="2"]').click();
    assert.equal(await page.locator('[data-phase="2"]').getAttribute('aria-pressed'), 'true');
    await page.waitForFunction(() => !window.THREE);
    assert.equal(requested, 1, 'Graphics must load once after the usable UI');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    assert.equal(requested, 1, 'Preference changes must not duplicate an in-flight graphics request');
    release();
    await page.waitForFunction(() => window.CryoScenes && cinema.getStats().scenes.some(scene => scene.frames > 0),
      null, { timeout: 30_000, polling: 100 });
    assert.equal(await page.evaluate(() => cinema.getStats().simulation.phase), 2,
      'Late graphics must receive the decisions made before their download');
    assert.deepEqual(errors, []);
    startup.graphicsReadyMs = await page.evaluate(() => performance.getEntriesByName('cryonexus:graphics-ready')[0].startTime);
    report.runs.push({ name: 'ui-before-delayed-graphics', startup });
    console.log(`PASS startup: UI ready at ${startup.uiReadyMs.toFixed(1)}ms; controls and model work during stalled graphics download`);
  } finally { release(); await context.close(); }
}

async function bootFailsafe(browser, url) {
  const run = await open(browser, url, { freezeIntervals: true, reduced: true });
  await run.page.waitForFunction(() => __acceptance.bootTimer.completedAt, null, { polling: 50 });
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
  assert(Array.from(suites).every(suite => ['all', 'desktop', 'mobile', 'reduced', 'simulation', 'recovery', 'boot', 'gpu', 'startup', 'terminal'].includes(suite)),
    'Unknown ACCEPTANCE_SUITE; use all, desktop, mobile, reduced, simulation, recovery, boot, gpu, startup or terminal');
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
    if (enabled('gpu')) await gpuMemoryRun(browser, local);
    if (enabled('simulation')) await simulationRun(browser, local);
    if (enabled('boot')) await bootFailsafe(browser, local);
    if (enabled('startup')) await startupRun(browser, local);
    if (enabled('terminal')) await terminalRun(browser, local);
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
