(function () {
  'use strict';
  const start = document.getElementById('zen-start');
  const panel = document.getElementById('zen-controls');
  const label = document.getElementById('zen-status');
  const toggle = document.getElementById('zen-pause');
  const sections = Array.from(document.querySelectorAll('main > .section'));
  const names = ['Kryo-Kammer', 'Finsternis', 'Eis-Nexus', 'Kristallfeld', 'Vault', 'Nebel'];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let active = false, paused = false, index = 0, timer = 0, position = 0;
  let previousFocus;
  let inertElements = [];
  function schedule() {
    clearTimeout(timer);
    timer = 0;
    if (active && !paused && !motion.matches && !document.hidden) {
      timer = setTimeout(function () { visit(index + 1); }, 18000);
    }
  }
  function render() {
    label.textContent = (index + 1) + '/6 · ' + names[index] + ' · ' +
      (motion.matches ? 'Standbilder · manuell weiter' : paused ? 'Rundreise pausiert' : 'Wechsel alle 18 Sekunden');
    toggle.textContent = paused ? 'Fortsetzen' : 'Pause';
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.disabled = motion.matches;
  }
  function visit(next) {
    index = (next + sections.length) % sections.length;
    sections[index].scrollIntoView({ behavior: motion.matches ? 'instant' : 'smooth', block: 'start' });
    render();
    schedule();
  }
  function stop() {
    if (!active) return;
    active = false;
    clearTimeout(timer);
    timer = 0;
    document.body.classList.remove('astro-zen');
    inertElements.forEach(function (entry) { entry.element.inert = entry.value; });
    inertElements = [];
    panel.hidden = true;
    start.setAttribute('aria-expanded', 'false');
    window.scrollTo({ top: position, behavior: 'instant' });
    if (previousFocus && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
  }
  start.addEventListener('click', function () {
    if (active) return;
    position = window.scrollY;
    previousFocus = document.activeElement;
    index = sections.reduce(function (best, section, i) {
      return Math.abs(section.getBoundingClientRect().top) < Math.abs(sections[best].getBoundingClientRect().top) ? i : best;
    }, 0);
    active = true;
    paused = motion.matches;
    inertElements = Array.from(document.querySelectorAll('main, .hud, .skip, #zen-start')).map(function (element) {
      const entry = { element: element, value: element.inert };
      element.inert = true;
      return entry;
    });
    document.body.classList.add('astro-zen');
    panel.hidden = false;
    start.setAttribute('aria-expanded', 'true');
    visit(index);
    document.getElementById('zen-stop').focus({ preventScroll: true });
  });
  toggle.addEventListener('click', function () { paused = !paused; render(); schedule(); });
  document.getElementById('zen-next').addEventListener('click', function () { visit(index + 1); });
  document.getElementById('zen-prev').addEventListener('click', function () { visit(index - 1); });
  document.getElementById('zen-stop').addEventListener('click', stop);
  document.addEventListener('keydown', function (event) {
    if (active && event.key === 'Escape') { event.preventDefault(); stop(); }
  });
  document.addEventListener('visibilitychange', schedule);
  motion.addEventListener('change', function () {
    if (!active) return;
    if (motion.matches) paused = true;
    render();
    schedule();
  });
  window.addEventListener('pagehide', stop);
})();
