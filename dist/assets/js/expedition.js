/* Lazy capability host. Economic state and research evidence belong to the model. */
(function () {
  'use strict';
  const definitions = new Map(), views = new Map(), loading = new Map();
  let api, current;
  const catalog = [
    { id: 'observatory', title: '01 · Observatorium', goal: 'Erfasse zwei verschiedene Phasen und halte eine Knotenposition. Dadurch öffnet sich das Resonanzlabor.', eligible: state => state.vault.cryoUnlocked },
    { id: 'resonance', title: '02 · Resonanzlabor', goal: 'Erfasse alle fünf Phasen, kalibriere drei gebundene Knoten mit Stärke ≥90 % und erzeuge Vault-Ertrag. Dadurch öffnet sich das Zeitarchiv.', eligible: state => state.expedition.networkUnlocked },
    { id: 'archive', title: '03 · Zeitarchiv', goal: 'Entschlüssle Zeitspur 004. Deine Forschung wird als Nebelsignatur sichtbar.', eligible: state => state.expedition.archiveUnlocked }
  ];
  const root = document.getElementById('expedition');
  const message = document.getElementById('expedition-status');
  function element(tag, text, parent) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (parent) parent.appendChild(node);
    return node;
  }
  function button(parent, label, callback) {
    const node = element('button', label, parent); node.type = 'button';
    node.addEventListener('click', callback); return node;
  }
  function load(entry) {
    if (loading.has(entry.id)) return;
    const view = views.get(entry.id);
    view.note.textContent = 'Fähigkeit wird geladen …';
    view.retry.hidden = true;
    const task = api.load(entry.id).then(function () {
      const definition = definitions.get(entry.id);
      if (!definition) throw new Error('Missing capability');
      view.module = definition.mount({ container: view.content, element: element, button: button,
        command: api.command, phases: api.phases });
      view.loaded = true;
      render(current);
    }).catch(function () {
      loading.delete(entry.id);
      view.note.textContent = 'Laden fehlgeschlagen. Deine Forschung bleibt erhalten; du kannst erneut laden oder Terminalbefehle verwenden.';
      view.retry.hidden = false;
    });
    loading.set(entry.id, task);
  }
  function render(state) {
    current = state;
    root.hidden = !state.vault.cryoUnlocked && !(state.expedition.observed.length || state.expedition.networkUnlocked);
    message.textContent = state.vault.cryoUnlocked ? 'CRYO aktiv · Fähigkeiten öffnen sich durch deine Forschung.' : 'Zugang abgelaufen oder zurückgesetzt · gespeicherte Forschung bleibt einsehbar; neue Aktionen benötigen aktiven Zugang.';
    catalog.forEach(function (entry) {
      const view = views.get(entry.id);
      const earned = entry.eligible(state);
      view.card.dataset.unlocked = String(earned);
      if (view.loaded) {
        view.module.update(state);
        view.note.textContent = earned ? 'Fähigkeit geladen' : 'Fähigkeit derzeit gesperrt';
        return;
      }
      if (earned && state.vault.cryoUnlocked) load(entry);
      else if (!loading.has(entry.id)) view.note.textContent = 'Gesperrt · ' + (entry.id === 'observatory' ? 'unlock cryo eingeben' : entry.goal);
    });
  }
  window.CryoExpedition = {
    register: function (id, definition) { definitions.set(id, definition); },
    start: function (options) {
      if (api) return;
      api = options;
      catalog.forEach(function (entry) {
        const card = element('article', '', document.getElementById('expedition-modules'));
        card.className = 'capability panel'; card.id = 'capability-' + entry.id;
        element('h3', entry.title, card); element('p', entry.goal, card);
        const note = element('p', '', card); note.className = 'micro';
        const content = element('div', '', card);
        const retry = button(card, 'Erneut laden', function () { if (current.vault.cryoUnlocked && entry.eligible(current)) load(entry); }); retry.hidden = true;
        views.set(entry.id, { card: card, note: note, content: content, retry: retry, loaded: false });
      });
      api.subscribe(render);
    }
  };
})();
