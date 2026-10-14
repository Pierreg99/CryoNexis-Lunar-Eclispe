'use strict';

const assert = require('node:assert/strict');
const Simulation = require('../dist/assets/js/simulation.js');
const Terminal = require('../dist/assets/js/terminal.js');
const SCENES = ['chamber', 'eclipse', 'ice-ring', 'nodes', 'terminal', 'void'];
const CODE = '004-46-13091';
const NODE = 'CN-ALPHA-01';
const afterExpiry = () => Date.UTC(2027, 0, 1);
let checks = 0;

function test(name, fn) {
  fn(); checks++;
  console.log('PASS journey: ' + name);
}
function success(result) { assert.equal(result.ok, true, result.message); }
function reject(model, type, payload) {
  const before = model.serialize();
  const result = model.act(type, payload);
  assert.equal(result.ok, false, type + ' must reject this input');
  assert.deepEqual(model.serialize(), before, 'Rejected ' + type + ' must preserve all saved state');
  return result;
}
function quest(model, id) {
  const item = model.snapshot().journey.quests.find(item => item.id === id);
  assert(item, 'The journal must expose quest ' + id);
  return item;
}
function has(model, key, id) { return model.serialize().journey[key].includes(id); }
function accept(model, id) {
  success(model.act('quest', { id }));
  assert(has(model, 'accepted', id), 'Accepting a quest must persist its active state');
}
function claim(model, id) {
  assert.equal(quest(model, id).status, 'ready', id + ' needs actual evidence before its reward');
  const before = model.snapshot().journey.claimedCount;
  success(model.act('claim', { id }));
  assert.equal(quest(model, id).status, 'claimed');
  assert.equal(model.snapshot().journey.claimedCount, before + 1);
  assert(model.snapshot().journey.lore.some(item => item.id === 'quest-' + id), 'Claimed rewards must enter the codex');
}
function inspect(model, id) {
  success(model.act('inspect', { id }));
  assert(has(model, 'inspected', id), 'Scene inspection must be saved');
}
function economy(model) {
  const saved = model.serialize();
  delete saved.journey;
  delete saved.history;
  delete saved.historySeq;
  return saved;
}

// This route uses the permanent network gate. It remains available after CRYO expires.
function completeRoute(model, retainEvidence) {
  accept(model, 'arrival');
  reject(model, 'claim', { id: 'arrival' });
  inspect(model, 'chamber');
  claim(model, 'arrival');

  accept(model, 'edge');
  inspect(model, 'eclipse');
  assert.equal(quest(model, 'edge').status, 'active', 'A visit outside Korona must not count as a Korona observation');
  success(model.selectPhase(2, { manual: true }));
  inspect(model, 'eclipse');
  assert.equal(quest(model, 'edge').status, 'ready');
  if (retainEvidence) {
    success(model.selectPhase(0, { manual: false }));
    assert.equal(quest(model, 'edge').status, 'ready', 'Leaving Korona must preserve the completed observation');
  }
  claim(model, 'edge');

  accept(model, 'cartographer');
  for (const id of SCENES) inspect(model, id);
  claim(model, 'cartographer');

  accept(model, 'beacon');
  success(model.act('stabilize', { id: NODE }));
  assert.equal(quest(model, 'beacon').status, 'active', 'Stabilizing an unbound node is insufficient');
  success(model.act('link', { id: NODE }));
  assert.equal(quest(model, 'beacon').status, 'active', 'A binding alone is insufficient');
  success(model.act('stabilize', { id: NODE }));
  assert(model.snapshot().nodes.find(node => node.id === NODE).strength >= 90);
  if (retainEvidence) {
    success(model.act('unlink', { id: NODE }));
    assert.equal(quest(model, 'beacon').status, 'ready', 'Unlinking must preserve the completed stabilization');
  }
  claim(model, 'beacon');

  accept(model, 'yield');
  if (!model.snapshot().nodes.find(node => node.id === NODE).bound) success(model.act('link', { id: NODE }));
  for (const id of ['CN-BOREALIS', 'CN-KRYO-7X']) success(model.act('link', { id }));
  success(model.selectPhase(2, { manual: false }));
  assert(model.snapshot().vault.open, 'Ordinary bindings, strength and coherence must open the permanent Vault gate');
  assert.equal(model.snapshot().vault.cryoUnlocked, false);
  success(model.act('deposit', { amount: 1000 }));
  assert.equal(quest(model, 'yield').status, 'active', 'An unearned deposit must not complete the yield quest');
  success(model.act('step'));
  assert(model.snapshot().vault.earned > 0);
  assert.equal(quest(model, 'yield').status, 'ready');
  if (retainEvidence) {
    success(model.act('withdraw', { amount: model.snapshot().vault.balance }));
    success(model.selectPhase(4, { manual: false }));
    success(model.act('unlink', { id: NODE }));
    assert.equal(model.snapshot().vault.balance, 0);
    assert.equal(model.snapshot().vault.open, false);
    assert.equal(quest(model, 'yield').status, 'ready', 'Withdrawal and a closed gate must preserve earned quest evidence');
  }
  claim(model, 'yield');

  accept(model, 'remembrance');
  assert.equal(quest(model, 'remembrance').status, 'active');
  success(model.act('signal', { code: CODE }));
  assert.equal(quest(model, 'remembrance').status, 'active', 'One secret must not fulfill the two-secret quest');
  success(model.act('pause'));
  inspect(model, 'void');
  claim(model, 'remembrance');
  success(model.selectPhase(3, { manual: false }));
  inspect(model, 'ice-ring');
  success(model.act('echo', { word: '42' }));
  success(model.act('echo', { word: 'xyzzy' }));
  return model;
}

test('actual exploration, binding and earned yield complete all quests after CRYO expiry', () => {
  const model = Simulation.create({ now: afterExpiry });
  reject(model, 'unlock', { key: 'cryo' });
  completeRoute(model, true);
  const journey = model.snapshot().journey;
  assert.equal(journey.claimedCount, 6);
  assert.equal(journey.secretCount, 3);
  assert.equal(journey.eggs.filter(item => item.discovered).length, 2);
  assert.equal(journey.inspected.length, 6);
  assert.equal(journey.lore.length, 11, 'Every earned quest, secret and egg has a codex entry');
  assert(journey.quests.every(item => item.status === 'claimed'));
  success(model.act('theme', { id: 'ember' }));
  assert.equal(model.snapshot().journey.theme, 'ember');
  success(model.act('theme', { id: 'aurora' }));
  assert.equal(model.snapshot().journey.theme, 'aurora');
});

test('prerequisites, repeated claims and malformed actions reject atomically', () => {
  const model = Simulation.create({ now: afterExpiry });
  for (const id of ['edge', 'cartographer', 'beacon', 'yield', 'remembrance']) reject(model, 'quest', { id });
  for (const id of ['arrival', 'edge', 'missing', '__proto__']) reject(model, 'claim', { id });
  for (const [type, payload] of [
    ['quest', { id: 'missing' }], ['quest', { id: 1 }], ['quest', {}],
    ['inspect', { id: 'missing' }], ['inspect', { id: ['chamber'] }], ['inspect', {}],
    ['signal', { code: CODE }], ['signal', { code: null }], ['signal', { code: 44613091 }],
    ['echo', { word: 'nothing' }], ['echo', {}], ['theme', { id: 'missing' }],
    ['theme', { id: 'ember' }], ['theme', { id: 'aurora' }]
  ]) reject(model, type, payload);
  accept(model, 'arrival');
  reject(model, 'quest', { id: 'arrival' });
  reject(model, 'claim', { id: 'arrival' });
  inspect(model, 'chamber');
  claim(model, 'arrival');
  reject(model, 'claim', { id: 'arrival' });
  reject(model, 'quest', { id: 'arrival' });
  reject(model, 'quest', { id: 'cartographer' });
});

test('puzzle evidence is distinct and contextual rather than earned by repeated visits', () => {
  const model = Simulation.create({ now: afterExpiry });
  inspect(model, 'chamber');
  inspect(model, 'chamber');
  inspect(model, 'eclipse');
  reject(model, 'signal', { code: CODE });
  inspect(model, 'ice-ring');
  for (const code of ['', '004', '004-46-13090', '004-46-1.3091', 'xyzzy']) reject(model, 'signal', { code });
  success(model.act('signal', { code: CODE }));
  assert(has(model, 'secrets', 'frequency'));
  reject(model, 'signal', { code: CODE });
  inspect(model, 'void');
  assert.equal(has(model, 'secrets', 'silence'), false, 'Visiting a running timeline must not discover silence');
  success(model.act('pause'));
  inspect(model, 'void');
  assert(has(model, 'secrets', 'silence'));
  assert.equal(has(model, 'secrets', 'refraction'), false);
  success(model.selectPhase(3, { manual: true }));
  inspect(model, 'ice-ring');
  assert(has(model, 'secrets', 'refraction'));
  assert.equal(model.snapshot().journey.secretCount, 3);
  const unseen = Simulation.create();
  success(unseen.selectPhase(3));
  inspect(unseen, 'ice-ring');
  assert.equal(has(unseen, 'secrets', 'refraction'), false, 'Freisteller needs a prior eclipse inspection');
});

test('historical Vault interest cannot substitute for a new earning step with the required deposit', () => {
  const model = Simulation.create({ now: () => Date.UTC(2026, 9, 14) });
  accept(model, 'arrival'); inspect(model, 'chamber'); claim(model, 'arrival');
  accept(model, 'beacon');
  success(model.act('link', { id: NODE })); success(model.act('stabilize', { id: NODE }));
  claim(model, 'beacon'); accept(model, 'yield');
  success(model.act('unlock', { key: 'cryo' }));
  success(model.act('deposit', { amount: 100 }));
  success(model.act('step'));
  const oldEarnings = model.snapshot().vault.earned;
  assert(oldEarnings > 0 && model.snapshot().vault.balance < 1000);
  assert.equal(model.serialize().journey.vaultYield, false, 'Earning on a small deposit must not prove the 1,000 CNX objective');
  success(model.act('withdraw', { amount: model.snapshot().vault.balance }));
  success(model.act('deposit', { amount: 1000 }));
  assert.equal(model.snapshot().vault.earned, oldEarnings, 'The replacement deposit must have no newly earned interest');
  assert.equal(model.serialize().journey.vaultYield, false,
    'A later 1,000 CNX deposit must not reuse interest earned on money already withdrawn');
  assert.equal(quest(model, 'yield').status, 'active');
  inspect(model, 'chamber');
  assert.equal(model.serialize().journey.vaultYield, false, 'An unrelated story action must not infer a new earning event');
  reject(model, 'claim', { id: 'yield' });
  const restored = Simulation.create({ saved: model.serialize(), now: () => Date.UTC(2026, 9, 14) });
  assert.equal(restored.snapshot().restored, true);
  assert.equal(quest(restored, 'yield').status, 'active', 'Reload must preserve the unfinished deposit objective');
  success(restored.act('step'));
  assert(restored.snapshot().vault.earned > oldEarnings, 'The qualifying tick must credit genuinely new interest');
  assert.equal(restored.serialize().journey.vaultYield, true);
  claim(restored, 'yield');

  const oldSave = Simulation.create({ now: () => Date.UTC(2026, 9, 14) });
  success(oldSave.act('unlock', { key: 'cryo' }));
  success(oldSave.act('deposit', { amount: 1000 }));
  success(oldSave.act('step'));
  const legacy = oldSave.serialize();
  delete legacy.journey;
  const lateJournal = Simulation.create({ saved: legacy, now: () => Date.UTC(2026, 9, 14) });
  assert.equal(lateJournal.snapshot().restored, true);
  assert(lateJournal.snapshot().vault.earned > 0);
  accept(lateJournal, 'arrival');
  assert.equal(lateJournal.serialize().journey.vaultYield, false,
    'A legacy balance and lifetime interest must not reconstruct an ambiguous past earning event');
  success(lateJournal.act('step'));
  assert.equal(lateJournal.serialize().journey.vaultYield, true);
});

test('real stabilization and Vault earnings before opening the journal preserve early gameplay credit', () => {
  const model = Simulation.create();
  const initial = model.serialize();
  model.snapshot(); model.quote('buy', NODE, 1);
  assert.deepEqual(model.serialize(), initial, 'Read-only views and quotes must not invent progression');
  success(model.act('buy', { id: NODE, quantity: 1 }));
  success(model.act('step'));
  assert.equal(Object.hasOwn(model.serialize(), 'journey'), false,
    'Trading and a tick without Vault earnings must not create unrelated quest evidence');
  success(model.act('link', { id: NODE }));
  assert.equal(Object.hasOwn(model.serialize(), 'journey'), false, 'A binding alone must not prove stabilization');
  success(model.act('stabilize', { id: NODE }));
  assert(model.snapshot().nodes.find(node => node.id === NODE).strength >= 90);
  assert(has(model, 'stabilized', NODE), 'A real qualifying stabilization must save its evidence before the journal opens');
  assert.deepEqual(model.serialize().journey.accepted, []);
  accept(model, 'arrival'); inspect(model, 'chamber'); claim(model, 'arrival');
  accept(model, 'beacon');
  assert.equal(quest(model, 'beacon').status, 'ready', 'The newly accepted quest must acknowledge the earlier real stabilization');
  claim(model, 'beacon');

  const earlyVault = Simulation.create({ now: () => Date.UTC(2026, 9, 14) });
  success(earlyVault.act('unlock', { key: 'cryo' }));
  success(earlyVault.act('deposit', { amount: 1000 }));
  assert.equal(Object.hasOwn(earlyVault.serialize(), 'journey'), false, 'A deposit alone must not create earned proof');
  success(earlyVault.act('step'));
  assert(earlyVault.snapshot().vault.earned > 0);
  assert.equal(earlyVault.serialize().journey.vaultYield, true,
    'A real qualifying earning tick must save proof before any quest has been accepted');
  assert.deepEqual(earlyVault.serialize().journey.accepted, []);
  const restored = Simulation.create({ saved: earlyVault.serialize(), now: () => Date.UTC(2026, 9, 14) });
  assert.equal(restored.snapshot().restored, true);
  assert.equal(restored.serialize().journey.vaultYield, true, 'Early proof must survive reload');
  accept(restored, 'arrival'); inspect(restored, 'chamber'); claim(restored, 'arrival');
  accept(restored, 'beacon');
  success(restored.act('link', { id: NODE })); success(restored.act('stabilize', { id: NODE }));
  claim(restored, 'beacon'); accept(restored, 'yield');
  assert.equal(quest(restored, 'yield').status, 'ready', 'Accepting the yield quest must acknowledge the genuine earlier earning tick');
  claim(restored, 'yield');
});

test('story actions preserve prices, balances, coherence, simulation time and RNG replay', () => {
  const story = Simulation.create({ seed: 743 });
  const reference = Simulation.create({ seed: 743 });
  function narrative(type, payload) {
    const before = economy(story);
    success(story.act(type, payload));
    assert.deepEqual(economy(story), before, type + ' must not alter the simulation economy or random generator');
  }
  narrative('quest', { id: 'arrival' });
  narrative('inspect', { id: 'chamber' });
  narrative('claim', { id: 'arrival' });
  narrative('quest', { id: 'edge' });
  for (const id of ['eclipse', 'ice-ring']) narrative('inspect', { id });
  narrative('signal', { code: CODE });
  narrative('echo', { word: '42' });
  narrative('echo', { word: 'xyzzy' });
  narrative('theme', { id: 'ember' });
  assert.deepEqual(economy(story), economy(reference));
  success(story.selectPhase(2)); success(reference.selectPhase(2));
  narrative('inspect', { id: 'eclipse' });
  narrative('claim', { id: 'edge' });
  for (let index = 0; index < 20; index++) {
    success(story.act('step')); success(reference.act('step'));
    assert.deepEqual(economy(story), economy(reference), 'Story progression must preserve the next deterministic market tick');
  }
});

test('new progress round-trips and snapshots cannot mutate the saved journal', () => {
  const model = completeRoute(Simulation.create({ now: afterExpiry }), false);
  success(model.act('theme', { id: 'aurora' }));
  const saved = model.serialize();
  const restored = Simulation.create({ saved: JSON.stringify(saved), now: afterExpiry });
  assert.equal(restored.snapshot().restored, true);
  assert.deepEqual(restored.serialize(), saved);
  assert.deepEqual(restored.snapshot().journey, model.snapshot().journey);
  const view = restored.snapshot().journey;
  view.quests[0].status = 'available';
  view.lore[0].text = 'injected';
  view.inspected.length = 0;
  const writable = restored.serialize();
  writable.journey.claimed.length = 0;
  writable.journey.theme = 'frost';
  assert.deepEqual(restored.serialize(), saved, 'Views and save copies must be detached from internal progression');
  reject(restored, 'claim', { id: 'remembrance' });
  reject(restored, 'echo', { word: '42' });
  reject(restored, 'echo', { word: 'xyzzy' });
});

test('legacy saves restore without invented progress or changes to their economy', () => {
  const legacy = Simulation.create({ seed: 505 });
  success(legacy.act('buy', { id: 'CN-BOREALIS', quantity: 2 }));
  success(legacy.act('step'));
  const saved = legacy.serialize();
  delete saved.journey;
  const restored = Simulation.create({ saved, now: afterExpiry });
  assert.equal(restored.snapshot().restored, true);
  assert.deepEqual(economy(restored), economy(legacy));
  assert.equal(restored.snapshot().journey.claimedCount, 0);
  assert.equal(restored.snapshot().journey.secretCount, 0);
  assert.deepEqual(restored.snapshot().journey.inspected, []);
  assert.equal(restored.snapshot().journey.theme, 'frost');
  const withoutResearch = structuredClone(saved);
  delete withoutResearch.expedition;
  assert.equal(Simulation.create({ saved: withoutResearch }).snapshot().restored, true);
});

test('invalid journal schemas fail cleanly and reset clears rewards and selected theme', () => {
  const model = completeRoute(Simulation.create({ now: afterExpiry }), false);
  success(model.act('theme', { id: 'aurora' }));
  const saved = model.serialize();
  const mutations = [
    journey => { journey.extra = true; },
    journey => { delete journey.accepted; },
    journey => { journey.accepted.push('arrival'); },
    journey => { journey.accepted.push('missing'); },
    journey => { journey.accepted = []; },
    journey => { journey.ready = []; },
    journey => { journey.claimed.push('missing'); },
    journey => { journey.inspected.push('chamber'); },
    journey => { journey.inspected = ['missing']; },
    journey => { journey.coronaInspected = 1; },
    journey => { journey.stabilized.push('missing'); },
    journey => { journey.vaultYield = 'true'; },
    journey => { journey.secrets.push('frequency'); },
    journey => { journey.secrets.push('missing'); },
    journey => { journey.eggs.push('answer'); },
    journey => { journey.eggs = ['missing']; },
    journey => { journey.theme = 'missing'; }
  ];
  for (const mutate of mutations) {
    const broken = structuredClone(saved); mutate(broken.journey);
    const restored = Simulation.create({ saved: broken, now: afterExpiry });
    assert.equal(restored.snapshot().restored, false, 'Invalid progress must not be accepted');
    assert(restored.snapshot().restoreError);
    assert.equal(restored.snapshot().journey.claimedCount, 0);
    assert.equal(restored.snapshot().cash, 100000);
  }
  success(model.act('reset'));
  assert.equal(model.snapshot().journey.claimedCount, 0);
  assert.equal(model.snapshot().journey.secretCount, 0);
  assert.deepEqual(model.snapshot().journey.inspected, []);
  assert.equal(model.snapshot().journey.eggs.filter(item => item.discovered).length, 0);
  assert.equal(model.snapshot().journey.lore.length, 0);
  assert.equal(model.snapshot().journey.theme, 'frost');
  assert.equal(quest(model, 'arrival').status, 'available');
  reject(model, 'theme', { id: 'ember' });
  reject(model, 'theme', { id: 'aurora' });
});

test('terminal commands share real quest gates, exact state and safe argument handling', () => {
  const model = Simulation.create({ now: afterExpiry });
  const api = { snapshot: model.snapshot, action: model.act, currentSection: 'chamber',
    phases: ['Kontakt', 'Diamantring', 'Korona', 'Freisteller', 'Reset'].map(name => ({ name })), reduced: true };
  const run = raw => Terminal.run(raw, api);
  function unchanged(raw, expected) {
    const before = model.serialize();
    const result = run(raw);
    assert.equal(result.ok, expected, raw);
    assert.deepEqual(model.serialize(), before, raw + ' must not mutate progress or the economy');
    return result;
  }
  for (const name of ['quests', 'quest', 'claim', 'inspect', 'secrets', 'signal', 'echo', 'theme']) {
    assert.match(unchanged('help ' + name, true).text, /Eingabe:.*\nBeispiel:/);
    unchanged(name + ' extra extra extra', false);
  }
  for (const raw of ['quests', 'secrets', 'theme']) assert(unchanged(raw, true).text.trim());
  for (const raw of ['quest', 'quest missing', 'claim arrival', 'inspect missing', 'signal ' + CODE,
    'echo nothing', 'theme aurora', 'theme ember', 'quest __proto__', 'claim constructor']) unchanged(raw, false);
  success(run('QuEsT arrival'));
  unchanged('quest arrival', false);
  success(run('inspect'));
  assert(has(model, 'inspected', 'chamber'), 'Default inspection must use the current real section');
  success(run('claim arrival'));
  unchanged('claim arrival', false);
  success(run('inspect finsternis'));
  success(run('inspect nexus'));
  unchanged('signal 004-46-13090', false);
  success(run('signal ' + CODE));
  success(run('echo 42'));
  success(run('echo xyzzy'));
  success(run('theme ember'));
  assert.equal(model.snapshot().journey.theme, 'ember');
  assert.equal(model.snapshot().journey.secretCount, 1);
  assert.equal(model.snapshot().journey.eggs.filter(item => item.discovered).length, 2);
  unchanged('signal ' + CODE, false);
  unchanged('echo 42', false);
  assert(model.snapshot().journey.lore.some(item => item.id === 'secret-frequency'));
});

console.log('Journey checks passed: ' + checks);
