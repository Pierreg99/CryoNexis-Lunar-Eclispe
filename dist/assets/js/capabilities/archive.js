(function () {
  'use strict';
  CryoExpedition.register('archive', { mount: function (api) {
    const progress = api.element('p', '', api.container);
    const decode = api.button(api.container, 'Zeitspur 004 entschlüsseln', function () { api.command('decode'); });
    const dossier = api.element('div', '', api.container); dossier.hidden = true;
    api.element('h4', 'ZEITSPUR 004 / DIE RESONANZ', dossier);
    api.element('p', 'Die Kammer bewahrt keine Münzen im Eis. Sie bewahrt den Moment, in dem du Licht erkannt, Knoten verbunden und Zeit überbrückt hast. Jede Resonanzbake trägt eine dieser Entscheidungen in den Nebel.', dossier);
    const evidence = api.element('p', '', dossier);
    const visit = api.element('a', 'Nebelsignatur ansehen →', dossier); visit.href = '#void';
    return { update: function (state) {
      const research = state.expedition;
      progress.textContent = research.decoded ? 'Zeitspur entschlüsselt · Archiv dauerhaft entdeckt' : 'Nachweise vollständig · die Zeitspur wartet auf deine Entschlüsselung.';
      decode.disabled = !state.vault.cryoUnlocked || !research.archiveUnlocked || research.decoded;
      dossier.hidden = !research.decoded;
      evidence.textContent = research.observed.length + '/5 Phasen · ' + research.calibrated.length + '/6 Resonanzbaken · Vault-Ertrag ' + state.vault.earned.toFixed(4) + ' CNX';
    } };
  } });
})();
