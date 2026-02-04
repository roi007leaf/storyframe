import { MODULE_ID } from '../../constants.mjs';
import * as SystemAdapter from '../../system-adapter.mjs';

// Import manager modules
import * as ChallengeHandlers from './managers/challenge-handlers.mjs';
import * as DCHandlers from './managers/dc-handlers.mjs';
import * as JournalHandlers from './managers/journal-handlers.mjs';
import * as ParticipantHandlers from './managers/participant-handlers.mjs';
import * as SkillCheckHandlers from './managers/skill-check-handlers.mjs';
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
    classes: ['storyframe', 'gm-sidebar', 'drawer'],
    window: {
      title: 'Storyframe',
      icon: 'fas fa-users',
      resizable: false,
      minimizable: false,
    },
    position: {
      width: 330,
      height: 500,
    },
    actions: {
      addSpeakerFromImage: GMSidebarAppBase._onAddSpeakerFromImage,
      setSpeaker: GMSidebarAppBase._onSetSpeaker,
      removeSpeaker: GMSidebarAppBase._onRemoveSpeaker,
      clearSpeaker: GMSidebarAppBase._onClearSpeaker,
      clearAllSpeakers: GMSidebarAppBase._onClearAllSpeakers,
      clearAllParticipants: GMSidebarAppBase._onClearAllParticipants,
      switchTab: GMSidebarAppBase._onSwitchTab,
      toggleSecretRoll: GMSidebarAppBase._onToggleSecretRoll,
      toggleJournalChecksPanel: GMSidebarAppBase._onToggleJournalChecksPanel,
      toggleJournalImagesPanel: GMSidebarAppBase._onToggleJournalImagesPanel,
      addAllPCs: GMSidebarAppBase._onAddAllPCs,
      addPartyPCs: GMSidebarAppBase._onAddPartyPCs,
      toggleParticipantSelection: GMSidebarAppBase._onToggleParticipantSelection,
      removeParticipant: GMSidebarAppBase._onRemoveParticipant,
      toggleSelectAll: GMSidebarAppBase._onToggleSelectAll,
      requestSkill: GMSidebarAppBase._onRequestSkill,
      sendBatch: GMSidebarAppBase._onSendBatch,
      openSkillMenu: GMSidebarAppBase._onOpenSkillMenu,
      openSkillConfig: GMSidebarAppBase._onOpenSkillConfig,
      setDCSelect: GMSidebarAppBase._onSetDCSelect,
      setDifficulty: GMSidebarAppBase._onSetDifficulty,
      cancelRoll: GMSidebarAppBase._onCancelRoll,
      openPlayerWindows: GMSidebarAppBase._onOpenPlayerWindows,
      closePlayerWindows: GMSidebarAppBase._onClosePlayerWindows,
      showPendingRolls: GMSidebarAppBase._onShowPendingRolls,
      showActiveChallenges: GMSidebarAppBase._onShowActiveChallenges,
      togglePresetDropdown: GMSidebarAppBase._onTogglePresetDropdown,
      applyPreset: GMSidebarAppBase._onApplyPreset,
      addPresetQuick: GMSidebarAppBase._onAddPresetQuick,
      deletePresetQuick: GMSidebarAppBase._onDeletePresetQuick,
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

    this.selectedParticipants = new Set();
    this.currentDC = null;
    this.currentDifficulty = 'standard'; // Default difficulty
    this.secretRollEnabled = false; // Secret roll toggle state

    // Track active speaker for change detection
    this._lastActiveSpeaker = null;

    // Track visible journal checks for highlighting
    this._visibleChecks = new Map(); // skill -> Set of DCs

    // Track collapsed state for active challenges
    this.collapsedChallenges = new Map();  // challengeId -> boolean

    // Track collapsed state for library challenges
    this.collapsedLibraryChallenges = new Map();  // challengeId -> boolean

    // Track pending rolls grouping mode
    this.pendingRollsGroupMode = 'actor';  // 'actor' or 'skill'

    // Batch skill selection (shift+click)
    this.batchedSkills = new Set();  // Set of skill slugs
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

    // Update tracked active speaker after render
    const state = game.storyframe.stateManager?.getState();
    if (state) {
      this._lastActiveSpeaker = state.activeSpeaker;
    }

    // Restore scroll positions after render with multiple attempts to ensure it works
    if (scrollPositions) {
      UIHelpers.restoreScrollPositions(this, scrollPositions);
    }
  }

  /**
   * Check if this render is just for a speaker change and handle it directly
   * @returns {boolean} True if the update was handled without re-rendering
   */
  _handleSpeakerUpdate() {
    if (!this.element) return false;

    const state = game.storyframe.stateManager.getState();
    if (!state) return false;

    // Check if only the active speaker changed
    const currentActiveSpeaker = this._lastActiveSpeaker;
    const newActiveSpeaker = state.activeSpeaker;

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
      return true;
    }

    return false;
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
    const journalImages = SpeakerHandlers.extractJournalImages(this);
    const journalActors = SpeakerHandlers.extractJournalActors(this);
    const hasJournalChecks = journalCheckGroups.length > 0;

    if (!state) {
      const dcOptions = SystemAdapter.getDCOptions();
      return {
        speakers: [],
        activeSpeaker: null,
        hasSpeakers: false,
        participants: [],
        hasParticipants: false,
        selectedCount: 0,
        allSelected: false,
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
        const result = {
          id: speaker.id,
          img: resolved.img,
          name: resolved.name,
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

    // Resolve participants using participant handlers
    const { participants } = await ParticipantHandlers.prepareParticipantsContext(this, state);

    // Pending rolls with names
    const pendingRolls = await Promise.all(
      (state.pendingRolls || []).map(async (r) => {
        const participant = state.participants?.find((p) => p.id === r.participantId);
        const actionName = r.actionSlug ? SkillCheckHandlers.getActionName(r.skillSlug, r.actionSlug) : null;
        return {
          ...r,
          participantName: participant
            ? await this._resolveParticipantName(participant)
            : 'Unknown',
          skillName: SkillCheckHandlers.getSkillName(r.skillSlug),
          actionName,
        };
      }),
    );

    // Quick button skills from settings
    const quickSkillsSetting = game.settings.get(MODULE_ID, 'quickButtonSkills');
    const quickSkills = quickSkillsSetting
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const quickButtonSkills = quickSkills.map((slug) => ({
      slug,
      name: SkillCheckHandlers.getSkillName(slug),
      shortName: SkillCheckHandlers.getSkillShortName(slug),
      icon: SkillCheckHandlers.getSkillIcon(slug),
    }));

    // Categorize skills
    const skillCategories = {
      physical: ['acr', 'ath', 'ste', 'thi'],
      magical: ['arc', 'nat', 'occ', 'rel'],
      social: ['dec', 'dip', 'itm', 'prf', 'soc'],
      utility: ['cra', 'med', 'per', 'sur'],
    };

    const categorizedSkills = {
      physicalSkills: await SkillCheckHandlers.mapSkillsWithProficiency(skillCategories.physical, quickButtonSkills, participants),
      magicalSkills: await SkillCheckHandlers.mapSkillsWithProficiency(skillCategories.magical, quickButtonSkills, participants),
      socialSkills: await SkillCheckHandlers.mapSkillsWithProficiency(skillCategories.social, quickButtonSkills, participants),
      utilitySkills: await SkillCheckHandlers.mapSkillsWithProficiency(skillCategories.utility, quickButtonSkills, participants),
    };

    // Get lore skills from participants
    const loreSkills = await SkillCheckHandlers.getLoreSkills(state, this.selectedParticipants);

    const selectedCount = this.selectedParticipants.size;
    const allSelected = participants.length > 0 && selectedCount === participants.length;

    // Get selected participant data for avatar display
    const selectedParticipantData = participants
      .filter(p => this.selectedParticipants.has(p.id))
      .map(p => ({
        id: p.id,
        name: p.name,
        img: p.img,
      }));

    console.log('Context - selectedParticipants:', Array.from(this.selectedParticipants));
    console.log('Context - selectedParticipantData:', selectedParticipantData);

    // Get system-specific DC context using DC handlers
    const dcContext = await DCHandlers.prepareDCContext(this);
    const systemContext = await DCHandlers.prepareContextSystemSpecific(this);
    const { partyLevel = null, calculatedDC = null, difficultyOptions = null } = systemContext;

    // Load DC presets
    const allPresets = game.settings.get(MODULE_ID, 'dcPresets') || [];
    const dcPresets = allPresets.filter((p) => !p.system || p.system === currentSystem);

    // Prepare challenges context
    const challengesContext = ChallengeHandlers.prepareChallengesContext(this, state);

    return {
      speakers,
      activeSpeaker: state.activeSpeaker,
      hasSpeakers: speakers.length > 0,
      participants,
      hasParticipants: participants.length > 0,
      totalParticipants: participants.length,
      selectedCount,
      allSelected,
      hasSelection: selectedCount > 0,
      selectedParticipantData,
      ...dcContext,
      partyLevel,
      calculatedDC,
      currentDifficulty: this.currentDifficulty,
      difficultyOptions,
      pendingRolls,
      quickButtonSkills,
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
      journalCheckGroups,
      hasJournalChecks,
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
  async _onRender(context, _options) {
    // Position as drawer
    this._positionAsDrawer();

    // Start tracking parent position
    this._startTrackingParent();

    // Attach DC handlers
    DCHandlers.attachDCHandlers(this);
    DCHandlers.attachSystemDCHandlers(this);

    // Attach skill action context menu
    UIHelpers.attachSkillActionContextMenu(this);

    // Attach image context menu
    SpeakerHandlers.attachImageContextMenu(this);

    // Attach player windows context menu
    SpeakerHandlers.attachPlayerWindowsContextMenu(this);

    // Setup journal check highlighting
    JournalHandlers.setupJournalCheckHighlighting(this);

    // Setup journal content observer
    JournalHandlers.setupJournalContentObserver(this);

    // Setup shift key tracking for batch selection
    this._setupShiftKeyTracking();

    // Update select all checkbox state
    ParticipantHandlers.updateSelectAllCheckbox(this);

    // Update batch highlights
    SkillCheckHandlers.updateBatchHighlights(this);
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
   * Cleanup on close
   */
  async _onClose(_options) {
    this._stopTrackingParent();
    JournalHandlers.cleanupJournalObservers(this);

    // Remove shift key handler
    if (this._shiftKeyHandler) {
      document.removeEventListener('keydown', this._shiftKeyHandler);
      document.removeEventListener('keyup', this._shiftKeyHandler);
      this._shiftKeyHandler = null;
    }

    // Clear batched skills
    this.batchedSkills.clear();
  }

  // ===========================
  // Action Handlers - Delegation to Managers
  // ===========================

  // Speaker Handlers
  static async _onAddSpeakerFromImage(event, target) {
    return SpeakerHandlers.onAddSpeakerFromImage(event, target, this);
  }

  static async _onSetSpeaker(event, target) {
    return SpeakerHandlers.onSetSpeaker(event, target, this);
  }

  static async _onRemoveSpeaker(event, target) {
    return SpeakerHandlers.onRemoveSpeaker(event, target, this);
  }

  static async _onClearSpeaker(event, target) {
    return SpeakerHandlers.onClearSpeaker(event, target, this);
  }

  static async _onClearAllSpeakers(event, target) {
    return SpeakerHandlers.onClearAllSpeakers(event, target, this);
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

  // Participant Handlers
  static async _onAddAllPCs(event, target) {
    return ParticipantHandlers.onAddAllPCs(event, target, this);
  }

  static async _onAddPartyPCs(event, target) {
    return ParticipantHandlers.onAddPartyPCs(event, target, this);
  }

  static async _onToggleParticipantSelection(event, target) {
    return ParticipantHandlers.onToggleParticipantSelection(event, target, this);
  }

  static async _onRemoveParticipant(event, target) {
    return ParticipantHandlers.onRemoveParticipant(event, target, this);
  }

  static async _onToggleSelectAll(event, target) {
    return ParticipantHandlers.onToggleSelectAll(event, target, this);
  }

  static async _onClearAllParticipants(event, target) {
    return ParticipantHandlers.onClearAllParticipants(event, target, this);
  }

  // Skill Check Handlers
  static async _onRequestSkill(event, target) {
    return SkillCheckHandlers.onRequestSkill(event, target, this);
  }

  static async _onSendBatch(event, target) {
    return SkillCheckHandlers.onSendBatch(event, target, this);
  }

  static async _onOpenSkillMenu(event, target) {
    return SkillCheckHandlers.onOpenSkillMenu(event, target, this);
  }

  static async _onOpenSkillConfig(event, target) {
    return SkillCheckHandlers.onOpenSkillConfig(event, target, this);
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

  static async _onAddPresetQuick(event, target) {
    return DCHandlers.onAddPresetQuick(event, target, this);
  }

  static async _onDeletePresetQuick(event, target) {
    return DCHandlers.onDeletePresetQuick(event, target, this);
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

  static async _onToggleSecretRoll(event, target) {
    this.secretRollEnabled = !this.secretRollEnabled;
    this.render();
  }

  static async _onToggleJournalChecksPanel(event, target) {
    this.journalChecksPanelCollapsed = !this.journalChecksPanelCollapsed;
    this.render();
  }

  static async _onToggleJournalImagesPanel(event, target) {
    this.journalImagesPanelCollapsed = !this.journalImagesPanelCollapsed;
    this.render();
  }

  static async _onCancelRoll(event, target) {
    const rollId = target.dataset.rollId;
    if (!rollId) return;

    await game.storyframe.socketManager.requestCancelRoll(rollId);
  }

  static async _onShowActiveChallenges(event, target) {
    const mode = target.dataset.mode || 'actor';
    this.pendingRollsGroupMode = mode;

    const state = game.storyframe.stateManager.getState();
    if (!state?.activeChallenges?.length) {
      ui.notifications.info('No active challenges');
      return;
    }

    // Build content showing all active challenges
    const challengesHtml = state.activeChallenges.map((challenge, idx) => {
      const optionsHtml = challenge.options.map((opt, optIdx) => {
        const skillOptionsHtml = opt.skillOptions.map(so => {
          const skillName = SkillCheckHandlers.getSkillName(so.skill);
          const actionName = so.action ? SkillCheckHandlers.getActionName(so.skill, so.action) : null;
          const displayText = actionName ? `${skillName} (${actionName})` : skillName;
          const secretBadge = so.isSecret ? '<span class="secret-badge">Secret</span>' : '';
          const minProfBadge = so.minProficiency ? `<span class="proficiency-badge">Min Prof: ${so.minProficiency}</span>` : '';
          return `<li>DC ${so.dc}: ${displayText} ${secretBadge} ${minProfBadge}</li>`;
        }).join('');

        return `
          <div class="challenge-option">
            <strong>Option ${optIdx + 1}:</strong> ${opt.description || 'No description'}
            <ul>${skillOptionsHtml}</ul>
          </div>
        `;
      }).join('');

      return `
        <div class="active-challenge-display">
          <h3>${challenge.name || `Challenge ${idx + 1}`}</h3>
          ${challenge.image ? `<img src="${challenge.image}" alt="${challenge.name}" style="max-width: 200px; margin: 10px 0;">` : ''}
          ${optionsHtml}
        </div>
      `;
    }).join('<hr>');

    const content = `
      <div class="active-challenges-popup">
        ${challengesHtml}
      </div>
    `;

    new foundry.applications.api.DialogV2({
      window: { title: 'Active Challenges' },
      content,
      buttons: [
        {
          action: 'close',
          label: 'Close',
          default: true,
        },
      ],
    }).render(true);
  }
}
