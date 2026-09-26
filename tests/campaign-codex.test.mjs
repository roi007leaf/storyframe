import assert from 'node:assert/strict';
import test from 'node:test';
import { collectCodexStage, getCodexSpeaker, saveCodexStage, launchCodexStage, beginCodexSession, buildCodexRecap, appendCodexRecap, initializeCampaignCodex, renderCodexSheet, prepareSavedCodexScene } from '../scripts/integrations/campaign-codex.mjs';
import { findJournalContent } from '../scripts/utils/dom-utils.mjs';

let counter = 0;
const documents = new Map(), hooks = new Map(), changes = [];
let savedScenes = [];
const mod = { active: true, api: {} };
let state = { speakers: [], participants: [], rollHistory: [], pendingRolls: [], activeChallenges: [] };
globalThis.foundry = { utils: { randomID: () => `id${++counter}`, deepClone: structuredClone }, applications: { api: { DialogV2: {} } } };
globalThis.Hooks = { on: (name, fn) => hooks.set(name, fn) };
globalThis.game = {
  user: { isGM: true }, modules: new Map([['campaign-codex', mod]]),
  scenes: { current: { id: 'scene' } }, messages: new Map(), actors: new Map(),
  settings: { get: () => savedScenes, set: async (_module, key, value) => { assert.equal(key, 'speakerScenes'); savedScenes = value; } },
  storyframe: { stateManager: {
    getState: () => state,
    setActiveSpeaker: async value => changes.push(['active', value]),
    setSecondarySpeaker: async value => changes.push(['secondary', value]),
    updateSpeakers: async speakers => { changes.push(['cast', speakers]); state.speakers = speakers; },
    setSceneBackground: async value => changes.push(['background', value]),
  }, socketManager: { launchSceneMode: () => changes.push(['launch']) } },
};
globalThis.fromUuid = async uuid => documents.get(uuid);
function journal(id, type, data = {}, image = '') {
  const flags = { type, data, image };
  const doc = { documentName: 'JournalEntry', uuid: `JournalEntry.${id}`, name: id, getFlag: (_module, key) => flags[key] };
  documents.set(doc.uuid, doc);
  return doc;
}
const actor = { documentName: 'Actor', uuid: 'Actor.actor', img: 'actor.webp' };
documents.set(actor.uuid, actor);
const publicNPC = journal('public', 'npc', { linkedActor: actor.uuid });
const duplicate = journal('duplicate', 'npc', { linkedActor: actor.uuid });
const hidden = journal('hidden', 'npc', {}, 'secret.webp');
const orphan = journal('orphan', 'npc', { linkedActor: 'Actor.missing' }, 'orphan.webp');
const shop = journal('shop', 'shop', { linkedNPCs: [hidden.uuid] });
const location = journal('tavern', 'location', { linkedNPCs: [publicNPC.uuid, duplicate.uuid, orphan.uuid, 'JournalEntry.missing'], linkedShops: [shop.uuid], hiddenAssociates: [shop.uuid], linkedScene: 'Scene.linked' });
documents.set('Scene.linked', { documentName: 'Scene', background: { src: 'tavern.webp' } });

test('location resolves cast, deduplicates actors, includes shop NPCs and preserves hidden relationships', async () => {
  const result = await collectCodexStage(location);
  assert.deepEqual(result.speakers.map(s => s.label), ['public', 'orphan', 'hidden']);
  assert.equal(result.speakers[2].isHidden, true);
  assert.equal(result.speakers[1].actorUuid, null);
  assert.equal(result.sceneBackground, 'tavern.webp');
  assert.equal(result.warnings.length, 2);
});
test('NPC and shop staging use their own links and custom portraits', async () => {
  assert.equal((await collectCodexStage(publicNPC)).speakers[0].actorUuid, actor.uuid);
  assert.equal((await collectCodexStage(shop)).speakers[0].label, 'hidden');
  assert.equal((await getCodexSpeaker(orphan)).imagePath, 'orphan.webp');
  const custom = journal('custom', 'npc', { linkedActor: actor.uuid }, 'custom.webp');
  assert.equal((await getCodexSpeaker(custom)).imagePath, 'custom.webp');
});
test('save updates one associated scene and keeps unrelated saved scenes', async () => {
  savedScenes = [{ id: 'unrelated', name: 'Other', speakers: [] }];
  const stage = await collectCodexStage(location);
  const first = await saveCodexStage(location, stage);
  stage.speakers[0].label = 'Changed';
  assert.equal(savedScenes[1].speakers[0].label, 'public');
  await saveCodexStage(location, { ...stage, sceneBackground: 'edited.webp' });
  assert.equal(savedScenes.length, 2);
  assert.equal(savedScenes[1].id, first.id);
  assert.equal(savedScenes[1].sceneBackground, 'edited.webp');
  assert.equal(savedScenes[0].id, 'unrelated');
});
test('launch publishes only selected presentation, clears stale active speakers and retains preparation', async () => {
  changes.length = 0;
  const stage = await collectCodexStage(location);
  const selected = { ...stage, speakers: [stage.speakers[0]] };
  await launchCodexStage(location, selected);
  assert.deepEqual(changes.map(c => c[0]), ['active', 'secondary', 'cast', 'background', 'launch']);
  assert.equal(changes[2][1].length, 1);
  assert.equal('codexUuid' in changes[2][1][0], false);
  assert.equal(selected.speakers[0].codexUuid, publicNPC.uuid);
});
test('all public entrypoints reject non-GMs and inactive Codex; missing scene fails before publish', async () => {
  game.user.isGM = false;
  await assert.rejects(collectCodexStage(location), /GM access/);
  await assert.rejects(saveCodexStage(location, {}), /GM access/);
  await assert.rejects(launchCodexStage(location, {}), /GM access/);
  await assert.rejects(appendCodexRecap(location, ''), /GM access/);
  game.user.isGM = true;
  mod.active = false;
  await assert.rejects(collectCodexStage(location), /active module/);
  mod.active = true;
  game.scenes.current = null;
  await assert.rejects(launchCodexStage(location, {}), /Open a Foundry scene/);
  game.scenes.current = { id: 'scene' };
});
test('Codex check selector chooses active prose ahead of scrollable navigation', () => {
  const active = {};
  assert.equal(findJournalContent({ querySelector: selector => selector === '.sheet-main .tab-panel.active' ? active : null }), active);
});
test('recap escapes dialogue, filters secret results and retains challenge names', () => {
  const session = { name: '<Tavern>', startedAt: 0, dialogues: [{ speaker: 'NPC', text: '<script>attack</script>' }],
    rolls: new Map([['a', { skillSlug: 'diplomacy', total: 24 }], ['b', { skillSlug: 'secret-lore', total: 99, isSecretRoll: true }]]),
    challenges: new Map([['c', { name: 'Negotiation', options: [{}, {}] }]]) };
  const html = buildCodexRecap(session, state);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('secret-lore'));
  assert.ok(html.includes('Negotiation (2 options)'));
  assert.ok(buildCodexRecap(session, state, true).includes('secret-lore'));
});
test('recap append delegates legacy and page storage to Codex content API, preserving notes', async () => {
  for (const storage of ['legacy', 'pages']) {
    let notes = '<p>Existing</p>';
    mod.api.journalContentHelper = {
      get: (doc, key) => { assert.equal(doc, location); assert.equal(key, 'notes'); return notes; },
      set: async (doc, key, value) => { assert.equal(doc, location); assert.equal(key, 'notes'); notes = value; },
    };
    await appendCodexRecap(location, `<p>${storage}</p>`);
    assert.equal(notes, `<p>Existing</p><p>${storage}</p>`);
  }
  mod.api.journalContentHelper = null;
  await assert.rejects(appendCodexRecap(location, ''), /content API unavailable/);
});
test('sheet controls clean up after role loss', () => {
  let removed = 0;
  game.user.isGM = false;
  renderCodexSheet({ document: location, element: { querySelector: () => ({ remove: () => removed++ }) } });
  assert.equal(removed, 2);
  game.user.isGM = true;
});
test('session hooks capture request secrecy, completed checks, dialogue and removed challenges', () => {
  initializeCampaignCodex();
  state = { speakers: [{ id: 'speaker', label: 'Innkeeper' }], activeSpeaker: 'speaker', participants: [],
    rollHistory: [{ requestId: 'old', total: 10 }], pendingRolls: [{ id: 'new', isSecretRoll: true }],
    activeChallenges: [{ id: 'challenge', name: 'Bargain', options: [] }] };
  const session = beginCodexSession(location, state);
  hooks.get('storyframe.dialogueSent')({ originalText: 'Welcome!' });
  const changed = { ...state, rollHistory: [...state.rollHistory, { requestId: 'new', total: 20 }], activeChallenges: [] };
  hooks.get('updateScene')({ id: 'scene', getFlag: (scope, key) => { assert.equal(scope, 'storyframe'); assert.equal(key, 'data'); return changed; } });
  assert.equal(session.rolls.size, 1);
  assert.equal(session.rolls.get('new').isSecret, true);
  assert.equal(session.challenges.size, 1);
  assert.deepEqual(session.dialogues, [{ speaker: 'Innkeeper', text: 'Welcome!' }]);
});
test('stage loads saved cast without refreshing Codex or publishing; cancel has no side effects', async () => {
  const old = changes.length;
  globalThis.document = { createElement: () => ({}), head: { appendChild: () => {} } };
  const wait = async options => {
    assert.ok(options.content.includes('Saved scene loaded'));
    assert.ok(options.content.includes('Changed'));
    return null;
  };
  foundry.applications.api.DialogV2.wait = wait;
  await game.storyframe.campaignCodex.stage(location);
  assert.equal(changes.length, old);
});
test('NPC controls keep distinct image-only NPCs sharing a portrait and reuse existing actors', async () => {
  state.speakers = [];
  const another = journal('another', 'npc', {}, 'secret.webp');
  await game.storyframe.campaignCodex.addSpeaker(hidden);
  await game.storyframe.campaignCodex.addSpeaker(another);
  assert.equal(state.speakers.length, 2);
  await game.storyframe.campaignCodex.addSpeaker(hidden, true);
  assert.equal(state.speakers.length, 2);
  assert.deepEqual(changes.at(-1), ['active', 'codex-hidden']);
  assert.ok(state.speakers.every(s => !s.codexUuid));
  await game.storyframe.campaignCodex.addSpeaker(publicNPC);
  await game.storyframe.campaignCodex.addSpeaker(duplicate);
  assert.equal(state.speakers.length, 3);
});
test('saved cinematic scene preparation strips source metadata and starts recap without changing cast', async () => {
  const old = changes.length;
  const scene = savedScenes.find(s => s.codexJournalUuid === location.uuid);
  const speakers = await prepareSavedCodexScene(scene);
  assert.ok(speakers.every(s => !s.codexUuid));
  assert.ok(scene.speakers.some(s => s.codexUuid));
  assert.equal(changes.length, old);
});
