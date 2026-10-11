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

  function validSaved(saved) {
    if (!exactKeys(saved, ['version', 'seed', 'rng', 'phase', 'tick', 'cycle', 'paused', 'cash', 'coherence', 'feesPaid', 'historySeq', 'history', 'nodes', 'vault']) ||
      saved.version !== VERSION || !integer(saved.seed, 0, 4294967295) ||
      !integer(saved.rng, 0, 4294967295) || !integer(saved.phase, 0, 4) || !integer(saved.tick, 0, 100000000) ||
      !integer(saved.cycle, 0, 1000000) || typeof saved.paused !== 'boolean' ||
      !finite(saved.cash, 0, MONEY_LIMIT) || !precise(saved.cash, 4) || !finite(saved.coherence, 0, 100) || !precise(saved.coherence, 4) ||
      !finite(saved.feesPaid, 0, MONEY_LIMIT) || !precise(saved.feesPaid, 4) ||
      !integer(saved.historySeq, 0, Number.MAX_SAFE_INTEGER) || !Array.isArray(saved.nodes) || saved.nodes.length !== 6 ||
      !exactKeys(saved.vault, ['balance', 'earned']) || !finite(saved.vault.balance, 0, MONEY_LIMIT) || !precise(saved.vault.balance, 4) ||
      !finite(saved.vault.earned, 0, MONEY_LIMIT) || !precise(saved.vault.earned, 4) ||
      !Array.isArray(saved.history) || saved.history.length > 40) return false;
    if (!saved.nodes.every((node, index) => exactKeys(node, ['id', 'rawPrice', 'liquidityFactor', 'strength', 'quantity', 'bound', 'change']) && node.id === BASE[index].id &&
      finite(node.rawPrice, 0.0001, 1000000) && precise(node.rawPrice, 4) &&
      finite(node.liquidityFactor, 0.35, 1.65) && precise(node.liquidityFactor, 4) && finite(node.strength, 25, 100) && precise(node.strength, 4) &&
      finite(node.quantity, 0, 1000000000) && precise(node.quantity, 6) &&
      typeof node.bound === 'boolean' && finite(node.change, -0.6, 0.6) && precise(node.change, 4))) return false;
    let previous = 0;
    let previousTick = 0;
    const historyTypes = ['tick', 'step', 'phase', 'auto-phase', 'pause', 'resume', 'buy', 'sell', 'link', 'unlink', 'stabilize', 'deposit', 'withdraw'];
    if (!saved.history.every(entry => {
      if (!exactKeys(entry, ['id', 'tick', 'type', 'text', 'phase']) || !integer(entry.id, previous + 1, saved.historySeq) || !integer(entry.tick, previousTick, saved.tick) ||
        !integer(entry.phase, 0, 4) || !historyTypes.includes(entry.type) ||
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
      const open = conditions.every(condition => condition.met);
      const apr = money(clamp(current.apr + bound * 0.25 + state.coherence * 0.006, 12, 20));
      return { nodes: nodes, portfolioValue: portfolioValue, equity: equity, stability: stability, bound: bound,
        vault: { open: open, balance: state.vault.balance, apr: apr, earned: state.vault.earned,
          conditions: conditions, accruing: open && state.vault.balance > 0 } };
    }
    function snapshot() {
      const values = derived();
      const current = profile();
      const exposure = values.equity ? values.portfolioValue / values.equity : 0;
      return {
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
          vaultOpen: values.vault.open, vaultPower: clamp(state.vault.balance / 100000, 0, 1), echoes: state.historySeq
        }
      };
    }
    function emit() {
      subscribers.forEach(function (subscriber) {
        try { subscriber(snapshot()); } catch (_) { /* A view failure cannot corrupt a transaction. */ }
      });
    }
    function done(message) { emit(); return { ok: true, message: message }; }
    function findNode(id) { return state.nodes.findIndex(node => node.id === id); }
    function gateReason() {
      return 'Das Vault-Gate ist geschlossen: ' + derived().vault.conditions.filter(condition => !condition.met).map(condition => condition.label).join('; ') + '.';
    }
    function amountValid(value) { return finite(value, 0.0001, MONEY_LIMIT) && precise(value, 4); }
    function quantityValid(value) { return finite(value, 0.000001, MAX_QUANTITY) && precise(value, 6); }

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
      state.vault.balance = money(state.vault.balance + credited);
      state.vault.earned = money(Math.min(MONEY_LIMIT, state.vault.earned + credited));
      const message = 'Simulationszeit +' + 5 + ' min · Phase ' + current.name + (credited ? ' · Vault-Zuwachs ' + display(credited) + ' CNX.' : '.');
      record(options.force === true ? 'step' : 'tick', message);
      return done(message);
    }

    function selectPhase(index, options) {
      options = options || {};
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
      snapshot: snapshot, tick: tick, selectPhase: selectPhase, act: act, quote: quote,
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
