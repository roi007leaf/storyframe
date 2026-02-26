import * as SystemAdapter from '../system-adapter.mjs';

/**
 * Dialog for requesting rolls from selected journal text
 */
export class RollRequestDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  /** Currently open instance — only one roll request dialog at a time */
  static _instance = null;

  static DEFAULT_OPTIONS = {
    id: 'storyframe-roll-request-{id}',
    window: {
      title: 'STORYFRAME.WindowTitles.RequestRolls',
      icon: 'fas fa-dice-d20',
      minimizable: false,
      resizable: true,
    },
    position: {
      width: 480,
      height: 'auto',
    },
    classes: ['storyframe', 'roll-request-dialog-app'],
    actions: {
      submit: RollRequestDialog._onSubmit,
      cancel: RollRequestDialog._onCancel,
    },
  };

  static PARTS = {
    form: {
      template: 'modules/storyframe/templates/roll-request-dialog.hbs',
    },
  };

  constructor(checks, participants, options = {}) {
    super(options);
    this.checks = checks.map(c => ({ ...c, _uid: c._uid || foundry.utils.randomID() }));
    this.participants = participants;
    // Map<checkUid, Set<pcId>> — explicit drag-links between a check and specific PCs.
    // Checks with entries here are sent only to those PCs (ignoring the global checkbox selection).
    // Checks without entries fall back to the globally selected PCs.
    this._links = new Map();
    this.allowOnlyOne = false; // Allow-only-one toggle state
    this._draggingUid = null;  // UID of the check currently being dragged
    this._autoSized = false;
    this.resolve = null;
    this.promise = new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  async _onRender(_context, _options) {
    super._onRender(_context, _options);

    // Wire up participant checkboxes to enable/disable submit button
    const checkboxes = this.element.querySelectorAll('input[name="participant"]');
    checkboxes.forEach(cb => cb.addEventListener('change', () => this._updateSubmitState()));
    this._updateSubmitState();

    // Delegate remove-button clicks on the checks list
    const checksList = this.element.querySelector('.checks-list');
    checksList?.addEventListener('click', (e) => {
      const btn = e.target.closest('.check-remove-btn');
      if (!btn) return;
      const uid = btn.dataset.uid;
      if (uid) this._removeCheck(uid);
    });

    // Set up drag-to-link interaction
    this._setupDragAndDrop();

    if (this._autoSized) return;
    this._autoSized = true;

    await this._autoSizeToContent();
  }

  async _autoSizeToContent() {
    await new Promise((resolve) => setTimeout(resolve, 0));
    this.setPosition({ height: 'auto' });
  }

  /**
   * Enable/disable the submit button based on whether there is at least one target
   * (either a globally checked PC or at least one drag-link).
   */
  _updateSubmitState() {
    const submitBtn = this.element?.querySelector('.submit-btn');
    if (!submitBtn) return;

    const anyChecked = Array.from(
      this.element.querySelectorAll('input[name="participant"]'),
    ).some(cb => cb.checked);

    const anyLinked = Array.from(this._links.values()).some(s => s.size > 0);

    submitBtn.disabled = !anyChecked && !anyLinked;
  }

  /**
   * Wire up HTML5 drag-and-drop so that dragging a check onto a PC card creates an
   * explicit link: that check will be sent only to explicitly linked PCs (not the
   * global checkbox selection).  Clicking a linked-PC avatar on a check row removes
   * that individual link.
   */
  _setupDragAndDrop() {
    const checksList = this.element?.querySelector('.checks-list');
    const participantsGrid = this.element?.querySelector('.participants-grid');
    if (!checksList || !participantsGrid) return;

    // --- Drag source: check items ---

    checksList.addEventListener('dragstart', (e) => {
      const item = e.target.closest('.check-item');
      if (!item) return;
      this._draggingUid = item.dataset.uid;
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', item.dataset.uid);
      item.classList.add('dragging');
      participantsGrid.classList.add('drag-active');
    });

    checksList.addEventListener('dragend', (e) => {
      const item = e.target.closest('.check-item');
      if (item) item.classList.remove('dragging');
      this._draggingUid = null;
      participantsGrid.classList.remove('drag-active');
      participantsGrid.querySelectorAll('.participant-content.drop-target, .participant-content.drop-ineligible').forEach(el => {
        el.classList.remove('drop-target', 'drop-ineligible');
      });
    });

    // --- Drop targets: PC cards ---

    participantsGrid.addEventListener('dragover', (e) => {
      const content = e.target.closest('.participant-content');
      if (!content) return;
      e.preventDefault();

      // If the dragged check has eligibility restrictions, show a not-allowed indicator
      // for PCs that don't qualify (e.g. a lore skill the PC doesn't possess).
      if (this._draggingUid) {
        const check = this.checks.find(c => c._uid === this._draggingUid);
        const pcLabel = content.closest('.participant-card');
        const pcId = pcLabel?.querySelector('input[name="participant"]')?.value;
        if (check?.eligiblePcIds instanceof Set && pcId && !check.eligiblePcIds.has(pcId)) {
          e.dataTransfer.dropEffect = 'none';
          content.classList.remove('drop-target');
          content.classList.add('drop-ineligible');
          return;
        }
      }

      e.dataTransfer.dropEffect = 'copy';
      content.classList.remove('drop-ineligible');
      content.classList.add('drop-target');
    });

    participantsGrid.addEventListener('dragleave', (e) => {
      const content = e.target.closest('.participant-content');
      if (!content) return;
      // Only remove the class when the cursor genuinely leaves this element
      if (!content.contains(e.relatedTarget)) {
        content.classList.remove('drop-target', 'drop-ineligible');
      }
    });

    participantsGrid.addEventListener('drop', (e) => {
      const content = e.target.closest('.participant-content');
      if (!content) return;
      e.preventDefault();
      content.classList.remove('drop-target', 'drop-ineligible');
      const uid = e.dataTransfer.getData('text/plain');
      const pcLabel = content.closest('.participant-card');
      const pcId = pcLabel?.querySelector('input[name="participant"]')?.value;
      if (uid && pcId) this._addLink(uid, pcId);
    });

    // --- Remove a link by clicking the PC avatar on the check row ---

    checksList.addEventListener('click', (e) => {
      const avatar = e.target.closest('.check-linked-pc');
      if (!avatar) return;
      const uid = avatar.dataset.uid;
      const pcId = avatar.dataset.pcId;
      if (uid && pcId) this._removeLink(uid, pcId);
    });
  }

  /**
   * Create a drag-link between a check and a PC.
   * Idempotent — calling it twice for the same pair is a no-op.
   */
  _addLink(uid, pcId) {
    // Reject the link if this PC is ineligible for the check (e.g. missing lore skill).
    const check = this.checks.find(c => c._uid === uid);
    if (check?.eligiblePcIds instanceof Set && !check.eligiblePcIds.has(pcId)) {
      const pc = this.participants.find(p => p.id === pcId);
      const systemSkills = SystemAdapter.getSkills();
      const skillName = systemSkills[check.skillName]?.name
        || check.skillName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      ui.notifications.warn(game.i18n.format('STORYFRAME.Notifications.SkillCheck.PCLacksSkill', {
        name: pc?.name ?? pcId,
        skillName,
      }));
      return;
    }

    if (!this._links.has(uid)) this._links.set(uid, new Set());
    const links = this._links.get(uid);
    if (links.has(pcId)) return; // Already linked
    links.add(pcId);

    // Add a small PC avatar to the check row
    const checkItem = this.element?.querySelector(`.check-item[data-uid="${uid}"]`);
    if (checkItem) {
      const pcsContainer = checkItem.querySelector('.check-linked-pcs');
      if (pcsContainer) {
        const pc = this.participants.find(p => p.id === pcId);
        if (pc) {
          const unlinkLabel = game.i18n.format('STORYFRAME.Dialogs.RollRequest.UnlinkPC', { name: pc.name });
          const img = document.createElement('img');
          img.className = 'check-linked-pc';
          img.src = pc.img || 'icons/svg/mystery-man.svg';
          img.alt = pc.name;
          img.title = unlinkLabel;
          img.dataset.uid = uid;
          img.dataset.pcId = pcId;
          pcsContainer.appendChild(img);
        }
      }
      checkItem.classList.add('has-links');
    }

    // Update the badge on the PC card
    this._updatePcLinkBadge(pcId);
    this._updateSubmitState();
  }

  /**
   * Remove a drag-link between a check and a PC.
   */
  _removeLink(uid, pcId) {
    const links = this._links.get(uid);
    if (!links) return;
    links.delete(pcId);
    if (links.size === 0) this._links.delete(uid);

    // Remove the avatar from the check row
    const checkItem = this.element?.querySelector(`.check-item[data-uid="${uid}"]`);
    if (checkItem) {
      checkItem.querySelector(`.check-linked-pc[data-uid="${uid}"][data-pc-id="${pcId}"]`)?.remove();
      if (!this._links.has(uid)) {
        checkItem.classList.remove('has-links');
      }
    }

    this._updatePcLinkBadge(pcId);
    this._updateSubmitState();
  }

  /**
   * Refresh the link-count badge on a PC card.
   * The badge shows how many checks are explicitly linked to that PC.
   */
  _updatePcLinkBadge(pcId) {
    const input = this.element?.querySelector(`input[name="participant"][value="${pcId}"]`);
    const content = input?.closest('.participant-card')?.querySelector('.participant-content');
    if (!content) return;

    let count = 0;
    for (const links of this._links.values()) {
      if (links.has(pcId)) count++;
    }

    let badge = content.querySelector('.pc-link-badge');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'pc-link-badge';
        content.appendChild(badge);
      }
      badge.textContent = count;
    } else {
      badge?.remove();
    }
  }

  /**
   * Enrich a single check with display data (icon, display name, action name, variant).
   * Shared by _prepareContext (initial render) and addChecks (DOM injection).
   */
  _enrichCheck(check) {
    const systemSkills = SystemAdapter.getSkills();
    const systemSaves = SystemAdapter.getSaves();

    const checkType = check.checkType || 'skill';
    const lookupTable = checkType === 'save' ? systemSaves : systemSkills;

    // Try to find check data by various methods
    let checkData = lookupTable[check.skillName]
      || lookupTable[check.skillName.toLowerCase()]
      || null;

    if (!checkData) {
      const searchName = check.skillName.toLowerCase();
      for (const [key, data] of Object.entries(lookupTable)) {
        if (data.name?.toLowerCase() === searchName || key === searchName) {
          checkData = data;
          break;
        }
      }
    }

    // Compute action display name — prefer system action table, fall back to formatting the slug.
    // Never use data-pf2-label as the action name: labels like "thievery DC" describe the check,
    // not the action being performed.
    let actionName = null;
    if (check.actionSlug) {
      const skillData = systemSkills[check.skillName];
      const action = skillData?.actions?.find(a => a.slug === check.actionSlug);
      actionName = action?.name
        ?? check.actionSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    // Compute variant display name
    const variantName = check.actionVariant
      ? check.actionVariant.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      : null;

    return {
      ...check,
      skillIcon: checkData?.icon || 'fa-dice-d20',
      skillName: checkData?.name || check.skillName,
      checkType,
      actionName,
      variantName,
    };
  }

  /**
   * Build the inner HTML for a single check list item (mirrors roll-request-dialog.hbs).
   */
  _renderCheckItemHTML(enriched) {
    const actionPart = enriched.actionName
      ? `<span class="check-action-name"> (${enriched.actionName}${enriched.variantName ? ': ' + enriched.variantName : ''})</span>`
      : '';
    const dcPart = enriched.dc ? `<span class="check-dc">DC ${enriched.dc}</span>` : '';
    const secretLabel = game.i18n.localize('STORYFRAME.Dialogs.RollRequest.Secret');
    const secretBadge = enriched.isSecret
      ? `<span class="check-secret-badge"><i class="fas fa-eye-slash"></i> ${secretLabel}</span>`
      : '';
    const removeBtnAriaLabel = game.i18n.localize('STORYFRAME.Dialogs.RollRequest.RemoveCheck');
    const removeBtn = `<button type="button" class="check-remove-btn" data-uid="${enriched._uid}" aria-label="${removeBtnAriaLabel}"><i class="fas fa-times"></i></button>`;
    return `<div class="check-info">
      <i class="fas ${enriched.skillIcon}"></i>
      <span class="check-skill">${enriched.skillName}${actionPart}</span>
      ${dcPart}
      ${secretBadge}
      <div class="check-linked-pcs"></div>
      ${removeBtn}
    </div>`;
  }

  async _prepareContext(_options) {
    const enrichedChecks = this.checks.map(check => this._enrichCheck(check));

    // Ensure participants have required properties with fallbacks
    const unknownLabel = game.i18n.localize('STORYFRAME.UI.Labels.Unknown');
    const enrichedParticipants = this.participants.map(p => ({
      id: p.id,
      name: p.name || unknownLabel,
      img: p.img || 'icons/svg/mystery-man.svg',
    }));

    // Detect what types of checks are present (skills, saves, or both)
    const hasSkills = enrichedChecks.some(check => check.checkType !== 'save');
    const hasSaves = enrichedChecks.some(check => check.checkType === 'save');

    let foundChecksText;
    if (hasSkills && hasSaves) {
      foundChecksText = game.i18n.format('STORYFRAME.Dialogs.RollRequest.FoundChecksAndSaves', { count: enrichedChecks.length });
    } else if (hasSaves) {
      foundChecksText = game.i18n.format('STORYFRAME.Dialogs.RollRequest.FoundSaves', { count: enrichedChecks.length });
    } else {
      foundChecksText = game.i18n.format('STORYFRAME.Dialogs.RollRequest.FoundChecks', { count: enrichedChecks.length });
    }

    return {
      checks: enrichedChecks,
      participants: enrichedParticipants,
      allowOnlyOne: this.allowOnlyOne,
      i18n: {
        foundChecks: foundChecksText,
        dragHint: game.i18n.localize('STORYFRAME.Dialogs.RollRequest.DragHint'),
        selectPCs: game.i18n.localize('STORYFRAME.Dialogs.RollRequest.SelectPCs'),
        cancel: game.i18n.localize('STORYFRAME.Dialogs.Cancel'),
        sendRollRequests: game.i18n.localize('STORYFRAME.Dialogs.RollRequest.SendRollRequests'),
        secret: game.i18n.localize('STORYFRAME.Dialogs.RollRequest.Secret'),
        allowOnlyOneLabel: game.i18n.localize('STORYFRAME.Dialogs.RollRequest.AllowOnlyOne'),
      },
    };
  }

  /**
   * Wait for the dialog to be resolved
   * @returns {Promise<string[]|null>} Selected participant IDs or null if cancelled
   */
  async wait() {
    return this.promise;
  }

  /**
   * Subscribe to a roll request dialog.
   * If one is already open, adds the checks to it and returns its existing promise
   * so the caller still receives the result when the dialog closes.
   * If not, opens a new dialog.
   * Every subscriber gets the same {selectedIds, allowOnlyOne, batchGroupId} result
   * and is responsible for sending only its own check(s).
   * @param {Array} checks
   * @param {Array} pcs  Only used when creating a new dialog.
   */
  static async subscribe(checks, pcs) {
    // Pre-assign UIDs so we can identify this subscriber's checks in the resolved result.
    const myChecks = checks.map(c => ({ ...c, _uid: c._uid || foundry.utils.randomID() }));
    const myUids = new Set(myChecks.map(c => c._uid));

    // Filter the shared result down to only the checks that belong to this subscriber
    // and that survived removal. If none survived, return null (treated as cancel by callers).
    const filterForSubscriber = (result) => {
      if (!result) return null;
      const surviving = (result.checks || []).filter(c => myUids.has(c._uid));
      return surviving.length === 0 ? null : { ...result, checks: surviving };
    };

    if (RollRequestDialog._instance) {
      await RollRequestDialog._instance.addChecks(myChecks);
      return RollRequestDialog._instance.promise.then(filterForSubscriber);
    }
    const dialog = new RollRequestDialog(myChecks, pcs);
    RollRequestDialog._instance = dialog;
    dialog.render(true);
    return dialog.promise.then(filterForSubscriber);
  }

  /**
   * Add checks to the open dialog without re-rendering.
   * Duplicates (same skill, action, variant, dc, secret) are silently dropped.
   */
  async addChecks(newChecks) {
    // Drop duplicates of checks already in the dialog
    const deduped = newChecks
      .filter(nc => !this.checks.some(ec =>
        ec.skillName === nc.skillName &&
        (ec.actionSlug ?? null) === (nc.actionSlug ?? null) &&
        (ec.actionVariant ?? null) === (nc.actionVariant ?? null) &&
        ec.dc === nc.dc &&
        Boolean(ec.isSecret) === Boolean(nc.isSecret),
      ))
      .map(c => ({ ...c, _uid: c._uid || foundry.utils.randomID() }));

    if (deduped.length === 0) {
      if (this.element) this.bringToTop?.();
      return;
    }

    this.checks = [...this.checks, ...deduped];

    // Inject new items directly into the DOM — no full re-render
    const checksList = this.element?.querySelector('.checks-list');
    if (checksList) {
      for (const check of deduped) {
        const enriched = this._enrichCheck(check);
        const li = document.createElement('li');
        li.className = 'check-item';
        li.dataset.uid = enriched._uid;
        li.draggable = true;
        li.innerHTML = this._renderCheckItemHTML(enriched);
        checksList.appendChild(li);
      }

      // Update the header count
      const header = this.element?.querySelector('.checks-summary h3');
      if (header) {
        const hasSkills = this.checks.some(c => c.checkType !== 'save');
        const hasSaves = this.checks.some(c => c.checkType === 'save');
        let key;
        if (hasSkills && hasSaves) key = 'STORYFRAME.Dialogs.RollRequest.FoundChecksAndSaves';
        else if (hasSaves) key = 'STORYFRAME.Dialogs.RollRequest.FoundSaves';
        else key = 'STORYFRAME.Dialogs.RollRequest.FoundChecks';
        header.textContent = game.i18n.format(key, { count: this.checks.length });
      }
    }

    // Grow the window by however much the new items overflow the current visible area.
    // We do this with a direct pixel increment rather than setPosition({ height: 'auto' })
    // to avoid the collapse-then-expand flicker that 'auto' causes.
    const inner = this.element?.querySelector('.window-content');
    if (inner) {
      const overflow = inner.scrollHeight - inner.clientHeight;
      if (overflow > 0) {
        this.setPosition({ height: (this.position?.height ?? this.element.offsetHeight) + overflow });
      }
    }

    if (this.element) this.bringToTop?.();
  }

  /**
   * Remove a single check row by its unique id.
   * If the last check is removed the dialog closes (resolves null).
   */
  _removeCheck(uid) {
    this.checks = this.checks.filter(c => c._uid !== uid);
    this.element?.querySelector(`.check-item[data-uid="${uid}"]`)?.remove();

    // Clean up any drag-links for this check and refresh affected PC badges
    if (this._links.has(uid)) {
      const affectedPcIds = [...this._links.get(uid)];
      this._links.delete(uid);
      affectedPcIds.forEach(pcId => this._updatePcLinkBadge(pcId));
      this._updateSubmitState();
    }

    // Update header count
    const header = this.element?.querySelector('.checks-summary h3');
    if (header) {
      const hasSkills = this.checks.some(c => c.checkType !== 'save');
      const hasSaves = this.checks.some(c => c.checkType === 'save');
      let key;
      if (hasSkills && hasSaves) key = 'STORYFRAME.Dialogs.RollRequest.FoundChecksAndSaves';
      else if (hasSaves) key = 'STORYFRAME.Dialogs.RollRequest.FoundSaves';
      else key = 'STORYFRAME.Dialogs.RollRequest.FoundChecks';
      header.textContent = game.i18n.format(key, { count: this.checks.length });
    }

    // Close (cancel) when all checks have been removed
    if (this.checks.length === 0) {
      const resolve = this.resolve;
      this.resolve = null;
      resolve(null);
      this.close();
    }
  }

  static async _onSubmit(event, target) {
    event.preventDefault();
    const form = target.closest('form');
    const formData = new FormDataExtended(form);
    const data = formData.object;

    // Get selected participant IDs (global checkbox selection)
    const selectedIds = data.participant
      ? (Array.isArray(data.participant) ? data.participant : [data.participant])
      : [];

    // Get allow-only-one checkbox state
    const allowOnlyOne = data.allowOnlyOne || false;
    // One shared batchGroupId so all concurrent subscribers use the same group
    const batchGroupId = allowOnlyOne ? foundry.utils.randomID() : null;

    // Attach per-check targetIds: explicit drag-links take priority over global selection.
    // A null targetIds means "fall back to selectedIds" in the caller.
    const checks = this.checks.map(check => {
      const explicitLinks = this._links.get(check._uid);
      return {
        ...check,
        targetIds: explicitLinks?.size > 0 ? [...explicitLinks] : null,
      };
    });

    const resolve = this.resolve;
    this.resolve = null;
    resolve({ selectedIds, allowOnlyOne, batchGroupId, checks });
    this.close();
  }

  static async _onCancel(_event, _target) {
    const resolve = this.resolve;
    this.resolve = null;
    resolve(null);
    this.close();
  }

  async close(options = {}) {
    RollRequestDialog._instance = null;
    // Ensure promise resolves even if closed via X button
    if (this.resolve) {
      this.resolve(null);
      this.resolve = null;
    }
    return super.close(options);
  }
}
