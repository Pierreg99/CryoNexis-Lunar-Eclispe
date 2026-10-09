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
  const nodes = [
    { id: 'CN-ALPHA-01', sector: 'Eis-Storage', price: 1842.60, liquidity: 1840000, halfLife: '128 h', validators: 64, strength: 84, symbol: '◇' },
    { id: 'CN-BOREALIS', sector: 'Cryo-Mining', price: 927.34, liquidity: 2630000, halfLife: '96 h', validators: 128, strength: 92, symbol: '⌘' },
    { id: 'CN-LUNAR-09', sector: 'Corona-Handel', price: 3120.09, liquidity: 4170000, halfLife: '42 h', validators: 92, strength: 78, symbol: '◉' },
    { id: 'CN-KRYO-7X', sector: 'Strahlungsschild', price: 748.72, liquidity: 1120000, halfLife: '256 h', validators: 48, strength: 96, symbol: '⬡' },
    { id: 'CN-UMBRA', sector: 'Schattenmarkt', price: 2064.18, liquidity: 3260000, halfLife: '64 h', validators: 76, strength: 68, symbol: '◈' },
    { id: 'CN-HALO', sector: 'Lichtarbitrage', price: 1296.46, liquidity: 2080000, halfLife: '32 h', validators: 104, strength: 88, symbol: '◎' }
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

  function renderNode(node) {
    node.priceElement.textContent = number.format(node.price);
    node.liquidityElement.textContent = number.format(node.liquidity / 1000000) + ' Mio. CNX';
    node.changeElement.textContent = (node.change >= 0 ? '+' : '−') + number.format(Math.abs(node.change)) + ' %';
    node.changeElement.style.color = node.change >= 0 ? 'var(--ice)' : 'var(--corona)';
    node.meter.style.setProperty('--value', node.strength.toFixed(2) + '%');
  }
  const nodeGrid = document.getElementById('node-grid');
  if (nodeGrid) nodes.forEach(function (node, index) {
    const article = document.createElement('article');
    article.className = 'node panel reveal reveal-d' + (index % 4 + 1);
    article.setAttribute('data-tilt', '');
    const detailId = 'node-detail-' + index;
    article.innerHTML = '<button type="button" class="node-trigger" aria-expanded="false" aria-controls="' + detailId + '">' +
      '<span class="node-head"><span>0' + (index + 1) + ' / VERBUNDEN</span><span class="node-symbol" aria-hidden="true">' + node.symbol + '</span></span>' +
      '<h3>' + node.id + '</h3><span class="node-sector">' + node.sector + '</span>' +
      '<span class="node-value"><span><span class="node-price"></span><small> CNX</small></span><small class="node-change"></small></span></button>' +
      '<div id="' + detailId + '" class="node-details" aria-hidden="true"><div class="node-details-inner"><dl>' +
      '<div><dt>Sektor</dt><dd>' + node.sector + '</dd></div><div><dt>Liquidität</dt><dd class="node-liquidity"></dd></div>' +
      '<div><dt>Halbwertszeit</dt><dd>' + node.halfLife + '</dd></div><div><dt>Validatoren</dt><dd>' + node.validators + '</dd></div>' +
      '</dl><div class="meter" aria-hidden="true"><i></i></div></div></div>';
    // A native button provides Enter and Space behavior without duplicate key handlers.
    const trigger = article.querySelector('.node-trigger');
    trigger.setAttribute('aria-label', node.id + ' · ' + node.sector + ' · Details');
    trigger.addEventListener('click', function () {
      const expanded = trigger.getAttribute('aria-expanded') !== 'true';
      trigger.setAttribute('aria-expanded', String(expanded));
      article.classList.toggle('open', expanded);
      article.querySelector('.node-details').setAttribute('aria-hidden', String(!expanded));
    });
    node.priceElement = article.querySelector('.node-price');
    node.changeElement = article.querySelector('.node-change');
    node.liquidityElement = article.querySelector('.node-liquidity');
    node.meter = article.querySelector('.meter i');
    node.change = 0;
    renderNode(node);
    nodeGrid.appendChild(article);
  });
  recurring(function () {
    nodes.forEach(function (node) {
      if (!node.priceElement) return;
      const drift = (Math.random() * 2 - 1) * 0.006;
      node.price *= 1 + drift;
      node.liquidity *= 1 + drift;
      node.change = drift * 100;
      node.strength = Math.max(45, Math.min(98, node.strength + drift * 35));
      renderNode(node);
    });
  }, 2200, true);

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
  const script = ['CRYONEXUS / VAULT v.04', 'Kryo-Verbindung hergestellt …', '6 Knoten validiert. Schattenmarkt verfügbar.', 'Kerntemperatur −268 °C. Restlauf ∞.', 'Zugriff gewährt: ZEITZEUGE.', 'Eingabe bereit. „help“ zeigt alle Befehle.'];
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
    const command = raw.trim().toLowerCase();
    if (!command) return;
    if (command === 'clear') { if (terminalOutput) terminalOutput.replaceChildren(); return; }
    appendTerminal('cryo@vault:~$ ' + raw.trim(), 'system');
    switch (command) {
      case 'help':
        appendTerminal('help    → Befehle anzeigen\nstatus  → Kammerstatus lesen\nnodes   → Sechs Knoten und Live-Werte\nphase   → Aktuelle Phase und Zeitlinie\neclipse → Finsternis-Messdaten\nvault   → Zugriffsprotokoll\nclear   → Ausgabe leeren');
        break;
      case 'status':
        appendTerminal('KAMMER 04 · KRITISCH STABIL\nUTC ' + new Date().toISOString().slice(11, 19) + '\nSzenen: ' + builtScenes.size + '/6 · Phase: ' + phases[phaseIndex].name + '\nKerntemperatur: −268 °C · Restlauf: ∞\nNetzwerk: lokal · Marktdaten: simuliert');
        break;
      case 'nodes':
        appendTerminal(nodes.map(function (node) { return node.id + ' / ' + node.sector + ' / ' + number.format(node.price) + ' CNX'; }).join('\n'));
        break;
      case 'phase':
        appendTerminal('Aktive Phase: ' + phases[phaseIndex].name + ' / ' + phases[phaseIndex].time + '\n' + phases.map(function (phase, index) { return (index === phaseIndex ? '› ' : '  ') + phase.name + ' ' + phase.time; }).join('\n') + '\nWähle eine Phase in der Zeitlinie.');
        break;
      case 'eclipse':
        appendTerminal('TOTALE SONNENFINSTERNIS\nKorona: 99,97 % · Brechungsindex: 1,3091\nKristallschollen: 46 · Kammer: 04\nLicht bricht sich durch einen Ring aus Eis.');
        break;
      case 'vault':
        appendTerminal('VAULT / ZUGRIFF GEWÄHRT\nRolle: ZEITZEUGE · Protokoll: v.04\n6 validierte Verbindungen · Verschlüsselung aktiv\nLokale Simulation. Keine Wallet erforderlich.');
        break;
      default:
        appendTerminal('Unbekannter Befehl: „' + raw.trim() + '“. Mit „help“ findest du alle Befehle.', 'error');
    }
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

  function selectPhase(index) {
    phaseIndex = index;
    phaseButtons.forEach(function (button) { button.setAttribute('aria-pressed', String(Number(button.dataset.phase) === index)); });
    const description = document.getElementById('phase-description');
    if (description) description.textContent = phases[index].description;
    document.dispatchEvent(new CustomEvent('cryonexus:phase', { detail: { index: index, name: phases[index].name } }));
  }
  const phaseJob = recurring(function () { selectPhase((phaseIndex + 1) % phases.length); }, 5200, true);
  phaseButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      selectPhase(Number(button.dataset.phase));
      // Give a manually selected phase a full cycle before advancing again.
      stopJob(phaseJob);
      startJob(phaseJob);
    });
  });
  selectPhase(0);

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
    const dt = lastFrame ? Math.min(now - lastFrame, 64) : 0;
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
    } else startFrames();
  }
  motion.addEventListener('change', motionChanged);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { jobs.forEach(stopJob); stopFrames(); }
    else { utcClock(); jobs.forEach(startJob); startFrames(); }
  });
  motionChanged();
})();
