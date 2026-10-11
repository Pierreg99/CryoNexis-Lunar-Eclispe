(function () {
  'use strict';
  CryoExpedition.register('resonance', { mount: function (api) {
    const status = api.element('p', '', api.container), list = api.element('div', '', api.container);
    const views = new Map();
    return { update: function (state) {
      status.textContent = 'Resonanzbaken: ' + state.expedition.calibrated.length + '/6 · Kalibrierte Knoten verstärken das Nexus-Signal.';
      state.nodes.forEach(function (node) {
        if (!views.has(node.id)) {
          const row = api.element('div', '', list); row.className = 'resonance-node';
          const text = api.element('p', '', row), controls = api.element('div', '', row); controls.className = 'simulation-controls';
          const bind = api.button(controls, 'Binden · 1.200 CNX', function () { api.command('link ' + node.id); });
          const strengthen = api.button(controls, 'Stabilisieren · 700 CNX', function () { api.command('stabilize ' + node.id); });
          const calibrate = api.button(controls, 'Kalibrieren', function () { api.command('calibrate ' + node.id); });
          views.set(node.id, { text: text, bind: bind, strengthen: strengthen, calibrate: calibrate });
        }
        const view = views.get(node.id), calibrated = state.expedition.calibrated.includes(node.id);
        const enabled = state.vault.cryoUnlocked && state.expedition.networkUnlocked;
        view.text.textContent = node.id + ' · Stärke ' + node.strength.toFixed(2) + ' % · ' + (node.bound ? 'gebunden' : 'ungebunden') + (calibrated ? ' · KALIBRIERT' : '');
        view.bind.disabled = !enabled || node.bound || state.cash < 1200;
        view.strengthen.disabled = !enabled || state.cash < 700;
        view.calibrate.disabled = !enabled || !node.bound || node.strength < 90 || calibrated;
      });
    } };
  } });
})();
