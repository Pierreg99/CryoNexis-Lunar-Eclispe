'use strict';
const assert = require('node:assert/strict');
const Simulation = require('../dist/assets/js/simulation.js');
const Terminal = require('../dist/assets/js/terminal.js');
let time = Date.UTC(2026, 9, 11);
const model = Simulation.create({ now: () => time });
const noChange = (type, payload) => {
  const before = model.serialize(); assert.equal(model.act(type, payload).ok, false);
  assert.deepEqual(model.serialize(), before);
};
noChange('observe'); noChange('calibrate', { id: 'CN-BOREALIS' }); noChange('decode');
assert(model.act('unlock', { key: 'cryo' }).ok);
assert(model.act('observe').ok); noChange('observe');
assert(model.selectPhase(1, { manual: true }).ok); assert(model.act('observe').ok);
assert.equal(model.snapshot().expedition.networkUnlocked, false);
assert(model.act('buy', { id: 'CN-BOREALIS', quantity: 1 }).ok);
assert(model.snapshot().expedition.networkUnlocked);
noChange('calibrate', { id: 'CN-BOREALIS' });
assert(model.act('link', { id: 'CN-BOREALIS' }).ok);
assert(model.act('calibrate', { id: 'CN-BOREALIS' }).ok);
noChange('calibrate', { id: 'CN-BOREALIS' }); noChange('decode');
for (const index of [2, 3, 4]) {
  assert(model.selectPhase(index, { manual: true }).ok); assert(model.act('observe').ok);
}
for (const id of ['CN-KRYO-7X', 'CN-HALO']) {
  assert(model.act('link', { id }).ok); assert(model.act('calibrate', { id }).ok);
}
assert.equal(model.snapshot().expedition.archiveUnlocked, false);
assert(model.act('deposit', { amount: 1000 }).ok); assert(model.act('step').ok);
assert(model.snapshot().vault.earned > 0);
assert(model.snapshot().expedition.archiveUnlocked);
assert(model.act('decode').ok); noChange('decode');
const state = model.snapshot();
assert.equal(state.visual.surveyCount, 5);
assert.equal(state.visual.calibrated.filter(Boolean).length, 3);
assert(state.visual.archiveDecoded);
console.log('PASS research: prerequisite gates, distinct evidence, milestone unlocks and visual consequences');
const saved = model.serialize();
const restored = Simulation.create({ saved, now: () => time });
assert(restored.snapshot().restored);
assert.deepEqual(restored.snapshot().expedition, state.expedition);
time = Date.UTC(2026, 10, 1);
assert.equal(restored.snapshot().vault.cryoUnlocked, false);
assert(restored.snapshot().expedition.decoded);
const expired = restored.serialize();
assert.equal(restored.act('calibrate', { id: 'CN-ALPHA-01' }).ok, false);
assert.deepEqual(restored.serialize(), expired);
for (const change of [value => value.observed.push(0), value => value.calibrated.push('UNKNOWN'), value => { value.observed = []; }]) {
  const broken = structuredClone(saved); change(broken.expedition);
  assert.equal(Simulation.create({ saved: broken }).snapshot().restored, false);
}
restored.act('reset'); assert.equal(restored.snapshot().expedition.observed.length, 0);
assert.equal(restored.snapshot().expedition.decoded, false);
console.log('PASS research: compatible save restoration, expired read access, invalid evidence and reset');
time = Date.UTC(2026, 9, 11);
const alias = Simulation.create({ now: () => time });
const api = { action: alias.act, snapshot: alias.snapshot, phases: [], reduced: true };
assert(Terminal.run('CrYo UnLoCk', api).ok);
assert(Terminal.run('missions', api).text.includes('Observatorium'));
assert(Terminal.run('observe', api).ok);
const initial = alias.serialize();
assert.equal(Terminal.run('cryo wrong', api).ok, false);
assert.equal(Terminal.run('calibrate', api).ok, false);
assert.deepEqual(alias.serialize(), initial);
console.log('PASS research: command aliases, mission guidance and safe command arguments');
