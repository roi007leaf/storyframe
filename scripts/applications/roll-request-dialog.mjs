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
    this.allowOnlyOne = false; // Allow-only-one toggle state
    this._autoSized = false;
    this.resolve = null;
    this.promise = new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  async _onRender(_context, _options) {
    super._onRender(_context, _options);

    // Wire up participant checkboxes to enable/disable submit button
    const submitBtn = this.element.querySelector('.submit-btn');
    const checkboxes = this.element.querySelectorAll('input[name="participant"]');

    const updateSubmit = () => {
      const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
      submitBtn.disabled = !anyChecked;
    };

    checkboxes.forEach(cb => cb.addEventListener('change', updateSubmit));
    updateSubmit();

    // Delegate remove-button clicks on the checks list
    const checksList = this.element.querySelector('.checks-list');
    checksList?.addEventListener('click', (e) => {
      const btn = e.target.closest('.check-remove-btn');
      if (!btn) return;
      const uid = btn.dataset.uid;
      if (uid) this._removeCheck(uid);
    });

    if (this._autoSized) return;
    this._autoSized = true;

    await this._autoSizeToContent();
  }

  async _autoSizeToContent() {
    await new Promise((resolve) => setTimeout(resolve, 0));
    this.setPosition({ height: 'auto' });
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

    // Get selected participant IDs
    const selectedIds = data.participant
      ? (Array.isArray(data.participant) ? data.participant : [data.participant])
      : [];

    // Get allow-only-one checkbox state
    const allowOnlyOne = data.allowOnlyOne || false;
    // One shared batchGroupId so all concurrent subscribers use the same group
    const batchGroupId = allowOnlyOne ? foundry.utils.randomID() : null;

    const resolve = this.resolve;
    this.resolve = null;
    resolve({ selectedIds, allowOnlyOne, batchGroupId, checks: this.checks });
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
