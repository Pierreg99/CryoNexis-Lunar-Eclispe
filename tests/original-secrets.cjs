'use strict';

const assert = require('node:assert/strict');
const Simulation = require('../dist/assets/js/simulation.js');
const SCENES = ['chamber', 'eclipse', 'ice-ring', 'nodes', 'terminal', 'void'];
const ORIGINAL = ['homecoming', 'witness', 'reply'];
const CODE = '004-46-13091';
const REPLY = '13091-46-004';
const afterExpiry = () => Date.UTC(2027, 0, 1);
let checks = 0;

function test(name, fn) { fn(); checks++; console.log('PASS original secrets: ' + name); }
function success(result) { assert.equal(result.ok, true, result.message); return result; }
function inspect(model, id) { return success(model.act('inspect', { id })); }
function has(model, id) { return model.snapshot().journey.secrets.some(item => item.id === id && item.discovered); }
function reject(model, type, payload, reason) {
  const before = model.serialize();
  const result = model.act(type, payload);
  assert.equal(result.ok, false, 'The action must reject: ' + JSON.stringify({ type, payload }));
  assert(result.message, 'Rejected answers need useful guidance');
  if (reason) assert.equal(result.reason, reason);
  assert.deepEqual(model.serialize(), before, 'Rejected answers must preserve all saved state');
  return result;
}
function economy(model) {
  const saved = model.serialize();
  delete saved.journey; delete saved.history; delete saved.historySeq;
  return saved;
}
function oldSecrets(model) {
  for (const id of ['chamber', 'eclipse', 'ice-ring']) inspect(model, id);
  success(model.act('signal', { code: CODE }));
  success(model.act('pause'));
  inspect(model, 'void');
  success(model.selectPhase(3, { manual: false }));
  inspect(model, 'ice-ring');
  assert.deepEqual(model.serialize().journey.secrets, ['frequency', 'silence', 'refraction']);
  return model;
}
function allSecrets(model) {
  oldSecrets(model);
  for (const id of SCENES) inspect(model, id);
  inspect(model, 'chamber');
  success(model.act('echo', { word: 'HIER' }));
  success(model.act('signal', { code: REPLY }));
  return model;
}

test('six signals retain the old entries and keep undiscovered stories and answers concealed', () => {
  const model = Simulation.create({ now: afterExpiry });
  const journal = model.snapshot().journey;
  assert.deepEqual(journal.secrets.map(item => item.id), ['frequency', 'silence', 'refraction', ...ORIGINAL]);
  assert.equal(journal.secretCount, 0);
  assert.deepEqual(journal.lore, []);
  for (const item of journal.secrets) {
    assert.equal(item.discovered, false);
    assert.equal(Object.hasOwn(item, 'text'), false, 'Unsolved signals must not disclose their story');
    assert(item.hint, 'Every signal must offer an optional path forward');
  }
  for (const item of journal.secrets.filter(item => ORIGINAL.includes(item.id))) {
    assert(!/\bHIER\b|13091-46-004/i.test(item.hint), 'Hints must point toward actual clues rather than reveal answers');
  }
  assert.equal(Object.hasOwn(model.serialize(), 'journey'), false, 'Reading the catalog must not invent progress');
});

test('the return requires all six real inspections and a later chamber visit', () => {
  const model = Simulation.create({ now: afterExpiry });
  inspect(model, 'chamber');
  inspect(model, 'chamber');
  assert.equal(has(model, 'homecoming'), false, 'Repeated visits before exploration must not count');
  for (const id of SCENES.slice(1)) inspect(model, id);
  assert.equal(model.snapshot().journey.inspected.length, 6);
  assert.equal(has(model, 'homecoming'), false, 'Completing a map at another scene must not invent a return');
  const result = inspect(model, 'chamber');
  assert.equal(has(model, 'homecoming'), true);
  assert.match(result.message, /GEHEIMNIS ENTDECKT/);
  const discovered = model.serialize();
  inspect(model, 'chamber');
  assert.deepEqual(model.serialize(), discovered, 'Repeated returns must not issue a second reward or history record');

  const chamberLast = Simulation.create({ now: afterExpiry });
  for (const id of SCENES.slice(1)) inspect(chamberLast, id);
  inspect(chamberLast, 'chamber');
  assert.equal(has(chamberLast, 'homecoming'), false, 'A first chamber inspection as scene six is not a return');
  inspect(chamberLast, 'chamber');
  assert.equal(has(chamberLast, 'homecoming'), true);
});

test('the seventh voice is solved from actual clue lines and an independently required reception rule', () => {
  const model = Simulation.create({ now: afterExpiry });
  reject(model, 'echo', { word: 'HIER' }, 'clues');
  const nodes = inspect(model, 'nodes');
  const lines = nodes.message.trim().split('\n').slice(-4);
  assert.equal(lines.length, 4);
  const answer = lines.map(line => line.trim()[0]).join('');
  assert.equal(answer, 'HIER', 'The returned four-line clue must itself produce the answer');
  reject(model, 'echo', { word: answer }, 'clues');
  const vault = inspect(model, 'terminal');
  assert.match(vault.message, /Anfangsbuchstaben/);
  assert.match(vault.message, /Echo/);
  reject(model, 'echo', { word: answer }, 'clues');
  const timeline = inspect(model, 'void');
  assert.match(timeline.message, /siebte Stimme/);
  success(model.act('echo', { word: answer }));
  assert.equal(has(model, 'witness'), true);
  assert.deepEqual(model.serialize().journey.eggs, [], 'The original secret must not masquerade as an Easter egg');
  reject(model, 'echo', { word: 'hIeR' }, 'discovered');
  for (const missing of ['nodes', 'terminal', 'void']) {
    const incomplete = Simulation.create({ now: afterExpiry });
    for (const id of ['nodes', 'terminal', 'void'].filter(id => id !== missing)) inspect(incomplete, id);
    reject(incomplete, 'echo', { word: answer }, 'clues');
    assert.equal(has(incomplete, 'witness'), false, 'Each of the three inspections must independently be required');
  }
});

test('word answers accept letter case while malformed and unrelated echoes preserve state', () => {
  for (const word of ['hier', 'HIER', 'hIeR']) {
    const model = Simulation.create({ now: afterExpiry });
    for (const id of ['nodes', 'terminal', 'void']) inspect(model, id);
    for (const wrong of ['HIER!', 'HEIR', 'elsewhere', '', 42, null, ['hier']]) reject(model, 'echo', { word: wrong }, 'word');
    reject(model, 'echo', {}, 'word');
    success(model.act('echo', { word }));
    assert.equal(has(model, 'witness'), true);
  }
});

test('the reply reverses actual frequency fields after receiving its instruction', () => {
  const model = Simulation.create({ now: afterExpiry });
  reject(model, 'signal', { code: REPLY }, 'clues');
  const chamber = inspect(model, 'chamber').message;
  const eclipse = inspect(model, 'eclipse').message;
  const nexus = inspect(model, 'ice-ring').message;
  assert.match(eclipse, /Kammer — Schollen — Brechungsindex/);
  const chamberNumber = chamber.match(/Kammer (\d+)/);
  const iceCount = nexus.match(/(\d+) Kristallschollen/);
  const index = nexus.match(/Brechungsindex beträgt (\d+),(\d+)/);
  assert(chamberNumber && iceCount && index, 'Actual scene messages must expose each reconstructible field');
  const fields = [chamberNumber[1].padStart(3, '0'), iceCount[1], index[1] + index[2]];
  const outgoing = fields.join('-');
  const incoming = fields.slice().reverse().join('-');
  assert.equal(outgoing, CODE);
  assert.equal(incoming, REPLY);
  reject(model, 'signal', { code: incoming }, 'clues');
  const opened = success(model.act('signal', { code: outgoing }));
  assert.match(opened.message, /III — II — I/);
  assert.match(opened.message, /Ziffern innerhalb der Felder bleiben unverändert/);
  const archive = model.snapshot().journey.lore.find(item => item.id === 'secret-frequency');
  assert(archive && archive.text.includes('III — II — I'), 'The received instruction must remain readable in the archive');
  for (const wrong of ['19031-64-400', '13091-46-04', '13091-004-46', '13091 46 004', 1309146004, null]) {
    reject(model, 'signal', { code: wrong }, 'code');
  }
  success(model.act('signal', { code: incoming }));
  assert.equal(has(model, 'reply'), true);
  reject(model, 'signal', { code: incoming }, 'discovered');
  reject(model, 'signal', { code: outgoing }, 'discovered');
});

test('all original discoveries remain playable after CRYO expiry and preserve the deterministic market', () => {
  const story = Simulation.create({ seed: 743, now: afterExpiry });
  const control = Simulation.create({ seed: 743, now: afterExpiry });
  reject(story, 'unlock', { key: 'cryo' });
  const before = economy(story);
  for (const id of SCENES) inspect(story, id);
  inspect(story, 'chamber');
  success(story.act('echo', { word: 'HIER' }));
  success(story.act('signal', { code: CODE }));
  success(story.act('signal', { code: REPLY }));
  assert.deepEqual(economy(story), before, 'Story actions must preserve money, coherence, phase, tick, nodes, vault and RNG');
  assert.deepEqual(economy(story), economy(control));
  assert(ORIGINAL.every(id => has(story, id)));
  const originalLore = story.snapshot().journey.lore.filter(item => ORIGINAL.some(id => item.id === 'secret-' + id));
  assert.equal(originalLore.length, 3);
  assert(originalLore.every(item => item.text && item.title));
  for (let tick = 0; tick < 20; tick++) {
    success(story.act('step')); success(control.act('step'));
    assert.deepEqual(economy(story), economy(control), 'The next market ticks must replay identically after discoveries');
  }
});

test('new lore round-trips in the existing journal schema without a new save version', () => {
  const model = allSecrets(Simulation.create({ now: afterExpiry }));
  const saved = model.serialize();
  assert.equal(saved.version, 1);
  assert.deepEqual(Object.keys(saved.journey).sort(), ['accepted', 'ready', 'claimed', 'inspected', 'coronaInspected', 'stabilized', 'vaultYield', 'secrets', 'eggs', 'theme'].sort());
  assert.equal(model.snapshot().journey.secretCount, 6);
  assert.equal(model.snapshot().journey.lore.length, 6);
  const restored = Simulation.create({ saved: JSON.stringify(saved), now: afterExpiry });
  assert.equal(restored.snapshot().restored, true);
  assert.deepEqual(restored.serialize(), saved);
  assert.deepEqual(restored.snapshot().journey, model.snapshot().journey);
  const copy = restored.snapshot().journey;
  copy.lore[0].text = 'tampered'; copy.secrets[3].discovered = false; copy.inspected.length = 0;
  assert.deepEqual(restored.serialize(), saved, 'Snapshots must not provide a mutable route into the saved journal');
  reject(restored, 'echo', { word: 'HIER' }, 'discovered');
  reject(restored, 'signal', { code: REPLY }, 'discovered');
  success(restored.act('reset'));
  assert.equal(restored.snapshot().journey.secretCount, 0);
  assert.equal(restored.snapshot().journey.lore.length, 0);
  assert.deepEqual(restored.snapshot().journey.inspected, []);
  assert(restored.snapshot().journey.secrets.every(item => !item.discovered));
  reject(restored, 'echo', { word: 'HIER' }, 'clues');
  reject(restored, 'signal', { code: REPLY }, 'clues');
});

test('old three-secret saves restore without inventing new discoveries', () => {
  const model = oldSecrets(Simulation.create({ now: afterExpiry }));
  const saved = model.serialize();
  const restored = Simulation.create({ saved, now: afterExpiry });
  assert.equal(restored.snapshot().restored, true);
  assert.deepEqual(restored.serialize(), saved);
  assert.equal(restored.snapshot().journey.secretCount, 3);
  assert(ORIGINAL.every(id => !has(restored, id)));
  assert.equal(restored.snapshot().journey.lore.length, 3);
  success(restored.act('signal', { code: REPLY }));
  assert.equal(has(restored, 'reply'), true, 'An old received signal must still support its new reply');
  const legacy = Simulation.create({ now: afterExpiry }).serialize();
  const empty = Simulation.create({ saved: legacy, now: afterExpiry });
  assert.equal(empty.snapshot().restored, true);
  assert.equal(empty.snapshot().journey.secretCount, 0);
  assert.equal(Object.hasOwn(empty.serialize(), 'journey'), false);
});

test('save validation rejects original discoveries without their causal prerequisites', () => {
  const template = Simulation.create({ now: afterExpiry });
  inspect(template, 'chamber');
  const base = template.serialize();
  const corruptions = [
    journey => { journey.secrets = ['homecoming']; },
    journey => { journey.secrets = ['witness']; journey.inspected = ['nodes', 'terminal']; },
    journey => { journey.secrets = ['witness']; journey.inspected = ['nodes', 'void']; },
    journey => { journey.secrets = ['witness']; journey.inspected = ['terminal', 'void']; },
    journey => { journey.secrets = ['reply']; journey.inspected = SCENES.slice(); },
    journey => { journey.secrets = ['frequency', 'reply']; journey.inspected = ['chamber', 'eclipse']; },
    journey => { journey.secrets = ['witness', 'witness']; journey.inspected = SCENES.slice(); },
    journey => { journey.secrets = ['unlisted']; }
  ];
  for (const corrupt of corruptions) {
    const saved = structuredClone(base); corrupt(saved.journey);
    const restored = Simulation.create({ saved, now: afterExpiry });
    assert.equal(restored.snapshot().restored, false, 'A forged discovery must fail save validation');
    assert(restored.snapshot().restoreError);
    assert.equal(restored.snapshot().journey.secretCount, 0);
    assert.equal(restored.snapshot().cash, 100000);
  }
});

console.log('Original secrets: ' + checks + ' test groups passed.');
