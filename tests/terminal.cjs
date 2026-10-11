'use strict';
const assert = require('node:assert/strict');
const Terminal = require('../dist/assets/js/terminal.js');
const Simulation = require('../dist/assets/js/simulation.js');
const phases = ['Kontakt', 'Diamantring', 'Korona', 'Freisteller', 'Reset'].map(name => ({ name, time: 'T' }));
const model = Simulation.create({ seed: 404 });
const api = { snapshot: model.snapshot, action: model.act, selectPhase: index => model.selectPhase(index, { manual: true }),
  quote: model.quote, phases, sceneCount: 0, reduced: true };
const run = raw => Terminal.run(raw, api);
const unchanged = raw => {
  const before = model.serialize(); const result = run(raw);
  assert.deepEqual(model.serialize(), before, raw + ' changed state'); return result;
};
const cash = value => new Intl.NumberFormat('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(value);
for (const name of Terminal.commands) {
  assert.match(unchanged('help ' + name).text, /Eingabe:.*\nBeispiel:/);
  assert.equal(unchanged(name + ' extra extra extra').ok, false);
}
for (const name of ['help', 'tasks', 'status', 'nodes', 'phase', 'eclipse', 'vault', 'portfolio', 'history']) {
  const response = unchanged(name); assert(response.ok); assert(response.text.length > 30, name);
}
assert.equal(unchanged('clear').clear, true);
assert.equal(unchanged('   '), null);
for (const raw of ['reset', 'reset CONFIRM', 'reset confirm extra', 'buy', 'buy CN-ALPHA-01',
  'buy CN-ALPHA-01 -2', 'buy CN-ALPHA-01 1e2', 'buy UNKNOWN 2', 'phase 0', 'phase 6', 'phase Korona extra',
  'sell CN-ALPHA-01 1', 'deposit 1', 'help constructor', 'constructor', '__proto__']) assert.equal(unchanged(raw).ok, false, raw);
console.log('PASS terminal: every help entry, read-only command and malformed argument preserves state');
const initial = model.snapshot(); const quote = model.quote('buy', 'CN-ALPHA-01', 2.5);
let response = run('BuY cn-alpha-01 2,5');
assert(response.ok); assert.match(response.text, /2,5 Einheiten CN-ALPHA-01 gekauft/);
for (const amount of [quote.gross, quote.slippage, quote.fee, quote.total, model.snapshot().cash]) assert(response.text.includes(cash(amount)), response.text);
assert.equal(model.snapshot().cash, Math.round((initial.cash - quote.total) * 1e4) / 1e4);
assert.match(run('sell CN-ALPHA-01 0,5').text, /Nettoerlös:.*\nBestand: 2 Einheiten/);
assert.match(unchanged('sell CN-ALPHA-01 999').text, /NICHT AUSGEFÜHRT[\s\S]*Verfügbarer Bestand[\s\S]*Nächster Schritt/);
console.log('PASS terminal: trade receipts match the actual quote, cash and remaining holdings');
for (const node of model.snapshot().nodes.slice(0, 3)) assert(run('link ' + node.id).ok);
assert.equal(unchanged('link CN-ALPHA-01').ok, false);
assert(run('stabilize CN-ALPHA-01').ok);
assert(run('phase 3').ok); assert.equal(model.snapshot().phase, 2);
assert(model.snapshot().vault.open);
assert.match(run('deposit 1000').text, /Vault-Guthaben: 0,0000 → 1\.000,0000/);
assert.match(run('pause').text, /PAUSIERT/);
response = run('step'); assert(response.ok); assert.match(response.text, /Simulationszeit: 0 → 5 Minuten/);
assert(model.snapshot().vault.earned > 0); assert(response.text.includes(cash(model.snapshot().vault.earned)));
assert.match(run('tasks').text, /6 von 6 aktuell erfüllt/);
assert(run('withdraw 250').ok);
assert.match(run('resume').text, /MANUELL.*reduzierte Bewegung/);
assert(run('unlink CN-ALPHA-01').ok); assert.equal(model.snapshot().vault.open, false);
assert.match(unchanged('withdraw 1').text, /NICHT AUSGEFÜHRT[\s\S]*Gate ist geschlossen[\s\S]*vault/);
assert.match(unchanged('tasks').text, /5 von 6 aktuell erfüllt/);
console.log('PASS terminal: full Vault task path, time control and closure use the existing model');
assert(run('reset confirm').ok); assert.equal(model.snapshot().cash, 100000); assert.equal(model.snapshot().vault.balance, 0);
assert.equal(model.snapshot().history.length, 0);
console.log('PASS terminal: explicit reset clears the model and reports its new starting state');

let now = Date.UTC(2026, 9, 31, 23, 59, 59, 999);
const unlocked = Simulation.create({ now: () => now });
const unlockApi = { ...api, snapshot: unlocked.snapshot, action: unlocked.act };
assert.equal(Terminal.run('unlock wrong', unlockApi).ok, false);
assert.equal(unlocked.snapshot().vault.open, false);
assert(Terminal.run('unlock cryo', unlockApi).ok);
assert(unlocked.snapshot().vault.cryoUnlocked);
assert(unlocked.act('deposit', { amount: 1000 }).ok);
assert(unlocked.act('withdraw', { amount: 100 }).ok);
assert.equal(unlocked.act('deposit', { amount: 1000000 }).ok, false);
const restored = Simulation.create({ saved: unlocked.serialize(), now: () => now });
assert(restored.snapshot().restored && restored.snapshot().vault.open);
now = Date.UTC(2026, 10, 1);
assert.equal(restored.snapshot().vault.open, false);
const expired = restored.serialize();
assert.equal(Terminal.run('unlock cryo', { ...unlockApi, snapshot: restored.snapshot, action: restored.act }).ok, false);
assert.equal(restored.act('withdraw', { amount: 1 }).ok, false);
assert.deepEqual(restored.serialize(), expired);
assert.equal(restored.snapshot().vault.balance, 900);
now -= 1;
assert(restored.snapshot().vault.open);
restored.act('reset');
assert.equal(restored.snapshot().vault.cryoUnlocked, false);
console.log('PASS terminal: CRYO unlock, persisted access, balance limits, exact UTC expiry and reset');
