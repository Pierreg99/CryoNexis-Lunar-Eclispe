(function (global, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else global.CryoSimulation = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 1;
  // Four-decimal monetary atoms stay below the safe integer limit at this cap.
  const MONEY_LIMIT = 100000000000;
  const MAX_QUANTITY = 1000;
  const YEAR_MINUTES = 365 * 24 * 60;
  const BASE = [
    { id: 'CN-ALPHA-01', sector: 'Eis-Storage', symbol: '◇', price: 1842.60, liquidity: 1840000, halfLife: 128, validators: 64, strength: 84 },
    { id: 'CN-BOREALIS', sector: 'Cryo-Mining', symbol: '⌘', price: 927.34, liquidity: 2630000, halfLife: 96, validators: 128, strength: 92 },
    { id: 'CN-LUNAR-09', sector: 'Corona-Handel', symbol: '◉', price: 3120.09, liquidity: 4170000, halfLife: 42, validators: 92, strength: 78 },
    { id: 'CN-KRYO-7X', sector: 'Strahlungsschild', symbol: '⬡', price: 748.72, liquidity: 1120000, halfLife: 256, validators: 48, strength: 96 },
    { id: 'CN-UMBRA', sector: 'Schattenmarkt', symbol: '◈', price: 2064.18, liquidity: 3260000, halfLife: 64, validators: 76, strength: 68 },
    { id: 'CN-HALO', sector: 'Lichtarbitrage', symbol: '◎', price: 1296.46, liquidity: 2080000, halfLife: 32, validators: 104, strength: 88 }
  ];
  // Phase prices are a calibration of neutral prices, never a repeated multiplier.
  const PHASES = [
    { name: 'Kontakt', cost: 8, flux: 0.18, corona: 0.08, temperature: -268, load: 2, coherence: 90, strength: 0, apr: 12,
      prices: [1, 1, 1, 1, 1, 1], liquidity: [1, 1, 1, 1, 1, 1], bias: [0.00010, 0.00012, -0.00004, 0.00006, -0.00010, 0.00008] },
    { name: 'Diamantring', cost: 12, flux: 0.65, corona: 0.44, temperature: -266.8, load: 5, coherence: 82, strength: -2, apr: 15,
      prices: [1.014, 1.008, 1.052, 1.017, 0.976, 1.039], liquidity: [0.96, 0.92, 1.16, 1.04, 0.82, 1.12], bias: [0.00006, -0.00008, 0.00035, 0.00012, -0.00025, 0.00024] },
    { name: 'Korona', cost: 18, flux: 0.96, corona: 0.9997, temperature: -264.2, load: 8, coherence: 70, strength: -5, apr: 18,
      prices: [1.026, 0.984, 1.082, 1.055, 1.042, 1.068], liquidity: [1.04, 0.85, 1.3, 1.18, 1.12, 1.24], bias: [0.00012, -0.00025, 0.00038, 0.00028, 0.00020, 0.00032] },
    { name: 'Freisteller', cost: 14, flux: 0.42, corona: 0.36, temperature: -266, load: 4, coherence: 86, strength: -1, apr: 16,
      prices: [1.012, 1.028, 1.021, 1.006, 1.061, 1.024], liquidity: [1.08, 1.14, 1.04, 0.97, 1.2, 1.06], bias: [0.00008, 0.00022, -0.00010, -0.00005, 0.00030, 0.00006] },
    { name: 'Reset', cost: 8, flux: 0.1, corona: 0.015, temperature: -269, load: 0, coherence: 94, strength: 3, apr: 12,
      prices: [0.987, 1.015, 0.971, 1.022, 0.983, 0.995], liquidity: [0.94, 1.08, 0.84, 1.14, 0.86, 0.98], bias: [-0.00014, 0.00012, -0.00030, 0.00020, -0.00020, -0.00005] }
  ];

  const SCENES = [
    { id: 'chamber', name: 'Kammer', text: 'Kammer 04. Unter dem Eis leuchtet eine Empfangsmarke: „Feld I: die Kammernummer, dreistellig mit führenden Nullen.“ Die Kammer antwortet auf Beobachtung.' },
    { id: 'eclipse', name: 'Finsternis', text: 'Hinter 99,97 % Totalität bleibt eine schmale Spur. Ihre Inschrift lautet: „Kammer — Schollen — Brechungsindex. Drei Zahlen, zwei Bindestriche. Beim Index entfällt nur das Dezimalzeichen.“ Im Freisteller wird Licht zu Schrift im Eis.' },
    { id: 'ice-ring', name: 'Nexus', text: '46 Kristallschollen tragen denselben Puls. Der Brechungsindex beträgt 1,3091. Die Zahlen auf der Kammer, am Schattenrand und im Eis bilden gemeinsam eine Sendefrequenz.' },
    { id: 'nodes', name: 'Knoten', text: 'Sechs Knoten halten die Kammer zusammen. Eine Bake braucht eine Bindung und danach eine Stabilisierung auf mindestens 90 % Stärke. Sie sendet auch dann, wenn niemand ihren Marktwert betrachtet.' },
    { id: 'terminal', name: 'Vault', text: 'Der Vault bewahrt Zeit im Eis: einlagern und einen Simulationsschritt berechnen, solange das Fenster offen ist. Eine Randnotiz fragt nach der Antwort auf das Leben, das Universum und den ganzen Rest; eine andere erinnert an das Zauberwort aus Colossal Cave. Vielleicht antwortet ein Echo.' },
    { id: 'void', name: 'Zeitlinie', text: 'Die letzte Szene enthält keine Uhr. Eine verblasste Zeile lautet: „Nicht jede Zeitspur braucht Bewegung. Halte den Rhythmus an, dann untersuche die Stille noch einmal.“' }
  ];
  const QUESTS = [
    { id: 'arrival', title: 'Ankunft in Kammer 04', description: 'Eine Empfangsmarke wartet unter dem Eis. Finde heraus, warum die Kammer auf dich reagiert.', hint: 'Untersuche die Kammer.', target: 'Kammer untersuchen', reward: 'Dossier „Ankunft“', requires: [], max: 1,
      text: 'ANKUNFT / Du bist nicht allein. Die Kammer hat keine Namen gespeichert, nur den ersten Blick jedes Zeitzeugen. Dein Blick gehört nun dazu.' },
    { id: 'edge', title: 'Der Schatten hat einen Rand', description: 'Ein Rest Licht durchdringt die Totalität. Lies seine Spur, wenn die Korona sichtbar ist.', hint: 'Wähle Korona und untersuche die Finsternis. Ein Phasenwechsel kostet Kohärenz.', target: 'Finsternis während Korona untersuchen', reward: 'Dossier „Hinter dem Rand“', requires: ['arrival'], max: 1,
      text: 'HINTER DEM RAND / Die Finsternis ist keine leere Fläche. An ihrem Rand wandert eine Nachricht entlang, die nur im gemeinsamen Licht der Kammer und des Nexus lesbar wird.' },
    { id: 'cartographer', title: 'Kartograf des Unsichtbaren', description: 'Sechs Orte erzählen dieselbe Geschichte aus verschiedenen Richtungen. Verbinde ihre Spuren.', hint: 'Untersuche Kammer, Finsternis, Nexus, Knoten, Vault und Zeitlinie.', target: 'Alle sechs Szenen untersuchen', reward: 'Titel „Zeitzeuge“', requires: ['edge'], max: 6,
      text: 'ZEITZEUGE / Deine Karte besteht aus Blicken: Eis, Schatten, Ring, Bake, Vault und Nebel. Erst gemeinsam zeigen sie den Weg der verschwundenen Besatzung.' },
    { id: 'beacon', title: 'Eine Bake im Eis', description: 'Eine verlässliche Verbindung trägt weiter als ein flüchtiges Signal. Stelle eine Bake wieder her.', hint: 'Binde einen Knoten und stabilisiere ihn danach auf mindestens 90 % Stärke. Binden kostet 1.200 CNX, Stabilisieren 700 CNX.', target: 'Gebundenen Knoten auf mindestens 90 % stabilisieren', reward: 'Dossier „Die letzte Bake“', requires: ['arrival'], max: 1,
      text: 'DIE LETZTE BAKE / Eine Verbindung wurde vor langer Zeit bewusst offen gehalten. Deine Stabilisierung schließt ihren Kreis. Im Eis antwortet eine zweite Stimme: „Empfang bestätigt.“' },
    { id: 'yield', title: 'Zeit im Eis', description: 'Die Bake braucht eine Nachricht, die länger als einen Augenblick hält. Bewahre Zeit im Vault.', hint: 'Halte mindestens 1.000 CNX im offenen Vault und erzeuge positiven Ertrag mit einem Simulationsschritt. „vault“ zeigt die Zugangsbedingungen.', target: '1.000 CNX im Vault und positiven Ertrag nachweisen', reward: 'Dossier „Zeit im Eis“', requires: ['beacon'], max: 1,
      text: 'ZEIT IM EIS / Der Ertrag ist nur ein Messzeichen. Er beweist, dass eine Nachricht über den nächsten Takt hinaus erhalten blieb. Die Kammer hat gelernt, auf eine Antwort zu warten.' },
    { id: 'remembrance', title: 'Die Kammer erinnert sich', description: 'Zwei verborgene Erinnerungen reichen, um die verlorene Nachricht zu vervollständigen.', hint: 'Entdecke zwei Geheimnisse. Untersuche die Anzeigen, die angehaltene Zeit und das Eis im Freisteller.', target: 'Zwei Geheimnisse entdecken', reward: 'Titel „Hüter der Kammer“ und Aurorasignatur', requires: ['cartographer', 'yield'], max: 2,
      text: 'HÜTER DER KAMMER / „Wir waren nicht verloren. Wir warteten darauf, dass jemand unsere Spuren miteinander verbindet.“ Die letzte Nachricht löst sich im Eis. Eine Aurora bleibt als dein Zeichen zurück.' }
  ];
  const SECRETS = [
    { id: 'frequency', title: 'Frequenz 004', hint: 'Die Anzeigen der Kammer, der Finsternis und des Nexus gehören zusammen. Untersuche ihre Inschriften und sende eine Frequenz.', text: 'FREQUENZ 004 / Eine verschlossene Empfangslinie öffnet sich: „Wir haben das Feuer im Eis gelassen. Wer unsere Zahlen liest, kann die Glutsignatur tragen.“ Die Signatur „Glut“ ist freigeschaltet.' },
    { id: 'silence', title: 'Archiv der Stille', hint: 'Eine Zeitspur wartet darauf, dass der Rhythmus verstummt.', text: 'ARCHIV DER STILLE / In der angehaltenen Zeit hörst du eine Nachricht ohne Takt: „Wir zählten nicht die Stunden, sondern die Momente, in denen jemand zuhörte.“' },
    { id: 'refraction', title: 'Zwischen Licht und Eis', hint: 'Ein Satz im Eis erscheint, nachdem du den Schatten gelesen hast und das Licht wieder freisteht.', text: 'ZWISCHEN LICHT UND EIS / Im Freisteller brechen sich die Buchstaben an jeder Scholle: „Der Schatten verbarg uns nicht. Er bewahrte unsere Nachricht, bis das Licht zurückkehrte.“' }
  ];
  const EGGS = [
    { id: 'answer', title: 'Die große Antwort', hint: 'Eine Randnotiz im Vault stellt eine sehr alte Frage.', text: 'DIE GROSSE ANTWORT / 42. Die Kammer nickt, obwohl sie noch immer nach der richtigen Frage sucht. Ein kleines Handtuch liegt neben dem Strahlungsschild.' },
    { id: 'magic', title: 'Ein sehr altes Zauberwort', hint: 'Eine Randnotiz im Vault erinnert an die Anfänge interaktiver Welten.', text: 'EIN SEHR ALTES ZAUBERWORT / Eine Höhle blitzt im Eis auf. Nichts geschieht — außer dass ein uraltes Abenteuer für einen Augenblick zurückgrüßt.' }
  ];
  const THEMES = [{ id: 'frost', name: 'Frost' }, { id: 'aurora', name: 'Aurora' }, { id: 'ember', name: 'Glut' }];
  const JOURNEY_HISTORY = ['quest', 'claim', 'inspect', 'secret', 'echo', 'theme'];

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const money = value => Math.round((value + Number.EPSILON) * 10000) / 10000;
  const quantityRound = value => Math.round(value * 1000000) / 1000000;
  const clone = value => JSON.parse(JSON.stringify(value));
  const finite = (value, low, high) => typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high;
  const integer = (value, low, high) => Number.isInteger(value) && finite(value, low, high);
  const precise = (value, decimals) => Math.abs(value - Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)) <= Number.EPSILON * Math.max(1, Math.abs(value)) * 2;
  const display = value => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 4 }).format(value);
  const failure = message => ({ ok: false, message: message });
  const exactKeys = (object, keys) => object && typeof object === 'object' && !Array.isArray(object) &&
    Object.keys(object).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(object, key));

  function initial(seed) {
    return {
      version: VERSION, seed: seed, rng: seed, phase: 0, tick: 0, cycle: 0, paused: false,
      cash: 100000, coherence: 90, feesPaid: 0, historySeq: 0, history: [],
      nodes: BASE.map(base => ({ id: base.id, rawPrice: base.price, liquidityFactor: 1,
        strength: base.strength, quantity: 0, bound: false, change: 0 })),
      vault: { balance: 0, earned: 0 }
    };
  }

  function expeditionInitial() {
    return { observed: [], calibrated: [], networkUnlocked: false, archiveUnlocked: false, decoded: false };
  }
  function validExpedition(value) {
    return exactKeys(value, ['observed', 'calibrated', 'networkUnlocked', 'archiveUnlocked', 'decoded']) &&
      Array.isArray(value.observed) && value.observed.length <= 5 && new Set(value.observed).size === value.observed.length && value.observed.every(phase => integer(phase, 0, 4)) &&
      Array.isArray(value.calibrated) && value.calibrated.length <= 6 && new Set(value.calibrated).size === value.calibrated.length && value.calibrated.every(id => BASE.some(node => node.id === id)) &&
      typeof value.networkUnlocked === 'boolean' && typeof value.archiveUnlocked === 'boolean' && typeof value.decoded === 'boolean' &&
      (!value.networkUnlocked || value.observed.length >= 2) && (!value.calibrated.length || value.networkUnlocked) &&
      (!value.archiveUnlocked || value.observed.length === 5 && value.calibrated.length >= 3 && value.networkUnlocked) && (!value.decoded || value.archiveUnlocked);
  }
  function journeyInitial() {
    return { accepted: [], ready: [], claimed: [], inspected: [], coronaInspected: false,
      stabilized: [], vaultYield: false, secrets: [], eggs: [], theme: 'frost' };
  }
  function journeyProgress(journey, id) {
    switch (id) {
      case 'arrival': return journey.inspected.includes('chamber') ? 1 : 0;
      case 'edge': return journey.coronaInspected ? 1 : 0;
      case 'cartographer': return journey.inspected.length;
      case 'beacon': return journey.stabilized.length ? 1 : 0;
      case 'yield': return journey.vaultYield ? 1 : 0;
      case 'remembrance': return Math.min(2, journey.secrets.length);
      default: return 0;
    }
  }
  function themeUnlocked(journey, id) {
    return id === 'frost' || id === 'ember' && journey.secrets.includes('frequency') ||
      id === 'aurora' && journey.claimed.includes('remembrance');
  }
  function validJourney(value, saved) {
    if (!exactKeys(value, ['accepted', 'ready', 'claimed', 'inspected', 'coronaInspected', 'stabilized', 'vaultYield', 'secrets', 'eggs', 'theme'])) return false;
    const ids = catalog => catalog.map(entry => entry.id);
    const boundedIds = (list, allowed) => Array.isArray(list) && list.length <= allowed.length &&
      new Set(list).size === list.length && list.every(id => typeof id === 'string' && allowed.includes(id));
    if (!boundedIds(value.accepted, ids(QUESTS)) || !boundedIds(value.ready, ids(QUESTS)) || !boundedIds(value.claimed, ids(QUESTS)) ||
      !boundedIds(value.inspected, ids(SCENES)) || !boundedIds(value.stabilized, ids(BASE)) || !boundedIds(value.secrets, ids(SECRETS)) || !boundedIds(value.eggs, ids(EGGS)) ||
      typeof value.coronaInspected !== 'boolean' || typeof value.vaultYield !== 'boolean' || !ids(THEMES).includes(value.theme) || !themeUnlocked(value, value.theme)) return false;
    if (value.coronaInspected && !value.inspected.includes('eclipse') ||
      value.vaultYield && (!saved.vault || !finite(saved.vault.earned, 0.0001, MONEY_LIMIT))) return false;
    if (!value.ready.every(id => value.accepted.includes(id)) || !value.claimed.every(id => value.ready.includes(id))) return false;
    if (!QUESTS.every(quest => !value.accepted.includes(quest.id) ||
      quest.requires.every(id => value.claimed.includes(id)) &&
      value.ready.includes(quest.id) === (journeyProgress(value, quest.id) >= quest.max))) return false;
    if (value.secrets.includes('frequency') && !['chamber', 'eclipse', 'ice-ring'].every(id => value.inspected.includes(id)) ||
      value.secrets.includes('silence') && !value.inspected.includes('void') ||
      value.secrets.includes('refraction') && !['eclipse', 'ice-ring'].every(id => value.inspected.includes(id))) return false;
    return true;
  }
  function validSaved(saved) {
    if (saved && Object.prototype.hasOwnProperty.call(saved, 'expedition') && !validExpedition(saved.expedition)) return false;
    if (saved && Object.prototype.hasOwnProperty.call(saved, 'journey') && !validJourney(saved.journey, saved)) return false;
    const savedKeys = ['version', 'seed', 'rng', 'phase', 'tick', 'cycle', 'paused', 'cash', 'coherence', 'feesPaid', 'historySeq', 'history', 'nodes', 'vault'];
    if (saved && Object.prototype.hasOwnProperty.call(saved, 'expedition')) savedKeys.push('expedition');
    if (saved && Object.prototype.hasOwnProperty.call(saved, 'journey')) savedKeys.push('journey');
    if (!exactKeys(saved, savedKeys) ||
      saved.version !== VERSION || !integer(saved.seed, 0, 4294967295) ||
      !integer(saved.rng, 0, 4294967295) || !integer(saved.phase, 0, 4) || !integer(saved.tick, 0, 100000000) ||
      !integer(saved.cycle, 0, 1000000) || typeof saved.paused !== 'boolean' ||
      !finite(saved.cash, 0, MONEY_LIMIT) || !precise(saved.cash, 4) || !finite(saved.coherence, 0, 100) || !precise(saved.coherence, 4) ||
      !finite(saved.feesPaid, 0, MONEY_LIMIT) || !precise(saved.feesPaid, 4) ||
      !integer(saved.historySeq, 0, Number.MAX_SAFE_INTEGER) || !Array.isArray(saved.nodes) || saved.nodes.length !== 6 ||
      !exactKeys(saved.vault, Object.prototype.hasOwnProperty.call(saved.vault, 'cryoUnlocked') ? ['balance', 'earned', 'cryoUnlocked'] : ['balance', 'earned']) || ('cryoUnlocked' in saved.vault && typeof saved.vault.cryoUnlocked !== 'boolean') || !finite(saved.vault.balance, 0, MONEY_LIMIT) || !precise(saved.vault.balance, 4) ||
      !finite(saved.vault.earned, 0, MONEY_LIMIT) || !precise(saved.vault.earned, 4) ||
      !Array.isArray(saved.history) || saved.history.length > 40) return false;
    if (!saved.nodes.every((node, index) => exactKeys(node, ['id', 'rawPrice', 'liquidityFactor', 'strength', 'quantity', 'bound', 'change']) && node.id === BASE[index].id &&
      finite(node.rawPrice, 0.0001, 1000000) && precise(node.rawPrice, 4) &&
      finite(node.liquidityFactor, 0.35, 1.65) && precise(node.liquidityFactor, 4) && finite(node.strength, 25, 100) && precise(node.strength, 4) &&
      finite(node.quantity, 0, 1000000000) && precise(node.quantity, 6) &&
      typeof node.bound === 'boolean' && finite(node.change, -0.6, 0.6) && precise(node.change, 4))) return false;
    let previous = 0;
    let previousTick = 0;
    const historyTypes = ['observe', 'calibrate', 'decode', 'discovery', 'unlock', 'tick', 'step', 'phase', 'auto-phase', 'pause', 'resume', 'buy', 'sell', 'link', 'unlink', 'stabilize', 'deposit', 'withdraw'].concat(JOURNEY_HISTORY);
    if (!saved.history.every(entry => {
      if (!exactKeys(entry, ['id', 'tick', 'type', 'text', 'phase']) || !integer(entry.id, previous + 1, saved.historySeq) || !integer(entry.tick, previousTick, saved.tick) ||
        !integer(entry.phase, 0, 4) || !historyTypes.includes(entry.type) || JOURNEY_HISTORY.includes(entry.type) && !saved.journey ||
        typeof entry.text !== 'string' || entry.text.length > 320) return false;
      previous = entry.id;
      previousTick = entry.tick;
      return true;
    })) return false;
    const positions = saved.nodes.reduce((sum, node, index) => sum + money(node.quantity * money(node.rawPrice * PHASES[saved.phase].prices[index])), 0);
    return finite(money(saved.cash + saved.vault.balance + positions), 0, MONEY_LIMIT);
  }

  function create(options) {
    options = options || {};
    const now = typeof options.now === 'function' ? options.now : Date.now;
    const unlockDeadline = Date.UTC(2026, 10, 1);
    const seed = integer(options.seed, 0, 4294967295) ? options.seed : 404;
    let state = initial(seed);
    let restored = false;
    let restoreError = '';
    if (options.saved !== undefined && options.saved !== null) {
      try {
        const candidate = typeof options.saved === 'string' ? JSON.parse(options.saved) : clone(options.saved);
        if (!validSaved(candidate)) throw new Error('Invalid state');
        state = candidate;
        restored = true;
      } catch (_) { restoreError = 'Der gespeicherte Zustand ist ungültig. Eine neue lokale Simulation wurde gestartet.'; }
    }
    const subscribers = new Set();
    const profile = () => PHASES[state.phase];

    function random() {
      state.rng = (state.rng + 0x6D2B79F5) >>> 0;
      let value = state.rng;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    }
    function record(type, text) {
      state.history.push({ id: ++state.historySeq, tick: state.tick, type: type, text: text, phase: state.phase });
      if (state.history.length > 40) state.history.splice(0, state.history.length - 40);
    }
    function derived() {
      const current = profile();
      const bound = state.nodes.filter(node => node.bound).length;
      const average = state.nodes.reduce((sum, node) => sum + node.strength, 0) / 6;
      const stability = money(clamp(average * 0.7 + state.coherence * 0.3 + bound * 1.2 - current.load, 0, 100));
      const nodes = state.nodes.map((node, index) => {
        const base = BASE[index];
        const price = money(node.rawPrice * current.prices[index]);
        const liquidity = money(base.liquidity * node.liquidityFactor * current.liquidity[index] *
          clamp(1 + (node.strength - base.strength) * 0.005 + (node.bound ? 0.07 : 0), 0.35, 2));
        const risk = money(clamp((100 - node.strength) * 0.62 + current.flux * 23 + (100 - state.coherence) * 0.15 - (node.bound ? 8 : 0), 0, 100));
        const spread = money(clamp(0.12 + risk * 0.004 + 1000000 / liquidity * 0.06, 0.12, 2));
        const halfLifeHours = money(base.halfLife * (1 - current.flux * 0.12 + (node.bound ? 0.08 : 0)));
        return {
          id: base.id, sector: base.sector, symbol: base.symbol, price: price, liquidity: liquidity,
          halfLife: halfLifeHours, halfLifeHours: halfLifeHours, halfLifeLabel: display(halfLifeHours) + ' h',
          validators: Math.max(8, base.validators + Math.round((node.strength - base.strength) * 0.8) + (node.bound ? 12 : 0)),
          strength: node.strength, change: node.change, quantity: node.quantity, bound: node.bound,
          positionValue: money(price * node.quantity), spread: spread, risk: risk
        };
      });
      const portfolioValue = money(nodes.reduce((sum, node) => sum + node.positionValue, 0));
      const equity = money(state.cash + state.vault.balance + portfolioValue);
      const conditions = [
        { label: 'Phase Korona oder Freisteller', met: state.phase === 2 || state.phase === 3 },
        { label: 'Mindestens 3 gebundene Knoten (' + bound + '/3)', met: bound >= 3 },
        { label: 'Stabilität mindestens 75 (' + display(stability) + ')', met: stability >= 75 },
        { label: 'Kohärenz mindestens 35 (' + display(state.coherence) + ')', met: state.coherence >= 35 }
      ];
      const unlocked = state.vault.cryoUnlocked === true && now() < unlockDeadline;
      const open = unlocked || conditions.every(condition => condition.met);
      if (unlocked) conditions.splice(0, conditions.length, { label: 'CRYO-Zugang aktiv bis 31.10.2026, 23:59:59 UTC · reguläre Zugangsbedingungen ausgesetzt', met: true });
      const apr = money(clamp(current.apr + bound * 0.25 + state.coherence * 0.006, 12, 20));
      return { nodes: nodes, portfolioValue: portfolioValue, equity: equity, stability: stability, bound: bound,
        vault: { open: open, cryoUnlocked: unlocked, unlockDeadline: unlockDeadline, balance: state.vault.balance, apr: apr, earned: state.vault.earned,
          conditions: conditions, accruing: open && state.vault.balance > 0 } };
    }
    function journeySnapshot() {
      const journey = state.journey || journeyInitial();
      const quests = QUESTS.map(function (quest) {
        const missing = quest.requires.filter(id => !journey.claimed.includes(id));
        const status = journey.claimed.includes(quest.id) ? 'claimed' : journey.ready.includes(quest.id) ? 'ready' :
          journey.accepted.includes(quest.id) ? 'active' : missing.length ? 'locked' : 'available';
        const prerequisite = missing.length ? 'Hole zuerst die Belohnung für ' + missing.map(id => '„' + QUESTS.find(entry => entry.id === id).title + '“').join(' und ') + ' ab. ' : '';
        return { id: quest.id, title: quest.title, description: quest.description, hint: prerequisite + quest.hint,
          target: quest.target, reward: quest.reward, status: status, progress: { value: journeyProgress(journey, quest.id), max: quest.max } };
      });
      const discoveries = (catalog, found) => catalog.map(function (entry) {
        const item = { id: entry.id, title: entry.title, discovered: found.includes(entry.id), hint: entry.hint };
        if (item.discovered) item.text = entry.text;
        return item;
      });
      const lore = QUESTS.filter(quest => journey.claimed.includes(quest.id)).map(quest => ({ id: 'quest-' + quest.id, title: quest.title, text: quest.text }))
        .concat(SECRETS.filter(secret => journey.secrets.includes(secret.id)).map(secret => ({ id: 'secret-' + secret.id, title: secret.title, text: secret.text })))
        .concat(EGGS.filter(egg => journey.eggs.includes(egg.id)).map(egg => ({ id: 'egg-' + egg.id, title: egg.title, text: egg.text })));
      return { quests: quests, secrets: discoveries(SECRETS, journey.secrets), eggs: discoveries(EGGS, journey.eggs), lore: lore,
        themes: THEMES.map(theme => ({ id: theme.id, name: theme.name, unlocked: themeUnlocked(journey, theme.id) })), theme: journey.theme,
        inspected: journey.inspected.slice(), claimedCount: journey.claimed.length, secretCount: journey.secrets.length };
    }
    function snapshot() {
      const values = derived();
      const current = profile();
      const exposure = values.equity ? values.portfolioValue / values.equity : 0;
      const expedition = clone(state.expedition || expeditionInitial());
      return {
        expedition: expedition,
        journey: journeySnapshot(),
        version: VERSION, seed: state.seed, restored: restored, restoreError: restoreError,
        phase: state.phase, phaseName: current.name, tick: state.tick, minutes: state.tick * 5,
        cycle: state.cycle, paused: state.paused, cash: state.cash, equity: values.equity,
        portfolioValue: values.portfolioValue, coherence: state.coherence, stability: values.stability,
        feesPaid: state.feesPaid, nodes: values.nodes, vault: values.vault, history: clone(state.history),
        phaseCosts: PHASES.map(phase => phase.cost),
        visual: {
          phase: state.phase, coherence: state.coherence / 100, stability: values.stability / 100,
          flux: clamp(current.flux * (1 + (100 - state.coherence) * 0.003) + exposure * 0.05, 0, 1),
          corona: current.corona, temperature: money(current.temperature + values.bound * 0.04 + exposure * 0.4),
          bindings: state.nodes.map(node => node.bound), strengths: state.nodes.map(node => node.strength / 100),
          holdings: values.nodes.map(node => clamp(node.positionValue / Math.max(1, values.equity) * 3, 0, 1)),
          surveyCount: expedition.observed.length, calibrated: BASE.map(node => expedition.calibrated.includes(node.id)), archiveDecoded: expedition.decoded,
          vaultOpen: values.vault.open, vaultPower: clamp(state.vault.balance / 100000, 0, 1), echoes: state.historySeq
        }
      };
    }
    function emit() {
      subscribers.forEach(function (subscriber) {
        try { subscriber(snapshot()); } catch (_) { /* A view failure cannot corrupt a transaction. */ }
      });
    }
    function done(message) {
      const research = state.expedition;
      if (research && derived().vault.cryoUnlocked) {
        if (!research.networkUnlocked && research.observed.length >= 2 && state.nodes.some(node => node.quantity > 0)) {
          research.networkUnlocked = true; record('discovery', 'Resonanzlabor freigeschaltet: zwei Phasen erfasst und eine Knotenposition gehalten.');
        }
        if (!research.archiveUnlocked && research.observed.length === 5 && research.calibrated.length >= 3 && state.vault.earned > 0) {
          research.archiveUnlocked = true; record('discovery', 'Zeitarchiv freigeschaltet: fünf Phasen, drei Resonanzen und Vault-Ertrag nachgewiesen.');
        }
      }
      if (state.journey) {
        const journey = state.journey;
        QUESTS.forEach(function (quest) {
          if (journey.accepted.includes(quest.id) && !journey.ready.includes(quest.id) && journeyProgress(journey, quest.id) >= quest.max) {
            journey.ready.push(quest.id);
            record('quest', 'Auftrag erfüllt: ' + quest.title + '. Die Belohnung wartet im Entdeckerjournal.');
          }
        });
      }
      emit(); return { ok: true, message: message };
    }
    function findNode(id) { return state.nodes.findIndex(node => node.id === id); }
    function gateReason() {
      return 'Das Vault-Gate ist geschlossen: ' + derived().vault.conditions.filter(condition => !condition.met).map(condition => condition.label).join('; ') + '.';
    }
    function amountValid(value) { return finite(value, 0.0001, MONEY_LIMIT) && precise(value, 4); }
    function quantityValid(value) { return finite(value, 0.000001, MAX_QUANTITY) && precise(value, 6); }

    function discoverSecret(journey, id) {
      if (journey.secrets.includes(id)) return null;
      const secret = SECRETS.find(entry => entry.id === id);
      journey.secrets.push(id);
      record('secret', 'Geheimnis entdeckt: ' + secret.title + '.');
      return secret;
    }
    function journeyAction(type, payload) {
      const journey = state.journey || journeyInitial();
      if (type === 'quest' || type === 'claim') {
        const quest = QUESTS.find(entry => entry.id === payload.id);
        if (!quest) return failure('Dieser Auftrag existiert nicht. „quests“ zeigt alle Aufträge.');
        if (type === 'quest') {
          if (journey.accepted.includes(quest.id)) return failure('Dieser Auftrag wurde bereits angenommen. Dein Fortschritt bleibt erhalten.');
          const missing = quest.requires.filter(id => !journey.claimed.includes(id));
          if (missing.length) return failure('Dieser Auftrag ist noch gesperrt. Hole zuerst die Belohnung für ' + missing.map(id => '„' + QUESTS.find(entry => entry.id === id).title + '“').join(' und ') + ' ab.');
          state.journey = journey; journey.accepted.push(quest.id);
          record('quest', 'Auftrag angenommen: ' + quest.title + '.');
          return done('Auftrag angenommen: ' + quest.title + '. ' + quest.hint);
        }
        if (journey.claimed.includes(quest.id)) return failure('Die Belohnung wurde bereits abgeholt. Das Dossier bleibt im Kodex.');
        if (!journey.accepted.includes(quest.id)) return failure('Nimm den Auftrag zuerst mit quest ' + quest.id + ' an.');
        if (!journey.ready.includes(quest.id)) return failure('Der Auftrag ist noch nicht erfüllt. ' + quest.hint);
        journey.claimed.push(quest.id);
        record('claim', 'Belohnung erhalten: ' + quest.reward + '.');
        return done('Belohnung erhalten: ' + quest.reward + '.\n' + quest.text);
      }
      if (type === 'inspect') {
        const scene = SCENES.find(entry => entry.id === payload.id);
        if (!scene) return failure('Dieser Ort existiert nicht. Untersuche chamber, eclipse, ice-ring, nodes, terminal oder void.');
        const fresh = !journey.inspected.includes(scene.id);
        const corona = scene.id === 'eclipse' && state.phase === 2 && !journey.coronaInspected;
        state.journey = journey;
        if (fresh) journey.inspected.push(scene.id);
        if (corona) journey.coronaInspected = true;
        if (fresh || corona) record('inspect', scene.name + ' untersucht · Phase ' + profile().name + '.');
        const found = [];
        if (scene.id === 'void' && state.paused) {
          const secret = discoverSecret(journey, 'silence'); if (secret) found.push(secret);
        }
        if (scene.id === 'ice-ring' && state.phase === 3 && journey.inspected.includes('eclipse')) {
          const secret = discoverSecret(journey, 'refraction'); if (secret) found.push(secret);
        }
        return done(scene.name.toUpperCase() + ' / ' + profile().name + '\n' + scene.text +
          (found.length ? '\n\n' + found.map(secret => 'GEHEIMNIS ENTDECKT: ' + secret.title + '\n' + secret.text).join('\n\n') : ''));
      }
      if (type === 'signal') {
        if (typeof payload.code !== 'string' || payload.code !== '004-46-13091') return { ok: false, reason: 'code', message: 'Keine Antwort auf dieser Frequenz. Lies die Inschriften der Kammer, der Finsternis und des Nexus. Drei Zahlen, zwei Bindestriche.' };
        if (!['chamber', 'eclipse', 'ice-ring'].every(id => journey.inspected.includes(id))) return { ok: false, reason: 'clues', message: 'Die Frequenz ist noch nicht belegt. Untersuche zuerst Kammer, Finsternis und Nexus, um alle Hinweise zu sammeln.' };
        if (journey.secrets.includes('frequency')) return { ok: false, reason: 'discovered', message: 'Diese Empfangslinie wurde bereits geöffnet. Ihre Nachricht bleibt im Kodex.' };
        state.journey = journey;
        const secret = discoverSecret(journey, 'frequency');
        return done('GEHEIMNIS ENTDECKT: ' + secret.title + '\n' + secret.text);
      }
      if (type === 'echo') {
        const id = payload.word === '42' ? 'answer' : payload.word === 'xyzzy' ? 'magic' : null;
        if (!id) return failure('Das Echo verliert sich im Eis. Vielleicht helfen die Randnotizen im Vault.');
        if (journey.eggs.includes(id)) return failure('Dieses Echo wurde bereits gefunden. Es bleibt im Kodex.');
        state.journey = journey; journey.eggs.push(id);
        const egg = EGGS.find(entry => entry.id === id);
        record('echo', 'Echo entdeckt: ' + egg.title + '.');
        return done('ECHO ENTDECKT: ' + egg.title + '\n' + egg.text);
      }
      if (type === 'theme') {
        const theme = THEMES.find(entry => entry.id === payload.id);
        if (!theme) return failure('Diese Signatur existiert nicht. Verfügbar sind frost, aurora und ember.');
        if (!themeUnlocked(journey, theme.id)) return failure('Diese Signatur wurde noch nicht entdeckt. Das Journal zeigt ihre Freischaltung.');
        if (journey.theme === theme.id) return failure('Die Signatur „' + theme.name + '“ ist bereits aktiv.');
        state.journey = journey; journey.theme = theme.id;
        record('theme', 'Signatur gewählt: ' + theme.name + '.');
        return done('Signatur „' + theme.name + '“ aktiv. Deine Werte und Handelsbedingungen bleiben gleich.');
      }
      return failure('Unbekannter Journalvorgang.');
    }

    function quote(type, id, quantity) {
      const empty = { quantity: 0, price: 0, gross: 0, fee: 0, slippage: 0, total: 0, net: 0 };
      const reject = message => Object.assign({ ok: false, message: message }, empty);
      if (type !== 'buy' && type !== 'sell') return reject('Für diesen Vorgang gibt es keine Handelsquote.');
      const index = findNode(id);
      if (index < 0) return reject('Dieser Knoten existiert nicht.');
      if (!quantityValid(quantity)) return reject('Die Menge muss positiv, höchstens 1.000 Einheiten und auf sechs Nachkommastellen begrenzt sein.');
      const node = derived().nodes[index];
      const gross = money(node.price * quantity);
      if (gross <= 0) return reject('Diese Menge liegt unter der vierstelligen Geldpräzision.');
      const impact = clamp(gross / node.liquidity * 0.035, 0, 0.025);
      const slippage = money(gross * (node.spread / 200 + impact));
      const fee = money(gross * (0.0012 + profile().flux * 0.0008));
      const total = type === 'buy' ? money(gross + fee + slippage) : money(fee + slippage);
      const net = type === 'sell' ? money(gross - fee - slippage) : gross;
      if (type === 'buy' && total > state.cash) return reject('Nicht genügend freies Guthaben. Benötigt: ' + display(total) + ' CNX.');
      if (type === 'buy' && state.nodes[index].quantity + quantity > 1000000000) return reject('Die Positionsgrenze dieses Knotens ist erreicht.');
      if (type === 'sell' && quantity > state.nodes[index].quantity) return reject('Die Verkaufsmenge übersteigt deinen Bestand.');
      if (type === 'sell' && net <= 0) return reject('Diese Menge ist zu klein für einen positiven Verkaufserlös.');
      if (type === 'sell' && state.cash + net > MONEY_LIMIT) return reject('Die Guthabengrenze würde überschritten.');
      return { ok: true, message: 'Quote einschließlich Spread, Liquiditätseinfluss und Gebühr.', quantity: quantity,
        price: node.price, gross: gross, fee: fee, slippage: slippage, total: total, net: net };
    }

    function tick(options) {
      options = options || {};
    const now = typeof options.now === 'function' ? options.now : Date.now;
    const unlockDeadline = Date.UTC(2026, 10, 1);
      if (state.paused && options.force !== true) return failure('Die Simulation ist pausiert. Ein Einzelschritt bleibt möglich.');
      if (state.tick >= 100000000) return failure('Die maximale simulierte Laufzeit ist erreicht.');
      const before = derived();
      const checkpoint = clone(state);
      const current = profile();
      state.nodes.forEach(function (node, index) {
        const oldRaw = node.rawPrice;
        const oldPrice = before.nodes[index].price;
        const drift = clamp((random() * 2 - 1) * (0.0037 + current.flux * 0.0014) + current.bias[index], -0.0058, 0.0058);
        node.rawPrice = money(clamp(oldRaw * (1 + drift), 0.0001, 1000000));
        const nextPrice = money(node.rawPrice * current.prices[index]);
        // Fixed money precision must never turn a small tick into a >0.6% jump.
        if (Math.abs(nextPrice / oldPrice - 1) > 0.006) node.rawPrice = oldRaw;
        node.change = money((money(node.rawPrice * current.prices[index]) / oldPrice - 1) * 100);
        node.liquidityFactor = money(clamp(node.liquidityFactor + drift * 0.35 + (random() - 0.5) * 0.0015, 0.35, 1.65));
        const target = clamp(BASE[index].strength + current.strength + (node.bound ? 6 : 0), 25, 100);
        node.strength = money(clamp(node.strength + (target - node.strength) * 0.012 - current.flux * (node.bound ? 0.012 : 0.025), 25, 100));
      });
      const exposure = before.equity ? before.portfolioValue / before.equity : 0;
      const coherenceTarget = clamp(current.coherence + before.bound * 0.65 - exposure * 3, 0, 100);
      state.coherence = money(clamp(state.coherence + (coherenceTarget - state.coherence) * 0.018 - current.flux * 0.025 + before.bound * 0.015, 0, 100));
      state.tick += 1;
      const vault = derived().vault;
      if (derived().equity > MONEY_LIMIT) { state = checkpoint; return failure('Der Simulationsschritt würde die Vermögensgrenze überschreiten.'); }
      const interest = vault.open ? money(state.vault.balance * vault.apr / 100 * 5 / YEAR_MINUTES) : 0;
      const credited = money(Math.max(0, Math.min(interest, MONEY_LIMIT - derived().equity)));
      if (state.vault.balance >= 1000 && credited > 0) {
        if (!state.journey) state.journey = journeyInitial();
        state.journey.vaultYield = true;
      }
      state.vault.balance = money(state.vault.balance + credited);
      state.vault.earned = money(Math.min(MONEY_LIMIT, state.vault.earned + credited));
      const message = 'Simulationszeit +' + 5 + ' min · Phase ' + current.name + (credited ? ' · Vault-Zuwachs ' + display(credited) + ' CNX.' : '.');
      record(options.force === true ? 'step' : 'tick', message);
      return done(message);
    }

    function selectPhase(index, options) {
      options = options || {};
    const now = typeof options.now === 'function' ? options.now : Date.now;
    const unlockDeadline = Date.UTC(2026, 10, 1);
      if (!integer(index, 0, 4)) return failure('Diese Phase existiert nicht.');
      if (index === state.phase) return done('Die Phase ' + profile().name + ' ist bereits aktiv.');
      const manual = options.manual !== false;
      const cost = PHASES[index].cost;
      if (manual && state.coherence < cost) return failure('Zu wenig Kohärenz für den Phasenwechsel. Benötigt: ' + cost + ', verfügbar: ' + display(state.coherence) + '.');
      const calibratedEquity = money(state.cash + state.vault.balance + state.nodes.reduce((sum, node, nodeIndex) =>
        sum + money(node.quantity * money(node.rawPrice * PHASES[index].prices[nodeIndex])), 0));
      if (calibratedEquity > MONEY_LIMIT) return failure('Diese Phasenkalibrierung würde die Vermögensgrenze überschreiten.');
      const previous = state.phase;
      if (manual) state.coherence = money(state.coherence - cost);
      state.phase = index;
      if (previous === 4 && index === 0) state.cycle += 1;
      // Changes describe tick drift only; a phase calibration is stated separately.
      state.nodes.forEach(node => { node.change = 0; });
      const message = 'Phase ' + profile().name + ' aktiviert' + (manual ? ' · ' + cost + ' Kohärenz verbraucht.' : ' · automatischer Wechsel.');
      record(manual ? 'phase' : 'auto-phase', message);
      return done(message);
    }

    function act(type, payload) {
      payload = payload || {};
      if (['quest', 'claim', 'inspect', 'signal', 'echo', 'theme'].includes(type)) return journeyAction(type, payload);
      if (['observe', 'calibrate', 'decode'].includes(type)) {
        if (!derived().vault.cryoUnlocked) return failure('Die Fähigkeit benötigt aktiven CRYO-Zugang. Nutze unlock cryo bis 31.10.2026 UTC.');
        const research = state.expedition || expeditionInitial();
        if (type === 'observe') {
          if (research.observed.includes(state.phase)) return failure('Diese Phase wurde bereits erfasst. Wähle eine andere Phase.');
          research.observed.push(state.phase); state.expedition = research;
          record('observe', profile().name + ' im Observatorium erfasst.');
          return done('Phase ' + profile().name + ' erfasst (' + research.observed.length + '/5). Beobachtung verstärkt die Lichtsignatur der Finsternis.');
        }
        if (type === 'calibrate') {
          if (!research.networkUnlocked) return failure('Resonanzlabor gesperrt: erfasse zwei Phasen mit observe und halte eine Knotenposition.');
          const node = state.nodes[findNode(payload.id)];
          if (!node) return failure('Dieser Knoten existiert nicht.');
          if (research.calibrated.includes(node.id)) return failure('Dieser Knoten ist bereits kalibriert.');
          if (!node.bound || node.strength < 90) return failure('Kalibrierung benötigt einen gebundenen Knoten mit Stärke mindestens 90 %. Nutze link und stabilize.');
          research.calibrated.push(node.id); state.expedition = research;
          record('calibrate', node.id + ' als Resonanzbake kalibriert.');
          return done(node.id + ' kalibriert (' + research.calibrated.length + '/6). Die Resonanzbake verstärkt das Eis-Nexus-Signal.');
        }
        if (!research.archiveUnlocked) return failure('Zeitarchiv gesperrt: erfasse alle fünf Phasen, kalibriere drei Knoten und erzeuge Vault-Ertrag mit deposit und step.');
        if (research.decoded) return failure('Die Zeitspur ist bereits entschlüsselt. Dein Archiv bleibt einsehbar.');
        research.decoded = true; state.expedition = research;
        record('decode', 'Zeitspur 004 entschlüsselt: Der Nexus bewahrt Entscheidungen als Licht im Nebel.');
        return done('Zeitspur 004 entschlüsselt. Das Archiv und eine zusätzliche Nebelsignatur sind freigeschaltet.');
      }
      if (type === 'unlock') {
        if (payload.key !== 'cryo') return failure('Verwende unlock cryo.');
        if (now() >= unlockDeadline) return failure('Der CRYO-Zugang endete am 31.10.2026 um 23:59:59 UTC. Es gelten wieder die normalen Vault-Bedingungen.');
        if (!state.expedition) state.expedition = expeditionInitial();
        if (!state.vault.cryoUnlocked) { state.vault.cryoUnlocked = true; record('unlock', 'CRYO-Zugang bis einschließlich 31.10.2026 UTC aktiviert.'); }
        return done('Vault freigeschaltet bis 31.10.2026, 23:59:59 UTC. Alle Ansichten und Aktionen sind verfügbar. Guthaben und Mengenlimits gelten weiter. Nächster Schritt: Forschungsfähigkeiten öffnen oder missions.');
      }
      if (type === 'step') return tick({ force: true });
      if (type === 'reset') {
        state = initial(404); restored = false; restoreError = '';
        return done('Die lokale Simulation wurde zurückgesetzt. Startguthaben: 100.000 CNX.');
      }
      if (type === 'pause' || type === 'resume') {
        const paused = type === 'pause';
        if (state.paused !== paused) { state.paused = paused; record(type, paused ? 'Simulation pausiert.' : 'Simulation fortgesetzt.'); }
        return done(paused ? 'Simulation pausiert. Einzelschritte bleiben möglich.' : 'Simulation fortgesetzt.');
      }
      if (type === 'buy' || type === 'sell') {
        const trade = quote(type, payload.id, payload.quantity);
        if (!trade.ok) return failure(trade.message);
        const node = state.nodes[findNode(payload.id)];
        node.quantity = quantityRound(node.quantity + (type === 'buy' ? trade.quantity : -trade.quantity));
        state.cash = money(state.cash + (type === 'buy' ? -trade.total : trade.net));
        state.feesPaid = money(state.feesPaid + trade.fee);
        const message = display(trade.quantity) + ' CNX ' + (type === 'buy' ? 'gekauft' : 'verkauft') + ' · ' + payload.id + ' · Gebühr ' + display(trade.fee) + ' CNX.';
        record(type, message);
        return done(message);
      }
      if (type === 'link' || type === 'unlink' || type === 'stabilize') {
        const index = findNode(payload.id);
        if (index < 0) return failure('Dieser Knoten existiert nicht.');
        const node = state.nodes[index];
        if (type === 'link') {
          if (node.bound) return failure('Dieser Knoten ist bereits gebunden.');
          if (state.cash < 1200) return failure('Eine Bindung benötigt 1.200 CNX freies Guthaben.');
          state.cash = money(state.cash - 1200);
          node.bound = true; node.strength = money(Math.min(100, node.strength + 6));
          state.coherence = money(Math.max(0, state.coherence - 1));
          const message = payload.id + ' gebunden · Kosten 1.200 CNX · Stärke +6, Kohärenz −1.';
          record(type, message); return done(message);
        }
        if (type === 'unlink') {
          if (!node.bound) return failure('Dieser Knoten ist nicht gebunden.');
          if (state.cash + 400 > MONEY_LIMIT) return failure('Die Guthabengrenze würde überschritten.');
          node.bound = false; node.strength = money(Math.max(25, node.strength - 6));
          state.cash = money(state.cash + 400); state.coherence = money(Math.min(100, state.coherence + 1));
          const message = payload.id + ' gelöst · Rückfluss 400 CNX · Vault-Bedingungen neu geprüft.';
          record(type, message); return done(message);
        }
        if (state.cash < 700) return failure('Eine Stabilisierung benötigt 700 CNX freies Guthaben.');
        if (node.strength === 100 && state.coherence === 100) return failure('Knotenstärke und Kohärenz sind bereits maximal.');
        state.cash = money(state.cash - 700);
        node.strength = money(Math.min(100, node.strength + 8));
        state.coherence = money(Math.min(100, state.coherence + 7));
        if (node.bound && node.strength >= 90) {
          if (!state.journey) state.journey = journeyInitial();
          if (!state.journey.stabilized.includes(node.id)) state.journey.stabilized.push(node.id);
        }
        const message = payload.id + ' stabilisiert · Kosten 700 CNX · Stärke bis +8, Kohärenz bis +7.';
        record(type, message); return done(message);
      }
      if (type === 'deposit' || type === 'withdraw') {
        if (!derived().vault.open) return failure(gateReason());
        const amount = payload.amount;
        if (!amountValid(amount)) return failure('Der Betrag muss positiv und auf vier Nachkommastellen begrenzt sein.');
        if (type === 'deposit') {
          if (amount > state.cash) return failure('Nicht genügend freies Guthaben für die Vault-Einlage.');
          if (state.vault.balance + amount > MONEY_LIMIT) return failure('Die Vault-Grenze würde überschritten.');
          state.cash = money(state.cash - amount); state.vault.balance = money(state.vault.balance + amount);
        } else {
          if (amount > state.vault.balance) return failure('Der Auszahlungsbetrag übersteigt das Vault-Guthaben.');
          if (state.cash + amount > MONEY_LIMIT) return failure('Die Guthabengrenze würde überschritten.');
          state.vault.balance = money(state.vault.balance - amount); state.cash = money(state.cash + amount);
        }
        const message = display(amount) + ' CNX ' + (type === 'deposit' ? 'in den Vault eingezahlt.' : 'aus dem Vault ausgezahlt.');
        record(type, message); return done(message);
      }
      return failure('Unbekannter Simulationsvorgang.');
    }

    return Object.freeze({
      snapshot: snapshot, refresh: emit, tick: tick, selectPhase: selectPhase, act: act, quote: quote,
      subscribe: function (subscriber) {
        if (typeof subscriber !== 'function') throw new TypeError('A subscriber must be a function.');
        subscribers.add(subscriber);
        try { subscriber(snapshot()); } catch (_) { /* Subscribers own their presentation failures. */ }
        return function () { subscribers.delete(subscriber); };
      },
      serialize: function () { return clone(state); }
    });
  }

  return Object.freeze({ create: create });
});
