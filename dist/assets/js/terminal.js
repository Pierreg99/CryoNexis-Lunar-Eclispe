/* Terminal presentation and input validation; the simulation owns all mutations. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CryoTerminal = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const number = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const precise = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 6 });
  const interest = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const commands = Object.freeze({
    cryo: [1, 1, 'cryo unlock', 'cryo unlock', 'Alternative Schreibweise für unlock cryo. Lädt die Forschungsfähigkeiten bei aktivem Zugang.'],
    missions: [0, 0, 'missions', 'missions', 'Zeigt Forschungsfortschritt, Fähigkeiten und die nächsten Freischaltungen.'],
    observe: [0, 0, 'observe', 'observe', 'Erfasst die aktuelle Finsternisphase im Observatorium. Jede Phase kann einmal erfasst werden.'],
    calibrate: [1, 1, 'calibrate ID', 'calibrate CN-BOREALIS', 'Kalibriert im Resonanzlabor einen gebundenen Knoten mit Stärke mindestens 90 %. Benötigt zwei erfasste Phasen und eine gehaltene Position.'],
    decode: [0, 0, 'decode', 'decode', 'Entschlüsselt die Zeitspur im Archiv. Benötigt fünf erfasste Phasen, drei kalibrierte Knoten und Vault-Ertrag.'],
    unlock: [1, 1, 'unlock cryo', 'unlock cryo', 'Lädt das Observatorium und öffnet den Vault bis einschließlich 31.10.2026 UTC unabhängig von Phase, Bindungen und Stabilität. Guthabenlimits gelten weiter; reset entfernt die Freischaltung.'],
    help: [0, 1, 'help [Befehl]', 'help buy', 'Zeigt alle Befehle oder Hilfe für einen einzelnen Befehl.'],
    tasks: [0, 0, 'tasks', 'tasks', 'Zeigt aktuell erfüllte Aufgaben und konkrete nächste Schritte.'],
    status: [0, 0, 'status', 'status', 'Zeigt den aktuellen System- und Simulationszustand.'],
    nodes: [0, 0, 'nodes', 'nodes', 'Zeigt gültige Knoten-IDs, Preise, Bestände und Bindungen.'],
    phase: [0, 1, 'phase [1–5 oder Name]', 'phase 3', 'Ohne Argument lesen; 1 Kontakt, 2 Diamantring, 3 Korona, 4 Freisteller, 5 Reset. Manuelle Wechsel kosten Kohärenz.'],
    eclipse: [0, 0, 'eclipse', 'eclipse', 'Zeigt aktuelle Finsterniswerte aus derselben Simulation wie die Szenen.'],
    vault: [0, 0, 'vault', 'vault', 'Zeigt jede Zugangsbedingung, Guthaben und simulierten Ertrag.'],
    portfolio: [0, 0, 'portfolio', 'portfolio', 'Zeigt freies Guthaben, Positionen, Vault und bezahlte Handelsgebühren.'],
    history: [0, 0, 'history', 'history', 'Zeigt die letzten 20 gespeicherten Simulationsereignisse.'],
    clear: [0, 0, 'clear', 'clear', 'Leert nur die Terminal-Ausgabe. Dein Spielstand bleibt erhalten.'],
    buy: [2, 2, 'buy ID Menge', 'buy CN-ALPHA-01 2,5', 'Kauft Einheiten des Knotens. Abgezogen werden Kurswert, Slippage und Gebühr. Höchstens 1.000 Einheiten je Auftrag, sechs Nachkommastellen.'],
    sell: [2, 2, 'sell ID Menge', 'sell CN-ALPHA-01 0,5', 'Verkauft vorhandene Einheiten. Gutgeschrieben wird der Kurswert abzüglich Slippage und Gebühr. Höchstens 1.000 Einheiten je Auftrag, sechs Nachkommastellen.'],
    link: [1, 1, 'link ID', 'link CN-ALPHA-01', 'Bindet einen ungebundenen Knoten für 1.200 CNX. Stärke steigt bis zu 6 Punkte, Kohärenz sinkt um 1 Punkt.'],
    unlink: [1, 1, 'unlink ID', 'unlink CN-ALPHA-01', 'Löst die Bindung und gibt 400 CNX zurück. Das Vault-Fenster kann sich dadurch schließen.'],
    stabilize: [1, 1, 'stabilize ID', 'stabilize CN-ALPHA-01', 'Kostet 700 CNX; erhöht Stärke um bis zu 8 und Kohärenz um bis zu 7 Punkte.'],
    deposit: [1, 1, 'deposit Betrag', 'deposit 1000', 'Überträgt freies Guthaben in den offenen Vault. Beträge haben höchstens vier Nachkommastellen.'],
    withdraw: [1, 1, 'withdraw Betrag', 'withdraw 250', 'Überträgt Vault-Guthaben zurück ins freie Guthaben. Der Vault muss offen sein; höchstens vier Nachkommastellen.'],
    pause: [0, 0, 'pause', 'pause', 'Stoppt automatische Markttakte und Phasenwechsel. step bleibt verfügbar.'],
    resume: [0, 0, 'resume', 'resume', 'Gibt die automatische Zeit frei. Bei reduzierter Bewegung bleibt die Zeit trotzdem manuell.'],
    step: [0, 0, 'step', 'step', 'Berechnet fünf Simulationsminuten einschließlich Preisen und möglichem Vault-Ertrag. Funktioniert auch während einer Pause.'],
    reset: [0, 1, 'reset confirm', 'reset confirm', 'Löscht Käufe, Bindungen, Vault und Zeitspuren; startet mit 100.000 CNX. reset allein zeigt nur die Bestätigung an.']
  });
  const own = name => Object.prototype.hasOwnProperty.call(commands, name);
  function help(name) {
    if (!own(name)) return 'Für „' + name + '“ gibt es keinen Befehl. „help“ zeigt alle gültigen Befehle.';
    const item = commands[name];
    return 'HILFE / ' + name + '\n' + item[4] + '\nEingabe: ' + item[2] + '\nBeispiel: ' + item[3] +
      (/^(buy|sell|deposit|withdraw)$/.test(name) ? '\nDezimalkomma oder Dezimalpunkt verwenden, ohne Tausendertrennzeichen oder Exponentialschreibweise.' : '');
  }
  function tasks(state) {
    const bound = state.nodes.filter(node => node.bound).length;
    const unbound = state.nodes.find(node => !node.bound) || state.nodes[0];
    const lines = [
      [state.nodes.some(node => node.quantity > 0), 'Eine Knotenposition halten', 'buy CN-ALPHA-01 1 (Kosten prüfen mit nodes und portfolio)'],
      [bound >= 3, 'Drei Knoten binden (' + bound + '/3)', 'link ' + unbound.id + ' (1.200 CNX je Bindung)'],
      [state.phase === 2 || state.phase === 3, 'Korona oder Freisteller wählen', 'phase 3 (verbraucht Kohärenz)'],
      [state.stability >= 75 && state.coherence >= 35, 'Stabilität ≥75 % und Kohärenz ≥35 %', 'stabilize ' + state.nodes.slice().sort((a, b) => a.strength - b.strength)[0].id + ' (700 CNX)'],
      [state.vault.balance > 0, 'Guthaben im Vault halten', state.vault.open ? 'deposit 1000 (benötigt 1.000 CNX freies Guthaben)' : 'vault zeigt die noch fehlenden Zugangsbedingungen'],
      [state.vault.earned > 0, 'Simulierten Vault-Ertrag erhalten', state.vault.accruing ? 'step (fünf Simulationsminuten; sehr kleine Erträge können gerundet null sein)' : 'Zuerst das Vault-Fenster öffnen und Guthaben einlagern; dann step']
    ];
    return 'AUFGABEN / ' + lines.filter(line => line[0]).length + ' von ' + lines.length + ' aktuell erfüllt\n' +
      lines.map(line => (line[0] ? '✓ ' : '○ ') + line[1] + (line[0] ? '' : '\n  Nächster Schritt: ' + line[2])).join('\n') +
      '\nDer Stand folgt deinen aktuellen Positionen und Bedingungen; er vergibt keine zusätzlichen Belohnungen. Alle CNX sind fiktiv.' +
      (state.vault.cryoUnlocked || state.expedition.observed.length ? '\nFORSCHUNG: ' + state.expedition.observed.length + '/5 Phasen · ' + state.expedition.calibrated.length + '/6 Resonanzbaken · ' + (state.expedition.decoded ? 'Zeitspur entschlüsselt' : 'Zeitspur offen') + '\nNächster Schritt: missions · observe · calibrate ID · decode' : '\nWeitere Fähigkeiten: unlock cryo lädt das Observatorium.');
  }
  function outcome(command, id, result, before, after, trade, reduced) {
    const node = after.nodes.find(item => item.id === id);
    const oldNode = before.nodes.find(item => item.id === id);
    const cash = 'Freies Guthaben: ' + interest.format(after.cash) + ' CNX';
    if (!result.ok) return 'NICHT AUSGEFÜHRT\n' + result.message + '\n' + cash +
      (node ? '\nVerfügbarer Bestand ' + id + ': ' + precise.format(node.quantity) + ' Einheiten' : '') +
      (/^(deposit|withdraw)$/.test(command) ? '\nVault-Guthaben: ' + interest.format(after.vault.balance) + ' CNX. „vault“ zeigt alle Zugangsbedingungen.' : '') +
      '\nNächster Schritt: help ' + command + (['buy', 'sell', 'link', 'unlink', 'stabilize'].includes(command) ? ' · nodes zeigt gültige IDs; portfolio zeigt deine verfügbaren Mittel.' : '');
    const lines = ['ERLEDIGT'];
    if (command === 'buy' || command === 'sell') {
      lines.push(precise.format(trade.quantity) + ' Einheiten ' + id + (command === 'buy' ? ' gekauft.' : ' verkauft.'),
        'Kurswert: ' + interest.format(trade.gross) + ' CNX · Slippage: ' + interest.format(trade.slippage) + ' CNX · Gebühr: ' + interest.format(trade.fee) + ' CNX',
        (command === 'buy' ? 'Gesamtabzug: ' + interest.format(before.cash - after.cash) : 'Nettoerlös: ' + interest.format(after.cash - before.cash)) + ' CNX',
        'Bestand: ' + precise.format(node.quantity) + ' Einheiten', cash, 'Nächster Schritt: portfolio oder tasks');
    } else if (['link', 'unlink', 'stabilize'].includes(command)) {
      lines.push(id + (command === 'link' ? ' gebunden.' : command === 'unlink' ? ' gelöst.' : ' stabilisiert.'),
        'Knotenstärke: ' + number.format(oldNode.strength) + ' → ' + number.format(node.strength) + ' %',
        'Kohärenz: ' + number.format(before.coherence) + ' → ' + number.format(after.coherence) + ' %',
        'Stabilität: ' + number.format(before.stability) + ' → ' + number.format(after.stability) + ' %',
        'Guthabenänderung: ' + interest.format(after.cash - before.cash) + ' CNX', cash, 'Nächster Schritt: vault prüft deinen Zugang.');
    } else {
      lines.push(result.message);
      if (command === 'phase') lines.push('Aktive Phase: ' + (after.phase + 1) + ' / ' + after.phaseName,
        'Kohärenz: ' + number.format(before.coherence) + ' → ' + number.format(after.coherence) + ' %', 'Nächster Schritt: eclipse oder vault');
      if (command === 'deposit' || command === 'withdraw' || command === 'step') lines.push(cash,
        'Vault-Guthaben: ' + interest.format(before.vault.balance) + ' → ' + interest.format(after.vault.balance) + ' CNX',
        'Ertrag dieses Vorgangs: ' + interest.format(after.vault.earned - before.vault.earned) + ' CNX', 'Nächster Schritt: vault oder history');
      if (command === 'step') lines.push('Simulationszeit: ' + before.minutes + ' → ' + after.minutes + ' Minuten');
      if (command === 'pause' || command === 'resume' || command === 'step' || command === 'reset') lines.push(
        'Zeitsteuerung: ' + (after.paused ? 'PAUSIERT — step bleibt möglich.' : reduced ? 'MANUELL — reduzierte Bewegung ist aktiv; nutze step.' : 'AUTOMATISCH — Markttakt alle 2,2 s, Phasenwechsel alle 5,2 s.'));
      if (command === 'reset') lines.push(cash, 'Nächster Schritt: tasks zeigt deinen neuen Aufgabenstand.');
    }
    if (['link', 'unlink', 'stabilize', 'phase', 'deposit', 'withdraw', 'step'].includes(command)) lines.push('Vault-Fenster: ' + (after.vault.open ? 'OFFEN' : 'GESCHLOSSEN'));
    return lines.join('\n');
  }
  function numeric(raw) {
    const value = String(raw).trim().replace(',', '.');
    return /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : NaN;
  }
  function run(raw, api) {
    const parts = String(raw).trim().split(/\s+/), command = parts[0].toLowerCase();
    if (!command) return null;
    if (!own(command)) return { ok: false, text: 'Unbekannter Befehl: „' + raw.trim() + '“. Mit „help“ findest du alle Befehle.' };
    const spec = commands[command], count = parts.length - 1;
    if (count < spec[0] || count > spec[1]) return { ok: false, text: 'NICHT AUSGEFÜHRT — Bitte die Argumente prüfen.\n' + help(command) };
    if (command === 'clear') return { ok: true, clear: true, text: '' };
    const state = api.snapshot(), phaseIndex = state.phase, phases = api.phases;
    const builtScenes = { size: api.sceneCount || 0 }, motion = { matches: !!api.reduced };
    const action = api.action, selectPhase = api.selectPhase, announce = value => value;
    const output = [];
    let ok = true;
    function appendTerminal(text, kind) { output.push(text); if (kind === 'error') ok = false; }
    const id = (parts[1] || '').toUpperCase();
    const trade = command === 'buy' || command === 'sell' ? api.quote(command, id, numeric(parts[2] || '')) : null;
    let result;
    switch (command) {
      case 'help':
        appendTerminal(parts[1] ? help(parts[1].toLowerCase()) : 'unlock cryo / cryo unlock → Forschungsfähigkeiten laden\nmissions / observe / calibrate ID / decode → Projektsphäre erschließen\nhelp BEFEHL → Erklärung und Beispiel\ntasks → Aufgabenstand und nächste Schritte\nhelp / status / nodes / phase / eclipse / vault / clear\nportfolio → Guthaben, Positionen, Gebühren\nhistory → Deine Zeitspuren\nphase 1..5 → Phase wählen (kostet Kohärenz)\nbuy ID Menge / sell ID Menge → Handeln\nlink ID / unlink ID → Zeitbindung (1.200 / +400 CNX)\nstabilize ID → Knoten stärken (700 CNX)\ndeposit Betrag / withdraw Betrag → Vault\npause / resume / step → Simulationszeit steuern\nreset confirm → Lokalen Fortschritt löschen\nBeispiel: buy CN-ALPHA-01 2,5\nAlle Werte sind fiktiv, lokal und deterministisch.');
        break;
      case 'missions': {
        const research = state.expedition;
        appendTerminal('FORSCHUNG / ' + (state.vault.cryoUnlocked ? 'CRYO AKTIV' : 'ZUGANG INAKTIV · unlock cryo') +
          '\nObservatorium: ' + research.observed.length + '/5 Phasen erfasst · phase 1..5, dann observe' +
          '\nResonanzlabor: ' + (research.networkUnlocked ? 'FREIGESCHALTET' : 'zwei Phasen erfassen und eine Position halten') + ' · ' + research.calibrated.length + '/6 Knoten kalibriert' +
          '\nZeitarchiv: ' + (research.archiveUnlocked ? 'FREIGESCHALTET' : 'fünf Phasen, drei Kalibrierungen und Vault-Ertrag benötigt') +
          '\nZeitspur: ' + (research.decoded ? 'ENTSCHLÜSSELT' : 'decode nach Archiv-Freischaltung') + '\nForschungsfortschritt bleibt gespeichert; neue Aktionen benötigen aktiven CRYO-Zugang.');
        break;
      }
      case 'observe': case 'decode': result = action(command); break;
      case 'calibrate': result = action(command, { id: id }); break;
      case 'cryo': result = parts[1].toLowerCase() === 'unlock' ? action('unlock', { key: 'cryo' }) : { ok: false, message: 'Verwende cryo unlock.' }; break;
      case 'tasks':
        appendTerminal(tasks(state)); break;
      case 'status':
        appendTerminal('KAMMER 04 · LOKALE SIMULATION\nUTC ' + new Date().toISOString().slice(11, 19) + '\nSzenen: ' + builtScenes.size + '/6 · Phase: ' + state.phaseName + '\nKerntemperatur: ' + number.format(state.visual.temperature) + ' °C\nStabilität: ' + number.format(state.stability) + ' % · Kohärenz: ' + number.format(state.coherence) + ' %\nSimulationszeit: ' + state.minutes + ' Minuten · Zyklus ' + state.cycle + '\nNetzwerk: lokal · Marktdaten: simuliert · ' + (state.paused ? 'PAUSIERT' : motion.matches ? 'MANUELLE ZEIT' : 'AKTIV'));
        break;
      case 'nodes':
        appendTerminal(state.nodes.map(function (node) { return node.id + ' / ' + node.sector + ' / ' + number.format(node.price) + ' CNX / Stärke ' + number.format(node.strength) + ' % / Bestand ' + precise.format(node.quantity) + (node.bound ? ' / GEBUNDEN' : ''); }).join('\n'));
        break;
      case 'phase':
        if (parts.length > 1) {
          const index = /^[1-5]$/.test(parts[1]) ? Number(parts[1]) - 1 : phases.findIndex(function (phase) { return phase.name.toLowerCase() === parts[1].toLowerCase(); });
          result = index >= 0 ? selectPhase(index, true) : announce({ ok: false, message: 'Phase als Zahl 1–5 oder Phasenname angeben.' });
        } else appendTerminal('Aktive Phase: ' + state.phaseName + ' / ' + phases[phaseIndex].time + '\n' + phases.map(function (phase, index) { return (index === phaseIndex ? '› ' : '  ') + (index + 1) + ' ' + phase.name + ' ' + phase.time + ' · Wechselkosten ' + state.phaseCosts[index] + ' Kohärenzpunkte'; }).join('\n') + '\nManuelle Wechsel verbrauchen Kohärenz; automatische Wechsel nicht.');
        break;
      case 'eclipse':
        appendTerminal('TOTALE SONNENFINSTERNIS / ' + state.phaseName + '\nAktuelle Korona: ' + number.format(state.visual.corona * 100) + ' %\nKalibrierte Totalität: 99,97 % · Brechungsindex: 1,3091\nKristallschollen: 46 · Kammer: 04\nStrahlungsfluss: ' + number.format(state.visual.flux * 100) + ' % · Kern: ' + number.format(state.visual.temperature) + ' °C');
        break;
      case 'vault':
        appendTerminal('VAULT / ' + (state.vault.open ? 'ZUGRIFF GEWÄHRT' : 'ZEITFENSTER GESPERRT') + '\n' + state.vault.conditions.map(function (condition) { return (condition.met ? '✓ ' : '○ ') + condition.label; }).join('\n') + '\nGuthaben ' + interest.format(state.vault.balance) + ' CNX · Ertrag ' + interest.format(state.vault.earned) + ' CNX\nSimulierter Jahreszins ' + number.format(state.vault.apr) + ' % · nur während des offenen Fensters\nLokale Simulation. Keine Wallet erforderlich.');
        break;
      case 'portfolio':
        appendTerminal('VERMÖGEN ' + number.format(state.equity) + ' CNX\nVerfügbar ' + number.format(state.cash) + ' CNX · Positionen ' + number.format(state.portfolioValue) + ' CNX · Vault ' + interest.format(state.vault.balance) + ' CNX\nHandelsgebühren bisher ' + interest.format(state.feesPaid) + ' CNX\n' + state.nodes.map(function (node) { return node.id + ': ' + precise.format(node.quantity) + ' / ' + number.format(node.positionValue) + ' CNX'; }).join('\n'));
        break;
      case 'history':
        appendTerminal(state.history.length ? state.history.slice(-20).map(function (entry) { return 'T+' + entry.tick * 5 + ' MIN / ' + phases[entry.phase].name + ' / ' + entry.text; }).join('\n') : 'Noch keine Zeitspuren. Deine Entscheidungen schreiben die Geschichte.');
        break;
      case 'unlock':
        result = action('unlock', { key: parts[1] }); break;
      case 'buy': case 'sell':
        result = action(command, { id: id, quantity: numeric(parts[2] || '') }); break;
      case 'link': case 'unlink': case 'stabilize':
        result = action(command, { id: id }); break;
      case 'deposit': case 'withdraw':
        result = action(command, { amount: numeric(parts[1] || '') }); break;
      case 'pause': case 'resume': case 'step':
        result = action(command); break;
      case 'reset':
        result = parts[1] === 'confirm' ? action('reset') : announce({ ok: false, message: '„reset confirm“ löscht alle lokalen Käufe, Bindungen und Zeitspuren und startet mit 100.000 CNX.' }); break;
      default:
        appendTerminal('Unbekannter Befehl: „' + raw.trim() + '“. Mit „help“ findest du alle Befehle.', 'error');
    }
    if (result) appendTerminal(outcome(command, id, result, state, api.snapshot(), trade, api.reduced), result.ok ? 'response' : 'error');
    if (command === 'help' && parts[1] && !own(parts[1].toLowerCase())) ok = false;
    return { ok: ok, text: output.join('\n') };
  }
  return Object.freeze({ run: run, help: help, commands: Object.freeze(Object.keys(commands)) });
});
