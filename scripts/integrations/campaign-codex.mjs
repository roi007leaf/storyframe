import { MODULE_ID, FLAG_KEY } from '../constants.mjs';
import { loadCSS } from '../css-loader.mjs';
import { handleJournalRender, handleJournalClose } from '../hooks/journal-hooks.mjs';

const CODEX = 'campaign-codex';
const sessions = new Map();
let initialized = false;
const clone = (value) => foundry.utils.deepClone(value);
export const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function isCodexJournal(document) {
  return document?.documentName === 'JournalEntry' && Boolean(document.getFlag(CODEX, 'type'));
}
function requireGM() {
  if (!game.user.isGM || !game.modules.get(CODEX)?.active) throw new Error('Campaign Codex integration requires an active module and GM access.');
}
function runtime() {
  requireGM();
  const manager = game.storyframe?.stateManager;
  if (!game.scenes.current || !manager?.getState() || !game.storyframe.socketManager) throw new Error('Open a Foundry scene before using StoryFrame.');
  return manager;
}
async function resolve(uuid) {
  if (!uuid) return null;
  try { return await fromUuid(uuid); } catch { return null; }
}
export async function getCodexSpeaker(journal, hidden = false) {
  requireGM();
  const data = journal.getFlag(CODEX, 'data') || {};
  const actor = await resolve(data.linkedActor);
  const imagePath = journal.getFlag(CODEX, 'image') || actor?.img || 'icons/svg/mystery-man.svg';
  return {
    id: `codex-${journal.id || journal.uuid.split('.').at(-1)}`, actorUuid: actor?.documentName === 'Actor' ? actor.uuid : null,
    imagePath, label: journal.name, isNameHidden: hidden, isHidden: hidden,
    altImages: [], codexUuid: journal.uuid,
  };
}
export async function collectCodexStage(journal) {
  requireGM();
  if (!isCodexJournal(journal)) throw new Error('Select a Campaign Codex journal.');
  const data = journal.getFlag(CODEX, 'data') || {};
  const type = journal.getFlag(CODEX, 'type');
  const speakers = [], warnings = [], seen = new Set();
  const add = async (npc, hidden) => {
    if (!isCodexJournal(npc) || npc.getFlag(CODEX, 'type') !== 'npc') return;
    const speaker = await getCodexSpeaker(npc, hidden);
    const key = speaker.actorUuid || npc.uuid;
    if (seen.has(key)) return;
    seen.add(key);
    speakers.push(speaker);
    if (npc.getFlag(CODEX, 'data')?.linkedActor && !speaker.actorUuid) warnings.push(`${npc.name}: linked actor missing; using portrait.`);
  };
  if (type === 'npc') await add(journal, false);
  const sources = [{ journal, hidden: false }];
  // Locations include shop NPCs, matching Codex's location workflow. Never recurse through the whole campaign.
  if (type === 'location') {
    for (const uuid of data.linkedShops || []) {
      const shop = await resolve(uuid);
      if (shop) sources.push({ journal: shop, hidden: (data.hiddenAssociates || []).includes(uuid) });
      else warnings.push(`Missing linked shop: ${uuid}`);
    }
  }
  for (const source of sources) {
    const flags = source.journal.getFlag(CODEX, 'data') || {};
    for (const uuid of new Set([...(flags.linkedNPCs || []), ...(flags.associates || [])])) {
      const npc = await resolve(uuid);
      if (!npc) { warnings.push(`Missing linked NPC: ${uuid}`); continue; }
      await add(npc, source.hidden || (flags.hiddenAssociates || []).includes(uuid));
    }
  }
  const linkedScene = await resolve(data.linkedScene);
  if (data.linkedScene && !linkedScene) warnings.push('Linked Foundry scene missing.');
  return { journalUuid: journal.uuid, name: journal.name, speakers, warnings,
    sceneBackground: journal.getFlag(CODEX, 'image') || linkedScene?.background?.src || '',
  };
}
export async function saveCodexStage(journal, stage) {
  requireGM();
  const scenes = clone(game.settings.get(MODULE_ID, 'speakerScenes') || []);
  let saved = scenes.find(s => s.codexJournalUuid === journal.uuid);
  if (!saved) { saved = { id: foundry.utils.randomID(), createdAt: Date.now() }; scenes.push(saved); }
  Object.assign(saved, { name: journal.name, codexJournalUuid: journal.uuid, speakers: clone(stage.speakers),
    sceneBackground: stage.sceneBackground || null, updatedAt: Date.now() });
  await game.settings.set(MODULE_ID, 'speakerScenes', scenes);
  return saved;
}
export function beginCodexSession(journal, state) {
  requireGM();
  const session = { id: foundry.utils.randomID(), journalUuid: journal.uuid, name: journal.name,
    startedAt: Date.now(), dialogues: [], rolls: new Map(), challenges: new Map(), requests: new Map(),
    previousRolls: new Set((state.rollHistory || []).map(r => r.requestId || r.chatMessageId || JSON.stringify(r))), sceneId: game.scenes.current.id };
  sessions.set(session.sceneId, session);
  captureSession(state);
  return session;
}
function captureSession(state) {
  const session = sessions.get(game.scenes.current?.id);
  if (!game.user.isGM || !session || !state) return;
  for (const request of state.pendingRolls || []) session.requests.set(request.id, clone(request));
  for (const roll of state.rollHistory || []) {
    const key = roll.requestId || roll.chatMessageId || JSON.stringify(roll);
    const request = session.requests.get(roll.requestId);
    const message = game.messages?.get(roll.chatMessageId);
    if (!session.previousRolls.has(key)) session.rolls.set(key, { ...clone(roll),
      isSecret: Boolean(roll.isSecret || roll.isSecretRoll || request?.isSecretRoll || request?.isSecret || message?.blind),
      participantName: (roll.actorUuid || request?.actorUuid) ? game.actors?.get((roll.actorUuid || request.actorUuid).split('.').at(-1))?.name : null,
    });
  }
  for (const challenge of state.activeChallenges || []) session.challenges.set(challenge.id, clone(challenge));
}
export async function launchCodexStage(journal, stage) {
  const manager = runtime();
  // Source UUIDs stay in saved preparation only. Live player state contains selected presentation data.
  const speakers = stage.speakers.map(({ codexUuid: _source, ...speaker }) => ({ ...speaker, isHidden: false }));
  beginCodexSession(journal, manager.getState());
  await manager.setActiveSpeaker(null);
  await manager.setSecondarySpeaker(null);
  await manager.updateSpeakers(speakers);
  await manager.setSceneBackground(stage.sceneBackground || null);
  // Do not set activeJournal: that field is also broadcast to players.
  game.storyframe.socketManager.launchSceneMode();
}
export async function prepareSavedCodexScene(scene) {
  requireGM();
  const journal = await resolve(scene.codexJournalUuid);
  if (journal && isCodexJournal(journal)) beginCodexSession(journal, runtime().getState());
  return scene.speakers.map(({ codexUuid: _source, ...speaker }) => speaker);
}
async function openStage(journal, fresh = false) {
  requireGM();
  loadCSS('styles/integrations/campaign-codex.css');
  const saved = (game.settings.get(MODULE_ID, 'speakerScenes') || []).find(s => s.codexJournalUuid === journal.uuid);
  const stage = saved && !fresh ? { ...clone(saved), warnings: [] } : await collectCodexStage(journal);
  const rows = stage.speakers.map((s, i) => `<label class="sf-codex-cast"><input type="checkbox" name="cast" value="${i}" ${s.isHidden ? '' : 'checked'}><img src="${escapeHTML(s.imagePath)}" alt=""><span>${escapeHTML(s.label)}${s.isHidden ? ' (hidden in Codex)' : ''}</span></label>`).join('');
  const choose = (_event, button) => {
    const form = button.form;
    return { speakers: [...form.querySelectorAll('[name="cast"]:checked')].map(input => ({ ...clone(stage.speakers[Number(input.value)]), isHidden: false })),
      sceneBackground: form.elements.background.value.trim() };
  };
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: `Stage in StoryFrame: ${journal.name}` }, classes: ['storyframe', 'sf-codex-dialog'], position: { width: 540 },
    content: `<p>Private preview. Launch replaces the current cast and background, following StoryFrame's player visibility setting.</p><p>${saved && !fresh ? 'Saved scene loaded. Refresh links to rebuild from Codex.' : 'Cast from Codex links. Hidden NPCs start unchecked.'}</p>${rows || '<p>No linked NPCs. You can still stage the background.</p>'}<label>Background<input name="background" type="text" value="${escapeHTML(stage.sceneBackground)}"></label>${stage.sceneBackground ? `<img class="sf-codex-background" src="${escapeHTML(stage.sceneBackground)}" alt="Background preview">` : ''}${stage.warnings.map(w => `<p>${escapeHTML(w)}</p>`).join('')}`,
    buttons: [
      { action: 'launch', label: 'Launch', callback: (e, b) => ({ action: 'launch', stage: choose(e, b) }) },
      { action: 'save', label: 'Save scene', callback: (e, b) => ({ action: 'save', stage: choose(e, b) }) },
      { action: 'refresh', label: 'Refresh links', callback: () => ({ action: 'refresh' }) },
      { action: 'cancel', label: 'Cancel' },
    ], rejectClose: false,
  });
  if (result?.action === 'refresh') return openStage(journal, true);
  if (result?.action === 'save') { await saveCodexStage(journal, result.stage); ui.notifications.info('StoryFrame scene saved.'); }
  if (result?.action === 'launch') await launchCodexStage(journal, result.stage);
}
async function addSpeaker(journal, active = false) {
  const manager = runtime();
  if (!isCodexJournal(journal) || journal.getFlag(CODEX, 'type') !== 'npc') throw new Error('Select a Codex NPC.');
  const speaker = await getCodexSpeaker(journal);
  const current = manager.getState().speakers || [];
  let created = current.find(s => s.id === speaker.id || (speaker.actorUuid && s.actorUuid === speaker.actorUuid));
  if (!created) {
    const { codexUuid: _source, ...presentation } = speaker;
    created = presentation;
    await manager.updateSpeakers([...current, created]);
  }
  if (active && created) await manager.setActiveSpeaker(created.id);
}
function isSecretCheck(roll) {
  return Boolean(roll.isSecret || roll.isSecretRoll || roll.secret || roll.blind || roll.rollMode === 'blindroll');
}
function formatCheck(roll, state) {
  const participant = (state.participants || []).find(p => p.id === roll.participantId);
  const actor = roll.actorUuid ? game.actors?.get(roll.actorUuid.split('.').at(-1)) : null;
  const degrees = ['Critical failure', 'Failure', 'Success', 'Critical success'];
  const degree = Number.isInteger(roll.degreeOfSuccess) ? degrees[roll.degreeOfSuccess] : roll.degreeOfSuccess;
  return `${roll.participantName || participant?.name || participant?.label || actor?.name || 'Participant'} — ${roll.skillSlug || roll.skillName || 'Check'}: ${roll.total ?? '?'}${degree != null ? ` (${degree})` : ''}`;
}
export function buildCodexRecap(session, state, includeSecrets = false) {
  const list = values => `<ul>${values.map(value => `<li>${escapeHTML(value)}</li>`).join('')}</ul>`;
  const rolls = [...session.rolls.values()].filter(r => includeSecrets || !isSecretCheck(r));
  return `<h2>StoryFrame: ${escapeHTML(session.name)}</h2><p>${escapeHTML(new Date(session.startedAt).toLocaleString())}</p><h3>Dialogue</h3>${list(session.dialogues.map(d => `${d.speaker}: ${d.text}`))}<h3>Checks</h3>${list(rolls.map(r => formatCheck(r, state)))}<h3>Challenges presented</h3>${list([...session.challenges.values()].map(c => `${c.name}${c.options?.length ? ` (${c.options.length} options)` : ''}`))}`;
}
export async function appendCodexRecap(journal, html) {
  requireGM();
  if (!isCodexJournal(journal)) throw new Error('Select a Campaign Codex journal.');
  const helper = game.modules.get(CODEX).api?.journalContentHelper;
  if (!helper?.get || !helper?.set) throw new Error('Campaign Codex content API unavailable.');
  // Notes use Codex's own restricted content policy, including page-based storage.
  await helper.set(journal, 'notes', `${helper.get(journal, 'notes') || ''}${html}`);
}
async function exportRecap(journal) {
  const manager = runtime();
  const session = sessions.get(game.scenes.current.id);
  if (!session) throw new Error('Launch a Codex stage first to start session capture.');
  captureSession(manager.getState());
  const snapshot = buildCodexRecap(session, manager.getState());
  const secretRolls = [...session.rolls.values()].filter(isSecretCheck);
  const secretHTML = `<h3>Secret checks</h3><ul>${secretRolls.map(r => `<li>${escapeHTML(formatCheck(r, manager.getState()))}</li>`).join('')}</ul>`;
  const targets = game.journal.filter(isCodexJournal);
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: 'Export StoryFrame recap' }, classes: ['storyframe', 'sf-codex-dialog'], position: { width: 600 },
    content: `<p>Captured since this Codex stage launched. Appends to Codex Notes.</p><label>Destination<select name="target">${targets.map(j => `<option value="${escapeHTML(j.uuid)}" ${j.uuid === journal.uuid ? 'selected' : ''}>${escapeHTML(j.name)}</option>`).join('')}</select></label><label><input type="checkbox" name="secrets"> Include ${secretRolls.length} secret checks</label><div class="sf-codex-secrets" hidden>${secretHTML}</div><label>Recap HTML<textarea name="recap" rows="12">${escapeHTML(snapshot)}</textarea></label><details><summary>Preview</summary><div class="sf-codex-recap-preview">${snapshot}</div></details>`,
    render: (_event, dialog) => {
      const root = dialog.element;
      root.querySelector('[name="secrets"]').addEventListener('change', event => {
        root.querySelector('.sf-codex-secrets').hidden = !event.target.checked;
      });
      root.querySelector('[name="recap"]').addEventListener('input', event => {
        // Show edited HTML as text so the preview never executes user markup.
        const preview = root.querySelector('.sf-codex-recap-preview');
        preview.textContent = event.target.value;
      });
    },
    buttons: [{ action: 'append', label: 'Append to Notes', callback: (_e, b) => ({ target: b.form.elements.target.value, html: b.form.elements.recap.value, secrets: b.form.elements.secrets.checked }) }, { action: 'cancel', label: 'Cancel' }], rejectClose: false,
  });
  if (!result?.target) return;
  const target = await resolve(result.target);
  if (!target) throw new Error('Destination journal no longer exists.');
  const html = `${result.html}${result.secrets ? secretHTML : ''}`;
  await appendCodexRecap(target, html);
  ui.notifications.info('StoryFrame recap appended to Codex Notes.');
}
function report(action) {
  return async event => {
    event.preventDefault(); event.stopPropagation();
    const button = event.currentTarget;
    button.disabled = true;
    try { await action(); } catch (error) { ui.notifications.error(error.message); console.error('StoryFrame | Campaign Codex', error); }
    finally { button.disabled = false; }
  };
}
export function renderCodexSheet(sheet, element) {
  if (!isCodexJournal(sheet.document)) return;
  element = sheet.element || element;
  element = element?.[0] || element;
  if (!element?.querySelector) return;
  if (!game.user.isGM || !game.modules.get(CODEX)?.active) {
    element.querySelector('.sf-codex-controls')?.remove();
    element.querySelector('.storyframe-sidebar-toggle')?.remove();
    return;
  }
  loadCSS('styles/integrations/campaign-codex.css');
  handleJournalRender(sheet, element);
  if (element.querySelector('.sf-codex-controls')) return;
  const header = element.querySelector('.window-header');
  if (!header) return;
  const controls = document.createElement('div');
  controls.className = 'sf-codex-controls';
  const actions = [['Stage', () => openStage(sheet.document)], ['Recap', () => exportRecap(sheet.document)]];
  if (sheet.document.getFlag(CODEX, 'type') === 'npc') actions.push(['Add speaker', () => addSpeaker(sheet.document)], ['Speak', () => addSpeaker(sheet.document, true)]);
  for (const [label, action] of actions) {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = label; button.title = `${label} — StoryFrame`;
    button.addEventListener('click', report(action)); controls.appendChild(button);
  }
  header.appendChild(controls);
}
export function initializeCampaignCodex() {
  if (initialized || !game.modules.get(CODEX)?.active) return;
  initialized = true;
  game.storyframe.campaignCodex = { stage: openStage, save: saveCodexStage, collect: collectCodexStage,
    addSpeaker, exportRecap, appendRecap: appendCodexRecap };
  Hooks.on('renderApplicationV2', renderCodexSheet);
  Hooks.on('updateUser', user => {
    if (user.id !== game.user.id || game.user.isGM) return;
    sessions.clear();
    if (isCodexJournal(game.storyframe.gmSidebar?.parentInterface?.document)) game.storyframe.gmSidebar.close();
    for (const sheet of foundry.applications.instances?.values() || []) {
      if (sheet.options?.classes?.includes('sf-codex-dialog')) sheet.close();
      renderCodexSheet(sheet, sheet.element);
    }
  });
  Hooks.on('closeApplicationV2', sheet => { if (isCodexJournal(sheet.document)) handleJournalClose(sheet); });
  Hooks.on('updateScene', (scene) => {
    if (scene.id === game.scenes.current?.id) captureSession(scene.getFlag(MODULE_ID, FLAG_KEY));
  });
  Hooks.on('storyframe.dialogueSent', data => {
    if (!game.user.isGM) return;
    const session = sessions.get(game.scenes.current?.id);
    if (!session) return;
    const state = game.storyframe.stateManager.getState();
    const speaker = state.speakers.find(s => s.id === state.activeSpeaker);
    session.dialogues.push({ speaker: speaker?.isNameHidden ? 'Unknown speaker' : speaker?.label || 'Narrator', text: data.originalText || data.text || '' });
    if (session.dialogues.length > 1000) session.dialogues.shift();
  });
}
