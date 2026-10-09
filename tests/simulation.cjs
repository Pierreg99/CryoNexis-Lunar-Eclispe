'use strict';

const assert = require('node:assert/strict');
const { create } = require('../dist/assets/js/simulation.js');
const money = value => Math.round((value + Number.EPSILON) * 10000) / 10000;
const ids = ['CN-ALPHA-01', 'CN-BOREALIS', 'CN-LUNAR-09', 'CN-KRYO-7X', 'CN-UMBRA', 'CN-HALO'];
let checks = 0;

function test(name, fn) {
  fn(); checks += 1; console.log('PASS simulation: ' + name);
}
function success(result) { assert.equal(result.ok, true, result.message); }
function invariant(sim) {
  const state = sim.snapshot();
  assert.equal(state.equity, money(state.cash + state.vault.balance + state.portfolioValue));
  assert.equal(state.portfolioValue, money(state.nodes.reduce((sum, node) => sum + node.positionValue, 0)));
  assert.equal(state.minutes, state.tick * 5);
  for (const value of [state.cash, state.equity, state.vault.balance, state.coherence, state.stability]) assert(Number.isFinite(value) && value >= 0);
  for (const node of state.nodes) {
    assert(Number.isFinite(node.price) && node.price > 0);
    assert(node.quantity >= 0 && node.strength >= 25 && node.strength <= 100);
    assert(Math.abs(node.change) <= 0.6);
  }
  assert(state.history.length <= 40);
}
function unchanged(sim, fn) {
  const before = sim.serialize();
  assert.equal(fn().ok, false);
  assert.deepEqual(sim.serialize(), before, 'A rejected operation must be atomic');
}
function unlock(sim) {
  for (const id of ids.slice(0, 3)) success(sim.act('link', { id }));
  success(sim.selectPhase(2));
  assert.equal(sim.snapshot().vault.open, true, 'Three links and sufficient stability/coherence unlock the corona gate');
}

test('initial assets, ledger identity and bounded tick drift', () => {
  const sim = create();
  assert.equal(sim.snapshot().cash, 100000);
  assert.deepEqual(sim.snapshot().nodes.map(node => node.id), ids);
  assert.deepEqual(sim.snapshot().nodes.map(node => node.price), [1842.6, 927.34, 3120.09, 748.72, 2064.18, 1296.46]);
  assert.equal(sim.snapshot().visual.temperature, -268);
  for (let i = 0; i < 250; i++) {
    const before = sim.snapshot(); success(sim.tick()); const after = sim.snapshot();
    after.nodes.forEach((node, index) => assert(Math.abs(node.price / before.nodes[index].price - 1) <= 0.006));
    invariant(sim);
  }
});

test('quotes are pure; buy and sell account for exact costs and fees', () => {
  const sim = create();
  const original = sim.serialize();
  const buy = sim.quote('buy', ids[0], 10.123456);
  success(buy); assert.deepEqual(sim.serialize(), original);
  success(sim.act('buy', { id: ids[0], quantity: 10.123456 }));
  assert.equal(sim.snapshot().cash, money(100000 - buy.total));
  assert.equal(sim.snapshot().feesPaid, buy.fee);
  assert.equal(sim.snapshot().equity, money(100000 - buy.fee - buy.slippage));
  const beforeSell = sim.snapshot();
  const sell = sim.quote('sell', ids[0], 10.123456);
  success(sell); success(sim.act('sell', { id: ids[0], quantity: 10.123456 }));
  assert.equal(sim.snapshot().nodes[0].quantity, 0);
  assert.equal(sim.snapshot().cash, money(beforeSell.cash + sell.net));
  assert.equal(sim.snapshot().equity, money(beforeSell.equity - sell.fee - sell.slippage));
  assert.equal(sim.snapshot().feesPaid, money(buy.fee + sell.fee));
  invariant(sim);
});

test('invalid quantities, insufficient funds and unknown actions are atomic', () => {
  const sim = create();
  for (const quantity of [0, -1, NaN, Infinity, '1', 1001, 0.0000001, 1.00000001]) {
    unchanged(sim, () => sim.act('buy', { id: ids[0], quantity }));
  }
  unchanged(sim, () => sim.act('buy', { id: ids[0], quantity: 1000 }));
  unchanged(sim, () => sim.act('sell', { id: ids[0], quantity: 1 }));
  unchanged(sim, () => sim.act('link', { id: 'missing' }));
  unchanged(sim, () => sim.act('unknown'));
  unchanged(sim, () => sim.selectPhase(99));
});

test('phase calibration cannot compound prices; manual control has a cost', () => {
  const sim = create();
  const prices = sim.snapshot().nodes.map(node => node.price);
  success(sim.selectPhase(1));
  assert.equal(sim.snapshot().coherence, 78);
  success(sim.selectPhase(0));
  assert.deepEqual(sim.snapshot().nodes.map(node => node.price), prices);
  const same = sim.serialize(); success(sim.selectPhase(0)); assert.deepEqual(sim.serialize(), same);
  for (const phase of [2, 3, 2, 1]) success(sim.selectPhase(phase));
  unchanged(sim, () => sim.selectPhase(2));
  const before = sim.snapshot().coherence;
  success(sim.selectPhase(4, { manual: false })); assert.equal(sim.snapshot().coherence, before);
  success(sim.selectPhase(0, { manual: false })); assert.equal(sim.snapshot().cycle, 1);
});

test('bindings, stabilization, liquidity and visual state share causal sources', () => {
  const sim = create(); const before = sim.snapshot();
  success(sim.act('link', { id: ids[0] }));
  const linked = sim.snapshot();
  assert.equal(linked.cash, 98800); assert.equal(linked.nodes[0].bound, true);
  assert(linked.nodes[0].liquidity > before.nodes[0].liquidity);
  assert(linked.nodes[0].validators > before.nodes[0].validators);
  assert(linked.nodes[0].risk < before.nodes[0].risk);
  assert.equal(linked.visual.bindings[0], true);
  unchanged(sim, () => sim.act('link', { id: ids[0] }));
  success(sim.act('stabilize', { id: ids[4] }));
  assert.equal(sim.snapshot().cash, 98100);
  assert(sim.snapshot().coherence > linked.coherence);
  assert(sim.snapshot().stability > linked.stability);
  success(sim.act('unlink', { id: ids[0] })); assert.equal(sim.snapshot().cash, 98500);
  assert.equal(sim.snapshot().visual.bindings[0], false);
  unchanged(sim, () => sim.act('unlink', { id: ids[0] }));
  invariant(sim);
});

test('vault gates, transfers, simulated interest, closure and withdrawals', () => {
  const sim = create(); unchanged(sim, () => sim.act('deposit', { amount: 100 }));
  unlock(sim);
  for (const amount of [0, -1, NaN, Infinity, '10', 1.00001, 1000000]) {
    unchanged(sim, () => sim.act('deposit', { amount }));
  }
  const equity = sim.snapshot().equity;
  success(sim.act('deposit', { amount: 20000 }));
  assert.equal(sim.snapshot().equity, equity);
  const apr = sim.snapshot().vault.apr; assert(apr >= 12 && apr <= 20);
  success(sim.tick());
  assert(sim.snapshot().vault.earned > 0 && sim.snapshot().vault.earned < 1);
  assert.equal(sim.snapshot().equity, money(equity + sim.snapshot().vault.earned));
  const balance = sim.snapshot().vault.balance;
  success(sim.selectPhase(4, { manual: false })); assert.equal(sim.snapshot().vault.open, false);
  unchanged(sim, () => sim.act('withdraw', { amount: 1 })); success(sim.tick());
  assert.equal(sim.snapshot().vault.balance, balance, 'Closed gates preserve funds and pause simulated interest');
  success(sim.selectPhase(2, { manual: false })); assert.equal(sim.snapshot().vault.open, true);
  const before = sim.snapshot().equity;
  success(sim.act('withdraw', { amount: 5000 })); assert.equal(sim.snapshot().equity, before);
  unchanged(sim, () => sim.act('withdraw', { amount: 100000 }));
  success(sim.act('unlink', { id: ids[0] })); assert.equal(sim.snapshot().vault.open, false);
  invariant(sim);
});

test('pause, forced steps and reset have explicit deterministic behavior', () => {
  const sim = create({ seed: 75 }); success(sim.act('pause'));
  unchanged(sim, () => sim.tick()); success(sim.act('step'));
  assert.equal(sim.snapshot().tick, 1); assert.equal(sim.snapshot().paused, true);
  success(sim.act('resume')); success(sim.tick()); assert.equal(sim.snapshot().tick, 2);
  success(sim.act('reset')); assert.deepEqual(sim.serialize(), create({ seed: 404 }).serialize());
});

test('seed replay, distinct phase paths and RNG-exact save restoration', () => {
  const a = create({ seed: 1234 }); const b = create({ seed: 1234 }); const different = create({ seed: 9876 });
  for (let i = 0; i < 25; i++) { a.tick(); b.tick(); different.tick(); }
  assert.deepEqual(a.serialize(), b.serialize()); assert.notDeepEqual(a.serialize().nodes, different.serialize().nodes);
  const c = create({ saved: JSON.stringify(a.serialize()) }); assert.equal(c.snapshot().restored, true);
  for (let i = 0; i < 15; i++) { a.tick(); c.tick(); }
  assert.deepEqual(a.serialize(), c.serialize());
  const kontakt = create({ seed: 404 }); const corona = create({ seed: 404 });
  corona.selectPhase(2, { manual: false });
  for (let i = 0; i < 40; i++) { kontakt.tick(); corona.tick(); }
  assert.notDeepEqual(kontakt.snapshot().nodes.map(node => node.price), corona.snapshot().nodes.map(node => node.price));
  assert.notEqual(kontakt.snapshot().stability, corona.snapshot().stability);
});

test('corrupt saves fail cleanly; serialized and view snapshots cannot mutate the model', () => {
  const fresh = create().serialize();
  const mutations = [
    saved => { saved.version = 2; }, saved => { saved.nodes[0].id = ids[1]; },
    saved => { saved.nodes.pop(); }, saved => { saved.cash = -1; },
    saved => { saved.coherence = Infinity; }, saved => { saved.nodes[0].quantity = 0.0000001; },
    saved => { saved.rng = '404'; }, saved => { saved.vault.balance = NaN; },
    saved => { saved.nodes[0].rawPrice = null; }, saved => { saved.paused = 0; },
    saved => { saved.history = [{ id: 1, tick: 99, type: 'tick', text: 'bad', phase: 0 }]; }
  ];
  for (const mutate of mutations) {
    const saved = structuredClone(fresh); mutate(saved);
    const model = create({ saved }); assert.equal(model.snapshot().restored, false);
    assert(model.snapshot().restoreError); assert.deepEqual(model.serialize(), fresh);
  }
  assert(create({ saved: '{"version":' }).snapshot().restoreError);
  const model = create(); const view = model.snapshot(); view.nodes[0].price = 0; view.history.push({ text: 'injected' });
  const saved = model.serialize(); saved.cash = 0;
  assert.deepEqual(model.serialize(), fresh);
  const calls = [];
  model.subscribe(state => { state.cash = -99; state.nodes[0].quantity = 100; throw new Error('view failure'); });
  const unsubscribe = model.subscribe(state => calls.push(state.cash));
  success(model.act('link', { id: ids[0] })); assert.deepEqual(calls, [100000, 98800]);
  unsubscribe(); success(model.tick()); assert.equal(calls.length, 2);
  invariant(model);
});

console.log('Simulation checks passed: ' + checks);
