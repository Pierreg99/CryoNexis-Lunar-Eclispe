(function () {
  'use strict';
  CryoExpedition.register('observatory', { mount: function (api) {
    const status = api.element('p', '', api.container);
    const group = api.element('div', '', api.container); group.className = 'simulation-controls';
    const phases = api.phases.map(function (phase, index) {
      return api.button(group, phase.name, function () { api.command('phase ' + (index + 1)); });
    });
    const observe = api.button(api.container, 'Aktuelle Phase erfassen', function () { api.command('observe'); });
    const purchase = api.button(api.container, '', function () { api.command('buy CN-BOREALIS 1'); });
    api.element('p', 'Phasenwechsel kosten wie bisher Kohärenz. Beobachten selbst kostet keine CNX.', api.container);
    return { update: function (state) {
      const research = state.expedition;
      status.textContent = 'Erfasst: ' + research.observed.length + '/5 · Aktuell: ' + state.phaseName + ' · Korona ' + (state.visual.corona * 100).toFixed(2) + ' % · Kern ' + state.visual.temperature + ' °C';
      const quote = api.quote('buy', 'CN-BOREALIS', 1);
      const holding = state.nodes.some(node => node.quantity > 0);
      purchase.textContent = holding ? 'Knotenposition vorhanden ✓' : '1 Borealis kaufen · ' + (quote.ok ? quote.total.toFixed(4) + ' CNX' : 'nicht verfügbar');
      purchase.disabled = !state.vault.cryoUnlocked || holding || !quote.ok || quote.total > state.cash;
      observe.disabled = !state.vault.cryoUnlocked || research.observed.includes(state.phase);
      phases.forEach(function (button, index) { button.disabled = !state.vault.cryoUnlocked; button.setAttribute('aria-pressed', String(index === state.phase)); button.textContent = api.phases[index].name + (research.observed.includes(index) ? ' ✓' : ''); });
    } };
  } });
})();
