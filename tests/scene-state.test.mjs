import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.window = { innerWidth: 1280, innerHeight: 720 };
globalThis.foundry = {
  applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: cls => cls } },
  utils: { deepClone: structuredClone, randomID: () => 'new-scene', debounce: fn => fn },
};
globalThis.Hooks = { on: () => 1, off: () => {} };
globalThis.MutationObserver = class { observe() {} disconnect() {} };
globalThis.ui = { notifications: { info() {}, warn() {} } };

const { CinematicGMApp } = await import('../scripts/applications/cinematic/cinematic-gm-app.mjs');
const { showSceneEditor } = await import('../scripts/scene-editor.mjs');
const cast = [
  { id: 'actor', actorUuid: 'Actor.npc', label: 'NPC', imagePath: 'npc.webp', isHidden: true, isNameHidden: false },
  { id: 'image', label: 'Stranger', imagePath: 'stranger.webp', isHidden: false, isNameHidden: true },
];
let scenes, state, loaded, events;
const app = { render() {}, _persistMinimizedJournals() {}, minimizedJournals: [] };
const target = id => ({ closest: () => ({ dataset: { sceneId: id, playlistId: id } }) });

function setup() {
  scenes = [{ id: 'saved', name: 'Saved', speakers: structuredClone(cast), playlistId: 'music' }];
  state = { speakers: structuredClone(cast), sceneBackground: 'background.webp' };
  events = [];
  loaded = null;
  const music = { id: 'music', playing: false, sounds: { contents: [{ id: 'one' }, { id: 'two' }] },
    playAll: async () => events.push('native-start'),
    updateEmbeddedDocuments: async (_type, updates) => events.push(updates),
  };
  const playlists = [{ id: 'old', playing: true, stopAll: async () => events.push('stop') }, music];
  playlists.get = id => playlists.find(p => p.id === id);
  globalThis.game = {
    actors: [], modules: new Map(), playlists,
    i18n: { localize: key => key, format: key => key },
    settings: { get: () => scenes, set: async (_module, _key, value) => { scenes = structuredClone(value); } },
    storyframe: {
      stateManager: { getState: () => state, resolveSpeaker: async s => ({ name: s.label, img: s.imagePath }),
        setSceneBackground: async value => { state.sceneBackground = value; } },
      socketManager: { requestUpdateSpeakers: async speakers => { loaded = speakers; state.speakers = speakers; } },
    },
  };
}

// Minimal DOM boundary: exercise actual editor initialization and registered save/current actions.
function editorDOM() {
  const nodes = new Map();
  const makeNode = () => ({ style: {}, value: '', handlers: {},
    addEventListener(event, fn) { this.handlers[event] = fn; },
    querySelector: selector => getNode(selector), querySelectorAll: () => [],
    focus() {}, remove() {},
  });
  const getNode = selector => {
    if (!nodes.has(selector)) nodes.set(selector, makeNode());
    return nodes.get(selector);
  };
  const editor = makeNode();
  getNode('.speakers-list').previousElementSibling = makeNode();
  globalThis.document = {
    querySelector: () => null, createElement: type => type === 'div' ? editor : makeNode(),
    head: { appendChild() {} }, body: { appendChild() {} },
    addEventListener() {}, removeEventListener() {},
  };
  return { getNode };
}

test('loading saved scene delegates playback to native playlist mode', async () => {
  setup();
  await CinematicGMApp._onLoadSpeakerScene.call(app, null, target('saved'));
  assert.deepEqual(events, ['stop', 'native-start']);
});

test('playlist play button delegates playback to native playlist mode', async () => {
  setup();
  await CinematicGMApp._onMusicPlayPlaylist.call(app, null, target('music'));
  assert.deepEqual(events, ['stop', 'native-start']);
});

for (const editing of [false, true]) {
  test(`scene editor ${editing ? 'update' : 'create'} retains NPC and name visibility on reload`, async () => {
    setup();
    game.playlists[0].playing = false;
    const { getNode } = editorDOM();
    await showSceneEditor({ sceneId: editing ? 'saved' : null, speakers: cast });
    getNode('#scene-name-input').value = 'Saved';
    await getNode('.btn-save').handlers.click();
    const saved = scenes.at(-1);
    await CinematicGMApp._onLoadSpeakerScene.call(app, null, target(saved.id));
    assert.deepEqual(loaded.map(s => [s.isHidden, s.isNameHidden]), [[true, false], [false, true]]);
  });
}

test('adding current speakers through editor retains visibility', async () => {
  setup();
  const { getNode } = editorDOM();
  await showSceneEditor();
  await getNode('.btn-add-current').handlers.click();
  getNode('#scene-name-input').value = 'Saved';
  await getNode('.btn-save').handlers.click();
  assert.deepEqual(scenes.at(-1).speakers.map(s => [s.isHidden, s.isNameHidden]), [[true, false], [false, true]]);
});

test('save state captures current speakers and restores visibility after switching scenes', async () => {
  setup();
  game.playlists[0].playing = false;
  state.speakers[0].isHidden = false;
  state.speakers[0].isNameHidden = true;
  const expected = structuredClone(state.speakers);
  await CinematicGMApp._onSaveSceneState.call(app, null, target('saved'));
  state.speakers = [];
  await CinematicGMApp._onLoadSpeakerScene.call(app, null, target('saved'));
  assert.deepEqual(loaded, expected);
});

test('loaded speakers do not mutate saved scene before explicit save', async () => {
  setup();
  await CinematicGMApp._onLoadSpeakerScene.call(app, null, target('saved'));
  loaded[0].isHidden = false;
  assert.equal(scenes[0].speakers[0].isHidden, true);
});
