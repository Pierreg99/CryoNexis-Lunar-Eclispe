(function () {
  'use strict';

  const root = document.documentElement;
  const boot = document.getElementById('boot');
  // This deadline is deliberately independent of every other timer and feature.
  window.setTimeout(function () {
    if (boot) { boot.classList.add('done'); boot.hidden = true; }
  }, 4200);

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const jobs = [];
  const builtScenes = new Set();
  const counters = new Map();
  const pendingTilts = new Map();
  const sections = Array.from(document.querySelectorAll('.section'));
  const phaseButtons = Array.from(document.querySelectorAll('[data-phase]'));
  const clock = document.getElementById('clock');
  const fps = document.getElementById('fps');
  const sceneCount = document.getElementById('scene-count');
  const status = document.getElementById('system-status');
  const terminalOutput = document.getElementById('terminal-output');
  const terminalInput = document.getElementById('terminal-input');
  const audioButton = document.getElementById('audio-toggle');
  const audioLabel = document.getElementById('audio-label');
  const number = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const precise = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 6 });
  const interest = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const storageKey = 'cryonexus.simulation.v1';
  let saved;
  let storageCorrupt = false;
  let storageAvailable = true;
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) { try { saved = JSON.parse(stored); } catch (_) { storageCorrupt = true; } }
  } catch (_) { storageAvailable = false; }
  const simulation = window.CryoSimulation.create({ seed: 404, saved: saved });
  let state = simulation.snapshot();
  const nodeViews = new Map();
  let phaseJob;
  let traceKey = null;
  let resetArmed = false;
  let resetTimer = 0;
  let phaseIndex = 0;
  let frameId = 0;
  let lastFrame = 0;
  let fpsStart = 0;
  let frameCount = 0;
  let scrollDirty = true;
  let graphicsFallback = false;
  let audioDesired = false;
  let audioToken = 0;
  let scriptIndex = 0;
  let scriptStopped = false;

  const phases = [
    { name: 'Kontakt', time: 'T−00:04', description: 'Der erste Kontakt. Zwei Himmelskörper berühren sich.' },
    { name: 'Diamantring', time: 'T+00:42', description: 'Ein letzter Lichtpunkt bricht durch den Ring aus Eis.' },
    { name: 'Korona', time: 'T+01:18', description: 'Totalität. Die Korona leuchtet am Rand des Schattens.' },
    { name: 'Freisteller', time: 'T+01:52', description: 'Das Licht kehrt zurück. Der Schatten gibt den Himmel frei.' },
    { name: 'Reset', time: 'T+02:30', description: 'Der Kreis schließt sich. Die Kammer wartet auf den nächsten Kontakt.' }
  ];

  function stopJob(job) {
    if (job.id) window.clearInterval(job.id);
    job.id = 0;
  }
  function startJob(job) {
    if (job.id || job.done || document.hidden || (job.motionOnly && motion.matches)) return;
    job.id = window.setInterval(job.callback, job.delay);
  }
  function recurring(callback, delay, motionOnly) {
    const job = { callback: callback, delay: delay, motionOnly: !!motionOnly, id: 0, done: false };
    jobs.push(job);
    startJob(job);
    return job;
  }
  function finishJob(job) { job.done = true; stopJob(job); }

  function utcClock() {
    const now = new Date();
    if (clock) { clock.textContent = now.toISOString().slice(11, 19); clock.dateTime = now.toISOString(); }
    syncScenes();
  }
  function syncScenes() {
    if (window.cinema && typeof window.cinema.getStats === 'function') {
      window.cinema.getStats().scenes.forEach(function (scene) { builtScenes.add(scene.id); });
    }
    if (sceneCount) sceneCount.textContent = String(Math.min(6, builtScenes.size));
  }
  function sceneBuilt(event) {
    const detail = event.detail || {};
    if (detail.id) builtScenes.add(detail.id);
    syncScenes();
  }
  document.addEventListener('cryonexus:scene', sceneBuilt);
  document.addEventListener('cryonexus:graphics', function () {
    graphicsFallback = true;
    if (status) status.textContent = 'ANSICHT STABIL';
  });
  utcClock();
  recurring(utcClock, 1000, false);
  let statusIndex = 0;
  const statusMessages = ['KAMMER BEREIT', 'NEXUS VERBUNDEN', 'VAULT GESICHERT', 'ZEITLINIE AKTIV'];
  recurring(function () {
    if (!graphicsFallback && status) status.textContent = statusMessages[++statusIndex % statusMessages.length];
  }, 6200, true);

  function finishBoot() {
    if (!boot) return;
    boot.style.setProperty('--p', '100');
    boot.classList.add('done');
    if (motion.matches) boot.hidden = true;
  }
  const calibration = ['01 / Kryo-Kammer kalibriert', '02 / Lichtbrechung synchronisiert', '03 / Schattenmarkt verbunden', '04 / Vault-Protokoll geprüft', '05 / Zeitzeuge: Zugang freigegeben'];
  const bootLines = document.getElementById('boot-lines');
  let bootStep = 0;
  function calibrate() {
    if (!boot || boot.classList.contains('done')) { finishJob(bootJob); return; }
    if (bootLines) {
      const line = document.createElement('div');
      line.textContent = calibration[bootStep];
      bootLines.appendChild(line);
    }
    bootStep += 1;
    boot.style.setProperty('--p', String(bootStep * 20));
    if (bootStep === calibration.length) { finishJob(bootJob); finishBoot(); }
  }
  const bootJob = recurring(calibrate, 480, true);
  if (motion.matches) finishBoot();

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }
  function numeric(raw) {
    const value = String(raw).trim().replace(',', '.');
    return /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : NaN;
  }
  function announce(result) {
    const element = document.getElementById('simulation-message');
    if (element) { element.textContent = result.message; element.dataset.error = String(!result.ok); }
    // Manual changes remain animation-free when accessibility preferences require it.
    if (motion.matches && typeof document.getAnimations === 'function') {
      document.getAnimations().forEach(function (animation) { animation.cancel(); });
    }
    return result;
  }
  function action(type, payload) { return announce(simulation.act(type, payload)); }
  function updateQuote(node, view) {
    const quantity = numeric(view.quantity.value);
    const buy = simulation.quote('buy', node.id, quantity);
    const sell = simulation.quote('sell', node.id, quantity);
    view.quote.textContent = buy.ok ? 'Kauf: ' + number.format(buy.total) + ' CNX · Gebühr ' + interest.format(buy.fee) + ' · Slippage ' + interest.format(buy.slippage) + '. Verkauf: ' + (sell.ok ? number.format(sell.net) + ' CNX' : sell.message) : buy.message;
    view.buy.disabled = !buy.ok || buy.total > state.cash;
    view.sell.disabled = !sell.ok || quantity > node.quantity;
  }
  function renderNode(node) {
    const view = nodeViews.get(node.id);
    if (!view) return;
    view.price.textContent = number.format(node.price);
    view.liquidity.textContent = number.format(node.liquidity / 1000000) + ' Mio. CNX';
    view.change.textContent = (node.change >= 0 ? '+' : '−') + number.format(Math.abs(node.change)) + ' %';
    view.change.style.color = node.change >= 0 ? 'var(--ice)' : 'var(--corona)';
    view.meter.style.setProperty('--value', node.strength.toFixed(2) + '%');
    view.held.textContent = precise.format(node.quantity) + ' / ' + number.format(node.positionValue) + ' CNX';
    view.strength.textContent = number.format(node.strength) + ' %';
    view.spread.textContent = number.format(node.spread) + ' %';
    view.risk.textContent = number.format(node.risk) + ' / 100';
    view.halfLife.textContent = precise.format(node.halfLife) + ' h';
    view.validators.textContent = String(node.validators);
    view.binding.textContent = node.bound ? 'ZEITLICH GEBUNDEN' : 'VERFÜGBAR';
    view.article.classList.toggle('bound', node.bound);
    view.link.textContent = node.bound ? 'Lösen (+400 CNX)' : 'Binden (1.200 CNX)';
    view.link.dataset.action = node.bound ? 'unlink' : 'link';
    view.link.setAttribute('aria-label', view.link.textContent + ' · ' + node.id);
    updateQuote(node, view);
  }
  const nodeGrid = document.getElementById('node-grid');
  if (nodeGrid) state.nodes.forEach(function (node, index) {
    const article = document.createElement('article');
    article.className = 'node panel reveal reveal-d' + (index % 4 + 1);
    article.dataset.node = node.id;
    article.setAttribute('data-tilt', '');
    const detailId = 'node-detail-' + index;
    const quantityId = 'node-quantity-' + index;
    article.innerHTML = '<button type="button" class="node-trigger" aria-expanded="false" aria-controls="' + detailId + '">' +
      '<span class="node-head"><span>0' + (index + 1) + ' / <span class="node-binding"></span></span><span class="node-symbol" aria-hidden="true">' + node.symbol + '</span></span>' +
      '<span class="node-name">' + node.id + '</span><span class="node-sector">' + node.sector + '</span>' +
      '<span class="node-value"><span><span class="node-price"></span><small> CNX</small></span><small class="node-change"></small></span></button>' +
      '<div id="' + detailId + '" class="node-details" aria-hidden="true"><div class="node-details-inner"><dl>' +
      '<div><dt>Sektor</dt><dd>' + node.sector + '</dd></div><div><dt>Liquidität</dt><dd class="node-liquidity"></dd></div>' +
      '<div><dt>Halbwertszeit</dt><dd class="node-half-life"></dd></div><div><dt>Validatoren</dt><dd class="node-validators"></dd></div>' +
      '<div><dt>Stärke</dt><dd class="node-strength"></dd></div><div><dt>Spread</dt><dd class="node-spread"></dd></div><div><dt>Simuliertes Risiko</dt><dd class="node-risk"></dd></div>' +
      '<div><dt>Bestand / Wert</dt><dd class="node-held"></dd></div></dl><div class="meter" aria-hidden="true"><i></i></div>' +
      '<div class="node-actions"><label class="control-label" for="' + quantityId + '">Anteile für ' + node.id + '</label>' +
      '<input class="simulation-input node-quantity" id="' + quantityId + '" value="1" inputmode="decimal" maxlength="16">' +
      '<p class="node-quote"></p><div class="simulation-controls"><button type="button" data-action="buy">Kaufen</button><button type="button" data-action="sell">Verkaufen</button></div>' +
      '<div class="simulation-controls"><button type="button" class="node-link" data-action="link"></button><button type="button" data-action="stabilize">Stabilisieren (700 CNX)</button></div></div></div></div>';
    const trigger = article.querySelector('.node-trigger');
    trigger.setAttribute('aria-label', node.id + ' · ' + node.sector + ' · Details');
    trigger.addEventListener('click', function () {
      const expanded = trigger.getAttribute('aria-expanded') !== 'true';
      trigger.setAttribute('aria-expanded', String(expanded));
      article.classList.toggle('open', expanded);
      article.querySelector('.node-details').setAttribute('aria-hidden', String(!expanded));
      if (motion.matches && typeof document.getAnimations === 'function') document.getAnimations().forEach(function (animation) { animation.cancel(); });
    });
    const view = {
      article: article, price: article.querySelector('.node-price'), change: article.querySelector('.node-change'),
      liquidity: article.querySelector('.node-liquidity'), meter: article.querySelector('.meter i'),
      halfLife: article.querySelector('.node-half-life'), validators: article.querySelector('.node-validators'),
      risk: article.querySelector('.node-risk'), held: article.querySelector('.node-held'), strength: article.querySelector('.node-strength'), spread: article.querySelector('.node-spread'),
      binding: article.querySelector('.node-binding'), link: article.querySelector('.node-link'), quantity: article.querySelector('.node-quantity'),
      quote: article.querySelector('.node-quote'), buy: article.querySelector('[data-action="buy"]'), sell: article.querySelector('[data-action="sell"]')
    };
    nodeViews.set(node.id, view);
    view.quantity.addEventListener('input', function () { updateQuote(state.nodes.find(function (item) { return item.id === node.id; }), view); });
    article.querySelectorAll('[data-action]').forEach(function (button) {
      button.setAttribute('aria-label', button.textContent + ' · ' + node.id);
      button.addEventListener('click', function () {
        action(button.dataset.action, { id: node.id, quantity: numeric(view.quantity.value) });
      });
    });
    renderNode(node);
    nodeGrid.appendChild(article);
  });
  recurring(function () { simulation.tick(); }, 2200, true);

  function renderSimulation(next) {
    const previousPhase = state.phase;
    state = next;
    phaseIndex = next.phase;
    state.nodes.forEach(renderNode);
    setText('sim-cash', number.format(state.cash));
    setText('sim-equity', number.format(state.equity));
    setText('sim-positions', 'POSITIONEN ' + number.format(state.portfolioValue) + ' CNX');
    setText('sim-stability', number.format(state.stability) + ' %');
    setText('sim-coherence', number.format(state.coherence) + ' %');
    setText('sim-time', 'ZYKLUS ' + state.cycle + ' / ' + precise.format(state.minutes) + ' MIN / ' + state.phaseName + (state.paused ? ' / PAUSIERT' : motion.matches ? ' / MANUELLE ZEIT' : ' / AKTIV'));
    setText('sim-climate', 'KERN ' + number.format(state.visual.temperature) + ' °C / KORONA ' + number.format(state.visual.corona * 100) + ' %');
    setText('eclipse-current', 'Aktuelle Korona: ' + number.format(state.visual.corona * 100) + ' % · ' + state.phaseName);
    setText('hero-temperature', number.format(state.visual.temperature));
    setText('sim-fees', 'HANDELSGEBÜHREN ' + interest.format(state.feesPaid) + ' CNX');
    setText('vault-state', state.vault.open ? 'ZEITFENSTER OFFEN' : 'GESPERRT');
    const ledger = document.querySelector('.vault-ledger');
    if (ledger) ledger.dataset.open = String(state.vault.open);
    setText('vault-balance', interest.format(state.vault.balance) + ' CNX');
    setText('vault-earned', interest.format(state.vault.earned) + ' CNX');
    setText('vault-apr', number.format(state.vault.apr) + ' % p. a.');
    const conditions = document.getElementById('vault-conditions');
    if (conditions) {
      conditions.replaceChildren();
      state.vault.conditions.forEach(function (condition) {
        const item = document.createElement('li');
        item.textContent = condition.label; item.dataset.met = String(condition.met); conditions.appendChild(item);
      });
    }
    const deposit = document.getElementById('vault-deposit'), withdraw = document.getElementById('vault-withdraw');
    if (deposit) deposit.disabled = !state.vault.open;
    if (withdraw) withdraw.disabled = !state.vault.open || state.vault.balance <= 0;
    setText('vault-message', state.vault.open ? 'Das Fenster ist offen. Einlagern und Entnehmen sind möglich.' : state.vault.conditions.filter(function (condition) { return !condition.met; }).map(function (condition) { return condition.label; }).join(' · '));
    const pause = document.getElementById('simulation-pause');
    if (pause) { pause.textContent = state.paused ? 'Simulation fortsetzen' : 'Simulation pausieren'; pause.setAttribute('aria-pressed', String(state.paused)); }
    phaseButtons.forEach(function (button) { button.setAttribute('aria-pressed', String(Number(button.dataset.phase) === phaseIndex)); });
    setText('phase-description', phases[phaseIndex].description + ' · Kohärenz ' + number.format(state.coherence) + ' % · Vault ' + (state.vault.open ? 'offen' : 'gesperrt'));
    const key = state.history.map(function (item) { return item.id; }).join(',');
    if (key !== traceKey) {
      traceKey = key;
      const list = document.getElementById('simulation-history');
      if (list) {
        list.replaceChildren();
        state.history.slice(-20).reverse().forEach(function (entry) {
          const item = document.createElement('li'), stamp = document.createElement('time'), text = document.createElement('span');
          stamp.textContent = 'T+' + entry.tick * 5 + ' MIN / ' + phases[entry.phase].name;
          text.textContent = entry.text; item.append(stamp, text); list.appendChild(item);
        });
        if (!list.children.length) { const item = document.createElement('li'); item.textContent = 'Deine erste Entscheidung schreibt die nächste Zeitspur.'; list.appendChild(item); }
      }
    }
    try { window.localStorage.setItem(storageKey, JSON.stringify(simulation.serialize())); }
    catch (_) { storageAvailable = false; }
    setText('simulation-storage', storageAvailable ? 'FORTSCHRITT AUF DIESEM GERÄT GESPEICHERT' : 'SITZUNG OHNE DAUERHAFTEN SPEICHER');
    if (previousPhase !== phaseIndex) document.dispatchEvent(new CustomEvent('cryonexus:phase', { detail: { index: phaseIndex, name: state.phaseName } }));
    document.dispatchEvent(new CustomEvent('cryonexus:simulation', { detail: state.visual }));
  }

  function appendTerminal(text, kind) {
    if (!terminalOutput) return;
    const line = document.createElement('p');
    line.className = 'terminal-' + (kind || 'response');
    // Terminal input never passes through HTML parsing.
    line.textContent = text;
    terminalOutput.appendChild(line);
    while (terminalOutput.children.length > 160) terminalOutput.firstElementChild.remove();
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
  }
  const script = ['CRYONEXUS / VAULT v.04', 'Kryo-Verbindung hergestellt …', '6 Knoten validiert. Schattenmarkt verfügbar.', 'Kerntemperatur −268 °C. Restlauf ∞.', 'Rolle erkannt: ZEITZEUGE. Vault-Zugang folgt dem Netzwerk.', 'Eingabe bereit. „help“ zeigt alle Befehle.'];
  appendTerminal(script[scriptIndex++], 'system');
  function autoplayLine() {
    if (scriptStopped) return;
    appendTerminal(script[scriptIndex++], scriptIndex === script.length ? 'response' : 'system');
    if (scriptIndex >= script.length) { scriptStopped = true; finishJob(terminalJob); }
  }
  const terminalJob = recurring(autoplayLine, 640, true);
  function finishAutoplay() {
    while (!scriptStopped && scriptIndex < script.length) autoplayLine();
  }
  if (motion.matches) finishAutoplay();

  function terminalCommand(raw) {
    scriptStopped = true;
    finishJob(terminalJob);
    const parts = raw.trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    if (!command) return;
    if (command === 'clear') { if (terminalOutput) terminalOutput.replaceChildren(); return; }
    appendTerminal('cryo@vault:~$ ' + raw.trim(), 'system');
    const id = (parts[1] || '').toUpperCase();
    let result;
    switch (command) {
      case 'help':
        appendTerminal('help / status / nodes / phase / eclipse / vault / clear\nportfolio → Guthaben, Positionen, Gebühren\nhistory → Deine Zeitspuren\nphase 1..5 → Phase wählen (kostet Kohärenz)\nbuy ID Menge / sell ID Menge → Handeln\nlink ID / unlink ID → Zeitbindung (1.200 / +400 CNX)\nstabilize ID → Knoten stärken (700 CNX)\ndeposit Betrag / withdraw Betrag → Vault\npause / resume / step → Simulationszeit steuern\nreset confirm → Lokalen Fortschritt löschen\nBeispiel: buy CN-ALPHA-01 2,5\nAlle Werte sind fiktiv, lokal und deterministisch.');
        break;
      case 'status':
        appendTerminal('KAMMER 04 · LOKALE SIMULATION\nUTC ' + new Date().toISOString().slice(11, 19) + '\nSzenen: ' + builtScenes.size + '/6 · Phase: ' + state.phaseName + '\nKerntemperatur: ' + number.format(state.visual.temperature) + ' °C\nStabilität: ' + number.format(state.stability) + ' % · Kohärenz: ' + number.format(state.coherence) + ' %\nSimulationszeit: ' + state.minutes + ' Minuten · Zyklus ' + state.cycle + '\nNetzwerk: lokal · Marktdaten: simuliert · ' + (state.paused ? 'PAUSIERT' : motion.matches ? 'MANUELLE ZEIT' : 'AKTIV'));
        break;
      case 'nodes':
        appendTerminal(state.nodes.map(function (node) { return node.id + ' / ' + node.sector + ' / ' + number.format(node.price) + ' CNX / Stärke ' + number.format(node.strength) + ' % / Bestand ' + precise.format(node.quantity) + (node.bound ? ' / GEBUNDEN' : ''); }).join('\n'));
        break;
      case 'phase':
        if (parts.length > 1) {
          const index = /^[1-5]$/.test(parts[1]) ? Number(parts[1]) - 1 : phases.findIndex(function (phase) { return phase.name.toLowerCase() === parts[1].toLowerCase(); });
          result = index >= 0 ? selectPhase(index, true) : announce({ ok: false, message: 'Phase als Zahl 1–5 oder Phasenname angeben.' });
        } else appendTerminal('Aktive Phase: ' + state.phaseName + ' / ' + phases[phaseIndex].time + '\n' + phases.map(function (phase, index) { return (index === phaseIndex ? '› ' : '  ') + (index + 1) + ' ' + phase.name + ' ' + phase.time; }).join('\n') + '\nManuelle Wechsel verbrauchen Kohärenz; automatische Wechsel nicht.');
        break;
      case 'eclipse':
        appendTerminal('TOTALE SONNENFINSTERNIS / ' + state.phaseName + '\nAktuelle Korona: ' + number.format(state.visual.corona * 100) + ' %\nKalibrierte Totalität: 99,97 % · Brechungsindex: 1,3091\nKristallschollen: 46 · Kammer: 04\nStrahlungsfluss: ' + number.format(state.visual.flux * 100) + ' % · Kern: ' + number.format(state.visual.temperature) + ' °C');
        break;
      case 'vault':
        appendTerminal('VAULT / ' + (state.vault.open ? 'ZUGRIFF GEWÄHRT' : 'ZEITFENSTER GESPERRT') + '\n' + state.vault.conditions.map(function (condition) { return (condition.met ? '✓ ' : '○ ') + condition.label; }).join('\n') + '\nGuthaben ' + interest.format(state.vault.balance) + ' CNX · Ertrag ' + interest.format(state.vault.earned) + ' CNX\nSimulierter Jahreszins ' + number.format(state.vault.apr) + ' % · nur während des offenen Fensters\nLokale Simulation. Keine Wallet erforderlich.');
        break;
      case 'portfolio':
        appendTerminal('VERMÖGEN ' + number.format(state.equity) + ' CNX\nVerfügbar ' + number.format(state.cash) + ' CNX · Positionen ' + number.format(state.portfolioValue) + ' CNX · Vault ' + interest.format(state.vault.balance) + ' CNX\nHandelsgebühren bisher ' + interest.format(state.feesPaid) + ' CNX\n' + state.nodes.map(function (node) { return node.id + ': ' + precise.format(node.quantity) + ' / ' + number.format(node.positionValue) + ' CNX'; }).join('\n'));
        break;
      case 'history':
        appendTerminal(state.history.length ? state.history.slice(-20).map(function (entry) { return 'T+' + entry.tick * 5 + ' MIN / ' + phases[entry.phase].name + ' / ' + entry.text; }).join('\n') : 'Noch keine Zeitspuren. Deine Entscheidungen schreiben die Geschichte.');
        break;
      case 'buy': case 'sell':
        result = action(command, { id: id, quantity: numeric(parts[2] || '') }); break;
      case 'link': case 'unlink': case 'stabilize':
        result = action(command, { id: id }); break;
      case 'deposit': case 'withdraw':
        result = action(command, { amount: numeric(parts[1] || '') }); break;
      case 'pause': case 'resume': case 'step':
        result = action(command); break;
      case 'reset':
        result = parts[1] === 'confirm' ? action('reset') : announce({ ok: false, message: '„reset confirm“ löscht alle lokalen Käufe, Bindungen und Zeitspuren und startet mit 100.000 CNX.' }); break;
      default:
        appendTerminal('Unbekannter Befehl: „' + raw.trim() + '“. Mit „help“ findest du alle Befehle.', 'error');
    }
    if (result) appendTerminal(result.message, result.ok ? 'response' : 'error');
  }
  const history = [];
  let historyIndex = 0;
  let historyDraft = '';
  const terminalForm = document.getElementById('terminal-form');
  if (terminalForm && terminalInput) {
    terminalForm.addEventListener('submit', function (event) {
      event.preventDefault();
      const raw = terminalInput.value;
      if (raw.trim()) { history.push(raw); if (history.length > 50) history.shift(); }
      historyIndex = history.length;
      historyDraft = '';
      terminalCommand(raw);
      terminalInput.value = '';
      terminalInput.focus({ preventScroll: true });
    });
    terminalInput.addEventListener('keydown', function (event) {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      if (!history.length) return;
      event.preventDefault();
      if (historyIndex === history.length) historyDraft = terminalInput.value;
      historyIndex = Math.max(0, Math.min(history.length, historyIndex + (event.key === 'ArrowUp' ? -1 : 1)));
      terminalInput.value = historyIndex === history.length ? historyDraft : history[historyIndex];
    });
  }

  function selectPhase(index, manual) {
    const result = simulation.selectPhase(index, { manual: manual !== false });
    if (manual !== false) {
      announce(result);
      if (result.ok && phaseJob) { stopJob(phaseJob); startJob(phaseJob); }
    }
    return result;
  }
  phaseJob = recurring(function () {
    if (!state.paused) selectPhase((phaseIndex + 1) % phases.length, false);
  }, 5200, true);
  phaseButtons.forEach(function (button) {
    button.addEventListener('click', function () { selectPhase(Number(button.dataset.phase), true); });
  });
  const pauseButton = document.getElementById('simulation-pause');
  if (pauseButton) pauseButton.addEventListener('click', function () { action(state.paused ? 'resume' : 'pause'); });
  const stepButton = document.getElementById('simulation-step');
  if (stepButton) stepButton.addEventListener('click', function () { action('step'); });
  ['deposit', 'withdraw'].forEach(function (type) {
    const button = document.getElementById('vault-' + type);
    if (button) button.addEventListener('click', function () {
      const result = action(type, { amount: numeric(document.getElementById('vault-amount').value) });
      setText('vault-message', result.message);
    });
  });
  const resetButton = document.getElementById('simulation-reset');
  function disarmReset() {
    resetArmed = false;
    if (resetTimer) window.clearTimeout(resetTimer);
    resetTimer = 0;
    if (resetButton) resetButton.textContent = 'Neustart';
  }
  if (resetButton) resetButton.addEventListener('click', function () {
    if (!resetArmed) {
      resetArmed = true;
      resetButton.textContent = 'Fortschritt löschen bestätigen';
      announce({ ok: true, message: 'Nochmals drücken: Käufe, Bindungen und Zeitspuren werden gelöscht. Neues Startkapital: 100.000 CNX.' });
      resetTimer = window.setTimeout(disarmReset, 8000);
    } else { disarmReset(); action('reset'); }
  });
  simulation.subscribe(renderSimulation);
  // Publish the restored initial phase, including a cold reduced-motion session.
  document.dispatchEvent(new CustomEvent('cryonexus:phase', { detail: { index: state.phase, name: state.phaseName } }));
  if (storageCorrupt) announce({ ok: false, message: 'Der gespeicherte Fortschritt war beschädigt. Eine neue lokale Simulation wurde gestartet.' });
  if (state.restoreError) announce({ ok: false, message: state.restoreError });

  const countElements = Array.from(document.querySelectorAll('[data-count]'));
  function countFormat(element, value) {
    const decimals = Number(element.dataset.decimals || 0);
    return new Intl.NumberFormat('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
  }
  function finishCounters() {
    counters.clear();
    countElements.forEach(function (element) {
      element.textContent = countFormat(element, Number(element.dataset.count));
      element.dataset.counted = 'true';
    });
  }
  function beginCounter(element) {
    if (element.dataset.counted) return;
    element.dataset.counted = 'true';
    if (motion.matches) { element.textContent = countFormat(element, Number(element.dataset.count)); return; }
    counters.set(element, { target: Number(element.dataset.count), elapsed: 0 });
    element.textContent = countFormat(element, 0);
  }

  let revealObserver;
  let countObserver;
  if ('IntersectionObserver' in window) {
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.15) return;
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.15 });
    countObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.15) return;
        beginCounter(entry.target);
        countObserver.unobserve(entry.target);
      });
    }, { threshold: 0.15 });
    document.querySelectorAll('.reveal').forEach(function (element) { revealObserver.observe(element); });
    countElements.forEach(function (element) { countObserver.observe(element); });
  } else {
    document.querySelectorAll('.reveal').forEach(function (element) { element.classList.add('visible'); });
    countElements.forEach(beginCounter);
  }
  root.classList.add('js');

  const tiltElements = Array.from(document.querySelectorAll('[data-tilt]'));
  tiltElements.forEach(function (element) {
    element.addEventListener('pointermove', function (event) {
      if (motion.matches || document.hidden || event.pointerType === 'touch') return;
      const rect = element.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      pendingTilts.set(element, { x: x, y: y });
    }, { passive: true });
    element.addEventListener('pointerleave', function () {
      if (!motion.matches && !document.hidden) pendingTilts.set(element, { x: 0.5, y: 0.5 });
    });
  });
  function clearDepth() {
    pendingTilts.clear();
    sections.forEach(function (section) { section.style.setProperty('--scroll-tilt', '0deg'); });
    tiltElements.forEach(function (element) {
      element.style.setProperty('--rx', '0deg'); element.style.setProperty('--ry', '0deg');
      element.style.setProperty('--mx', '50%'); element.style.setProperty('--my', '50%');
    });
  }
  function frame(now) {
    frameId = 0;
    if (document.hidden || motion.matches) return;
    // Use visible wall time so counters finish on schedule even during slow frames.
    const dt = lastFrame ? now - lastFrame : 0;
    lastFrame = now;
    frameCount += 1;
    if (now - fpsStart >= 1000) {
      if (fps) fps.textContent = String(Math.round(frameCount * 1000 / (now - fpsStart)));
      fpsStart = now;
      frameCount = 0;
    }
    if (scrollDirty) {
      const height = window.innerHeight;
      sections.forEach(function (section) {
        const rect = section.getBoundingClientRect();
        const depth = Math.max(-1, Math.min(1, (rect.top + rect.height / 2 - height / 2) / Math.max(height, rect.height)));
        section.style.setProperty('--scroll-tilt', (depth * -1.8).toFixed(3) + 'deg');
      });
      scrollDirty = false;
    }
    pendingTilts.forEach(function (pointer, element) {
      element.style.setProperty('--mx', (pointer.x * 100).toFixed(2) + '%');
      element.style.setProperty('--my', (pointer.y * 100).toFixed(2) + '%');
      element.style.setProperty('--rx', ((0.5 - pointer.y) * 7).toFixed(2) + 'deg');
      element.style.setProperty('--ry', ((pointer.x - 0.5) * 9).toFixed(2) + 'deg');
    });
    pendingTilts.clear();
    counters.forEach(function (counter, element) {
      counter.elapsed += dt;
      const progress = Math.min(1, counter.elapsed / 1400);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = countFormat(element, counter.target * eased);
      if (progress === 1) counters.delete(element);
    });
    frameId = window.requestAnimationFrame(frame);
  }
  function startFrames() {
    if (frameId || document.hidden || motion.matches) return;
    lastFrame = 0;
    fpsStart = performance.now();
    frameCount = 0;
    scrollDirty = true;
    frameId = window.requestAnimationFrame(frame);
  }
  function stopFrames() {
    if (frameId) window.cancelAnimationFrame(frameId);
    frameId = 0;
    lastFrame = 0;
  }
  window.addEventListener('scroll', function () { if (!motion.matches) scrollDirty = true; }, { passive: true });
  window.addEventListener('resize', function () { if (!motion.matches) scrollDirty = true; }, { passive: true });

  function audioState(enabled, available) {
    if (!audioButton) return;
    audioButton.setAttribute('aria-pressed', String(enabled));
    audioButton.removeAttribute('aria-busy');
    audioButton.setAttribute('aria-label', enabled ? 'Klang ausschalten' : 'Klang einschalten');
    if (audioLabel) audioLabel.textContent = available === false ? 'KLANG NICHT VERFÜGBAR' : enabled ? 'KLANG AN' : 'KLANG AUS';
  }
  function requestAudio(enabled) {
    audioDesired = enabled;
    const token = ++audioToken;
    if (audioButton) audioButton.setAttribute('aria-busy', 'true');
    if (!window.cinema || typeof window.cinema.setAudio !== 'function') { audioDesired = false; audioState(false, false); return; }
    let result;
    // Call synchronously inside the interaction handler to preserve audio activation.
    try { result = window.cinema.setAudio(enabled); }
    catch (_) { audioDesired = false; audioState(false, false); return; }
    Promise.resolve(result).then(function (active) {
      if (token !== audioToken) {
        if (!audioDesired) window.cinema.setAudio(false);
        return;
      }
      audioDesired = enabled && !!active;
      audioState(audioDesired, !enabled || !!active);
    }).catch(function () {
      if (token === audioToken) { audioDesired = false; audioState(false, false); }
    });
  }
  function firstPointer(event) {
    if (audioButton && audioButton.contains(event.target)) return;
    document.removeEventListener('pointerdown', firstPointer);
    requestAudio(true);
  }
  document.addEventListener('pointerdown', firstPointer, { passive: true });
  if (audioButton) audioButton.addEventListener('click', function () {
    document.removeEventListener('pointerdown', firstPointer);
    requestAudio(!audioDesired);
  });

  function motionChanged() {
    jobs.forEach(function (job) { stopJob(job); startJob(job); });
    renderSimulation(simulation.snapshot());
    if (motion.matches) {
      stopFrames();
      clearDepth();
      finishCounters();
      finishAutoplay();
      finishBoot();
      finishJob(bootJob);
      document.querySelectorAll('.reveal').forEach(function (element) { element.classList.add('visible'); });
      if (revealObserver) revealObserver.disconnect();
      if (countObserver) countObserver.disconnect();
      if (fps) fps.textContent = '—';
      // Flush the reduced-motion styles and cancel transitions already pending.
      if (typeof document.getAnimations === 'function') {
        document.getAnimations().forEach(function (animation) { animation.cancel(); });
      }
    } else startFrames();
  }
  motion.addEventListener('change', motionChanged);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { jobs.forEach(stopJob); stopFrames(); }
    else { utcClock(); jobs.forEach(startJob); startFrames(); }
  });
  motionChanged();
})();
