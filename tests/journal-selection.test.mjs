import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.HTMLElement = class {};
globalThis.foundry = {
  applications: { api: {
    ApplicationV2: class {},
    HandlebarsApplicationMixin: (Base) => Base,
    DialogV2: { prompt: async () => 'Selected challenge' },
  } },
  utils: { randomID: () => 'test-id' },
};
let warnings;
let library;
globalThis.game = {
  system: { id: 'pf2e' },
  modules: new Map(),
  actors: [],
  settings: {
    get: () => library,
    set: async (_module, _key, value) => { library = value; },
  },
  i18n: { localize: (key) => key, format: (key) => key },
};
globalThis.ui = { notifications: {
  warn: (key) => warnings.push(key), info: () => {},
} };
const handlers = await import('../scripts/applications/gm-sidebar/managers/challenge-handlers.mjs');

function fixture({ attached = false, journal = true, selected = true, checks = true, elementRange = false } = {}) {
  warnings = [];
  library = [];
  const node = { parentElement: null };
  const content = new HTMLElement();
  content.contains = (value) => journal && (value === node || value === content);
  content.closest = (selector) => {
    assert.ok(selector.includes('.journal-page-content'));
    assert.ok(selector.includes('.journal-entry-pages'));
    return journal ? content : null;
  };
  node.parentElement = content;
  const root = new HTMLElement();
  root.classList = { contains: () => true };
  root.querySelector = () => content;
  const fragment = {};
  const selection = {
    rangeCount: selected ? 1 : 0,
    getRangeAt: () => ({ commonAncestorContainer: elementRange ? content : node, cloneContents: () => fragment }),
    removeAllRanges: () => { selection.rangeCount = 0; },
  };
  globalThis.window = { getSelection: () => selection };
  globalThis.document = { createElement: () => ({ appendChild: (value) => {
    assert.equal(value, fragment);
  } }) };
  let parsed = 0;
  const sidebar = {
    parentInterface: attached ? { element: root } : null,
    _parseChecksFromContent: () => {
      parsed++;
      return checks ? [{ skillName: 'sur', dc: 24, checkType: 'skill' }] : [];
    },
  };
  return { sidebar, selection, content, root, parsed: () => parsed };
}

for (const attached of [false, true]) {
  test(`challenge wand parses selected journal HTML (${attached ? 'attached' : 'floating'})`, async () => {
    const f = fixture({ attached });
    await handlers.onCreateChallengeFromSelection(null, null, f.sidebar);
    assert.equal(f.parsed(), 1);
    assert.deepEqual(warnings, []);
    assert.equal(library[0].options[0].skillOptions[0].dc, 24);
    assert.equal(f.selection.rangeCount, 0);
  });
  test(`checks wand reaches PC lookup (${attached ? 'attached' : 'floating'})`, async () => {
    const f = fixture({ attached });
    await handlers.onRequestRollsFromSelection(null, null, f.sidebar);
    assert.equal(f.parsed(), 1);
    assert.deepEqual(warnings, ['STORYFRAME.Notifications.NoPlayerCharactersFound']);
  });
}

for (const handler of [handlers.onCreateChallengeFromSelection, handlers.onRequestRollsFromSelection]) {
  test(`${handler.name} accepts selection spanning elements in a floating journal`, async () => {
    const f = fixture({ elementRange: true, checks: false });
    await handler(null, null, f.sidebar);
    assert.equal(f.parsed(), 1);
    assert.deepEqual(warnings, ['STORYFRAME.Notifications.Challenge.NoSkillChecksFound']);
  });
  test(`${handler.name} follows selected journal instead of a different attached journal`, async () => {
    const f = fixture({ attached: true, checks: false });
    f.root.querySelector = () => ({ contains: () => false });
    await handler(null, null, f.sidebar);
    assert.equal(f.parsed(), 1);
    assert.deepEqual(warnings, ['STORYFRAME.Notifications.Challenge.NoSkillChecksFound']);
  });
  test(`${handler.name} rejects unrelated text`, async () => {
    const f = fixture({ journal: false });
    await handler(null, null, f.sidebar);
    assert.equal(f.parsed(), 0);
    assert.equal(warnings.length, 1);
  });
  test(`${handler.name} handles missing selection`, async () => {
    const f = fixture({ selected: false });
    await handler(null, null, f.sidebar);
    assert.equal(f.parsed(), 0);
    assert.equal(warnings.length, 1);
  });
  test(`${handler.name} warns when selected journal text contains no checks`, async () => {
    const f = fixture({ checks: false });
    await handler(null, null, f.sidebar);
    assert.equal(f.parsed(), 1);
    assert.deepEqual(warnings, ['STORYFRAME.Notifications.Challenge.NoSkillChecksFound']);
  });
}
