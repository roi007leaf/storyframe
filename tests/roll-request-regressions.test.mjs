import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.HTMLElement = class {};
let nextId = 0;
globalThis.foundry = {
  applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: B => B } },
  utils: { randomID: () => `test-${++nextId}` },
};
globalThis.document = { createElement: () => ({ appendChild() {} }), head: { appendChild() {} } };
globalThis.ui = { notifications: { info() {}, warn() {}, error() {} } };
const actors = ['A', 'B'].map(id => ({
  uuid: `Actor.${id}`, name: id, type: 'character', hasPlayerOwner: true,
  testUserPermission: user => user.id === id,
}));
globalThis.fromUuid = async uuid => actors.find(a => a.uuid === uuid);
const sent = [];
globalThis.game = {
  system: { id: 'dnd5e' }, modules: new Map(), actors,
  users: ['A', 'B'].map(id => ({ id, active: true, isGM: false })),
  settings: { get: () => false }, i18n: { localize: k => k, format: k => k },
  storyframe: { stateManager: { getState: () => ({}) }, socketManager: {
    requestAddPendingRoll: async request => sent.push(request), triggerSkillCheckOnPlayer: async () => {},
  } },
};
const { RollRequestDialog } = await import('../scripts/applications/roll-request-dialog.mjs');
const { onRequestRollsFromSelection } = await import('../scripts/applications/gm-sidebar/managers/challenge-handlers.mjs');
const { openRollRequesterAndSend, requestDialogCheck, sendBatchSkillCheck } = await import('../scripts/applications/gm-sidebar/managers/skill-check-handlers.mjs');
const helpers = await import('../scripts/applications/gm-sidebar/managers/ui-helpers.mjs');
const { PlayerSidebarApp } = await import('../scripts/applications/player-sidebar.mjs');
const { PlayerViewerApp } = await import('../scripts/applications/player-viewer.mjs');

function setup() {
  sent.length = 0;
  game.system.id = 'dnd5e';
  game.storyframe.stateManager.getState = () => ({});
  const content = new HTMLElement();
  content.closest = () => content;
  content.contains = () => true;
  const range = { commonAncestorContainer: content, cloneContents: () => ({}) };
  globalThis.window = { getSelection: () => ({ rangeCount: 1, getRangeAt: () => range, removeAllRanges() {} }) };
  const check = { skillName: 'ath', dc: 24, isSecret: false, checkType: 'skill' };
  const sidebar = {
    currentDC: 15, secretRollEnabled: true, parentInterface: null,
    element: { querySelector: () => null, querySelectorAll: () => [] }, _parseChecksFromContent: () => [check],
  };
  return { sidebar, check };
}

for (const selectedIds of [[], ['Actor.B']]) {
  test(`wand respects linked Actor.A with global targets ${JSON.stringify(selectedIds)}`, async () => {
    const { sidebar, check } = setup();
    RollRequestDialog.subscribe = async () => ({ selectedIds, checks: [{ ...check, targetIds: ['Actor.A'] }] });
    await onRequestRollsFromSelection(null, null, sidebar);
    assert.deepEqual(sent.map(r => r.actorUuid), ['Actor.A']);
    assert.equal(sent[0].dc, 24);
    assert.equal(sent[0].isSecretRoll, false);
    assert.equal(sidebar.currentDC, 15);
    assert.equal(sidebar.secretRollEnabled, true);
  });
}

test('wand uses global targets only for checks without explicit links', async () => {
  const { sidebar, check } = setup();
  RollRequestDialog.subscribe = async () => ({ selectedIds: ['Actor.B'], checks: [check] });
  await onRequestRollsFromSelection(null, null, sidebar);
  assert.deepEqual(sent.map(r => r.actorUuid), ['Actor.B']);
});

test('pending requester sends displayed DC even after sidebar DC changes', async () => {
  const { sidebar } = setup();
  let resolveDialog;
  let signalOpened;
  const opened = new Promise(resolve => { signalOpened = resolve; });
  RollRequestDialog.subscribe = checks => {
    signalOpened(checks);
    return new Promise(resolve => { resolveDialog = resolve; });
  };
  const pending = openRollRequesterAndSend(sidebar, 'ath', 'skill');
  const displayed = await opened;
  sidebar.currentDC = 30;
  resolveDialog({ selectedIds: ['Actor.A'], checks: displayed });
  await pending;
  assert.equal(sent[0].dc, 15);
  assert.equal(sidebar.currentDC, 30);
});

test('dialog row preserves no DC, save type, secret, variant and group metadata', async () => {
  const { sidebar } = setup();
  const check = { skillName: 'dex', checkType: 'save', dc: null, isSecret: true, actionSlug: 'test-action', actionVariant: 'variant', targetIds: ['Actor.A'] };
  await requestDialogCheck(sidebar, check, { selectedIds: ['Actor.B'], allowOnlyOne: true, batchGroupId: 'group-1' });
  assert.deepEqual(sent.map(({ actorUuid, dc, checkType, isSecretRoll, actionSlug, actionVariant, batchGroupId, allowOnlyOne }) =>
    ({ actorUuid, dc, checkType, isSecretRoll, actionSlug, actionVariant, batchGroupId, allowOnlyOne })), [{
    actorUuid: 'Actor.A', dc: null, checkType: 'save', isSecretRoll: true,
    actionSlug: 'test-action', actionVariant: 'variant', batchGroupId: 'group-1', allowOnlyOne: true,
  }]);
});

test('removed or explicitly untargeted dialog rows send nothing', async () => {
  const { sidebar, check } = setup();
  await requestDialogCheck(sidebar, null, { selectedIds: ['Actor.A'] });
  await requestDialogCheck(sidebar, { ...check, targetIds: [] }, { selectedIds: ['Actor.A'] });
  assert.equal(sent.length, 0);
});

test('batch keeps distinct row DCs and targets without changing sidebar state', async () => {
  const { sidebar } = setup();
  sidebar.batchedChecks = [{ skill: 'ath', dc: 10 }, { skill: 'dex', checkType: 'save', dc: 25 }];
  RollRequestDialog.subscribe = async checks => ({ selectedIds: [], checks: checks.map((check, i) => ({ ...check, targetIds: [actors[i].uuid] })) });
  await sendBatchSkillCheck(sidebar);
  assert.deepEqual(sent.map(r => [r.actorUuid, r.dc, r.checkType]), [['Actor.A', 10, 'skill'], ['Actor.B', 25, 'save']]);
  assert.equal(sidebar.currentDC, 15);
  assert.equal(sidebar.secretRollEnabled, true);
  assert.deepEqual(sidebar.batchedChecks, []);
});

for (const player of [false, true]) {
  test(`${player ? 'player' : 'GM'} parent tracking disconnects on rerender, reattach and detach`, () => {
    const observers = [];
    globalThis.MutationObserver = class {
      constructor() { this.active = false; observers.push(this); }
      observe() { this.active = true; }
      disconnect() { this.active = false; }
    };
    const element = new HTMLElement();
    element.classList = { contains: () => true };
    const parentKey = player ? 'parentViewer' : 'parentInterface';
    const sidebar = { [parentKey]: { element }, _stopTrackingParent: PlayerSidebarApp.prototype._stopTrackingParent };
    const start = player ? () => PlayerSidebarApp.prototype._startTrackingParent.call(sidebar) : () => helpers.startTrackingParent(sidebar);
    const stop = player ? () => PlayerSidebarApp.prototype._stopTrackingParent.call(sidebar) : () => helpers.stopTrackingParent(sidebar);
    start();
    start();
    assert.equal(observers.filter(o => o.active).length, 1);
    sidebar[parentKey] = { element };
    start();
    assert.equal(observers.filter(o => o.active).length, 1);
    sidebar[parentKey] = null;
    start();
    assert.equal(observers.filter(o => o.active).length, 0);
    stop();
    assert.equal(observers.filter(o => o.active).length, 0);
  });
}

test('PF2e player rolls preserve all numeric outcome degrees, including zero', async () => {
  setup();
  game.system.id = 'pf2e';
  const request = { id: 'request-1', actorUuid: 'Actor.A', skillSlug: 'ath', dc: 15, checkType: 'skill' };
  game.storyframe.stateManager.getState = () => ({ pendingRolls: [request] });
  const submitted = [];
  game.storyframe.socketManager.requestSubmitRollResult = async result => submitted.push(result);
  for (const degree of [0, 1, 2, 3, null]) {
    actors[0].skills = { athletics: { roll: async () => ({ total: 20, degreeOfSuccess: degree }) } };
    await PlayerViewerApp._onExecuteRoll(null, { dataset: { requestId: request.id } });
  }
  assert.deepEqual(submitted.map(r => r.degreeOfSuccess), [0, 1, 2, 3, null]);
});
