import { MODULE_ID } from '../../constants.mjs';
import * as SystemAdapter from '../../system-adapter.mjs';

// Import manager modules
import * as ChallengeHandlers from './managers/challenge-handlers.mjs';
import * as DCHandlers from './managers/dc-handlers.mjs';
import * as JournalHandlers from './managers/journal-handlers.mjs';
import * as SkillCheckHandlers from './managers/skill-check-handlers.mjs';
import * as SkillReorderHandlers from './managers/skill-reorder-handlers.mjs';
import * as SpeakerHandlers from './managers/speaker-handlers.mjs';
import * as UIHelpers from './managers/ui-helpers.mjs';

/**
 * GM Sidebar for StoryFrame
 * Drawer-style window that attaches to native Foundry journal sheets
 */
export class GMSidebarAppBase extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  static DEFAULT_OPTIONS = {
    id: 'storyframe-gm-sidebar',
    classes: ['storyframe', 'gm-sidebar'],
    window: {
      title: 'STORYFRAME.WindowTitles.GMSidebar',
      icon: 'fas fa-book-open',
      resizable: true,
      minimizable: true,
    },
    position: {
      width: 330,
      height: 500,
    },
    actions: {
      addSpeakerFromImage: GMSidebarAppBase._onAddSpeakerFromImage,
      gatherScene: GMSidebarAppBase._onGatherScene,
      setSpeaker: GMSidebarAppBase._onSetSpeaker,
      editSpeaker: GMSidebarAppBase._onEditSpeaker,
      removeSpeaker: GMSidebarAppBase._onRemoveSpeaker,
      toggleSpeakerVisibility: GMSidebarAppBase._onToggleSpeakerVisibility,
      toggleSpeakerHidden: GMSidebarAppBase._onToggleSpeakerHidden,
      cycleSpeakerImageNext: GMSidebarAppBase._onCycleSpeakerImageNext,
      cycleSpeakerImagePrev: GMSidebarAppBase._onCycleSpeakerImagePrev,
      addSpeakerAltImage: GMSidebarAppBase._onAddSpeakerAltImage,
      removeSpeakerAltImage: GMSidebarAppBase._onRemoveSpeakerAltImage,
      clearSpeaker: GMSidebarAppBase._onClearSpeaker,
      clearAllSpeakers: GMSidebarAppBase._onClearAllSpeakers,
      saveCurrentSpeakers: GMSidebarAppBase._onSaveCurrentSpeakers,
      manageScenes: GMSidebarAppBase._onManageScenes,
      toggleGridLock: GMSidebarAppBase._onToggleGridLock,
      switchTab: GMSidebarAppBase._onSwitchTab,
      toggleSecretRoll: GMSidebarAppBase._onToggleSecretRoll,
      toggleAllowOnlyOne: GMSidebarAppBase._onToggleAllowOnlyOne,
      toggleJournalChecksPanel: GMSidebarAppBase._onToggleJournalChecksPanel,
      toggleJournalImagesPanel: GMSidebarAppBase._onToggleJournalImagesPanel,
      requestSkill: GMSidebarAppBase._onRequestSkill,
      requestSave: GMSidebarAppBase._onRequestSave,
      sendBatch: GMSidebarAppBase._onSendBatch,
      openSkillMenu: GMSidebarAppBase._onOpenSkillMenu,
      setDCSelect: GMSidebarAppBase._onSetDCSelect,
      setDifficulty: GMSidebarAppBase._onSetDifficulty,
      cancelRoll: GMSidebarAppBase._onCancelRoll,
      openPlayerWindows: GMSidebarAppBase._onOpenPlayerWindows,
      closePlayerWindows: GMSidebarAppBase._onClosePlayerWindows,
      openPlayerSidebars: GMSidebarAppBase._onOpenPlayerSidebars,
      closePlayerSidebars: GMSidebarAppBase._onClosePlayerSidebars,
      showPendingRolls: GMSidebarAppBase._onShowPendingRolls,
      showActiveChallenges: GMSidebarAppBase._onShowActiveChallenges,
      togglePresetDropdown: GMSidebarAppBase._onTogglePresetDropdown,
      applyPreset: GMSidebarAppBase._onApplyPreset,
      applyPresetDC: GMSidebarAppBase._onApplyPresetDC,
      applyJournalCheck: GMSidebarAppBase._onApplyJournalCheck,
      showCheckDCsPopup: GMSidebarAppBase._onShowCheckDCsPopup,
      setImageAsSpeaker: GMSidebarAppBase._onSetImageAsSpeaker,
      setActorAsSpeaker: GMSidebarAppBase._onSetActorAsSpeaker,
      presentChallenge: GMSidebarAppBase._onPresentChallenge,
      clearChallenge: GMSidebarAppBase._onClearChallenge,
      removeChallenge: GMSidebarAppBase._onRemoveChallenge,
      clearAllChallenges: GMSidebarAppBase._onClearAllChallenges,
      toggleChallengeCollapse: GMSidebarAppBase._onToggleChallengeCollapse,
      toggleLibraryChallengeCollapse: GMSidebarAppBase._onToggleLibraryChallengeCollapse,
      presentSavedChallenge: GMSidebarAppBase._onPresentSavedChallenge,
      editChallenge: GMSidebarAppBase._onEditChallenge,
      deleteChallenge: GMSidebarAppBase._onDeleteChallenge,
      createChallengeFromSelection: GMSidebarAppBase._onCreateChallengeFromSelection,
      requestRollsFromSelection: GMSidebarAppBase._onRequestRollsFromSelection,
      launchSceneMode: GMSidebarAppBase._onLaunchSceneMode,
    },
  };

  static PARTS = {
    content: {
      template: 'modules/storyframe/templates/gm-sidebar.hbs',
      scrollable: ['.gm-sidebar-container', '.speaker-gallery', '.panel-content'],
    },
  };

  /** @type {foundry.applications.sheets.journal.JournalEntrySheet|null} Reference to the parent journal sheet */
  parentInterface = null;

  /** @type {Function|null} Bound handler for parent position changes */
  _parentPositionHandler = null;


  constructor(options = {}) {
    super(options);
    this._stateRestored = false;

    // Tab state: 'npcs', 'pcs', 'challenges'
    this.currentTab = 'npcs'; // Default to NPCs tab

    // Sub-panel state within PCs tab
    this.journalChecksPanelCollapsed = false;
    this.journalImagesPanelCollapsed = true; // Collapsed by default

    this.currentDC = null;
    this.currentDifficulty = 'standard'; // Default difficulty
    this.secretRollEnabled = false; // Secret roll toggle state

    // Track active speaker for change detection
    this._lastActiveSpeaker = null;

    // Track speaker lists for change detection
    this._lastSpeakerIds = [];

    // Track visible journal checks for highlighting
    this._visibleChecks = new Map(); // skill -> Set of DCs

    // Track collapsed state for active challenges
    this.collapsedChallenges = new Map();  // challengeId -> boolean

    // Track collapsed state for library challenges
    this.collapsedLibraryChallenges = new Map();  // challengeId -> boolean

    // Track pending rolls grouping mode
    this.pendingRollsGroupMode = 'actor';  // 'actor' or 'skill'

    // Batch skill selection (shift+click)
    // Array of check objects: { skill: slug, dc: number|null, isSecret: boolean, actionSlug: string|null, checkId: string }
    this.batchedChecks = [];
    this._shiftKeyDown = false;

    // Parent reference (set externally when attaching)
    this.parentInterface = null;
  }

  /**
   * Position the drawer adjacent to the parent journal sheet
   * @param {number} retryCount - Number of retry attempts remaining
   */
  _positionAsDrawer(retryCount = 3) {
    return UIHelpers.positionAsDrawer(this, retryCount);
  }

  /**
   * Start tracking parent journal sheet movements and state changes
   */
  _startTrackingParent() {
    return UIHelpers.startTrackingParent(this);
  }

  /**
   * Stop tracking parent window movements
   */
  _stopTrackingParent() {
    return UIHelpers.stopTrackingParent(this);
  }

  /**
   * Override render to preserve scroll position and handle speaker-only updates
   */
  async _render(force, options) {
    // Check if this is a speaker-only update that we can handle without re-rendering
    if (this._handleSpeakerUpdate()) {
      return;
    }

    // Save scroll positions before render
    const scrollPositions = UIHelpers.saveScrollPositions(this);

    // Perform render
    await super._render(force, options);

    // Update tracked state after render
    const state = game.storyframe.stateManager?.getState();
    if (state) {
      this._lastActiveSpeaker = state.activeSpeaker;
      this._lastSpeakerIds = (state.speakers || []).map(s => s.id);
    }

    // Restore scroll positions after render with multiple attempts to ensure it works
    if (scrollPositions) {
      UIHelpers.restoreScrollPositions(this, scrollPositions);
    }
  }

  /**
   * Check if this render is just for simple state changes and handle them directly
   * @returns {boolean} True if the update was handled without re-rendering
   */
  _handleSpeakerUpdate() {
    if (!this.element) return false;

    const state = game.storyframe.stateManager.getState();
    if (!state) return false;

    let handledUpdate = false;

    // Get current state IDs
    const currentActiveSpeaker = this._lastActiveSpeaker;
    const newActiveSpeaker = state.activeSpeaker;
    const currentSpeakerIds = this._lastSpeakerIds;
    const newSpeakerIds = (state.speakers || []).map(s => s.id);

    // Check if speakers list changed (additions/removals)
    const speakersChanged = JSON.stringify(currentSpeakerIds.sort()) !== JSON.stringify(newSpeakerIds.sort());

    // If speakers were added/removed, we need to re-render
    if (speakersChanged) {
      return false;
    }

    // Check if only the active speaker changed
    if (currentActiveSpeaker !== newActiveSpeaker) {
      // Update speaker UI directly
      const speakers = this.element.querySelectorAll('[data-speaker-id]');
      speakers.forEach((speaker) => {
        const speakerId = speaker.dataset.speakerId;
        const isActive = speakerId === newActiveSpeaker;

        if (isActive) {
          speaker.classList.add('active');
          const removeBtn = speaker.querySelector('.remove-speaker');
          if (removeBtn) {
            removeBtn.style.display = 'flex';
          }
        } else {
          speaker.classList.remove('active');
          const removeBtn = speaker.querySelector('.remove-speaker');
          if (removeBtn) {
            removeBtn.style.display = 'none';
          }
        }
      });

      this._lastActiveSpeaker = newActiveSpeaker;
      handledUpdate = true;
    }

    return handledUpdate;
  }

  /**
   * Handle dragover to allow drop
   */
  _handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  /**
   * Handle drop event
   */
  async _handleDrop(event) {
    event.preventDefault();

    const data = TextEditor.getDragEventData(event);

    // Only handle Actor drops
    if (data.type !== 'Actor') return;

    const actor = await fromUuid(data.uuid);
    if (!actor) {
      ui.notifications.error(game.i18n.localize('STORYFRAME.Notifications.Scene.ActorNotFound'));
      return;
    }

    // Check if ALT key is held to hide name from players
    const isNameHidden = event.altKey;

    // Add actor as speaker (state manager handles duplicate notification)
    // Token image is derived dynamically at render time — no need to store it
    await game.storyframe.socketManager.requestAddSpeaker({
      actorUuid: actor.uuid,
      imagePath: actor.img,
      label: actor.name,
      isNameHidden,
    });
  }

  /**
   * Group journal checks by type (skills vs saves)
   * @param {Array} checkGroups - Array of check groups
   * @returns {object} Separated skill and save groups
   */
  _groupJournalChecksByType(checkGroups) {
    const skillGroups = [];
    const loreGroups = [];
    const saveGroups = [];

    checkGroups.forEach(group => {
      // Each group contains checks with the same skillName
      const hasSkills = group.checks.some(check => check.checkType === 'skill' || !check.checkType);
      const hasSaves = group.checks.some(check => check.checkType === 'save');

      if (hasSkills) {
        const skillChecks = group.checks.filter(check => check.checkType === 'skill' || !check.checkType);
        if (skillChecks.length > 0) {
          const isLore = group.skillSlug?.includes('-lore');
          if (isLore) {
            // Strip the trailing "-lore" / " Lore" for a compact display name.
            // skillName (used as data-skill) stays unchanged for popup/batch compat.
            const displayName = group.skillName.replace(/[- ]?lore$/i, '');
            loreGroups.push({ ...group, displayName, checks: skillChecks });
          } else {
            skillGroups.push({ ...group, checks: skillChecks });
          }
        }
      }

      if (hasSaves) {
        const saveChecks = group.checks.filter(check => check.checkType === 'save');
        if (saveChecks.length > 0) {
          saveGroups.push({
            ...group,
            checks: saveChecks,
          });
        }
      }
    });

    return {
      journalSkillGroups: skillGroups,
      journalLoreGroups: loreGroups,
      journalSaveGroups: saveGroups,
      hasJournalChecks: skillGroups.length > 0,
      hasJournalLore: loreGroups.length > 0,
      hasJournalSaves: saveGroups.length > 0,
    };
  }

  /**
   * Prepare context data for the sidebar template
   * Orchestrates data from all manager modules
   */
  async _prepareContext(_options) {
    // Detect system info (needed throughout the method)
    const currentSystem = SystemAdapter.detectSystem();

    const state = game.storyframe.stateManager.getState();

    // Extract checks, images, and actors from parent journal using journal handlers
    let journalCheckGroups = JournalHandlers.extractJournalChecks(this);
    const groupedChecks = this._groupJournalChecksByType(journalCheckGroups);
    const journalImages = SpeakerHandlers.extractJournalImages(this);
    const journalActors = SpeakerHandlers.extractJournalActors(this);

    if (!state) {
      const dcOptions = SystemAdapter.getDCOptions();
      return {
        speakers: [],
        activeSpeaker: null,
        hasSpeakers: false,
        currentDC: null,
        pendingRolls: [],
        quickButtonSkills: [],
        pcsPanelCollapsed: this.pcsPanelCollapsed,
        currentSystem,
        dcOptions,
        isPF2e: currentSystem === 'pf2e',
        isDND5e: currentSystem === 'dnd5e',
      };
    }

    // Resolve speakers (NPCs)
    const speakers = await Promise.all(
      state.speakers.map(async (speaker) => {
        const resolved = await game.storyframe.stateManager.resolveSpeaker(speaker);

        // Build full image list: actor portrait + token image (if different) + custom images
        // Actor/token images are always available regardless of current selection
        const allImages = [];
        if (speaker.actorUuid) {
          const actor = await fromUuid(speaker.actorUuid);
          if (actor) {
            allImages.push(actor.img);
            const tokenImg = actor.prototypeToken?.texture?.src;
            if (tokenImg && tokenImg !== actor.img) allImages.push(tokenImg);
          }
        } else if (resolved.img) {
          allImages.push(resolved.img);
        }
        (speaker.altImages || []).forEach((img) => { if (!allImages.includes(img)) allImages.push(img); });

        const currentImg = resolved.img;
        const result = {
          id: speaker.id,
          img: currentImg,
          name: resolved.name,
          isNameHidden: speaker.isNameHidden || false,
          isHidden: speaker.isHidden || false,
          hasAltImages: allImages.length > 1,
          canRemoveCurrentImage: (speaker.altImages || []).includes(currentImg),
          currentImagePath: currentImg,
        };

        if (speaker.actorUuid) {
          const actor = await fromUuid(speaker.actorUuid);
          if (!actor) {
            result.actorDeleted = true;
          }
        }

        return result;
      }),
    );

    // Pending rolls with names
    const pendingRolls = await Promise.all(
      (state.pendingRolls || []).map(async (r) => {
        const actor = r.actorUuid ? await fromUuid(r.actorUuid) : null;
        const actionName = r.actionSlug ? SkillCheckHandlers.getActionName(r.skillSlug, r.actionSlug) : null;
        return {
          ...r,
          participantName: actor?.name || 'Unknown',
          skillName: SkillCheckHandlers.getSkillName(r.skillSlug),
          actionName,
        };
      }),
    );

    // All system skills as skill objects
    const systemSkillsMap = SystemAdapter.getSkills();
    const allSkillsData = Object.entries(systemSkillsMap).map(([slug]) => ({
      slug,
      name: SkillCheckHandlers.getSkillName(slug),
      shortName: SkillCheckHandlers.getSkillShortName(slug),
      icon: SkillCheckHandlers.getSkillIcon(slug),
    }));

    // Categorize skills (system-specific, provided by subclass)
    const skillCategories = this._getSkillCategories();

    const categorizedSkills = {
      physicalSkills: await SkillCheckHandlers.mapSkillsWithProficiency(skillCategories.physical, allSkillsData, null),
      magicalSkills: await SkillCheckHandlers.mapSkillsWithProficiency(skillCategories.magical, allSkillsData, null),
      socialSkills: await SkillCheckHandlers.mapSkillsWithProficiency(skillCategories.social, allSkillsData, null),
      utilitySkills: await SkillCheckHandlers.mapSkillsWithProficiency(skillCategories.utility, allSkillsData, null),
    };

    // Apply saved skill order within each category
    categorizedSkills.physicalSkills = SkillReorderHandlers.applySavedSkillOrder(categorizedSkills.physicalSkills, 'physical');
    categorizedSkills.magicalSkills = SkillReorderHandlers.applySavedSkillOrder(categorizedSkills.magicalSkills, 'magical');
    categorizedSkills.socialSkills = SkillReorderHandlers.applySavedSkillOrder(categorizedSkills.socialSkills, 'social');
    categorizedSkills.utilitySkills = SkillReorderHandlers.applySavedSkillOrder(categorizedSkills.utilitySkills, 'utility');

    // Apply saved category order
    SkillReorderHandlers.applySavedCategoryOrder(categorizedSkills);

    // Get lore skills from all player PCs
    const loreSkills = await this.constructor._getLoreSkills(null, null);

    // Get system-specific DC context using DC handlers
    const dcContext = await DCHandlers.prepareDCContext(this);
    const systemContext = await this._prepareContextSystemSpecific();
    const { partyLevel = null, calculatedDC = null, difficultyOptions = null } = systemContext;

    // Load DC presets
    const allPresets = game.settings.get(MODULE_ID, 'dcPresets') || [];
    const dcPresets = allPresets.filter((p) => !p.system || p.system === currentSystem);

    // Prepare challenges context
    const challengesContext = await ChallengeHandlers.prepareChallengesContext(this, state);

    // Check for saved speaker scenes
    const speakerScenes = game.settings.get(MODULE_ID, 'speakerScenes') || [];

    return {
      speakers,
      activeSpeaker: state.activeSpeaker,
      hasSpeakers: speakers.length > 0,
      hasSpeakerScenes: speakerScenes.length > 0,
      gridLocked: this._gridLocked ?? false,
      gridLockedSize: this._gridLockedSize ?? null,
      gridSliderSize: this._gridSliderSize ?? 100,
      speakerControlsMode: game.settings.get(MODULE_ID, 'speakerControlsMode') ?? 'hover',
      ...dcContext,
      partyLevel,
      calculatedDC,
      currentDifficulty: this.currentDifficulty,
      difficultyOptions,
      pendingRolls,
      ...categorizedSkills,
      loreSkills,
      hasLoreSkills: loreSkills.length > 0,
      currentTab: this.currentTab,
      secretRollEnabled: this.secretRollEnabled || false,
      journalChecksPanelCollapsed: this.journalChecksPanelCollapsed,
      journalImagesPanelCollapsed: this.journalImagesPanelCollapsed,
      currentSystem,
      isPF2e: currentSystem === 'pf2e',
      isDND5e: currentSystem === 'dnd5e',
      dcPresets,
      journalCheckGroups, // Keep for backward compatibility
      ...groupedChecks, // Adds journalSkillGroups, journalSaveGroups, hasJournalChecks, hasJournalSaves
      journalImages,
      hasJournalImages: journalImages.length > 0,
      journalActors,
      hasJournalActors: journalActors.length > 0,
      ...challengesContext,
    };
  }

  /**
   * Extract checks from parent journal content
   * Subclasses override to parse system-specific check formats
   */
  _parseChecksFromContent(_content) {
    return []; // Override in subclass
  }

  /**
   * Resolve participant name from actor UUID
   */
  async _resolveParticipantName(participant) {
    const actor = await fromUuid(participant.actorUuid);
    return actor?.name || 'Unknown';
  }

  /**
   * Get party level (override in system-specific subclass)
   */
  async _getPartyLevel() {
    return null;
  }

  /**
   * Calculate DC by level (override in system-specific subclass)
   */
  _calculateDCByLevel(_level, _difficultyId) {
    return null;
  }

  /**
   * Get skill category slugs for the current system (override in system-specific subclass)
   * @returns {{ physical: string[], magical: string[], social: string[], utility: string[] }}
   */
  _getSkillCategories() {
    return {
      physical: ['acr', 'ath', 'ste', 'thi'],
      magical: ['arc', 'nat', 'occ', 'rel'],
      social: ['dec', 'dip', 'itm', 'prf', 'soc'],
      utility: ['cra', 'med', 'per', 'sur'],
    };
  }

  /**
   * Prepare system-specific context (override in system-specific subclass)
   */
  async _prepareContextSystemSpecific() {
    return {};
  }

  /**
   * Attach system-specific DC handlers (override in system-specific subclass)
   */
  _attachSystemDCHandlers() {
    // Override in subclass
  }

  /**
   * Check if actor has a specific skill (override in system-specific subclass)
   */
  async _actorHasSkill(_actor, _skillSlug) {
    return false;
  }

  /**
   * Get lore skills (override in PF2e subclass)
   */
  static async _getLoreSkills(_state, _selectedParticipants) {
    return [];
  }

  /**
   * Get available skills from selected participants (override in system-specific subclass)
   */
  static async _getAvailableSkills(_state, _selectedParticipants) {
    return new Set();
  }

  /**
   * Check actor proficiency (override in system-specific subclass)
   */
  static async _isActorProficientInSkill(_actor, _skillSlug) {
    return false;
  }

  /**
   * Get actor proficiency rank (override in system-specific subclass)
   */
  static async _getActorProficiencyRank(_actor, _skillSlug) {
    return 0;
  }

  /**
   * Attach event handlers after render
   */
  async _onRender(_context, _options) {
    // Position as drawer and track parent only if attached to a journal
    if (this.parentInterface) {
      // Add drawer class for drawer-specific styling
      this.element.classList.add('drawer');
      this._positionAsDrawer();
      this._startTrackingParent();
    } else {
      // Remove drawer class for standalone mode
      this.element.classList.remove('drawer');
    }

    // Set up drag-drop for actors (remove old listeners first)
    if (this._dropHandler) {
      this.element.removeEventListener('drop', this._dropHandler);
      this.element.removeEventListener('dragover', this._dragoverHandler);
    }
    this._dropHandler = this._handleDrop.bind(this);
    this._dragoverHandler = this._handleDragOver.bind(this);
    this.element.addEventListener('drop', this._dropHandler);
    this.element.addEventListener('dragover', this._dragoverHandler);

    // Attach DC handlers
    DCHandlers.attachDCHandlers(this);

    // Attach system-specific DC handlers (calls subclass method)
    this._attachSystemDCHandlers();

    // Attach skill action context menu
    UIHelpers.attachSkillActionContextMenu(this);

    // Attach action variant hover handlers
    UIHelpers.attachActionVariantHoverHandlers(this);

    // Attach image context menu
    SpeakerHandlers.attachImageContextMenu(this);

    // Attach player windows context menu
    SpeakerHandlers.attachPlayerWindowsContextMenu(this);

    // Attach player sidebars context menu
    SpeakerHandlers.attachPlayerSidebarsContextMenu(this);

    // Setup journal check highlighting
    JournalHandlers.setupJournalCheckHighlighting(this);

    // Setup journal content observer
    JournalHandlers.setupJournalContentObserver(this);

    // Setup shift key tracking for batch selection
    this._setupShiftKeyTracking();

    // Update batch highlights
    SkillCheckHandlers.updateBatchHighlights(this);

    // Attach skill reordering handlers
    SkillReorderHandlers.attachSkillReorderHandlers(this);

    // Grid size slider — direct DOM update for real-time resizing
    const slider = this.element.querySelector('.grid-size-slider');
    if (slider) {
      // Apply stored size on render if previously adjusted
      if (this._gridSliderSize) {
        const gallery = this.element.querySelector('.speaker-gallery');
        if (gallery) gallery.style.gridTemplateColumns = `repeat(auto-fill, ${this._gridSliderSize}px)`;
      }
      slider.addEventListener('input', (e) => {
        const size = parseInt(e.target.value);
        this._gridSliderSize = size;
        const gallery = this.element.querySelector('.speaker-gallery');
        if (gallery) gallery.style.gridTemplateColumns = `repeat(auto-fill, ${size}px)`;
        slider.dataset.tooltip = `Card size: ${size}px`;
      });
    }
  }

  /**
   * Setup shift key tracking for batch skill selection
   */
  _setupShiftKeyTracking() {
    if (this._shiftKeyHandler) {
      document.removeEventListener('keydown', this._shiftKeyHandler);
      document.removeEventListener('keyup', this._shiftKeyHandler);
    }

    this._shiftKeyHandler = (event) => {
      const wasShiftDown = this._shiftKeyDown;
      this._shiftKeyDown = event.shiftKey;

      // If shift state changed, update UI
      if (wasShiftDown !== this._shiftKeyDown && this.element) {
        SkillCheckHandlers.updateBatchHighlights(this);
      }
    };

    document.addEventListener('keydown', this._shiftKeyHandler);
    document.addEventListener('keyup', this._shiftKeyHandler);
  }

  /**
   * Guard against Foundry's _updatePosition crashing when element is null/detached
   * during render cycles that overlap with close (e.g. drawer reposition on parent move)
   */
  setPosition(options) {
    if (!this.element?.isConnected) return this.position;
    return super.setPosition(options);
  }

  /**
   * Cleanup on close
   */
  async _onClose(_options) {
    // Save standalone position + size for next open
    if (!this.parentInterface) {
      this._lastStandalonePos = {
        width: this.position.width, height: this.position.height,
        left: this.position.left, top: this.position.top,
      };
    }

    this._stopTrackingParent();
    JournalHandlers.cleanupJournalObservers(this);
    SkillReorderHandlers.cleanupSkillReorderHandlers(this);

    // Clear parent interface to prevent stale references
    this.parentInterface = null;

    // Update all journal toggle buttons to reflect closed state
    const { _updateAllJournalToggleButtons } = await import('../../hooks/journal-hooks.mjs');
    _updateAllJournalToggleButtons?.();

    // Save visibility state
    await game.settings.set(MODULE_ID, 'gmSidebarVisible', false);

    // Remove shift key handler
    if (this._shiftKeyHandler) {
      document.removeEventListener('keydown', this._shiftKeyHandler);
      document.removeEventListener('keyup', this._shiftKeyHandler);
      this._shiftKeyHandler = null;
    }

    // Remove drag/drop handlers
    if (this._dropHandler && this.element) {
      this.element.removeEventListener('drop', this._dropHandler);
      this._dropHandler = null;
    }
    if (this._dragoverHandler && this.element) {
      this.element.removeEventListener('dragover', this._dragoverHandler);
      this._dragoverHandler = null;
    }

    // Clear data structures
    this.batchedChecks = [];
    this.collapsedChallenges.clear();
    this.collapsedLibraryChallenges.clear();
  }

  // ===========================
  // Action Handlers - Delegation to Managers
  // ===========================

  // Speaker Handlers
  static async _onAddSpeakerFromImage(event, target) {
    return SpeakerHandlers.onAddSpeakerFromImage(event, target, this);
  }

  static async _onGatherScene(event, target) {
    return SpeakerHandlers.onGatherScene(event, target, this);
  }

  static async _onSetSpeaker(event, target) {
    return SpeakerHandlers.onSetSpeaker(event, target, this);
  }

  static async _onEditSpeaker(event, target) {
    return SpeakerHandlers.onEditSpeaker(event, target);
  }

  static async _onRemoveSpeaker(event, target) {
    return SpeakerHandlers.onRemoveSpeaker(event, target);
  }

  static async _onToggleSpeakerVisibility(event, target) {
    return SpeakerHandlers.onToggleSpeakerVisibility(event, target);
  }

  static async _onToggleSpeakerHidden(event, target) {
    return SpeakerHandlers.onToggleSpeakerHidden(event, target);
  }

  static async _onCycleSpeakerImageNext(event, target) {
    return SpeakerHandlers.onCycleSpeakerImageNext(event, target);
  }

  static async _onCycleSpeakerImagePrev(event, target) {
    return SpeakerHandlers.onCycleSpeakerImagePrev(event, target);
  }

  static async _onAddSpeakerAltImage(event, target) {
    return SpeakerHandlers.onAddSpeakerAltImage(event, target);
  }

  static async _onRemoveSpeakerAltImage(event, target) {
    return SpeakerHandlers.onRemoveSpeakerAltImage(event, target);
  }

  static async _onClearSpeaker(event, target) {
    return SpeakerHandlers.onClearSpeaker(event, target, this);
  }

  static async _onClearAllSpeakers(event, target) {
    return SpeakerHandlers.onClearAllSpeakers(event, target, this);
  }

  static async _onSaveCurrentSpeakers(event, target) {
    return SpeakerHandlers.onSaveCurrentSpeakers(event, target, this);
  }

  static async _onManageScenes(event, target) {
    return SpeakerHandlers.onManageScenes(event, target, this);
  }

  static _onToggleGridLock(_event, _target) {
    if (!this._gridLocked) {
      // Capture current card width before locking
      const card = this.element?.querySelector('.speaker-gallery .speaker-thumbnail');
      this._gridLockedSize = card ? card.offsetWidth : 100;
      this._gridLocked = true;
    } else {
      this._gridLocked = false;
      this._gridLockedSize = null;
    }
    this.render();
  }

  static async _onSetImageAsSpeaker(event, target) {
    return SpeakerHandlers.onSetImageAsSpeaker(event, target, this);
  }

  static async _onSetActorAsSpeaker(event, target) {
    return SpeakerHandlers.onSetActorAsSpeaker(event, target, this);
  }

  static async _onOpenPlayerWindows(event, target) {
    return SpeakerHandlers.onOpenPlayerWindows(event, target, this);
  }

  static async _onClosePlayerWindows(event, target) {
    return SpeakerHandlers.onClosePlayerWindows(event, target, this);
  }

  static async _onOpenPlayerSidebars(event, target) {
    return SpeakerHandlers.onOpenPlayerSidebars(event, target, this);
  }

  static async _onClosePlayerSidebars(event, target) {
    return SpeakerHandlers.onClosePlayerSidebars(event, target, this);
  }

  // Skill Check Handlers
  static async _onRequestSkill(event, target) {
    return SkillCheckHandlers.onRequestSkill(event, target, this);
  }

  static async _onRequestSave(event, target) {
    return SkillCheckHandlers.onRequestSave(event, target, this);
  }

  static async _onSendBatch(event, target) {
    return SkillCheckHandlers.onSendBatch(event, target, this);
  }

  static async _onOpenSkillMenu(event, target) {
    return SkillCheckHandlers.onOpenSkillMenu(event, target, this);
  }

  // DC Handlers
  static async _onSetDCSelect(event, target) {
    return DCHandlers.onSetDCSelect(event, target, this);
  }

  static async _onSetDifficulty(event, target) {
    return DCHandlers.onSetDifficulty(event, target, this);
  }

  static _onTogglePresetDropdown(event, target) {
    return DCHandlers.onTogglePresetDropdown(event, target, this);
  }

  static async _onApplyPreset(event, target) {
    return DCHandlers.onApplyPreset(event, target, this);
  }

  static async _onApplyPresetDC(event, target) {
    return DCHandlers.onApplyPresetDC(event, target, this);
  }


  // UI Helpers
  static async _onShowPendingRolls(event, target) {
    return UIHelpers.onShowPendingRolls(event, target, this);
  }

  static async _onShowCheckDCsPopup(event, target) {
    return UIHelpers.onShowCheckDCsPopup(event, target, this);
  }

  static async _onApplyJournalCheck(event, target) {
    return UIHelpers.onApplyJournalCheck(event, target, this);
  }

  // Challenge Handlers
  static async _onPresentChallenge(event, target) {
    return ChallengeHandlers.onPresentChallenge(event, target, this);
  }

  static async _onClearChallenge(event, target) {
    return ChallengeHandlers.onClearChallenge(event, target, this);
  }

  static async _onRemoveChallenge(event, target) {
    return ChallengeHandlers.onRemoveChallenge(event, target, this);
  }

  static async _onClearAllChallenges(event, target) {
    return ChallengeHandlers.onClearAllChallenges(event, target, this);
  }

  static async _onToggleChallengeCollapse(event, target) {
    return ChallengeHandlers.onToggleChallengeCollapse(event, target, this);
  }

  static async _onToggleLibraryChallengeCollapse(event, target) {
    return ChallengeHandlers.onToggleLibraryChallengeCollapse(event, target, this);
  }

  static async _onPresentSavedChallenge(event, target) {
    return ChallengeHandlers.onPresentSavedChallenge(event, target, this);
  }

  static async _onEditChallenge(event, target) {
    return ChallengeHandlers.onEditChallenge(event, target, this);
  }

  static async _onDeleteChallenge(event, target) {
    return ChallengeHandlers.onDeleteChallenge(event, target, this);
  }

  static async _onCreateChallengeFromSelection(event, target) {
    return ChallengeHandlers.onCreateChallengeFromSelection(event, target, this);
  }

  static async _onRequestRollsFromSelection(event, target) {
    return ChallengeHandlers.onRequestRollsFromSelection(event, target, this);
  }

  static _onLaunchSceneMode() {
    const state = game.storyframe.stateManager?.getState();
    if (!state?.speakers?.length) {
      ui.notifications.warn(game.i18n.localize('STORYFRAME.CinematicScene.NoSpeakers'));
      return;
    }
    game.storyframe.socketManager.launchSceneMode();
  }

  // ===========================
  // Tab and Panel Management (remain in base class)
  // ===========================

  static async _onSwitchTab(event, target) {
    const tab = target.dataset.tab;
    if (tab) {
      this.currentTab = tab;
      this.render();
    }
  }

  static async _onToggleSecretRoll(_event, _target) {
    this.secretRollEnabled = !this.secretRollEnabled;

    // Update button state directly
    const secretBtn = this.element.querySelector('.secret-roll-btn');
    if (secretBtn) {
      if (this.secretRollEnabled) {
        secretBtn.classList.add('active');
        secretBtn.setAttribute('aria-pressed', 'true');
      } else {
        secretBtn.classList.remove('active');
        secretBtn.setAttribute('aria-pressed', 'false');
      }
    }
  }

  static async _onToggleJournalChecksPanel(_event, _target) {
    this.journalChecksPanelCollapsed = !this.journalChecksPanelCollapsed;
    this.render();
  }

  static async _onToggleJournalImagesPanel(_event, _target) {
    this.journalImagesPanelCollapsed = !this.journalImagesPanelCollapsed;
    this.render();
  }

  static async _onCancelRoll(event, target) {
    const rollId = target.dataset.rollId;
    if (!rollId) return;

    await game.storyframe.socketManager.requestCancelRoll(rollId);
  }

  static async _onShowActiveChallenges(event, target) {
    await UIHelpers.onShowActiveChallenges(event, target, this);
  }
}
