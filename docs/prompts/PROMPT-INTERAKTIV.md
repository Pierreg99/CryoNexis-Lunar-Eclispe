> **Archivierte Fremdvorlage — Versionsversatz bestätigt.**
> Dieser Prompt beschreibt nicht den Repository-Stand `acc5ff9` oder `b314186`.
> Phase und Terminal steuern die vorhandene Simulation bereits; die Engine hält Szenen intern vor.
> Die genannten Zeilenanker und `PROMPT.md`-Verweise passen nicht zu diesem Projekt.
> Der nachfolgende Originaltext ist als Referenz erhalten und kein ungeprüft auszuführender Implementierungsauftrag.

---

# CRYONEXUS — Lunar Eclipse · Aufgabenlogik interaktiv machen

> Kopierfertiger Auftrag für einen Coding-Agenten (ChatGPT/Codex, Claude Code, Cursor, OpenCode o. ä.).
> **Voraussetzung:** der vollständige aktuelle Quellcode von `dist/` (siehe §0).
> Ziel: aus einer beeindruckenden Animation eine **Spielmechanik**, in der jede
> Nutzereingabe sichtbare Folgen im 3D-Raum hat.

---

## 0. ARBEITSGRUNDLAGE (zwingend)

Du bekommst **nicht** den bestehenden Source im Chat. Du arbeitest gegen ein
lokales Verzeichnis mit exakt diesem Stand:

```
dist/
├── index.html                          253 Zeilen
└── assets/
    ├── css/main.css                    816 Zeilen, 20 Blöcke
    ├── js/scenes.js                    906 Zeilen, 6 Szenen
    ├── js/app.js                       424 Zeilen, 2D-Layer
    └── vendor/
        ├── three.min.js                Three.js r138, MIT
        └── cinema_engine.js            514 Zeilen, AGI3HERMES v4
```

**Bevor du eine Zeile schreibst**, lies diese vier Stellen vollständig — sie
sind der Vertrag, den du erweitern musst, nicht ersetzen:

| Datei | Zeilen | Was dort steht |
|---|---|---|
| `scenes.js` | 135, 257, 464, 589, 669, 773 | die 6× `C.boot(canvas, …)`-Aufrufe |
| `scenes.js` | ~40–130 | GLSL-Chunks `ICE_VERT` / `ICE_FRAG` + `iceMaterial(T, opts)` |
| `app.js` | 264–268 | `setPhase(i)` — die Phasenlogik |
| `app.js` | 186–225 | `REPLIES` + `terminal()` — die Befehlsverarbeitung |
| `vendor/cinema_engine.js` | 432–514 | `boot()` und `window.AGI3_CINEMA` |

**Kein Neuaufbau.** Alle Schwellen, Konstanten, Farben und Shaker bleiben.
Du fügst hinzu, du überschreibst nicht.

---

## 1. DIAGNOSE — was heute tot ist

Drei Befunde, alle verifiziert. Daran arbeitest du:

1. **`setPhase(i)` (`app.js:264`) steuert ausschließlich CSS.** Sie togglet
   `.phase.is-active`. Kein einziger 3D-Parameter ändert sich. Die Phasen-Zeile
   ist ein Schaufenster ohne Wirkung.
2. **Der Rückgabewert von `C.boot()` wird verworfen** (6 Stellen in `scenes.js`).
   Das `refs`-Objekt (Schollen, Torus, Plasma, Krater, 6000 Motes) existiert,
   aber es gibt keine Registry — von außen ist **keine** Szene erreichbar.
3. **Das Terminal liest, es handelt nicht.** `REPLIES` sind statische
   Textarrays. Es gibt keinen Befehl, der irgendetwas im 3D-Raum verändert.

Zusätzlich: das einzige Custom-Event (`cryonexus:scene`, `app.js:403`) feuert
nach **außen** und nur beim Build. Es gibt keinen Kanal nach **innen**.

---

## 2. HARTES BUDGET

Gilt unverändert, es wird nicht ausgehandelt:

| Limit | Wert |
|---|---|
| Neue externe Abhängigkeiten | **null** — kein CDN, kein npm, kein Framework |
| Payload gesamt | **< 1,4 MB** (aktuell 1,19 MB) |
| WebGL-Kontexte gleichzeitig | **max. 2** |
| Frames | **60 fps** bei sichtbarer Szene |
| Neue Sprachabhängigkeit | keine — Vanilla ES2020 reicht |
| `console.warn` / `console.error` | **null**, auch im Fehlerpfad |
| Interne Kommentare | **Englisch**, Oberfläche **Deutsch** |

---

## 3. ZIEL 1 — SZENEN-REGISTRY (`scenes.js`)

Der Rückgabewert von `boot()` darf nicht mehr ins Nichts fallen.

```js
// Neu, direkt nach den geteilten Chunks, vor Szene 1
const REGISTRY = Object.create(null);

function register(id, handle) {
  REGISTRY[id] = handle;
  document.dispatchEvent(new CustomEvent('cryonexus:scene', {
    detail: { id, handle },
  }));
  return handle;
}

function get(id) {
  return REGISTRY[id] || null;
}

// Zugriff aus Konsole/anderen Modulen
window.CRYO = {
  scenes: get,
  ids: () => Object.keys(REGISTRY),
  get phase() { return STATE.phase; },
  setPhase, // §5
  ...STATE,
};
```

**Jede** der 6 Szenen übergibt ihr `boot()`-Ergebnis an `register()`:

```js
register('nexus', C.boot(canvas, ({ T: T3, scene, camera }) => {
  // … unveränderter Bestand …
}, (ctx) => { /* … unverändert … */ }, { fov: 42, clear: 0x03060d }));
```

Die 6 IDs, exakt so benannt, weil `index.html` die Canvas-IDs schon trägt:

| `id` | Canvas | Sektion |
|---|---|---|
| `chamber` | `cn-chamber` | `#chamber` |
| `eclipse` | `cn-eclipse` | `#eclipse` |
| `nexus` | `cn-nexus` | `#ice-ring` |
| `crystal` | `cn-crystal` | `#nodes` |
| `vault` | `cn-vault` | `#terminal` |
| `void` | `cn-void` | `#void` |

**Pitfall (bestehende Regel, `PROMPT.md` §8.7):** die Szenen-`IntersectionObserver`
dürfen sich **nicht** selbst `unobserve`-n. Das Registry ersetzt daran nichts.

---

## 4. ZIEL 2 — AUFGABEN-STATE (`app.js`, neu)

Eine flache, serialisierbare State-Instanz. Kein Framework, kein Proxy-Zirkus.

```js
const STATE = {
  phase: 0,          // 0..4, Indizes in PHASES
  phaseProgress: 0,  // 0..1, Fortschritt in der aktuellen Phase
  claimed: [],       // Node-IDs, die der Nutzer bereits geöffnet hat
  executed: [],      // Terminal-Befehle, die bereits liefen
  stability: 0.68,   // 0..1, startet bei 0.68 und reagiert auf Aktionen
  freeze: false,     // true = Phase eingefroren
};
```

**Ein Bus, beide Richtungen.** Jede Mutation feuert ein Event, jede Szene
subscribed sich selbst — die Szene muss nie wissen, wer den Button gedrückt hat:

```js
function set(patch, reason) {
  Object.assign(STATE, patch);
  document.dispatchEvent(new CustomEvent('cryonexus:state', {
    detail: { patch, state: STATE, reason },
  }));
}
```

`set()` ist die **einzige** Schreibstelle. Kein `STATE.x =` außerhalb von `set()`.

---

## 5. ZIEL 3 — PHASE WIRD ZUM TREIBER

`setPhase()` war CSS. Jetzt ist es ein Parametervektor auf die Szenen.

```js
// PRO Phase i: [Korona-Stärke, Schollen-Drift, Kammer-Shake, Vault-Frei, Void-Warp]
const PHASE_MATRIX = [
  { corona: 0.25, drift: 0.30, shake: 0.00, vault: 0.00, warp: 0.20 }, // Kontakt
  { corona: 1.00, drift: 1.00, shake: 0.35, vault: 0.55, warp: 0.40 }, // Diamantring
  { corona: 0.85, drift: 0.45, shake: 0.20, vault: 0.85, warp: 0.85 }, // Korona
  { corona: 0.40, drift: 0.15, shake: 0.05, vault: 1.00, warp: 0.30 }, // Freisteller
  { corona: 0.05, drift: 0.05, shake: 0.00, vault: 0.10, warp: 0.10 }, // Reset
];
```

**Jede Szene abonniert selbst.** Innerhalb des jeweiligen `onUpdate`, ohne
zusätzlichen Renderloop:

```js
// z. B. in der eclipse-Szene
let cx = 0, phaseDrift = 0;
onState(({ state, patch }) => {
  const p = PHASE_MATRIX[state.phase] || PHASE_MATRIX[0];
  cx = p.corona;                       // Zielwert, wird geglättet
  if (patch && patch.phase) phaseDrift = 1;  // Phasenwechsel = Kick
}, refs);

// im onUpdate-Loop:
cx += (PHASE_MATRIX[STATE.phase].corona - cx) * Math.min(1, dt * 2.4);
refs.grp.scale.setScalar(1 + cx * 0.14);
refs.coronaBack.material.uniforms.uBass.value = A.bands.bass * cx;
phaseDrift *= 0.94;                    // Kick klingt aus
```

**Mindestens diese Zuordnungen** — jede Szene muss auf mindestens einen
Phasenwert reagieren, sonst ist sie Dekoration:

| Szene | Reagiert auf |
|---|---|
| `eclipse` | `corona` (Skalierung + Uniform), `shake` (Kamera-Offset, gedämpft) |
| `nexus` | `drift` (Umlaufgeschwindigkeit der 46 Schollen), `corona` (Puls-Frequenz) |
| `chamber` | `shake` (Shell-Rotation + Kamera), `warp` (Frost-Mote-Größe) |
| `vault` | `vault` (Box-Gitter-Spread + Spaltenfrequenz, **0 = eingefroren**) |
| `crystal` | `drift` (Kegelwachstum), `stability` (Höhe des Gitter-Floors) |
| `void` | `warp` (Oktaven-Amplitude), `phaseProgress` (Farbtemperatur) |

**Phasen-Automatik pausiert**, sobald der Nutzer manuell wählt. 8 s ohne
Klick → zurück in die Automatik. `freeze` stoppt den Auto-Advance hart.

---

## 6. ZIEL 4 — TERMINAL HANDELT

`REPLIES` wird von Textarrays zu **Funktionen mit Rückgabewert**.

```js
const REPLIES = {
  help: () => [/* … bestehende Hilfe-Zeilen … */],

  phase: () => {
    const p = PHASES[STATE.phase];
    set({ freeze: true }, 'term:phase');          // eingefroren, Auto-Stopp
    return [
      'Phase ' + p.idx + ' → ' + p.name,
      'Uhr ' + p.time + ' · Stabilität ' + (STATE.stability * 100).toFixed(1) + '%',
      '  → Zeitlinie angehalten. "resume" zum Fortsetzen.',
    ];
  },

  'phase 3': () => { set({ phase: 3, freeze: true }, 'term:phase3'); return ['Korona aktiv.']; },

  freeze: () => { set({ freeze: true }, 'term:freeze'); return ['Zeitlinie eingefroren.']; },
  resume: () => { set({ freeze: false }, 'term:resume'); return ['Zeitlinie läuft.']; },

  claim: (args) => {
    const id = String(args[0] || '').toUpperCase();
    const n = NODES.find((x) => x.id === id);
    if (!n) return ['  Unbekannter Knoten. "nodes" listet alle.', 'err'];
    if (STATE.claimed.includes(id)) return ['  ' + id + ' bereits beansprucht.', 'warn'];
    set({ claimed: STATE.claimed.concat(id), stability: clamp01(STATE.stability + 0.06) }, 'claim');
    return ['  ' + id + ' beansprucht. Stabilität +6%.', 'ok'];
  },

  nodes: () => NODES.map((n) => '  ' + n.id + '  ' + n.val.toFixed(2) +
                              (STATE.claimed.includes(n.id) ? '  [beansprucht]' : '')),

  vault: () => {
    set({ stability: clamp01(STATE.stability - 0.11) }, 'term:vault');
    return ['  Vault-Zugriff protokolliert. Stabilität −11%.', 'warn'];
  },

  status: () => ['  Kammer 04 · −268 °C',
                 '  Stabilität ' + (STATE.stability * 100).toFixed(1) + '%',
                 '  Phase ' + PHASES[STATE.phase].name +
                 (STATE.freeze ? ' (EINGEFROREN)' : ''),
                 '  Beansprucht ' + STATE.claimed.length + '/6',
                 '  Restlauf ∞'],

  eclipse: () => [/* … bestehende Zeilen … */],
  clear:  () => ['__CLEAR__', 'dim'],
};
```

**Pflicht:** `help`, `status`, `nodes`, `phase`, `eclipse`, `vault`, `clear`
funktionieren weiterhin **exakt wie bisher** — es kommen Befehle dazu, keine
werden entfernt oder umbenannt. Jeder Befehl landet in `STATE.executed`.

**Jeder erfolgreiche Befehl verändert die Kammer.** `status` schreibt nichts,
sonst wird die Anzeige zur Totemschilder. Setze einen Guard:
```js
if (RESULT_MUTATES.has(cmd)) set({ /* … */ });
```

---

## 7. ZIEL 5 — NODES WIRKEN (`app.js:93`)

Der Detail-Aufklapper (`toggle`) wird zur Aktion:

```js
const toggle = () => {
  const open = el.classList.toggle('is-open');
  el.setAttribute('aria-expanded', open ? 'true' : 'false');
  const fill = $('[data-fill="' + idx + '"]', el);
  if (fill) fill.style.width = open ? '100%' : (30 + (idx * 11) % 60) + '%';
  if (open) set({ claimed: uniq(STATE.claimed.concat(n.id)) }, 'node:' + n.id);
};
```

**Reaktion der 3D-Szenen auf jeden geöffneten Knoten:**
- `nexus`: die zugehörige Scholle leuchtet auf (`emissiveIntensity` +0.8, 2 s Abklingen)
- `chamber`: `stability` → Helligkeit des Zentrallichts
- `crystal`: `stability` → Höhe des Gitter-Floors (Skalierung auf `0.4 … 1.0`)

---

## 8. ZIEL 6 — STABILITÄT ALS SCHLEIFE

`stability` ist der Kreis, der alle sechs Szenen verbindet. Er bewegt sich
**nur** durch Nutzerhandlungen, plus ein sehr langsames Altern von selbst:

```js
// in app.js, getaktet auf 1 Hz, additiv statt multiplikativ
setInterval(() => {
  const drift = Math.sin(Date.now() / 9000) * 0.004;   // ±0.4 %, kaum sichtbar
  set({ stability: clamp01(STATE.stability + drift) }, 'decay');
}, 1000);
```

Verliert der Nutzer die Aufmerksamkeit, sackt die Stabilität sichtbar ab
(Restlauf-Anzeige und Kamera-Fresnel reagieren). Das ist der Druck, der
`claim` wertvoll macht.

---

## 9. ABNAHME-KRITERIEN

Zusätzlich zu **allen** Kriterien aus `PROMPT.md` §7 gilt:

- [ ] `CRYO.scenes('nexus')` liefert in der Konsole ein Objekt mit `.refs` — **kein** `null`
- [ ] Klick auf eine Phase → `nexus`-Schollen drehen sich **sichtbar** anders, nicht nur die CSS-Klasse
- [ ] Terminal `phase 3` friert die Automatik ein, `resume` lässt sie weiterlaufen
- [ ] Terminal `claim CN-ALPHA-01` erhöht `status` um 6 % — zweimal geklickt bleibt es bei +6 %
- [ ] Terminal `vault` **senkt** die Stabilität, `claim` **höht** sie — beides sichtbar in Szene `crystal`
- [ ] Jeder der 6 Canvas reagiert auf mindestens einen Phasenwert — kein „toter" Canvas
- [ ] `freeze` → `setInterval` in `phases()` ruft `setPhase` nicht mehr auf
- [ ] `clear` leert das Terminal, `help`/`status`/`nodes`/`eclipse`/`vault`/`phase` unverändert nutzbar
- [ ] Kein einziger 3D-Kontext-Chunk verliert seine Pausier-Logik (§8.7 der Basis-Prompt)
- [ ] 6 Szenen + laufende `setInterval`s bleiben bei **60 fps** — `IntersectionObserver` darf nicht umgangen werden
- [ ] `prefers-reduced-motion: reduce` → Zustandsänderungen bleiben **funktional**, nur ohne Animation
- [ ] Tastatur: Phasen und Terminal vollständig per `Tab` bedienbar, `:focus-visible` sichtbar
- [ ] Konsole bleibt **sauber** — null Warnungen, null Fehler, null 404s

---

## 10. STOLPERFALLEN

1. **`set()` ist die einzige Schreibstelle.** Wer direkt in `STATE` schreibt,
   erzeugt einen Zustand, den keine Szene sieht. Das ist der häufigste Bug.
2. **Nicht in Events schreiben.** Ein `cryonexus:state`-Handler, der wieder
   `set()` aufruft, erzeugt eine Endlosschleife. Reagiere auf Änderungen, nicht
   auf das eigene Echo.
3. **Glättung statt Sprung.** Phasenwerte sind Zielwerte — pro Frame mit
   `dt`-Ramp interpolieren, sonst ruckt die Kamera.
4. **`freeze` muss den Auto-Advance hart stoppen**, nicht nur die Anzeige.
   Ein `setInterval` ohne Guard ist ein Tick pro Sekunde zurück im Automatikmodus.
5. **`refs` nicht cachen, sondern im `onUpdate` lesen.** Ein gecachtes
   `refs` überlebt keinen Szenen-Rebuild (Resize, Lazy-Boot-Race).
6. **Phase 0 und 4 sind nahezu Null** (`corona 0.25` / `0.05`). Teste beide
   Enden der Matrix — sie brechen die Shaker am häufigsten.
7. **Subscribes aufräumen.** Jeder `addEventListener` auf `cryonexus:state`
   braucht ein Gegenstück, sonst wächst der Handler-Stack bei jedem Resize.
8. **Verdopple die Handler nicht.** `terminal()` läuft einmal — ein zweiter
   `keydown`-Listener verdoppelt alle Befehlsausgaben.