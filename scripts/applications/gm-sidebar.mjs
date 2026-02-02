const MODULE_ID = 'storyframe';

import * as SystemAdapter from '../system-adapter.mjs';
import { ChallengeBuilderDialog } from './challenge-builder.mjs';

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
      openSkillMenu: GMSidebarAppBase._onOpenSkillMenu,
      openSkillConfig: GMSidebarAppBase._onOpenSkillConfig,
      setDCSelect: GMSidebarAppBase._onSetDCSelect,
      setDifficulty: GMSidebarAppBase._onSetDifficulty,
      cancelRoll: GMSidebarAppBase._onCancelRoll,
      openPlayerWindows: GMSidebarAppBase._onOpenPlayerWindows,
      closePlayerWindows: GMSidebarAppBase._onClosePlayerWindows,
      showPendingRolls: GMSidebarAppBase._onShowPendingRolls,
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
      presentSavedChallenge: GMSidebarAppBase._onPresentSavedChallenge,
      editChallenge: GMSidebarAppBase._onEditChallenge,
      deleteChallenge: GMSidebarAppBase._onDeleteChallenge,
      createChallengeFromSelection: GMSidebarAppBase._onCreateChallengeFromSelection,
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
    this.currentTab = 'pcs'; // Default to PCs tab (most used)

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

    // Parent reference (set externally when attaching)
    this.parentInterface = null;
  }

  /**
   * Position the drawer adjacent to the parent journal sheet
   * @param {number} retryCount - Number of retry attempts remaining
   */
  _positionAsDrawer(retryCount = 3) {
    // Check if parent exists and has element (ApplicationV2 doesn't have .rendered property)
    if (!this.parentInterface?.element) {
      console.warn('StoryFrame: Parent interface not ready for positioning', {
        hasElement: !!this.parentInterface?.element,
        retryCount,
      });
      // Retry if we have attempts left
      if (retryCount > 0) {
        setTimeout(() => this._positionAsDrawer(retryCount - 1), 100);
      }
      return;
    }

    // ApplicationV2 uses element directly (HTMLElement), not jQuery/array
    const parentEl = this.parentInterface.element instanceof HTMLElement
      ? this.parentInterface.element
      : (this.parentInterface.element[0] || this.parentInterface.element);
    const parentRect = parentEl.getBoundingClientRect();

    // Check if parent has valid dimensions (not at 0,0 with no size)
    if (parentRect.width === 0 || parentRect.height === 0) {
      if (retryCount > 0) {
        setTimeout(() => this._positionAsDrawer(retryCount - 1), 100);
      }
      return;
    }

    // Position to the right of the parent window
    const newLeft = parentRect.right;
    const newTop = parentRect.top;
    const newHeight = parentRect.height;

    // Check if it would go off-screen, if so position to the left instead
    const maxLeft = window.innerWidth - this.position.width;
    let adjustedLeft = newLeft;

    if (newLeft > maxLeft) {
      // Position to the left of parent instead
      adjustedLeft = Math.max(0, parentRect.left - this.position.width);
    }

    // Use setPosition for ApplicationV2
    if (!this.element) {
      console.warn('StoryFrame: Sidebar element not found, cannot position');
      return;
    }

    this.setPosition({
      left: adjustedLeft,
      top: newTop,
      height: newHeight,
    });

    // Match parent z-index + 1 to appear above it
    const parentZIndex = parseInt(window.getComputedStyle(parentEl).zIndex) || 99;
    this.element.style.zIndex = parentZIndex + 1;
  }

  /**
   * Start tracking parent journal sheet movements and state changes
   */
  _startTrackingParent() {
    if (!this.parentInterface?.element) {
      return;
    }

    // ApplicationV2 uses element directly (HTMLElement), not jQuery/array
    const element = this.parentInterface.element instanceof HTMLElement
      ? this.parentInterface.element
      : (this.parentInterface.element[0] || this.parentInterface.element);

    // Create a MutationObserver to watch for style and class changes
    this._parentObserver = new MutationObserver((mutations) => {
      if (!this.rendered || !this.parentInterface) return;

      for (const mutation of mutations) {
        if (mutation.attributeName === 'style') {
          this._positionAsDrawer(0); // No retries during tracking updates
          break;
        }
        if (mutation.attributeName === 'class') {
          // Handle minimize/maximize
          const isMinimized = element.classList.contains('minimized');
          if (isMinimized && this.rendered) {
            this.element.style.display = 'none';
          } else if (!isMinimized && this.rendered) {
            this.element.style.display = '';
            this._positionAsDrawer(0);
          }
          break;
        }
      }
    });

    this._parentObserver.observe(element, {
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
  }

  /**
   * Stop tracking parent window movements
   */
  _stopTrackingParent() {
    if (this._parentObserver) {
      this._parentObserver.disconnect();
      this._parentObserver = null;
    }
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
    const scrollPositions = this._saveScrollPositions();

    // Perform render
    await super._render(force, options);

    // Update tracked active speaker after render
    const state = game.storyframe.stateManager?.getState();
    if (state) {
      this._lastActiveSpeaker = state.activeSpeaker;
    }

    // Restore scroll positions after render with multiple attempts to ensure it works
    if (scrollPositions) {
      this._restoreScrollPositions(scrollPositions);
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
          speaker.setAttribute('aria-selected', 'true');
        } else {
          speaker.classList.remove('active');
          speaker.setAttribute('aria-selected', 'false');
        }
      });

      // Update our cached value
      this._lastActiveSpeaker = newActiveSpeaker;
      return true;
    }

    return false;
  }

  /**
   * Save scroll positions of scrollable containers
   */
  _saveScrollPositions() {
    if (!this.element) return null;

    const positions = {};
    const container = this.element.querySelector('.gm-sidebar-container');
    if (container) {
      positions.main = container.scrollTop;
    }

    return positions;
  }

  /**
   * Restore scroll positions of scrollable containers
   * Uses multiple timing approaches and mutation observer to ensure it works
   */
  _restoreScrollPositions(positions) {
    if (!this.element || !positions) return;

    const restore = () => {
      const container = this.element?.querySelector('.gm-sidebar-container');
      if (container && positions.main !== undefined && container.scrollTop !== positions.main) {
        container.scrollTop = positions.main;
        return true;
      }
      return false;
    };

    // Try immediate restore
    restore();

    // Try after animation frame
    requestAnimationFrame(() => restore());

    // Try with small delays
    setTimeout(() => restore(), 0);
    setTimeout(() => restore(), 10);
    setTimeout(() => restore(), 50);

    // Also set up a mutation observer to restore on DOM changes
    const container = this.element?.querySelector('.gm-sidebar-container');
    if (container && positions.main !== undefined) {
      const observer = new MutationObserver(() => {
        if (restore()) {
          observer.disconnect();
        }
      });

      observer.observe(container, {
        childList: true,
        subtree: true,
      });

      // Disconnect after 500ms to avoid memory leaks
      setTimeout(() => observer.disconnect(), 500);
    }
  }

  async _prepareContext(_options) {
    // Detect system info (needed throughout the method)
    const currentSystem = SystemAdapter.detectSystem();

    const state = game.storyframe.stateManager.getState();

    // Extract checks, images, and actors from parent journal
    let journalCheckGroups = this._extractJournalChecks();
    const journalImages = this._extractJournalImages();
    const journalActors = this._extractJournalActors();
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

    // Resolve participants (PCs)
    const participants = await Promise.all(
      (state.participants || []).map(async (p) => {
        const actor = await fromUuid(p.actorUuid);
        return {
          id: p.id,
          actorUuid: p.actorUuid,
          userId: p.userId,
          img: actor?.img || 'icons/svg/mystery-man.svg',
          name: actor?.name || 'Unknown',
          selected: this.selectedParticipants.has(p.id),
        };
      }),
    );

    // Pending rolls with names
    const pendingRolls = await Promise.all(
      (state.pendingRolls || []).map(async (r) => {
        const participant = state.participants?.find((p) => p.id === r.participantId);
        const actionName = r.actionSlug ? this._getActionName(r.skillSlug, r.actionSlug) : null;
        return {
          ...r,
          participantName: participant
            ? await this._resolveParticipantName(participant)
            : 'Unknown',
          skillName: this._getSkillName(r.skillSlug),
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
      name: this._getSkillName(slug),
      shortName: this._getSkillShortName(slug),
      icon: this._getSkillIcon(slug),
    }));

    // Categorize skills
    const skillCategories = {
      physical: ['acr', 'ath'],
      mental: ['arc', 'nat', 'occ', 'rel'],
      social: ['dec', 'dip', 'itm', 'prf', 'soc'],
      perception: ['per'],
      utility: ['cra', 'med', 'ste', 'sur', 'thi'],
    };

    const categorizedSkills = {
      physicalSkills: this._mapSkillsWithAvailability(skillCategories.physical, quickButtonSkills),
      mentalSkills: this._mapSkillsWithAvailability(skillCategories.mental, quickButtonSkills),
      socialSkills: this._mapSkillsWithAvailability(skillCategories.social, quickButtonSkills),
      perceptionSkills: this._mapSkillsWithAvailability(skillCategories.perception, quickButtonSkills),
      utilitySkills: this._mapSkillsWithAvailability(skillCategories.utility, quickButtonSkills),
    };

    // Get lore skills from participants
    const loreSkills = await this.constructor._getLoreSkills(state, this.selectedParticipants);

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

    // Get system-specific DC options
    const dcOptions = SystemAdapter.getDCOptions();

    // Get system-specific context (override in subclass)
    const systemContext = await this._prepareContextSystemSpecific();
    const { partyLevel = null, calculatedDC = null, difficultyOptions = null } = systemContext;

    // Load DC presets
    const allPresets = game.settings.get(MODULE_ID, 'dcPresets') || [];
    const dcPresets = allPresets.filter((p) => !p.system || p.system === currentSystem);

    // Active challenge
    const activeChallenge = state?.activeChallenge || null;
    const hasActiveChallenge = activeChallenge !== null;

    // Load and enrich saved challenges for library
    const savedChallengesRaw = game.settings.get(MODULE_ID, 'challengeLibrary') || [];
    const savedChallenges = savedChallengesRaw.map(c => {
      const optionsPreview = c.options.map((opt, idx) => {
        const skillOptions = opt.skillOptions.map(so => {
          const skillName = this._getSkillName(so.skill);
          const actionName = so.action ? this._getActionName(so.skill, so.action) : null;
          return {
            skillName,
            actionName,
            dc: so.dc,
            isSecret: so.isSecret || false,
            displayText: actionName ? `${skillName} (${actionName})` : skillName,
          };
        });

        return {
          index: idx + 1,
          description: opt.description,
          skillOptions,
        };
      });

      return {
        id: c.id,
        name: c.name,
        image: c.image,
        options: optionsPreview,
      };
    });

    return {
      speakers,
      activeSpeaker: state.activeSpeaker,
      hasSpeakers: speakers.length > 0,
      participants,
      hasParticipants: participants.length > 0,
      selectedCount,
      allSelected,
      hasSelection: selectedCount > 0,
      selectedParticipantData,
      currentDC: this.currentDC,
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
      dcOptions,
      isPF2e: currentSystem === 'pf2e',
      isDND5e: currentSystem === 'dnd5e',
      dcPresets,
      journalCheckGroups,
      hasJournalChecks,
      journalImages,
      hasJournalImages: journalImages.length > 0,
      journalActors,
      hasJournalActors: journalActors.length > 0,
      activeChallenge,
      hasActiveChallenge,
      savedChallenges,
      hasSavedChallenges: savedChallenges.length > 0,
    };
  }

  /**
   * Extract checks from parent journal content
   * Subclasses override to parse system-specific check formats
   */
  _extractJournalChecks() {
    if (!this.parentInterface?.element) return [];

    const content = this._getJournalContent();
    if (!content) return [];

    const checks = this._parseChecksFromContent(content);
    return this._groupChecksBySkill(checks);
  }

  /**
   * Get journal content element (helper)
   * Returns the container with all journal content for check parsing
   */
  _getJournalContent() {
    const element = this.parentInterface.element instanceof HTMLElement
      ? this.parentInterface.element
      : (this.parentInterface.element[0] || this.parentInterface.element);

    // Try multiple selectors to support different journal sheet types
    // For multi-page journals (MetaMorphic), get the pages container
    const pagesContainer = element.querySelector('.journal-entry-pages');
    if (pagesContainer) return pagesContainer;

    // For single-page journals, get the content directly
    const pageContent = element.querySelector('.journal-page-content');
    if (pageContent) return pageContent;

    // Fallback to entry content
    return element.querySelector('.journal-entry-content');
  }

  /**
   * Parse checks from content (system-specific - override in subclass)
   * @param {HTMLElement} content - Journal content element
   * @returns {Array} Array of check objects { label, skillName, dc, id }
   */
  _parseChecksFromContent(_content) {
    // Base implementation returns empty - subclasses override
    return [];
  }

  /**
   * Group checks by skill (common logic)
   */
  _groupChecksBySkill(checks) {
    // Remove duplicates
    const unique = [];
    const seen = new Set();
    checks.forEach((check) => {
      const key = `${check.skillName}-${check.dc}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(check);
      }
    });

    // Group by skill type
    const grouped = {};
    unique.forEach((check) => {
      const skill = check.skillName;
      const skillDisplay = skill.charAt(0).toUpperCase() + skill.slice(1);
      if (!grouped[skill]) {
        grouped[skill] = {
          skillName: skillDisplay,
          skillSlug: skill,
          checks: [],
        };
      }
      grouped[skill].checks.push(check);
    });

    // Sort groups alphabetically by skill name (A-Z)
    return Object.values(grouped).sort((a, b) =>
      a.skillName.localeCompare(b.skillName)
    );
  }

  /**
   * Extract checks from parent journal (ungrouped version for backward compat)
   */
  _extractJournalChecksFlat() {
    const grouped = this._extractJournalChecks();
    const flat = [];
    grouped.forEach((group) => flat.push(...group.checks));
    return flat;
  }

  /**
   * Extract images from parent journal content
   */
  _extractJournalImages() {
    if (!this.parentInterface?.element) return [];

    // ApplicationV2 uses element directly (HTMLElement), not jQuery/array
    const element = this.parentInterface.element instanceof HTMLElement
      ? this.parentInterface.element
      : (this.parentInterface.element[0] || this.parentInterface.element);
    const content = element.querySelector('.journal-page-content');
    if (!content) return [];

    // Get current speakers to filter out
    const state = game.storyframe.stateManager.getState();
    const speakerImages = new Set();
    if (state?.speakers) {
      state.speakers.forEach((speaker) => {
        if (speaker.imagePath) speakerImages.add(speaker.imagePath);
      });
    }

    const images = [];
    const imgElements = content.querySelectorAll('img');


    imgElements.forEach((img) => {
      if (img.src && !img.src.includes('icons/svg/mystery-man') && !speakerImages.has(img.src)) {
        images.push({
          src: img.src,
          alt: img.alt || 'Image',
          id: foundry.utils.randomID(),
        });
      }
    });

    // Remove duplicates by src
    const unique = [];
    const seen = new Set();
    images.forEach((img) => {
      if (!seen.has(img.src)) {
        seen.add(img.src);
        unique.push(img);
      }
    });

    return unique;
  }

  _extractJournalActors() {
    if (!this.parentInterface?.element) return [];

    // ApplicationV2 uses element directly (HTMLElement), not jQuery/array
    const element = this.parentInterface.element instanceof HTMLElement
      ? this.parentInterface.element
      : (this.parentInterface.element[0] || this.parentInterface.element);
    const content = element.querySelector('.journal-page-content');
    if (!content) return [];

    // Get current speakers to filter out
    const state = game.storyframe.stateManager.getState();
    const speakerUuids = new Set();
    if (state?.speakers) {
      state.speakers.forEach((speaker) => {
        if (speaker.actorUuid) speakerUuids.add(speaker.actorUuid);
      });
    }

    const actors = [];

    // Find all content links that reference actors
    // Handles both @Actor[id] and @UUID[Actor.id] formats
    const actorLinks = content.querySelectorAll('a.content-link[data-uuid^="Actor."], a.content-link[data-uuid*="Actor."]');

    actorLinks.forEach((link) => {
      const uuid = link.dataset.uuid;

      // Extract actor ID from UUID (handles both "Actor.id" and full UUIDs)
      const actorId = uuid.includes('Actor.')
        ? uuid.split('Actor.')[1].split('.')[0]
        : null;

      if (!actorId) return;

      const actorName = link.textContent || 'Unknown';

      if (!speakerUuids.has(uuid)) {
        const actor = game.actors.get(actorId);
        if (actor && actor.type !== 'loot' && actor.type !== 'hazard') {
          actors.push({
            id: actorId,
            name: actorName,
            img: actor.img,
          });
        }
      }
    });

    // Remove duplicates by id
    const unique = [];
    const seen = new Set();
    actors.forEach((actor) => {
      if (!seen.has(actor.id)) {
        seen.add(actor.id);
        unique.push(actor);
      }
    });

    return unique;
  }

  async _onRender(context, _options) {
    super._onRender(context, _options);
    this._attachDragDropHandlers();
    this._disableWindowDrag();
    this._attachDCHandlers();
    this._attachImageContextMenu();
    this._attachSkillActionContextMenu();
    this._attachPlayerWindowsContextMenu();
    this._setupJournalCheckHighlighting();

    // Position as drawer (parent should already be set by _attachSidebarToSheet)
    if (!this._stateRestored) {
      // Position immediately on first render
      this._positionAsDrawer(5);
      this._startTrackingParent();
      this._stateRestored = true;
    } else {
      // On subsequent renders, re-position as drawer
      this._positionAsDrawer(0);
    }
  }

  /**
   * Disable window dragging for drawer mode
   */
  _disableWindowDrag() {
    const header = this.element.querySelector('.window-header');
    if (header) {
      // Prevent mousedown from initiating drag
      header.addEventListener(
        'mousedown',
        (e) => {
          // Allow clicks on buttons
          if (e.target.closest('button, a')) return;
          e.stopPropagation();
        },
        true,
      );
    }
  }

  _attachDCHandlers() {
    // Common DC input field
    const dcInput = this.element.querySelector('#dc-input');
    if (dcInput) {
      dcInput.addEventListener('change', (e) => {
        const value = e.target.value;
        if (value === '') {
          this.currentDC = null;
        } else {
          const dc = parseInt(value);
          if (!isNaN(dc)) {
            this.currentDC = dc;
          }
        }
      });
    }

    // System-specific DC handlers (override in subclass)
    this._attachSystemDCHandlers();
  }

  /**
   * Attach system-specific DC handlers (override in subclass)
   */
  _attachSystemDCHandlers() {
    // Base implementation does nothing
  }

  /**
   * Attach right-click context menu for NPC image enlargement
   */
  _attachImageContextMenu() {
    // NPC speaker thumbnails
    const images = this.element.querySelectorAll('.speaker-thumbnail img');
    images.forEach((img) => {
      img.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const name =
          img.alt ||
          img.closest('.speaker-thumbnail')?.querySelector('.speaker-name')?.textContent ||
          'NPC';
        this._showEnlargedImage(img.src, name);
      });
    });

    // Journal images
    const journalImages = this.element.querySelectorAll('.journal-image-item-thumb img');
    journalImages.forEach((img) => {
      img.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const name = img.alt || 'Image';
        this._showEnlargedImage(img.src, name);
      });
    });

    // Journal actors
    const journalActors = this.element.querySelectorAll('.journal-actor-item-thumb img');
    journalActors.forEach((img) => {
      img.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const name = img.alt || 'Actor';
        this._showEnlargedImage(img.src, name);
      });
    });
  }

  /**
   * Show enlarged image in a popup
   */
  _showEnlargedImage(src, name) {
    // Remove existing popup if any
    document.querySelector('.storyframe-image-popup')?.remove();

    const popup = document.createElement('div');
    popup.className = 'storyframe-image-popup';
    popup.innerHTML = `
      <div class="popup-backdrop"></div>
      <div class="popup-content">
        <img src="${src}" alt="${name}">
        <div class="popup-name">${name}</div>
      </div>
    `;

    // Close on click anywhere
    popup.addEventListener('click', () => popup.remove());

    // Close on escape key
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        popup.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    document.body.appendChild(popup);
  }

  /**
   * Attach right-click context menu for skill action selection
   */
  _attachSkillActionContextMenu() {
    const skillButtons = this.element.querySelectorAll('.skill-btn[data-skill]');
    skillButtons.forEach((btn) => {
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const skillSlug = btn.dataset.skill;
        if (skillSlug) {
          this._showSkillActionsMenu(e, skillSlug);
        }
      });
    });
  }

  /**
   * Attach right-click handler to open player windows button (to close)
   */
  _attachPlayerWindowsContextMenu() {
    const btn = this.element.querySelector('[data-action="openPlayerWindows"]');
    if (btn) {
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        GMSidebarAppBase._onClosePlayerWindows(e, btn);
      });
    }
  }

  /**
   * Show skill actions popup menu
   */
  _showSkillActionsMenu(event, skillSlug) {
    const skills = SystemAdapter.getSkills();
    const skill = skills[skillSlug];
    const actions = skill?.actions;

    if (!actions || actions.length === 0) {
      ui.notifications.info(`No specific actions for ${this._getSkillName(skillSlug)}`);
      return;
    }

    const skillName = this._getSkillName(skillSlug);
    const appInstance = this;

    // Remove any existing menu
    document.querySelector('.storyframe-skill-actions-menu')?.remove();

    // Create popup menu
    const menu = document.createElement('div');
    menu.className = 'storyframe-skill-actions-menu';
    menu.innerHTML = `
      <div class="menu-header">${skillName} Actions</div>
      <div class="menu-actions">
        ${actions.map((a) => `<button type="button" class="action-option" data-action-slug="${a.slug}" data-skill="${skillSlug}">${a.name}</button>`).join('')}
      </div>
    `;

    // Position near the click
    const rect = event.target.getBoundingClientRect();
    menu.style.cssText = `
      position: fixed;
      top: ${rect.bottom + 4}px;
      left: ${rect.left}px;
      z-index: 10000;
      background: #1a1a2e;
      border: 1px solid #3d3d5c;
      border-radius: 8px;
      padding: 0;
      min-width: 160px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      overflow: hidden;
    `;

    // Style header
    const header = menu.querySelector('.menu-header');
    header.style.cssText = `
      padding: 8px 12px;
      font-size: 11px;
      font-weight: 700;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background: rgba(0,0,0,0.3);
      border-bottom: 1px solid rgba(255,255,255,0.1);
    `;

    // Style actions container
    const actionsContainer = menu.querySelector('.menu-actions');
    actionsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      padding: 4px;
    `;

    // Add click handlers
    menu.querySelectorAll('.action-option').forEach((btn) => {
      btn.style.cssText = `
        padding: 8px 12px;
        background: transparent;
        border: none;
        color: #e0e0e0;
        cursor: pointer;
        text-align: left;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 500;
        transition: background 0.15s ease;
      `;
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'rgba(94, 129, 172, 0.3)';
        btn.style.color = '#ffffff';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'transparent';
        btn.style.color = '#e0e0e0';
      });
      btn.addEventListener('click', async () => {
        const actionSlug = btn.dataset.actionSlug;
        const actionSkill = btn.dataset.skill;
        menu.remove();

        if (appInstance.selectedParticipants.size === 0) {
          ui.notifications.warn('No PCs selected');
          return;
        }

        // Request skill check with action context
        await appInstance._requestSkillCheck(
          actionSkill,
          Array.from(appInstance.selectedParticipants),
          actionSlug,
        );
      });
    });

    // Close on click outside
    const closeHandler = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);

    document.body.appendChild(menu);

    // Adjust position if off-screen
    const menuRect = menu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth) {
      menu.style.left = `${window.innerWidth - menuRect.width - 10}px`;
    }
    if (menuRect.bottom > window.innerHeight) {
      menu.style.top = `${rect.top - menuRect.height - 4}px`;
    }
  }

  _attachDragDropHandlers() {

    // NPC gallery drop zone
    const gallery = this.element.querySelector('.speaker-gallery');
    if (gallery) {
      gallery.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        gallery.classList.add('drag-over');
      });

      gallery.addEventListener('dragleave', (e) => {
        if (e.target === gallery) {
          gallery.classList.remove('drag-over');
        }
      });

      gallery.addEventListener('drop', async (e) => {
        e.preventDefault();
        gallery.classList.remove('drag-over');

        // Try StoryFrameImage data first
        const plainData = e.dataTransfer.getData('text/plain');
        if (plainData) {
          try {
            const imageData = JSON.parse(plainData);
            if (imageData.type === 'StoryFrameImage') {
              const label = await foundry.applications.api.DialogV2.prompt({
                window: { title: 'NPC Name' },
                content: '<input type="text" name="label" placeholder="Enter NPC name" autofocus>',
                ok: {
                  label: 'Add',
                  callback: (event, button, _dialog) => button.form.elements.label.value,
                },
                rejectClose: false,
              });

              if (label) {
                await game.storyframe.socketManager.requestAddSpeaker({
                  imagePath: imageData.src,
                  label,
                });
              }
              return;
            }
          } catch (err) {
            // Not JSON, continue to Actor handling
          }
        }

        // Handle Actor drops
        const data = TextEditor.getDragEventData(e);
        if (data.type === 'Actor') {
          const actor = await fromUuid(data.uuid);
          if (!actor) return;

          // Reject player characters
          if (actor.type === 'character') {
            const isPlayerOwned = game.users.some(
              (user) => !user.isGM && actor.testUserPermission(user, 'OWNER'),
            );
            if (isPlayerOwned) {
              ui.notifications.warn('Player characters should be added to the PCs section');
              return;
            }
          }

          await game.storyframe.socketManager.requestAddSpeaker({
            actorUuid: data.uuid,
            label: actor.name,
          });
        }
      });
    }

    // PC drop zone
    const pcZone = this.element.querySelector('[data-drop-zone="participant"]');
    if (pcZone) {
      pcZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        pcZone.classList.add('drag-over');
      });

      pcZone.addEventListener('dragleave', (e) => {
        if (e.target === pcZone) {
          pcZone.classList.remove('drag-over');
        }
      });

      pcZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        pcZone.classList.remove('drag-over');

        const data = TextEditor.getDragEventData(e);
        if (data.type === 'Actor') {
          const actor = await fromUuid(data.uuid);
          if (!actor) return;

          if (actor.type !== 'character') {
            ui.notifications.warn('Only player characters can be added as PCs');
            return;
          }

          const owningUser = game.users.find(
            (user) => !user.isGM && actor.testUserPermission(user, 'OWNER'),
          );

          if (!owningUser) {
            ui.notifications.warn(`No player owner found for ${actor.name}`);
            return;
          }

          await game.storyframe.socketManager.requestAddParticipant({
            actorUuid: data.uuid,
            userId: owningUser.id,
          });
        }
      });
    }

    // Check drop zone - entire skill section
    const skillSection = this.element.querySelector('.skill-config-panel');
    if (skillSection) {
      skillSection.addEventListener('dragover', (e) => {
        const types = Array.from(e.dataTransfer.types);
        if (types.includes('text/plain')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          skillSection.classList.add('check-drag-over');
        }
      });

      skillSection.addEventListener('dragleave', (e) => {
        if (!skillSection.contains(e.relatedTarget)) {
          skillSection.classList.remove('check-drag-over');
        }
      });

      skillSection.addEventListener('drop', async (e) => {
        e.preventDefault();
        skillSection.classList.remove('check-drag-over');

        try {
          const data = JSON.parse(e.dataTransfer.getData('text/plain'));

          if (data.type === 'StoryFrameCheck' && data.dc) {
            this.currentDC = data.dc;

            const dcInput = this.element.querySelector('#dc-input');
            if (dcInput) dcInput.value = data.dc;

            ui.notifications.info(`Applied: ${data.label}`);

            // If skill specified and participants selected, auto-request
            if (data.skillSlug && this.selectedParticipants.size > 0) {
              await this._requestSkillCheck(
                data.skillSlug,
                Array.from(this.selectedParticipants),
                data.actionSlug,
              );
            }
          }
        } catch (err) {
          console.error('Failed to parse check drop:', err);
        }
      });
    }
  }

  async _onClose(_options) {
    // Stop tracking parent movements
    this._stopTrackingParent();

    // Clean up IntersectionObserver
    if (this._checkObserver) {
      this._checkObserver.disconnect();
      this._checkObserver = null;
    }

    // Save visibility state
    await game.settings.set(MODULE_ID, 'gmSidebarVisible', false);

    return super._onClose(_options);
  }

  // --- Helper Methods ---

  _getPlayerCharacters() {
    return game.actors.filter((actor) => {
      if (actor.type !== 'character') return false;
      return game.users.some((user) => !user.isGM && actor.testUserPermission(user, 'OWNER'));
    });
  }

  /**
   * Get unique lore skills from participants
   */
  /**
   * Get lore skills from participants (system-specific - override in subclass)
   * @param {Object} state - Game state
   * @param {Set} selectedParticipants - Set of selected participant IDs
   * @returns {Promise<Array>} Lore skills
   */
  static async _getLoreSkills(_state, _selectedParticipants) {
    return [];
  }

  /**
   * Get available skills from selected participants (system-specific - override in subclass)
   * @param {Object} state - Game state
   * @param {Set} selectedParticipants - Set of selected participant IDs
   * @returns {Promise<Set<string>>} Set of available skill slugs (lowercase)
   */
  static async _getAvailableSkills(_state, _selectedParticipants) {
    return new Set();
  }

  _getSkillName(slug) {
    const skills = SystemAdapter.getSkills();
    const skill = skills[slug];
    if (skill?.name) return skill.name;

    // Handle lore skills - slug is like "cooking-lore" or "warfare-lore"
    if (slug.includes('-lore')) {
      return slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }

    return slug.toUpperCase();
  }

  _getSkillShortName(slug) {
    return SystemAdapter.getSkillShortName(slug);
  }

  _getSkillIcon(slug) {
    const iconMap = {
      // PF2e skills
      per: 'fa-eye',
      acr: 'fa-person-running',
      arc: 'fa-wand-sparkles',
      ath: 'fa-dumbbell',
      cra: 'fa-hammer',
      dec: 'fa-mask',
      dip: 'fa-handshake',
      itm: 'fa-fist-raised',
      med: 'fa-kit-medical',
      nat: 'fa-leaf',
      occ: 'fa-book-skull',
      prf: 'fa-music',
      rel: 'fa-cross',
      soc: 'fa-users',
      ste: 'fa-user-secret',
      sur: 'fa-compass',
      thi: 'fa-hand-holding',
      // D&D 5e additional
      ani: 'fa-paw',
      his: 'fa-scroll',
      ins: 'fa-lightbulb',
      inv: 'fa-search',
      prc: 'fa-eye',
      slt: 'fa-hand-sparkles',
    };
    return iconMap[slug] || 'fa-dice-d20';
  }

  _mapSkillsWithAvailability(categorySlugs, allSkills) {
    return categorySlugs
      .map(slug => allSkills.find(s => s.slug === slug))
      .filter(Boolean);
  }

  async _resolveParticipantName(participant) {
    const actor = await fromUuid(participant.actorUuid);
    return actor?.name || 'Unknown';
  }

  /**
   * Get party level for DC calculation (system-specific - override in subclass)
   * @returns {Promise<number|null>}
   */
  async _getPartyLevel() {
    return null;
  }

  /**
   * Calculate DC by level (system-specific - override in subclass)
   * @param {number} level - Party level
   * @param {string} difficultyId - Difficulty ID
   * @returns {number|null}
   */
  _calculateDCByLevel(_level, _difficultyId) {
    return null;
  }

  /**
   * Prepare system-specific context for template (override in subclass)
   * @returns {Promise<Object>} { partyLevel?, calculatedDC?, difficultyOptions? }
   */
  async _prepareContextSystemSpecific() {
    return {};
  }

  /**
   * Setup IntersectionObserver to highlight journal check buttons when checks are in view
   */
  _setupJournalCheckHighlighting() {
    // Clean up existing observer
    if (this._checkObserver) {
      this._checkObserver.disconnect();
      this._checkObserver = null;
    }

    if (!this.parentInterface?.element) return;

    // Get the journal's scrollable container
    const parentElement = this.parentInterface.element instanceof HTMLElement
      ? this.parentInterface.element
      : (this.parentInterface.element[0] || this.parentInterface.element);

    // Find the scrollable content area (the part that actually scrolls)
    const scrollContainer = parentElement.querySelector('.journal-entry-pages') ||
                           parentElement.querySelector('.journal-entry-content') ||
                           parentElement.querySelector('.scrollable');

    if (!scrollContainer) return;

    // Get all inline check elements (PF2e format)
    const checkElements = scrollContainer.querySelectorAll('a.inline-check[data-pf2-check][data-pf2-dc]');
    if (checkElements.length === 0) return;

    // Track which skills are in view and their DCs
    const visibleChecks = new Map(); // skill -> Set of DCs

    // Create observer - use the scroll container as root
    this._checkObserver = new IntersectionObserver(
      (entries) => {
        let changed = false;

        entries.forEach((entry) => {
          const skillName = entry.target.dataset.pf2Check;
          const dc = entry.target.dataset.pf2Dc;
          if (!skillName || !dc) return;

          // Normalize skill name to match button data-skill format
          const normalizedSkill = skillName.toLowerCase();

          if (entry.isIntersecting) {
            // Add skill and DC to visible set
            if (!visibleChecks.has(normalizedSkill)) {
              visibleChecks.set(normalizedSkill, new Set());
            }
            if (!visibleChecks.get(normalizedSkill).has(dc)) {
              visibleChecks.get(normalizedSkill).add(dc);
              changed = true;
            }
          } else {
            // Remove DC from visible set
            if (visibleChecks.has(normalizedSkill)) {
              visibleChecks.get(normalizedSkill).delete(dc);
              if (visibleChecks.get(normalizedSkill).size === 0) {
                visibleChecks.delete(normalizedSkill);
              }
              changed = true;
            }
          }
        });

        // Update button highlights (DC highlighting happens in popup)
        if (changed && this.element) {
          // Store visible checks on instance for popup highlighting
          this._visibleChecks = new Map(visibleChecks);

          // Update button highlight state
          const buttons = this.element.querySelectorAll('.journal-skill-btn');
          buttons.forEach((btn) => {
            const skillName = btn.dataset.skill?.toLowerCase();
            if (skillName && visibleChecks.has(skillName)) {
              btn.classList.add('in-view');
            } else {
              btn.classList.remove('in-view');
            }
          });
        }
      },
      {
        root: scrollContainer,
        rootMargin: '0px',
        threshold: [0, 0.25, 0.5, 0.75, 1.0],
      }
    );

    // Observe all check elements
    checkElements.forEach((el) => this._checkObserver.observe(el));
  }

  async _requestSkillCheck(skillSlug, participantIds, actionSlug = null) {
    const state = game.storyframe.stateManager.getState();
    if (!state) return;

    // Check if secret roll is enabled (toggle button or action with secret trait)
    let isSecretRoll = this.secretRollEnabled || false;

    // Auto-detect actions with secret trait in PF2e
    if (!isSecretRoll && actionSlug && game.pf2e) {
      isSecretRoll = await this._actionHasSecretTrait(actionSlug);
    }

    let sentCount = 0;
    let offlineCount = 0;
    let missingSkillCount = 0;

    for (const participantId of participantIds) {
      const participant = state.participants.find((p) => p.id === participantId);
      if (!participant) continue;

      // Validate that the participant has this skill
      const actor = await fromUuid(participant.actorUuid);
      if (actor) {
        const hasSkill = await this._actorHasSkill(actor, skillSlug);
        if (!hasSkill) {
          missingSkillCount++;
          continue;
        }
      }

      const user = game.users.get(participant.userId);
      if (!user?.active) {
        offlineCount++;
        continue;
      }

      const requestId = foundry.utils.randomID();
      const request = {
        id: requestId,
        participantId: participant.id,
        actorUuid: participant.actorUuid,
        userId: participant.userId,
        skillSlug,
        actionSlug,
        dc: this.currentDC,
        isSecretRoll,
        timestamp: Date.now(),
      };

      await game.storyframe.socketManager.requestAddPendingRoll(request);
      await game.storyframe.socketManager.triggerSkillCheckOnPlayer(participant.userId, request);
      sentCount++;
    }

    const skillName = this._getSkillName(skillSlug);
    const actionName = actionSlug ? this._getActionName(skillSlug, actionSlug) : null;
    const checkName = actionName ? `${skillName} (${actionName})` : skillName;

    if (sentCount > 0) {
      ui.notifications.info(`Requested ${checkName} check from ${sentCount} PC(s)`);
    }
    if (offlineCount > 0) {
      ui.notifications.warn(`${offlineCount} PC(s) offline - skipped`);
    }
    if (missingSkillCount > 0) {
      ui.notifications.warn(`${missingSkillCount} PC(s) don't have ${skillName} - skipped`);
    }

    // Clear selection after sending rolls
    this.selectedParticipants.clear();
    this.render();
  }

  /**
   * Check if an actor has a specific skill (system-specific - override in subclass)
   * @param {Actor} actor - The actor to check
   * @param {string} skillSlug - The skill slug to check for
   * @returns {Promise<boolean>} True if the actor has the skill
   */
  async _actorHasSkill(_actor, _skillSlug) {
    // Base implementation always returns true - subclasses should override
    return true;
  }

  /**
   * Check if an action has the secret trait (makes it a blind GM roll)
   * @param {string} actionSlug - The action slug to check
   * @returns {Promise<boolean>} True if action has secret trait
   */
  async _actionHasSecretTrait(actionSlug) {
    if (!game.pf2e?.actions) return false;

    try {
      // Search the actions compendium for this action
      const pack = game.packs.get('pf2e.actionspf2e');
      if (!pack) return false;

      // Convert slug to title case for searching (e.g., 'seek' -> 'Seek')
      const actionName = actionSlug.split('-').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');

      // Search by name
      const actionItem = pack.index.find(i => i.name.toLowerCase() === actionName.toLowerCase());
      if (!actionItem) return false;

      // Get full document to check traits
      const doc = await pack.getDocument(actionItem._id);
      return doc?.system?.traits?.value?.includes('secret') || false;
    } catch (error) {
      console.warn(`${MODULE_ID} | Error checking action traits:`, error);
      return false;
    }
  }

  /**
   * Get the display name for a skill action
   * @param {string} skillSlug - The skill slug
   * @param {string} actionSlug - The action slug
   * @returns {string|null} The action name or null
   */
  _getActionName(skillSlug, actionSlug) {
    const skills = SystemAdapter.getSkills();
    const skill = skills[skillSlug];
    const actions = skill?.actions;
    if (!actions) return null;
    const action = actions.find((a) => a.slug === actionSlug);
    return action?.name || null;
  }

  // --- Action Handlers ---

  static async _onAddSpeakerFromImage(_event, _target) {
    new FilePicker({
      type: 'image',
      callback: async (path) => {
        const label = await foundry.applications.api.DialogV2.prompt({
          window: { title: 'NPC Name' },
          content: '<input type="text" name="label" placeholder="Enter NPC name" autofocus>',
          ok: {
            label: 'Add',
            callback: (event, button, _dialog) => button.form.elements.label.value,
          },
          rejectClose: false,
        });

        if (label) {
          await game.storyframe.socketManager.requestAddSpeaker({
            imagePath: path,
            label,
          });
        }
      },
    }).render(true);
  }

  static async _onSetSpeaker(_event, target) {
    const speakerId = target.closest('[data-speaker-id]')?.dataset.speakerId;
    if (speakerId) {
      await game.storyframe.socketManager.requestSetActiveSpeaker(speakerId);
    }
  }

  static async _onRemoveSpeaker(event, target) {
    event.stopPropagation();
    const speakerId = target.closest('[data-speaker-id]')?.dataset.speakerId;
    if (!speakerId) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'Remove NPC' },
      content: '<p>Remove this NPC from the list?</p>',
      yes: { label: 'Remove' },
      no: { label: 'Cancel', default: true },
      rejectClose: false,
    });

    if (confirmed) {
      await game.storyframe.socketManager.requestRemoveSpeaker(speakerId);
    }
  }

  static async _onClearSpeaker(_event, _target) {
    await game.storyframe.socketManager.requestSetActiveSpeaker(null);
  }

  static async _onClearAllSpeakers(_event, _target) {
    const state = game.storyframe.stateManager.getState();
    if (!state?.speakers?.length) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'Clear All NPCs' },
      content: '<p>Remove all NPCs from the list?</p>',
      yes: { label: 'Clear All' },
      no: { label: 'Cancel', default: true },
      rejectClose: false,
    });

    if (confirmed) {
      await game.storyframe.socketManager.requestUpdateSpeakers([]);
    }
  }

  static async _onClearAllParticipants(_event, _target) {
    const state = game.storyframe.stateManager.getState();
    if (!state?.participants?.length) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'Clear All PCs' },
      content: '<p>Remove all PCs from the list?</p>',
      yes: { label: 'Clear All' },
      no: { label: 'Cancel', default: true },
      rejectClose: false,
    });

    if (confirmed) {
      await game.storyframe.socketManager.requestClearAllParticipants();
      this.selectedParticipants.clear();
    }
  }

  static async _onSwitchTab(_event, target) {
    const tab = target.dataset.tab;
    this.currentTab = tab;
    this.render();
  }

  static async _onToggleSecretRoll(_event, _target) {
    this.secretRollEnabled = !this.secretRollEnabled;
    this.render();
  }

  static async _onToggleJournalChecksPanel(_event, _target) {
    this.journalChecksPanelCollapsed = !this.journalChecksPanelCollapsed;
    this.render();
  }

  static async _onToggleJournalImagesPanel(_event, _target) {
    this.journalImagesPanelCollapsed = !this.journalImagesPanelCollapsed;
    this.render();
  }

  static async _onAddAllPCs(_event, _target) {
    const pcs = this._getPlayerCharacters();

    if (pcs.length === 0) {
      ui.notifications.warn('No player characters found');
      return;
    }

    for (const actor of pcs) {
      const owningUser = game.users.find(
        (user) => !user.isGM && actor.testUserPermission(user, 'OWNER'),
      );

      if (owningUser) {
        await game.storyframe.socketManager.requestAddParticipant({
          actorUuid: actor.uuid,
          userId: owningUser.id,
        });
      }
    }

    ui.notifications.info(`Added ${pcs.length} PC(s)`);
  }

  /**
   * Add party PCs (system-specific - override in subclass)
   * Base implementation falls back to adding all PCs
   */
  static async _onAddPartyPCs(_event, _target) {
    // Default: fall back to adding all PCs
    return GMSidebarAppBase._onAddAllPCs.call(this, _event, _target);
  }

  static async _onToggleParticipantSelection(_event, target) {
    const participantElement = target.closest('[data-participant-id]');
    const participantId = participantElement?.dataset.participantId;
    if (!participantId) return;

    const isSelected = this.selectedParticipants.has(participantId);

    if (isSelected) {
      this.selectedParticipants.delete(participantId);
      participantElement.classList.remove('selected');
      participantElement.setAttribute('aria-selected', 'false');
    } else {
      this.selectedParticipants.add(participantId);
      participantElement.classList.add('selected');
      participantElement.setAttribute('aria-selected', 'true');
    }

    // Update UI elements directly
    const state = game.storyframe.stateManager.getState();
    const totalParticipants = state?.participants?.length || 0;
    const selectedCount = this.selectedParticipants.size;
    const allSelected = totalParticipants > 0 && selectedCount === totalParticipants;

    // Update count display
    const countDisplay = this.element.querySelector('.selection-info .count');
    if (countDisplay) {
      countDisplay.textContent = `${selectedCount}/${totalParticipants}`;
      countDisplay.setAttribute('aria-label', `${selectedCount} of ${totalParticipants} selected`);
    }

    // Update selection-info class
    const selectionInfo = this.element.querySelector('.selection-info');
    if (selectionInfo) {
      selectionInfo.classList.toggle('has-selection', selectedCount > 0);
    }

    // Update select all button
    const selectAllBtn = this.element.querySelector('[data-action="toggleSelectAll"] i');
    if (selectAllBtn) {
      selectAllBtn.className = allSelected ? 'far fa-square' : 'fas fa-check-double';
    }

    // Update check-request-bar ready state
    const requestBar = this.element.querySelector('.check-request-bar');
    if (requestBar) {
      requestBar.classList.toggle('ready', selectedCount > 0 && this.currentDC);
    }

    // Re-render to update avatar display
    this.render();
  }

  static async _onRemoveParticipant(event, target) {
    event.stopPropagation();
    const participantId = target.closest('[data-participant-id]')?.dataset.participantId;
    if (!participantId) return;

    await game.storyframe.socketManager.requestRemoveParticipant(participantId);
    this.selectedParticipants.delete(participantId);
  }

  static async _onToggleSelectAll(_event, _target) {
    const state = game.storyframe.stateManager.getState();
    const allParticipantIds = (state.participants || []).map((p) => p.id);

    const selectAll = this.selectedParticipants.size !== allParticipantIds.length;

    if (selectAll) {
      this.selectedParticipants = new Set(allParticipantIds);
    } else {
      this.selectedParticipants.clear();
    }

    // Update all participant elements
    const participants = this.element.querySelectorAll('[data-participant-id]');
    participants.forEach((el) => {
      if (selectAll) {
        el.classList.add('selected');
        el.setAttribute('aria-selected', 'true');
      } else {
        el.classList.remove('selected');
        el.setAttribute('aria-selected', 'false');
      }
    });

    // Re-render to update avatar display
    console.log('Select all - selected participants:', Array.from(this.selectedParticipants));
    this.render();
  }

  /**
   * Update the select all checkbox and count display based on current selection
   */
  static _updateSelectAllCheckbox() {
    if (!this.element) return;

    const state = game.storyframe.stateManager.getState();
    const totalParticipants = state?.participants?.length || 0;
    const selectedCount = this.selectedParticipants.size;
    const allSelected = totalParticipants > 0 && selectedCount === totalParticipants;

    // Update count display
    const countDisplay = this.element.querySelector('.selection-info .count');
    if (countDisplay) {
      countDisplay.textContent = `${selectedCount}/${totalParticipants}`;
      countDisplay.setAttribute('aria-label', `${selectedCount} of ${totalParticipants} selected`);
    }

    // Update selection-info class
    const selectionInfo = this.element.querySelector('.selection-info');
    if (selectionInfo) {
      if (selectedCount > 0) {
        selectionInfo.classList.add('has-selection');
      } else {
        selectionInfo.classList.remove('has-selection');
      }
    }

    // Update select all button icon and tooltip
    const selectAllBtn = this.element.querySelector('[data-action="toggleSelectAll"]');
    if (selectAllBtn) {
      const icon = selectAllBtn.querySelector('i');
      if (icon) {
        if (allSelected) {
          icon.className = 'far fa-square';
        } else {
          icon.className = 'fas fa-check-double';
        }
      }

      const tooltip = allSelected ? 'Deselect all' : 'Select all';
      selectAllBtn.setAttribute('data-tooltip', tooltip);
      selectAllBtn.setAttribute('aria-label', tooltip);
    }

    // Update check-request-bar ready state
    const requestBar = this.element.querySelector('.check-request-bar');
    if (requestBar) {
      if (selectedCount > 0 && this.currentDC) {
        requestBar.classList.add('ready');
      } else {
        requestBar.classList.remove('ready');
      }
    }
  }

  static async _onRequestSkill(_event, target) {
    const skillSlug = target.dataset.skill;
    if (!skillSlug) return;

    if (this.selectedParticipants.size === 0) {
      ui.notifications.warn('No PCs selected');
      return;
    }

    await this._requestSkillCheck(skillSlug, Array.from(this.selectedParticipants));
  }

  static async _onOpenSkillMenu(_event, target) {
    // Get system-specific skills
    const systemSkills = SystemAdapter.getSkills();
    const allSkills = Object.entries(systemSkills).map(([slug, skill]) => ({
      slug,
      name: skill.name,
      isLore: false,
    }));

    // Add lore skills from participants
    const state = game.storyframe.stateManager.getState();
    const participantLores = await this.constructor._getLoreSkills(state, this.selectedParticipants);
    allSkills.push(...participantLores);

    const appInstance = this;

    // Remove any existing skill menu
    document.querySelector('.storyframe-skill-menu')?.remove();

    // Create popup menu
    const menu = document.createElement('div');
    menu.className = 'storyframe-skill-menu';

    const regularSkills = allSkills.filter((s) => !s.isLore);
    const loreSkills = allSkills.filter((s) => s.isLore);

    let menuHTML = regularSkills
      .map(
        (s) =>
          `<button type="button" class="skill-option" data-skill="${s.slug}">${s.name}</button>`,
      )
      .join('');

    if (loreSkills.length > 0) {
      menuHTML += '<div class="skill-divider"></div>';
      menuHTML += loreSkills
        .map(
          (s) =>
            `<button type="button" class="skill-option lore" data-skill="${s.slug}" data-is-lore="true"><i class="fas fa-book"></i> ${s.name}</button>`,
        )
        .join('');
    }

    menu.innerHTML = menuHTML;

    // Position near the button
    const rect = target.getBoundingClientRect();
    menu.style.cssText = `
      position: fixed;
      top: ${rect.top}px;
      left: ${rect.right + 8}px;
      z-index: 10000;
      background: #1a1a2e;
      border: 1px solid #3d3d5c;
      border-radius: 8px;
      padding: 6px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-height: 320px;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;

    // Style divider
    const divider = menu.querySelector('.skill-divider');
    if (divider) {
      divider.style.cssText = `
        height: 1px;
        background: rgba(255, 255, 255, 0.1);
        margin: 4px 8px;
      `;
    }

    // Add click handlers
    menu.querySelectorAll('.skill-option').forEach((btn) => {
      const isLore = btn.classList.contains('lore');
      btn.style.cssText = `
        padding: 8px 14px;
        background: transparent;
        border: none;
        color: ${isLore ? '#aaa' : '#e0e0e0'};
        cursor: pointer;
        text-align: left;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        transition: background 0.15s ease;
        display: flex;
        align-items: center;
        gap: 8px;
      `;
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'rgba(94, 129, 172, 0.3)';
        btn.style.color = '#ffffff';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'transparent';
        btn.style.color = '#e0e0e0';
      });
      btn.addEventListener('click', async () => {
        const skillSlug = btn.dataset.skill;
        menu.remove();

        if (appInstance.selectedParticipants.size === 0) {
          ui.notifications.warn('No PCs selected');
          return;
        }

        // For lore skills, pass the slug as-is (it's the lore name slugified)
        await appInstance._requestSkillCheck(
          skillSlug,
          Array.from(appInstance.selectedParticipants),
        );
      });
    });

    // Close on click outside
    const closeHandler = (e) => {
      if (!menu.contains(e.target) && e.target !== target) {
        menu.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);

    document.body.appendChild(menu);

    // Adjust position if off-screen
    const menuRect = menu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth) {
      menu.style.left = `${rect.left - menuRect.width - 5}px`;
    }
    if (menuRect.bottom > window.innerHeight) {
      menu.style.top = `${window.innerHeight - menuRect.height - 10}px`;
    }
  }

  static async _onOpenSkillConfig(_event, target) {
    // Get system-specific skills
    const systemSkills = SystemAdapter.getSkills();
    const allSkills = Object.entries(systemSkills).map(([slug, skill]) => ({
      slug,
      name: skill.name,
    }));

    // Get current selected skills
    const currentSetting = game.settings.get(MODULE_ID, 'quickButtonSkills');
    const selectedSlugs = new Set(
      currentSetting
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );

    // Remove any existing config panel
    document.querySelector('.storyframe-skill-config')?.remove();

    // Create config panel
    const panel = document.createElement('div');
    panel.className = 'storyframe-skill-config';

    const checkboxesHtml = allSkills
      .map(
        (s) => `
      <label class="skill-checkbox-item" data-slug="${s.slug}">
        <input type="checkbox" value="${s.slug}" ${selectedSlugs.has(s.slug) ? 'checked' : ''}>
        <span class="skill-label">${s.name}</span>
      </label>
    `,
      )
      .join('');

    panel.innerHTML = `
      <div class="config-header">
        <span class="config-title">Quick Skill Buttons</span>
        <button type="button" class="config-close" aria-label="Close">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="config-body">
        <p class="config-hint">Select skills to show as quick buttons</p>
        <div class="skill-checkboxes">${checkboxesHtml}</div>
      </div>
    `;

    // Style the panel
    panel.style.cssText = `
      position: fixed;
      z-index: 10001;
      background: #1a1a2e;
      border: 1px solid #3d3d5c;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      width: 280px;
      max-height: 420px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;

    // Position near the button
    const rect = target.getBoundingClientRect();
    panel.style.top = `${rect.top}px`;
    panel.style.left = `${rect.right + 8}px`;

    // Style header
    const header = panel.querySelector('.config-header');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: rgba(0,0,0,0.3);
      border-bottom: 1px solid rgba(255,255,255,0.1);
    `;

    const title = panel.querySelector('.config-title');
    title.style.cssText = `
      font-size: 13px;
      font-weight: 700;
      color: #ffffff;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    `;

    const closeBtn = panel.querySelector('.config-close');
    closeBtn.style.cssText = `
      background: transparent;
      border: none;
      color: #888;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: all 0.15s;
    `;
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = 'rgba(255,255,255,0.1)';
      closeBtn.style.color = '#fff';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'transparent';
      closeBtn.style.color = '#888';
    });

    // Style body
    const body = panel.querySelector('.config-body');
    body.style.cssText = `
      flex: 1;
      padding: 12px 16px;
      overflow-y: auto;
    `;

    const hint = panel.querySelector('.config-hint');
    hint.style.cssText = `
      font-size: 11px;
      color: #888;
      margin: 0 0 12px 0;
    `;

    // Style checkboxes container
    const checkboxes = panel.querySelector('.skill-checkboxes');
    checkboxes.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    `;

    // Style checkbox items
    panel.querySelectorAll('.skill-checkbox-item').forEach((item) => {
      item.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        background: rgba(0,0,0,0.2);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s;
        border: 1px solid transparent;
      `;

      const checkbox = item.querySelector('input');
      checkbox.style.cssText = `
        width: 16px;
        height: 16px;
        accent-color: #5e81ac;
        cursor: pointer;
        margin: 0;
      `;

      const label = item.querySelector('.skill-label');
      label.style.cssText = `
        font-size: 12px;
        color: #e0e0e0;
        font-weight: 500;
      `;

      // Update styling based on checked state
      const updateItemStyle = () => {
        if (checkbox.checked) {
          item.style.background = 'rgba(94, 129, 172, 0.2)';
          item.style.borderColor = 'rgba(94, 129, 172, 0.4)';
          label.style.color = '#ffffff';
        } else {
          item.style.background = 'rgba(0,0,0,0.2)';
          item.style.borderColor = 'transparent';
          label.style.color = '#e0e0e0';
        }
      };
      updateItemStyle();

      item.addEventListener('mouseenter', () => {
        if (!checkbox.checked) {
          item.style.background = 'rgba(255,255,255,0.05)';
        }
      });
      item.addEventListener('mouseleave', () => {
        updateItemStyle();
      });

      // Handle checkbox change
      checkbox.addEventListener('change', async () => {
        updateItemStyle();

        // Update setting
        const selected = [];
        panel.querySelectorAll('.skill-checkbox-item input:checked').forEach((cb) => {
          selected.push(cb.value);
        });

        // Maintain order from allSkills
        const orderedSelected = allSkills
          .filter((s) => selected.includes(s.slug))
          .map((s) => s.slug);

        await game.settings.set(MODULE_ID, 'quickButtonSkills', orderedSelected.join(','));
      });
    });

    // Close button handler
    closeBtn.addEventListener('click', () => panel.remove());

    // Close on click outside
    const closeHandler = (e) => {
      if (!panel.contains(e.target) && e.target !== target) {
        panel.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);

    document.body.appendChild(panel);

    // Adjust position if off-screen
    const panelRect = panel.getBoundingClientRect();
    if (panelRect.right > window.innerWidth) {
      panel.style.left = `${rect.left - panelRect.width - 8}px`;
    }
    if (panelRect.bottom > window.innerHeight) {
      panel.style.top = `${window.innerHeight - panelRect.height - 10}px`;
    }
  }

  static async _onSetDCSelect(_event, target) {
    const value = target.value;
    if (value === '') {
      this.currentDC = null;
    } else {
      const dc = parseInt(value);
      if (!isNaN(dc)) {
        this.currentDC = dc;
      }
    }
    this.render();
  }

  static async _onSetDifficulty(_event, target) {
    const difficulty = target.value;
    this.currentDifficulty = difficulty;

    // Recalculate DC based on party level and new difficulty
    const partyLevel = await this._getPartyLevel();
    if (partyLevel !== null) {
      this.currentDC = this._calculateDCByLevel(partyLevel, difficulty);
    }

    this.render();
  }

  static async _onCancelRoll(_event, target) {
    const requestId = target.closest('[data-request-id]')?.dataset.requestId;
    if (!requestId) return;

    await game.storyframe.socketManager.requestRemovePendingRoll(requestId);
    ui.notifications.info('Roll request cancelled');
  }

  static async _onOpenPlayerWindows(_event, _target) {
    game.storyframe.socketManager.openAllPlayerViewers();
    ui.notifications.info('Opening StoryFrame on all player clients');
  }

  static async _onClosePlayerWindows(_event, _target) {
    game.storyframe.socketManager.closeAllPlayerViewers();
    ui.notifications.info('Closing StoryFrame on all player clients');
  }

  static async _onShowPendingRolls(_event, target) {
    const state = game.storyframe.stateManager.getState();
    const pendingRolls = state?.pendingRolls || [];

    if (pendingRolls.length === 0) {
      ui.notifications.info('No pending rolls');
      return;
    }

    // Build pending rolls data with names
    const rollsData = await Promise.all(
      pendingRolls.map(async (r) => {
        const participant = state.participants?.find((p) => p.id === r.participantId);
        const actor = participant ? await fromUuid(participant.actorUuid) : null;
        return {
          ...r,
          participantName: actor?.name || 'Unknown',
          skillName: this._getSkillName(r.skillSlug),
          actionName: r.actionSlug ? this._getActionName(r.skillSlug, r.actionSlug) : null,
        };
      }),
    );

    // Remove existing popup if any
    document.querySelector('.storyframe-pending-rolls-popup')?.remove();

    // Create popup
    const popup = document.createElement('div');
    popup.className = 'storyframe-pending-rolls-popup';

    const rollsHtml = rollsData
      .map(
        (roll) => `
      <div class="pending-roll-item" data-request-id="${roll.id}">
        <div class="roll-info">
          <span class="participant-name">${roll.participantName}</span>
          <span class="skill-name">${roll.skillName}${roll.actionName ? ` (${roll.actionName})` : ''}</span>
          ${roll.dc ? `<span class="dc-badge">DC ${roll.dc}</span>` : ''}
        </div>
        <button type="button" class="cancel-roll-btn" data-request-id="${roll.id}" data-tooltip="Cancel request">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `,
      )
      .join('');

    popup.innerHTML = `
      <div class="popup-header">
        <span class="popup-title">Pending Rolls (${rollsData.length})</span>
        <button type="button" class="popup-close" aria-label="Close">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="popup-body">
        ${rollsHtml}
      </div>
      <div class="popup-footer">
        <button type="button" class="cancel-all-btn">Cancel All</button>
      </div>
    `;

    // Style the popup
    popup.style.cssText = `
      position: fixed;
      z-index: 10001;
      background: #1a1a2e;
      border: 1px solid #3d3d5c;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      width: 320px;
      max-height: 400px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;

    // Position near the indicator
    const rect = target.getBoundingClientRect();
    popup.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    popup.style.right = `${window.innerWidth - rect.right}px`;

    // Style header
    const header = popup.querySelector('.popup-header');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: rgba(0,0,0,0.3);
      border-bottom: 1px solid rgba(255,255,255,0.1);
    `;

    const title = popup.querySelector('.popup-title');
    title.style.cssText = `
      font-size: 13px;
      font-weight: 700;
      color: #ffffff;
    `;

    const closeBtn = popup.querySelector('.popup-close');
    closeBtn.style.cssText = `
      background: transparent;
      border: none;
      color: #888;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: all 0.15s;
    `;

    // Style body
    const body = popup.querySelector('.popup-body');
    body.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    `;

    // Style roll items
    popup.querySelectorAll('.pending-roll-item').forEach((item) => {
      item.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        background: rgba(0,0,0,0.2);
        border-radius: 8px;
        margin-bottom: 6px;
      `;

      const info = item.querySelector('.roll-info');
      info.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 2px;
      `;

      const name = item.querySelector('.participant-name');
      name.style.cssText = `
        font-size: 13px;
        font-weight: 600;
        color: #ffffff;
      `;

      const skill = item.querySelector('.skill-name');
      skill.style.cssText = `
        font-size: 11px;
        color: #aaa;
      `;

      const dcBadge = item.querySelector('.dc-badge');
      if (dcBadge) {
        dcBadge.style.cssText = `
          font-size: 10px;
          color: #5e81ac;
          font-weight: 600;
        `;
      }

      const cancelBtn = item.querySelector('.cancel-roll-btn');
      cancelBtn.style.cssText = `
        background: transparent;
        border: none;
        color: #888;
        cursor: pointer;
        padding: 6px 8px;
        border-radius: 4px;
        transition: all 0.15s;
      `;
      cancelBtn.addEventListener('mouseenter', () => {
        cancelBtn.style.background = 'rgba(255,100,100,0.2)';
        cancelBtn.style.color = '#ff6b6b';
      });
      cancelBtn.addEventListener('mouseleave', () => {
        cancelBtn.style.background = 'transparent';
        cancelBtn.style.color = '#888';
      });
    });

    // Style footer
    const footer = popup.querySelector('.popup-footer');
    footer.style.cssText = `
      padding: 12px 16px;
      border-top: 1px solid rgba(255,255,255,0.1);
      display: flex;
      justify-content: flex-end;
    `;

    const cancelAllBtn = popup.querySelector('.cancel-all-btn');
    cancelAllBtn.style.cssText = `
      background: rgba(255,100,100,0.2);
      border: 1px solid rgba(255,100,100,0.3);
      color: #ff6b6b;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    `;
    cancelAllBtn.addEventListener('mouseenter', () => {
      cancelAllBtn.style.background = 'rgba(255,100,100,0.3)';
    });
    cancelAllBtn.addEventListener('mouseleave', () => {
      cancelAllBtn.style.background = 'rgba(255,100,100,0.2)';
    });

    // Event handlers
    closeBtn.addEventListener('click', () => popup.remove());

    // Cancel individual roll
    popup.querySelectorAll('.cancel-roll-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const requestId = btn.dataset.requestId;
        await game.storyframe.socketManager.requestRemovePendingRoll(requestId);

        // Remove item from popup
        const item = btn.closest('.pending-roll-item');
        item.remove();

        // Update count in header
        const remaining = popup.querySelectorAll('.pending-roll-item').length;
        title.textContent = `Pending Rolls (${remaining})`;

        // Close popup if no more rolls
        if (remaining === 0) {
          popup.remove();
        }

        ui.notifications.info('Roll request cancelled');
      });
    });

    // Cancel all rolls
    cancelAllBtn.addEventListener('click', async () => {
      for (const roll of rollsData) {
        await game.storyframe.socketManager.requestRemovePendingRoll(roll.id);
      }
      popup.remove();
      ui.notifications.info('All roll requests cancelled');
    });

    // Close on click outside
    const closeHandler = (e) => {
      if (!popup.contains(e.target) && !target.contains(e.target)) {
        popup.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);

    // Close on escape
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        popup.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    document.body.appendChild(popup);

    // Adjust position if off-screen
    const popupRect = popup.getBoundingClientRect();
    if (popupRect.left < 10) {
      popup.style.right = 'auto';
      popup.style.left = '10px';
    }
    if (popupRect.top < 10) {
      popup.style.bottom = 'auto';
      popup.style.top = '10px';
    }
  }

  static _onTogglePresetDropdown(_event, target) {
    const dropdown = this.element.querySelector('.preset-dropdown');
    if (!dropdown) return;

    const isVisible = dropdown.style.display !== 'none';
    dropdown.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
      const closeHandler = (e) => {
        if (!dropdown.contains(e.target) && !target.contains(e.target)) {
          dropdown.style.display = 'none';
          document.removeEventListener('click', closeHandler);
        }
      };
      setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }
  }

  static async _onApplyPreset(_event, target) {
    const presetId = target.dataset.presetId;
    const presets = game.settings.get(MODULE_ID, 'dcPresets');
    const preset = presets.find((p) => p.id === presetId);

    if (!preset) return;

    this.currentDC = preset.dc;
    const dcInput = this.element.querySelector('#dc-input');
    if (dcInput) dcInput.value = preset.dc;

    const dropdown = this.element.querySelector('.preset-dropdown');
    if (dropdown) dropdown.style.display = 'none';

    ui.notifications.info(`Applied: ${preset.name} (DC ${preset.dc})`);
  }

  static async _onAddPresetQuick(_event, _target) {
    const input = this.element.querySelector('#new-preset-dc');
    const dcValue = parseInt(input.value);

    if (isNaN(dcValue) || dcValue < 1 || dcValue > 60) {
      ui.notifications.warn('Enter a valid DC (1-60)');
      return;
    }

    const preset = {
      id: foundry.utils.randomID(),
      name: `DC ${dcValue}`,
      dc: dcValue,
      system: game.system.id,
      createdAt: Date.now(),
    };

    const presets = game.settings.get(MODULE_ID, 'dcPresets');
    presets.push(preset);
    await game.settings.set(MODULE_ID, 'dcPresets', presets);

    input.value = '';

    // Update DOM directly instead of re-rendering to preserve scroll position
    const dropdown = this.element.querySelector('.preset-dropdown');
    let presetList = dropdown?.querySelector('.preset-list');

    // Create preset list if it doesn't exist (first preset)
    if (!presetList) {
      const divider = document.createElement('div');
      divider.className = 'preset-divider';
      dropdown.appendChild(divider);

      presetList = document.createElement('div');
      presetList.className = 'preset-list';
      dropdown.appendChild(presetList);
    }

    // Create and add new preset item
    const presetItem = document.createElement('div');
    presetItem.className = 'preset-item';
    presetItem.innerHTML = `
      <button type="button"
              class="preset-option"
              data-action="applyPreset"
              data-preset-id="${preset.id}"
              data-dc="${preset.dc}"
              data-tooltip="${preset.name}">
        ${preset.dc}
      </button>
      <button type="button"
              class="preset-delete-btn"
              data-action="deletePresetQuick"
              data-preset-id="${preset.id}"
              data-tooltip="Delete">
        <i class="fas fa-times"></i>
      </button>
    `;
    presetList.appendChild(presetItem);

    ui.notifications.info(`Added DC ${dcValue}`);
  }

  static async _onDeletePresetQuick(_event, target) {
    const presetId = target.dataset.presetId;
    const presets = game.settings.get(MODULE_ID, 'dcPresets');
    const filtered = presets.filter((p) => p.id !== presetId);

    await game.settings.set(MODULE_ID, 'dcPresets', filtered);

    // Update DOM directly instead of re-rendering to preserve scroll position
    const presetItem = target.closest('.preset-item');
    if (presetItem) {
      presetItem.remove();

      // If this was the last preset, remove the divider and list container
      const presetList = this.element.querySelector('.preset-list');
      if (presetList && presetList.children.length === 0) {
        const divider = this.element.querySelector('.preset-divider');
        if (divider) divider.remove();
        presetList.remove();
      }
    }
  }

  static async _onShowCheckDCsPopup(_event, target) {
    const skillName = target.dataset.skill;

    // Find all checks for this skill from context
    const context = await this._prepareContext();
    const skillGroup = context.journalCheckGroups.find((g) => g.skillName === skillName);

    if (!skillGroup?.checks?.length) return;

    // Get visible DCs for this skill
    const normalizedSkill = skillName.toLowerCase();
    const visibleDCs = this._visibleChecks?.get(normalizedSkill) || new Set();

    // Create popup menu
    const menu = document.createElement('div');
    menu.className = 'storyframe-dc-popup';

    menu.innerHTML = `
      <div class="dc-popup-header">${skillName}</div>
      <div class="dc-popup-items">
        ${skillGroup.checks.map((check) => {
          const isVisible = visibleDCs.has(String(check.dc));
          const secretIcon = check.isSecret ? '<i class="fas fa-eye-slash" style="font-size: 0.7em; opacity: 0.7; margin-left: 4px;"></i>' : '';
          return `
          <button type="button"
                  class="dc-option ${isVisible ? 'in-view' : ''}"
                  data-dc="${check.dc}"
                  data-skill="${check.skillName}"
                  data-is-secret="${check.isSecret || false}"
                  data-tooltip="${check.label}${check.isSecret ? ' (Secret)' : ''}">
            ${check.dc}${secretIcon}
          </button>
        `;
        }).join('')}
      </div>
    `;

    // Position above button
    const rect = target.getBoundingClientRect();
    document.body.appendChild(menu);

    menu.style.cssText = `
      position: fixed;
      bottom: ${window.innerHeight - rect.top + 4}px;
      left: ${rect.left}px;
      z-index: 10000;
      background: #1a1a2e;
      border: 1px solid #3d3d5c;
      border-radius: 8px;
      padding: 0;
      min-width: 100px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;

    // Style header
    const header = menu.querySelector('.dc-popup-header');
    header.style.cssText = `
      padding: 8px 12px;
      font-size: 11px;
      font-weight: 700;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background: rgba(0,0,0,0.3);
      border-bottom: 1px solid rgba(255,255,255,0.1);
    `;

    // Style items container
    const items = menu.querySelector('.dc-popup-items');
    items.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
      gap: 6px;
      padding: 8px;
    `;

    // Style DC buttons with highlighting for visible checks
    menu.querySelectorAll('.dc-option').forEach((btn) => {
      const isVisible = btn.classList.contains('in-view');

      btn.style.cssText = `
        padding: 12px;
        background: ${isVisible ? 'linear-gradient(135deg, rgba(94, 129, 172, 0.6), rgba(94, 129, 172, 0.45))' : 'linear-gradient(135deg, rgba(94, 129, 172, 0.25), rgba(94, 129, 172, 0.15))'};
        border: 1px solid ${isVisible ? 'var(--sf-accent-primary)' : 'rgba(94, 129, 172, 0.4)'};
        border-radius: 6px;
        color: ${isVisible ? '#fff' : 'var(--sf-accent-primary, #5e81ac)'};
        cursor: pointer;
        font-size: 1.4em;
        font-weight: 700;
        font-family: var(--font-mono, monospace);
        transition: all 0.15s ease;
        box-shadow: ${isVisible ? '0 0 12px rgba(94, 129, 172, 0.6), inset 0 0 20px rgba(94, 129, 172, 0.2)' : 'none'};
      `;

      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'linear-gradient(135deg, rgba(94, 129, 172, 0.35), rgba(94, 129, 172, 0.25))';
        btn.style.transform = 'scale(1.05)';
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.background = isVisible ? 'linear-gradient(135deg, rgba(94, 129, 172, 0.6), rgba(94, 129, 172, 0.45))' : 'linear-gradient(135deg, rgba(94, 129, 172, 0.25), rgba(94, 129, 172, 0.15))';
        btn.style.transform = 'scale(1)';
      });

      btn.addEventListener('click', async () => {
        const dc = parseInt(btn.dataset.dc);
        const skill = btn.dataset.skill;
        const isSecret = btn.dataset.isSecret === 'true';
        menu.remove();

        // Set DC and request check
        this.currentDC = dc;
        const dcInput = this.element.querySelector('#dc-input');
        if (dcInput) dcInput.value = dc;

        // Set secret toggle if this is a secret check
        this.secretRollEnabled = isSecret;
        this.render();

        if (this.selectedParticipants.size > 0) {
          const skillSlug = SystemAdapter.getSkillSlugFromName(skill) || skill.toLowerCase();
          if (skillSlug) {
            await this._requestSkillCheck(skillSlug, Array.from(this.selectedParticipants));
          }
        } else {
          ui.notifications.warn('Select PCs first');
        }
      });
    });

    // Close on click outside
    const closeHandler = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
  }

  static async _onApplyJournalCheck(_event, target) {
    const dc = parseInt(target.dataset.dc);
    const skillName = target.dataset.skill;


    if (isNaN(dc)) return;

    // Set the DC
    this.currentDC = dc;
    const dcInput = this.element.querySelector('#dc-input');
    if (dcInput) dcInput.value = dc;

    // If PCs are selected and we have a skill, request the roll
    if (this.selectedParticipants.size > 0 && skillName) {
      // Map skill name to slug using SystemAdapter
      const skillSlug = SystemAdapter.getSkillSlugFromName(skillName) || skillName.toLowerCase();

      if (skillSlug) {
        await this._requestSkillCheck(skillSlug, Array.from(this.selectedParticipants));
      } else {
        ui.notifications.warn(`Unknown skill: ${skillName}`);
      }
    } else if (this.selectedParticipants.size === 0) {
      ui.notifications.warn('Select PCs first to request a roll');
    } else {
      ui.notifications.info(`Set DC to ${dc}`);
    }
  }

  static async _onSetImageAsSpeaker(_event, target) {
    const imageSrc = target.dataset.imageSrc;
    if (!imageSrc) return;

    const label = await foundry.applications.api.DialogV2.prompt({
      window: { title: 'NPC Name' },
      content: '<input type="text" name="label" placeholder="Enter NPC name" autofocus>',
      ok: {
        label: 'Add',
        callback: (event, button, _dialog) => button.form.elements.label.value,
      },
      rejectClose: false,
    });

    if (label) {
      await game.storyframe.socketManager.requestAddSpeaker({
        imagePath: imageSrc,
        label,
      });
      ui.notifications.info(`Added ${label} as NPC`);
    }
  }

  static async _onSetActorAsSpeaker(_event, target) {
    const actorId = target.dataset.actorId;
    if (!actorId) return;

    const actor = game.actors.get(actorId);
    if (!actor) {
      ui.notifications.error('Actor not found');
      return;
    }

    await game.storyframe.socketManager.requestAddSpeaker({
      actorUuid: actor.uuid,
      imagePath: actor.img,
      label: actor.name,
    });
    ui.notifications.info(`Added ${actor.name} as NPC`);
  }

  static async _onPresentChallenge(_event, _target) {
    // No participant requirement - challenge is broadcast to all players
    const builder = new ChallengeBuilderDialog(new Set());
    builder.render(true);
  }

  static async _onClearChallenge(_event, _target) {
    await game.storyframe.socketManager.requestClearActiveChallenge();
    ui.notifications.info('Challenge cleared');
  }

  static async _onPresentSavedChallenge(_event, target) {
    const challengeId = target.dataset.challengeId;
    const savedChallenges = game.settings.get(MODULE_ID, 'challengeLibrary') || [];
    const template = savedChallenges.find(c => c.id === challengeId);

    if (!template) {
      ui.notifications.error('Challenge not found');
      return;
    }

    // Create challenge data from template
    const challengeData = {
      id: foundry.utils.randomID(),
      name: template.name,
      image: template.image,
      selectedParticipants: [], // Broadcast to all players
      options: template.options,
    };

    await game.storyframe.socketManager.requestSetActiveChallenge(challengeData);
    ui.notifications.info(`Challenge "${challengeData.name}" presented to all players`);
  }

  static async _onEditChallenge(_event, target) {
    const challengeId = target.dataset.challengeId;
    const savedChallenges = game.settings.get(MODULE_ID, 'challengeLibrary') || [];
    const template = savedChallenges.find(c => c.id === challengeId);

    if (!template) {
      ui.notifications.error('Challenge not found');
      return;
    }

    // Import ChallengeBuilderDialog
    const { ChallengeBuilderDialog } = await import('./challenge-builder.mjs');

    // Open builder in edit mode
    const builder = new ChallengeBuilderDialog(new Set(), {
      editMode: true,
      templateId: challengeId,
      templateData: template,
    });
    builder.render(true);
  }

  static async _onDeleteChallenge(_event, target) {
    const challengeId = target.dataset.challengeId;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'Delete Challenge' },
      content: '<p>Delete this challenge from library?</p>',
      yes: { label: 'Delete' },
      no: { label: 'Cancel' },
      rejectClose: false,
    });

    if (!confirmed) return;

    const savedChallenges = game.settings.get(MODULE_ID, 'challengeLibrary') || [];
    const filtered = savedChallenges.filter(c => c.id !== challengeId);
    await game.settings.set(MODULE_ID, 'challengeLibrary', filtered);

    ui.notifications.info('Challenge deleted from library');
    this.render();
  }

  /**
   * Create a challenge from selected journal text
   */
  static async _onCreateChallengeFromSelection(_event, _target) {
    // Get the journal content element
    const content = this._getJournalContent();
    if (!content) {
      ui.notifications.warn('No journal content found');
      return;
    }

    // Get selected text from the journal
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      ui.notifications.warn('No text selected in journal');
      return;
    }

    // Check if selection is within the journal content
    const range = selection.getRangeAt(0);
    if (!content.contains(range.commonAncestorContainer)) {
      ui.notifications.warn('Selection must be within the journal content');
      return;
    }

    // Create a temporary container with the selected HTML
    const fragment = range.cloneContents();
    const tempContainer = document.createElement('div');
    tempContainer.appendChild(fragment);

    // Parse checks from the selected content
    const checks = this._parseChecksFromContent(tempContainer);

    if (checks.length === 0) {
      ui.notifications.warn('No skill checks found in selected text');
      return;
    }

    // Prompt for challenge name
    const challengeName = await foundry.applications.api.DialogV2.prompt({
      window: { title: 'Create Challenge' },
      content: '<p>Enter a name for this challenge:</p><input type="text" name="challengeName" autofocus>',
      ok: {
        label: 'Create',
        callback: (_event, button, _dialog) => button.form.elements.challengeName.value,
      },
      rejectClose: false,
    });

    if (!challengeName) return;

    // Create options from checks - each check becomes an option
    const options = checks.map((check) => {
      // Extract description without DC reference
      let description = check.label || '';
      // Remove common DC patterns like "DC 15" or "(DC 15)" from description
      description = description.replace(/\(?\s*DC\s*\d+\s*\)?/gi, '').trim();
      // If description is empty after cleaning, use skill name
      if (!description) {
        description = check.skillName.charAt(0).toUpperCase() + check.skillName.slice(1);
      }

      // Map skill name to short slug for the challenge system
      const skillSlug = SystemAdapter.getSkillSlugFromName(check.skillName) || check.skillName;

      return {
        id: foundry.utils.randomID(),
        description,
        skillOptions: [{
          skill: skillSlug || check.skillName,
          dc: check.dc,
          action: null,
          isSecret: check.isSecret || false,
        }],
      };
    });

    // Create challenge template
    const template = {
      id: foundry.utils.randomID(),
      name: challengeName,
      image: null,
      options,
      createdAt: Date.now(),
    };

    // Save to library
    const savedChallenges = game.settings.get(MODULE_ID, 'challengeLibrary') || [];
    savedChallenges.push(template);
    await game.settings.set(MODULE_ID, 'challengeLibrary', savedChallenges);

    ui.notifications.info(`Challenge "${challengeName}" created with ${checks.length} check(s)`);

    // Rerender to show new challenge in library
    this.render();

    // Clear selection
    selection.removeAllRanges();
  }

  static async _onManageChallengeLibraryOLD(_event, _target) {
    const savedChallenges = game.settings.get(MODULE_ID, 'challengeLibrary') || [];

    if (savedChallenges.length === 0) {
      ui.notifications.info('No saved challenges. Create one and check "Save to library"');
      return;
    }

    // Build library manager dialog (OLD INLINE VERSION - TO BE DELETED)
    const challengeCards = savedChallenges.map(c => {
      const optionsPreview = c.options.map((opt, idx) => {
        const skillsText = opt.skillOptions.map(so => {
          const skillName = this._getSkillName(so.skill);
          return `<span class="skill-dc-pill">${skillName} <strong>DC ${so.dc}</strong></span>`;
        }).join(' ');
        return `
          <div class="lib-option-preview">
            <div class="opt-num">Option ${idx + 1}</div>
            <div class="opt-desc">${opt.description}</div>
            <div class="opt-skills">${skillsText}</div>
          </div>
        `;
      }).join('');

      return `
        <div class="lib-challenge-card" data-challenge-id="${c.id}">
          <div class="lib-card-header">
            <div class="lib-card-title-section">
              <i class="fas fa-flag-checkered lib-card-icon"></i>
              <span class="lib-card-title">${c.name}</span>
            </div>
            <button type="button" class="lib-delete-btn" data-challenge-id="${c.id}">
              <i class="fas fa-trash"></i>
            </button>
          </div>
          <div class="lib-card-body">
            ${optionsPreview}
          </div>
          <button type="button" class="lib-present-btn" data-challenge-id="${c.id}">
            <i class="fas fa-paper-plane"></i> Present to Selected PCs
          </button>
        </div>
      `;
    }).join('');

    const content = `
      <style>
        .lib-manager-content {
          display: flex;
          flex-direction: column;
          gap: 14px;
          max-height: 520px;
          overflow-y: auto;
          padding: 4px;
        }
        .lib-manager-content::-webkit-scrollbar { width: 8px; }
        .lib-manager-content::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); border-radius: 4px; }
        .lib-manager-content::-webkit-scrollbar-thumb { background: rgba(94, 129, 172, 0.4); border-radius: 4px; }
        .lib-manager-content::-webkit-scrollbar-thumb:hover { background: rgba(94, 129, 172, 0.6); }

        .lib-challenge-card {
          background: linear-gradient(135deg, rgba(94, 129, 172, 0.15), rgba(94, 129, 172, 0.08));
          border: 1px solid rgba(94, 129, 172, 0.35);
          border-radius: 10px;
          padding: 16px;
          box-shadow: 0 3px 12px rgba(0, 0, 0, 0.25);
          transition: all 0.3s ease;
        }
        .lib-challenge-card:hover {
          border-color: rgba(94, 129, 172, 0.5);
          box-shadow: 0 5px 20px rgba(0, 0, 0, 0.35);
          transform: translateY(-2px);
        }

        .lib-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
          padding-bottom: 12px;
          border-bottom: 2px solid rgba(94, 129, 172, 0.25);
        }

        .lib-card-title-section {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
        }

        .lib-card-icon {
          font-size: 18px;
          color: rgba(94, 129, 172, 0.7);
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .lib-card-title {
          font-weight: 700;
          font-size: 16px;
          color: #e0e0e0;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
          letter-spacing: 0.02em;
        }

        .lib-delete-btn {
          background: linear-gradient(135deg, rgba(191, 97, 106, 0.3), rgba(191, 97, 106, 0.2));
          border: 1px solid rgba(191, 97, 106, 0.5);
          color: #bf616a;
          padding: 7px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }
        .lib-delete-btn:hover {
          background: linear-gradient(135deg, rgba(191, 97, 106, 0.45), rgba(191, 97, 106, 0.35));
          transform: translateY(-1px);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
        }
        .lib-delete-btn:active {
          transform: translateY(0);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }
        .lib-delete-btn i { font-size: 10px; }

        .lib-card-body {
          font-size: 12px;
          color: #d8dee9;
          margin-bottom: 12px;
          line-height: 1.5;
        }

        .lib-option-preview {
          margin: 8px 0;
          padding: 10px 14px;
          background: rgba(0, 0, 0, 0.3);
          border-left: 3px solid rgba(94, 129, 172, 0.5);
          border-radius: 0 6px 6px 0;
          box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
        }
        .lib-option-preview:first-child { margin-top: 0; }
        .lib-option-preview:last-child { margin-bottom: 0; }

        .opt-num {
          font-size: 10px;
          font-weight: 700;
          color: rgba(94, 129, 172, 0.8);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
        }

        .opt-desc {
          font-size: 13px;
          font-weight: 600;
          color: #e0e0e0;
          margin-bottom: 6px;
          line-height: 1.4;
        }

        .opt-skills {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 6px;
        }

        .skill-dc-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          background: linear-gradient(135deg, rgba(94, 129, 172, 0.25), rgba(94, 129, 172, 0.15));
          border: 1px solid rgba(94, 129, 172, 0.4);
          border-radius: 12px;
          font-size: 11px;
          color: #a8b5c8;
          font-weight: 500;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }
        .skill-dc-pill strong {
          color: #5e81ac;
          font-weight: 700;
          font-family: monospace;
        }

        .lib-present-btn {
          width: 100%;
          padding: 12px 16px;
          background: linear-gradient(135deg, rgba(163, 190, 140, 0.35), rgba(163, 190, 140, 0.25));
          border: 1px solid rgba(163, 190, 140, 0.6);
          color: #a3be8c;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 700;
          font-size: 13px;
          transition: all 0.25s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.25);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .lib-present-btn:hover {
          background: linear-gradient(135deg, rgba(163, 190, 140, 0.5), rgba(163, 190, 140, 0.4));
          transform: translateY(-2px);
          box-shadow: 0 5px 16px rgba(0, 0, 0, 0.35);
        }
        .lib-present-btn:active {
          transform: translateY(0);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
        }
        .lib-present-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          transform: none;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
        }
        .lib-present-btn:disabled:hover {
          transform: none;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
        }
        .lib-present-btn i { font-size: 12px; }

        .lib-empty-state {
          text-align: center;
          padding: 60px 40px;
          color: #888;
          font-size: 14px;
        }
        .lib-empty-state i {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.3;
        }
      </style>
      <div class="lib-manager-content">
        ${challengeCards}
      </div>
    `;

    const libDialog = new foundry.applications.api.DialogV2({
      window: { title: 'Challenge Library' },
      content,
      position: { width: 480 },
      buttons: [{
        action: 'close',
        label: 'Close',
        default: true,
      }],
      render: (_event, html) => {
        // Delete challenge
        html.querySelectorAll('.lib-delete-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const challengeId = btn.dataset.challengeId;

            const confirmed = await foundry.applications.api.DialogV2.confirm({
              window: { title: 'Delete Challenge' },
              content: '<p>Delete this challenge from library?</p>',
              yes: { label: 'Delete' },
              no: { label: 'Cancel' },
              rejectClose: false,
            });

            if (confirmed) {
              const savedChallenges = game.settings.get(MODULE_ID, 'challengeLibrary') || [];
              const filtered = savedChallenges.filter(c => c.id !== challengeId);
              await game.settings.set(MODULE_ID, 'challengeLibrary', filtered);
              btn.closest('.lib-challenge-card').remove();
              ui.notifications.info('Challenge deleted');

              // Close dialog if no more challenges
              if (filtered.length === 0) {
                libDialog.close();
              }
            }
          });
        });

        // Present challenge
        html.querySelectorAll('.lib-present-btn').forEach(btn => {
          const hasSelection = this.selectedParticipants.size > 0;
          btn.disabled = !hasSelection;

          if (!hasSelection) {
            btn.title = 'Select PCs first';
          }

          btn.addEventListener('click', async () => {
            const challengeId = btn.dataset.challengeId;
            const savedChallenges = game.settings.get(MODULE_ID, 'challengeLibrary') || [];
            const template = savedChallenges.find(c => c.id === challengeId);

            if (!template) return;

            // Create challenge data from template
            const challengeData = {
              id: foundry.utils.randomID(),
              name: template.name,
              image: template.image,
              selectedParticipants: Array.from(this.selectedParticipants),
              options: template.options,
            };

            await game.storyframe.socketManager.requestSetActiveChallenge(challengeData);
            ui.notifications.info(`Challenge "${challengeData.name}" presented to ${this.selectedParticipants.size} PC(s)`);
            libDialog.close();
          });
        });
      },
    });

    await libDialog.render(true);
  }
}
