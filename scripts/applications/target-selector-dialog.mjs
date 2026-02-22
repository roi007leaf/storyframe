/**
 * Target Selector Dialog
 * Opens when the GM Ctrl+clicks a damage roll link in a journal.
 * Shows all PC tokens on the scene, lets the GM pick targets,
 * then sets game.user.targets before executing the roll.
 */
export class TargetSelectorDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  static DEFAULT_OPTIONS = {
    id: 'storyframe-target-selector',
    window: {
      title: 'STORYFRAME.WindowTitles.TargetSelector',
      icon: 'fas fa-bullseye',
      minimizable: false,
      resizable: true,
    },
    position: {
      width: 580,
      height: 'auto',
    },
    classes: ['storyframe', 'target-selector-dialog-app'],
    actions: {
      submit: TargetSelectorDialog._onSubmit,
      cancel: TargetSelectorDialog._onCancel,
    },
  };

  static PARTS = {
    form: {
      template: 'modules/storyframe/templates/target-selector-dialog.hbs',
    },
  };

  constructor({ formula, flavor } = {}, options = {}) {
    super(options);
    this.formula = formula ?? '';
    this.flavor = flavor ?? '';
    this.resolve = null;
    this.promise = new Promise((r) => {
      this.resolve = r;
    });
    this._autoSized = false;
  }

  /**
   * Parse a raw FoundryVTT damage formula + flavor into structured display data.
   * Returns { diceExpr, damageTypes: [{ slug, label }] }.
   * Examples:
   *   "{2d6[fire]}"             → { diceExpr:"2d6", damageTypes:[{slug:"fire",label:"Fire"}] }
   *   "1d8+5[slashing]"         → { diceExpr:"1d8+5", damageTypes:[{slug:"slashing",label:"Slashing"}] }
   *   formula:"2d6", flavor:"fire" → { diceExpr:"2d6", damageTypes:[{slug:"fire",label:"Fire"}] }
   *   "{1d6[fire]+1d4[cold]}"   → { diceExpr:"1d6+1d4", damageTypes:[Fire, Cold] }
   */
  static _parseDamageFormula(formula, flavor) {
    let expr = (formula ?? '').trim().replace(/^\{/, '').replace(/\}$/, '');

    const rawTypes = [];
    expr = expr.replace(/\[([^\]]+)\]/g, (_, t) => { rawTypes.push(t); return ''; }).trim();

    if (rawTypes.length === 0 && flavor) {
      const fl = flavor.replace(/^#+\s*/, '').trim();
      if (fl && !/^\d+d\d+/i.test(fl)) rawTypes.push(fl);
    }

    const unique = [...new Set(rawTypes)];
    const damageTypes = unique.map((t) => ({
      slug: t.toLowerCase().replace(/\s+/g, '-'),
      label: t.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
    }));

    return { diceExpr: expr, damageTypes };
  }

  async _prepareContext(_options) {
    const tokens = (canvas.tokens?.placeables ?? [])
      .filter((tok) => tok.actor?.hasPlayerOwner)
      .map((tok) => ({
        id: tok.id,
        name: tok.document.name,
        img: tok.actor?.img ?? tok.document.texture?.src ?? 'icons/svg/mystery-man.svg',
      }));

    const { diceExpr, damageTypes } = TargetSelectorDialog._parseDamageFormula(this.formula, this.flavor);

    return {
      diceExpr,
      damageTypes,
      tokens,
      i18n: {
        rollingLabel: game.i18n.localize('STORYFRAME.Dialogs.TargetSelector.Rolling'),
        selectTargets: game.i18n.localize('STORYFRAME.Dialogs.TargetSelector.SelectTargets'),
        cancel: game.i18n.localize('STORYFRAME.Dialogs.Cancel'),
        rollDamage: game.i18n.localize('STORYFRAME.Dialogs.TargetSelector.RollDamage'),
        noTokens: game.i18n.localize('STORYFRAME.Dialogs.TargetSelector.NoTokens'),
      },
    };
  }

  async _onRender(_context, _options) {
    super._onRender(_context, _options);

    if (!this._autoSized) {
      this._autoSized = true;
      await new Promise((r) => setTimeout(r, 0));
      this.setPosition({ height: 'auto' });
    }
  }

  async close(options = {}) {
    if (this.resolve) {
      this.resolve(null);
      this.resolve = null;
    }
    return super.close(options);
  }

  static async _onSubmit(event, target) {
    event.preventDefault();
    const checked = target.closest('form').querySelectorAll('input[name="target"]:checked');
    const tokenIds = Array.from(checked).map((cb) => cb.value);
    const resolve = this.resolve;
    this.resolve = null;
    resolve({ tokenIds });
    this.close();
  }

  static async _onCancel(_event, _target) {
    const resolve = this.resolve;
    this.resolve = null;
    resolve(null);
    this.close();
  }

  /**
   * Factory method — creates and renders a new dialog, returns its promise.
   * @param {{ formula: string, flavor: string }} opts
   * @returns {Promise<{ tokenIds: string[] }|null>}
   */
  static async open({ formula, flavor } = {}) {
    const dialog = new TargetSelectorDialog({ formula, flavor });
    dialog.render(true);
    return dialog.promise;
  }
}
