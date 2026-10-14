/* The journal is a view of model evidence, never a source of discoveries. */
(function () {
  'use strict';

  let api;
  let current;
  let selectedView = 'quests';
  const questViews = new Map();
  const secretViews = new Map();
  const eggViews = new Map();
  const loreViews = new Map();
  const themeViews = new Map();
  const statusLabels = { locked: 'Gesperrt', available: 'Bereit zum Start', active: 'In Arbeit', ready: 'Ziel erreicht', claimed: 'Abgeschlossen' };
  const destinations = { arrival: '#chamber', edge: '#eclipse', cartographer: '#chamber', beacon: '#node-grid', yield: '#terminal', remembrance: '#journal-secrets' };
  const sceneNames = { chamber: 'Kammer', eclipse: 'Finsternis', 'ice-ring': 'Nexus', nodes: 'Knoten', terminal: 'Vault', void: 'Zeitlinie' };
  let controls;
  let panels;
  let hosts;
  let feedback;
  let eggList;
  let eggNote;
  let loreEmpty;

  function element(tag, className, parent) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (parent) parent.appendChild(node);
    return node;
  }
  function text(node, value) {
    if (!node) return;
    const next = value == null ? '' : String(value);
    if (node.textContent !== next) node.textContent = next;
  }
  function receipt(node, result) {
    if (!node || !result) return;
    text(node, result.message);
    node.dataset.error = String(!result.ok);
  }
  function act(type, payload, node) {
    // The app keeps its global status quiet when an action has a local receipt.
    const result = api.action(type, payload, node, false);
    receipt(node, result);
    return result;
  }
  function journey(state) {
    return state && state.journey ? state.journey : { quests: [], secrets: [], eggs: [], lore: [], themes: [], theme: 'frost' };
  }
  function view(name) {
    if (!Object.prototype.hasOwnProperty.call(panels, name)) return;
    selectedView = name;
    Object.keys(panels).forEach(function (key) {
      if (panels[key]) panels[key].hidden = key !== name;
    });
    controls.forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.journalView === name));
    });
    const themes = document.getElementById('journal-themes');
    if (themes) themes.hidden = name !== 'codex';
  }

  function buildQuest(quest) {
    const card = element('article', 'journal-card panel', hosts.quests);
    card.id = 'quest-' + quest.id;
    card.dataset.questId = quest.id;
    const header = element('div', 'journal-card-header', card);
    const title = element('h4', '', header);
    title.tabIndex = -1;
    const status = element('span', 'journal-status', header);
    const description = element('p', 'journal-description', card);
    const hint = element('p', 'journal-hint', card);
    hint.id = card.id + '-hint';
    const progress = element('progress', 'journal-progress-track', card);
    progress.id = card.id + '-progress';
    const count = element('p', 'journal-progress-text micro', card);
    const reward = element('p', 'journal-reward', card);
    const actions = element('div', 'journal-card-actions', card);
    const button = element('button', '', actions);
    button.type = 'button';
    button.setAttribute('aria-describedby', hint.id);
    const target = element('a', 'text-link journal-target', actions);
    target.dataset.questTarget = quest.id;
    target.addEventListener('click', function () {
      if (quest.id === 'remembrance') view('secrets');
    });
    button.addEventListener('click', function () {
      const entry = journey(current).quests.find(function (item) { return item.id === quest.id; });
      if (!entry || (entry.status !== 'available' && entry.status !== 'ready')) return;
      const result = act(entry.status === 'ready' ? 'claim' : 'quest', { id: quest.id }, feedback);
      // An explicit completed action can disable this control; keep keyboard focus in its card.
      if (result && result.ok && button.disabled) {
        if (!target.hidden) target.focus({ preventScroll: true });
        else title.focus({ preventScroll: true });
      }
    });
    const item = { card: card, title: title, status: status, description: description, hint: hint,
      progress: progress, count: count, reward: reward, button: button, target: target };
    questViews.set(quest.id, item);
    return item;
  }
  function renderQuest(quest) {
    const item = questViews.get(quest.id) || buildQuest(quest);
    const status = statusLabels[quest.status] ? quest.status : 'locked';
    item.card.dataset.status = status;
    text(item.title, quest.title);
    text(item.status, statusLabels[status]);
    text(item.description, quest.description);
    const inspected = journey(current).inspected || [];
    const remaining = quest.id === 'cartographer' ? Object.keys(sceneNames).filter(function (id) { return !inspected.includes(id); }) : [];
    text(item.hint, quest.hint + (quest.id === 'cartographer' && status === 'active' && remaining.length ? ' Noch offen: ' + remaining.map(function (id) { return sceneNames[id]; }).join(', ') + '.' : ''));
    const maximum = Math.max(1, Number(quest.progress && quest.progress.max) || 1);
    const value = Math.max(0, Math.min(maximum, Number(quest.progress && quest.progress.value) || 0));
    item.progress.max = maximum;
    item.progress.value = value;
    item.progress.setAttribute('aria-label', String(quest.title) + ': Fortschritt');
    text(item.count, value + ' / ' + maximum + ' · ' + statusLabels[status]);
    text(item.reward, quest.reward ? 'Belohnung: ' + quest.reward : '');
    item.reward.hidden = !quest.reward;
    item.button.dataset.questAction = status === 'ready' ? 'claim' : 'quest';
    item.button.disabled = status !== 'available' && status !== 'ready';
    text(item.button, status === 'ready' ? 'Belohnung abholen' : status === 'available' ? 'Quest annehmen' : status === 'claimed' ? 'Abgeschlossen' : status === 'locked' ? 'Noch gesperrt' : 'In Arbeit');
    const target = quest.id === 'cartographer' && remaining.length ? '#' + remaining[0] : typeof quest.target === 'string' && /^#[A-Za-z0-9_-]+$/.test(quest.target) ? quest.target : destinations[quest.id] || '';
    item.target.hidden = status !== 'active' || !target;
    if (target) item.target.setAttribute('href', target);
    else item.target.removeAttribute('href');
    const targetLabel = quest.id === 'cartographer' && remaining.length ? 'Als Nächstes: ' + sceneNames[remaining[0]] + ' untersuchen' : quest.target && quest.target.charAt(0) !== '#' ? quest.target : 'Zum Quest-Ziel';
    text(item.target, targetLabel + ' →');
    item.target.setAttribute('aria-label', String(quest.title) + ': ' + targetLabel);
  }

  function buildSecret(secret, index) {
    const card = element('article', 'journal-card journal-secret panel', hosts.secrets);
    card.dataset.secretId = secret.id;
    card.id = 'journal-secret-' + secret.id;
    const title = element('h4', '', card);
    const status = element('span', 'journal-status', card);
    const story = element('p', 'journal-description', card);
    const details = element('details', 'journal-hint-disclosure', card);
    const summary = element('summary', '', details);
    text(summary, 'Hinweis anzeigen');
    const hint = element('p', 'journal-hint', details);
    const item = { card: card, title: title, status: status, story: story, details: details,
      summary: summary, hint: hint, index: index };
    secretViews.set(secret.id, item);
    return item;
  }
  function renderSecret(secret, index) {
    const item = secretViews.get(secret.id) || buildSecret(secret, index);
    item.card.dataset.discovered = String(!!secret.discovered);
    text(item.title, secret.discovered ? secret.title : 'Unbekanntes Signal ' + String(index + 1).padStart(2, '0'));
    text(item.status, secret.discovered ? 'Entdeckt' : 'Verborgen');
    text(item.story, secret.discovered ? secret.text : 'Ein verborgenes Signal wartet darauf, entschlüsselt zu werden.');
    text(item.hint, secret.hint);
    text(item.summary, secret.discovered ? 'Fundspur ansehen' : 'Hinweis anzeigen');
    item.details.hidden = !secret.hint;
  }
  function renderEggs(eggs) {
    const discovered = eggs.filter(function (egg) { return egg.discovered; });
    text(eggNote, discovered.length + ' / ' + eggs.length + ' Echos gefunden. In deinen Fundstücken verbergen sich Spuren zu weiteren Antworten.');
    eggs.forEach(function (egg) {
      let item = eggViews.get(egg.id);
      if (!egg.discovered) {
        if (item) { item.card.remove(); eggViews.delete(egg.id); }
        return;
      }
      if (!item) {
        const card = element('article', 'journal-card journal-egg panel', eggList);
        card.dataset.eggId = egg.id;
        item = { card: card, title: element('h4', '', card), story: element('p', 'journal-description', card) };
        eggViews.set(egg.id, item);
      }
      text(item.title, egg.title);
      text(item.story, egg.text);
    });
  }
  function renderLore(lore) {
    const ids = new Set(lore.map(function (entry) { return entry.id; }));
    loreViews.forEach(function (item, id) {
      if (!ids.has(id)) { item.card.remove(); loreViews.delete(id); }
    });
    lore.forEach(function (entry) {
      let item = loreViews.get(entry.id);
      if (!item) {
        const card = element('article', 'journal-card journal-lore', hosts.codex);
        card.dataset.loreId = entry.id;
        item = { card: card, title: element('h4', '', card), story: element('p', 'journal-description', card) };
        loreViews.set(entry.id, item);
      }
      text(item.title, entry.title);
      text(item.story, entry.text);
    });
    text(loreEmpty, lore.length ? 'Weitere Seiten öffnen sich durch Quests, Signale und Echos.' : 'Dein Kodex ist noch leer. Nimm deine erste Quest an und hole ihre Belohnung ab, um die Geschichte der Kammer zu lesen.');
  }
  function renderThemes(themes, active) {
    const container = document.getElementById('journal-themes');
    if (!container) return;
    container.classList.add('journal-theme-controls');
    themes.forEach(function (theme) {
      let item = themeViews.get(theme.id);
      if (!item) {
        const card = element('div', 'journal-theme-option', container);
        const button = element('button', '', card);
        button.type = 'button';
        button.id = 'theme-' + theme.id;
        button.dataset.theme = theme.id;
        const note = element('p', 'micro', card);
        note.id = 'theme-' + theme.id + '-note';
        button.setAttribute('aria-describedby', note.id);
        button.addEventListener('click', function () {
          if (journey(current).theme === theme.id) {
            receipt(feedback, { ok: true, message: 'Diese Signatur ist bereits aktiv.' });
            return;
          }
          act('theme', { id: theme.id }, feedback);
        });
        item = { card: card, button: button, note: note };
        themeViews.set(theme.id, item);
      }
      const selected = active === theme.id;
      text(item.button, theme.name + (selected ? ' · aktiv' : ''));
      item.button.disabled = !theme.unlocked;
      item.button.setAttribute('aria-pressed', String(selected));
      text(item.note, theme.unlocked ? 'Kosmetische Signatur · verändert die Akzentfarben.' : theme.id === 'aurora' ? 'Schließe die letzte Quest ab, um diese Signatur freizuschalten.' : 'Eine verborgene Frequenz trägt diese Signatur.');
    });
  }
  function render(state) {
    const previousHistory = current && current.history || [];
    const nextHistory = state.history || [];
    const previousId = previousHistory.length ? previousHistory[previousHistory.length - 1].id : 0;
    const nextId = nextHistory.length ? nextHistory[nextHistory.length - 1].id : 0;
    if (current && (state.tick < current.tick || nextId < previousId)) {
      document.querySelectorAll('.scene-discovery[data-discovery], #signal-feedback, #journal-message').forEach(function (node) {
        text(node, '');
        delete node.dataset.error;
      });
      const input = document.getElementById('signal-code');
      if (input) input.setAttribute('aria-invalid', 'false');
    }
    current = state;
    const record = journey(state);
    const quests = record.quests || [];
    const secrets = record.secrets || [];
    const eggs = record.eggs || [];
    quests.forEach(renderQuest);
    secrets.forEach(renderSecret);
    renderEggs(eggs);
    renderLore(record.lore || []);
    renderThemes(record.themes || [], record.theme);
    const claimed = Number.isInteger(record.claimedCount) ? record.claimedCount : quests.filter(function (quest) { return quest.status === 'claimed'; }).length;
    const found = Number.isInteger(record.secretCount) ? record.secretCount : secrets.filter(function (secret) { return secret.discovered; }).length;
    text(document.getElementById('journal-progress'), claimed + ' / ' + quests.length + ' Quests abgeschlossen · ' + found + ' / ' + secrets.length + ' Signale entdeckt');
    text(document.getElementById('journal-count'), claimed + '/' + quests.length);
    if (document.body) document.body.dataset.signalTheme = ['frost', 'ember', 'aurora'].includes(record.theme) ? record.theme : 'frost';
    document.querySelectorAll('.scene-inspect[data-inspect]').forEach(function (button) {
      const inspected = Array.isArray(record.inspected) && record.inspected.includes(button.dataset.inspect);
      button.dataset.inspected = String(inspected);
    });
  }

  window.CryoChronicle = {
    start: function (options) {
      if (api || !document.getElementById('journal')) return;
      api = options;
      feedback = document.getElementById('journal-message');
      panels = { quests: document.getElementById('journal-quests'), secrets: document.getElementById('journal-secrets'), codex: document.getElementById('journal-codex') };
      hosts = { quests: panels.quests, secrets: document.getElementById('journal-secret-list') || panels.secrets, codex: document.getElementById('journal-lore') || panels.codex };
      controls = Array.from(document.querySelectorAll('#journal-view-controls [data-journal-view]'));
      Object.keys(hosts).forEach(function (key) { if (hosts[key]) hosts[key].classList.add('journal-grid'); });
      controls.forEach(function (button) {
        button.type = 'button';
        button.addEventListener('click', function () { view(button.dataset.journalView); });
      });
      const echoSection = element('div', 'journal-echoes', panels.secrets);
      text(element('h4', '', echoSection), 'Echos der Kammer');
      eggNote = element('p', 'journal-empty', echoSection);
      eggList = element('div', 'journal-grid', echoSection);
      loreEmpty = element('p', 'journal-empty', hosts.codex);
      const form = document.getElementById('signal-form');
      const input = document.getElementById('signal-code');
      const signalFeedback = document.getElementById('signal-feedback');
      if (form && input) {
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          const result = act('signal', { code: input.value.trim() }, signalFeedback);
          input.setAttribute('aria-invalid', String(!!result && !result.ok && (!result.reason || result.reason === 'code')));
        });
        input.addEventListener('input', function () { input.setAttribute('aria-invalid', 'false'); });
      }
      document.querySelectorAll('.scene-inspect[data-inspect]').forEach(function (button) {
        button.addEventListener('click', function () {
          const local = Array.from(document.querySelectorAll('.scene-discovery[data-discovery]')).find(function (node) { return node.dataset.discovery === button.dataset.inspect; });
          act('inspect', { id: button.dataset.inspect }, local || feedback);
        });
      });
      view(selectedView);
      api.subscribe(render);
    }
  };
})();
