import { initializeCampaignCodex } from '../../scripts/integrations/campaign-codex.mjs';

const result = document.querySelector('#result');
const hooks = new Map(), docs = new Map();
const emit = (name, ...args) => (hooks.get(name) || []).forEach(fn => fn(...args));
globalThis.Hooks = { on: (name, fn) => hooks.set(name, [...(hooks.get(name) || []), fn]) };
class FixtureDialog {
  static wait(options) {
    return new Promise(resolve => {
      const dialog = document.createElement('dialog');
      dialog.className = options.classes?.join(' ') || 'sf-codex-dialog';
      dialog.innerHTML = `<header class="window-header"><h2></h2></header><form class="window-content"><fieldset>${options.content}</fieldset><footer></footer></form>`;
      dialog.querySelector('h2').textContent = options.window.title;
      for (const config of options.buttons) {
        const button = document.createElement('button');
        button.type = 'button'; button.textContent = config.label;
        button.onclick = async event => {
          const value = config.callback ? await config.callback(event, button) : config.action;
          dialog.close(); dialog.remove(); resolve(value);
        };
        dialog.querySelector('footer').appendChild(button);
      }
      dialog.oncancel = () => { dialog.remove(); resolve(null); };
      document.body.appendChild(dialog); dialog.showModal();
      options.render?.(new Event('render'), { element: dialog });
    });
  }
  static confirm(options) {
    return this.wait({ ...options, buttons: [{ label: 'Confirm', action: true }, { label: 'Cancel', action: false }] });
  }
}
globalThis.foundry = { utils: { randomID: () => crypto.randomUUID(), deepClone: value => structuredClone(value) }, applications: { api: { DialogV2: FixtureDialog }, instances: new Map() } };
let saved = [];
const state = { speakers: [], participants: [], activeChallenges: [], pendingRolls: [], rollHistory: [], activeSpeaker: null };
function journal(id, type, data, image = '') {
  const flags = { type, data, image };
  const doc = { documentName: 'JournalEntry', uuid: `JournalEntry.${id}`, name: id, getFlag: (_m, key) => flags[key] };
  docs.set(doc.uuid, doc); return doc;
}
const npc = journal('Innkeeper', 'npc', {}, '/icons/svg/mystery-man.svg');
const hidden = journal('Secret agent', 'npc', {}, '/icons/svg/mystery-man.svg');
const tavern = journal('Tavern', 'location', { linkedNPCs: [npc.uuid, hidden.uuid], hiddenAssociates: [hidden.uuid] }, '/icons/svg/castle.svg');
let notes = '<p>Existing notes preserved.</p>';
const module = { active: true, api: { journalContentHelper: { get: () => notes, set: async (_j, _key, html) => { notes = html; result.textContent = `Recap appended.\n${notes}`; } } } };
globalThis.game = { user: { id: 'gm', isGM: true }, modules: new Map([['campaign-codex', module]]),
  system: { id: 'pf2e' }, i18n: { localize: key => key },
  settings: { get: (_m, key) => key === 'speakerScenes' ? saved : false, set: async (_m, _key, value) => { saved = value; result.textContent = `Saved scenes: ${saved.length}\nCast: ${saved.at(-1).speakers.map(s => s.label).join(', ')}`; } },
  journal: [tavern, npc, hidden], scenes: { current: { id: 'fixture' } }, messages: new Map(), actors: new Map(),
  storyframe: { stateManager: {
    getState: () => state,
    setActiveSpeaker: async id => { state.activeSpeaker = id; },
    setSecondarySpeaker: async () => {},
    updateSpeakers: async speakers => { state.speakers = speakers; },
    setSceneBackground: async src => { state.sceneBackground = src; },
  }, socketManager: { launchSceneMode: () => {
    result.textContent = `Launched cast: ${state.speakers.map(s => s.label).join(', ')}\nBackground: ${state.sceneBackground}`;
    state.activeSpeaker = state.speakers[0]?.id;
    emit('storyframe.dialogueSent', { originalText: 'Welcome to the tavern!' });
    state.pendingRolls = [{ id: 'secret-check', isSecretRoll: true }];
    emit('updateScene', { id: 'fixture', getFlag: () => state });
    state.rollHistory.push({ requestId: 'check', skillSlug: 'diplomacy', total: 24, degreeOfSuccess: 2 });
    state.rollHistory.push({ requestId: 'secret-check', skillSlug: 'secret-lore', total: 19 });
    state.activeChallenges = [{ id: 'negotiation', name: 'Negotiation', options: [{}, {}] }];
    emit('updateScene', { id: 'fixture', getFlag: () => state });
  } } },
};
globalThis.ui = { windows: {}, notifications: { info: message => { result.textContent += `\n${message}`; }, error: message => { result.textContent = `Error: ${message}`; } } };
globalThis.fromUuid = async uuid => docs.get(uuid);
initializeCampaignCodex();
const sheet = { id: 'fixture-sheet', document: npc, element: document.querySelector('#codex-sheet'), rendered: true };
foundry.applications.instances.set(sheet.id, sheet);
emit('renderApplicationV2', sheet, sheet.element);
const run = fn => async () => { try { await fn(); } catch (error) { result.textContent = error.message; } };
document.querySelector('#stage').onclick = run(() => game.storyframe.campaignCodex.stage(tavern));
document.querySelector('#recap').onclick = run(() => game.storyframe.campaignCodex.exportRecap(tavern));
document.querySelector('#player').onclick = () => { game.user.isGM = !game.user.isGM; emit('updateUser', game.user); result.textContent = game.user.isGM ? 'Role: GM' : 'Role: player — GM actions must reject.'; };
result.textContent = 'Ready. Stage tavern → save → reopen → launch → export recap.';
