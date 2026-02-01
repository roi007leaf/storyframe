const MODULE_ID = 'storyframe';

import * as SystemAdapter from '../system-adapter.mjs';

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
      togglePCsPanel: GMSidebarAppBase._onTogglePCsPanel,
      toggleNPCsPanel: GMSidebarAppBase._onToggleNPCsPanel,
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
    },
  };

  static PARTS = {
    content: {
      template: 'modules/storyframe/templates/gm-sidebar.hbs',
      scrollable: ['.speaker-gallery', '.panel-content'],
    },
  };

  /** @type {foundry.applications.sheets.journal.JournalEntrySheet|null} Reference to the parent journal sheet */
  parentInterface = null;

  /** @type {Function|null} Bound handler for parent position changes */
  _parentPositionHandler = null;

  constructor(options = {}) {
    super(options);
    this._stateRestored = false;

    // Panel state (progressive disclosure - less important sections collapsed)
    this.pcsPanelCollapsed = false;
    this.npcsPanelCollapsed = false;
    this.journalChecksPanelCollapsed = false;
    this.journalImagesPanelCollapsed = true; // Collapsed by default
    this.selectedParticipants = new Set();
    this.currentDC = null;
    this.currentDifficulty = 'standard'; // Default difficulty

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

  async _prepareContext(_options) {
    // Detect system info (needed throughout the method)
    const currentSystem = SystemAdapter.detectSystem();

    const state = game.storyframe.stateManager.getState();

    // Extract checks, images, and actors from parent journal
    const journalCheckGroups = this._extractJournalChecks();
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
    }));

    // Get lore skills from participants
    const loreSkills = await this.constructor._getLoreSkills(state, this.selectedParticipants);

    const selectedCount = this.selectedParticipants.size;
    const allSelected = participants.length > 0 && selectedCount === participants.length;

    // Get system-specific DC options and difficulty adjustments
    const dcOptions = SystemAdapter.getDCOptions();
    const difficultyAdjustments = SystemAdapter.getDifficultyAdjustments();

    // Get system-specific context (override in subclass)
    const systemContext = await this._prepareContextSystemSpecific();
    const { partyLevel = null, calculatedDC = null, difficultyOptions = null } = systemContext;

    // Load DC presets
    const allPresets = game.settings.get(MODULE_ID, 'dcPresets') || [];
    const dcPresets = allPresets.filter((p) => !p.system || p.system === currentSystem);

    return {
      speakers,
      activeSpeaker: state.activeSpeaker,
      hasSpeakers: speakers.length > 0,
      participants,
      hasParticipants: participants.length > 0,
      selectedCount,
      allSelected,
      currentDC: this.currentDC,
      partyLevel,
      calculatedDC,
      currentDifficulty: this.currentDifficulty,
      difficultyOptions,
      pendingRolls,
      quickButtonSkills,
      loreSkills,
      hasLoreSkills: loreSkills.length > 0,
      pcsPanelCollapsed: this.pcsPanelCollapsed,
      npcsPanelCollapsed: this.npcsPanelCollapsed,
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
   */
  _getJournalContent() {
    const element = this.parentInterface.element instanceof HTMLElement
      ? this.parentInterface.element
      : (this.parentInterface.element[0] || this.parentInterface.element);
    return element.querySelector('.journal-page-content');
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

    return Object.values(grouped);
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

  async _requestSkillCheck(skillSlug, participantIds, actionSlug = null) {
    const state = game.storyframe.stateManager.getState();
    if (!state) return;

    // Check if secret roll is enabled
    const secretCheckbox = this.element.querySelector('#secret-roll-checkbox');
    const isSecretRoll = secretCheckbox?.checked || false;

    let sentCount = 0;
    let offlineCount = 0;

    for (const participantId of participantIds) {
      const participant = state.participants.find((p) => p.id === participantId);
      if (!participant) continue;

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

  static async _onTogglePCsPanel(_event, _target) {
    this.pcsPanelCollapsed = !this.pcsPanelCollapsed;
    this.render();
  }

  static async _onToggleNPCsPanel(_event, _target) {
    this.npcsPanelCollapsed = !this.npcsPanelCollapsed;
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
    return this._onAddAllPCs(_event, _target);
  }

  static async _onToggleParticipantSelection(_event, target) {
    const participantId = target.closest('[data-participant-id]')?.dataset.participantId;
    if (!participantId) return;

    if (this.selectedParticipants.has(participantId)) {
      this.selectedParticipants.delete(participantId);
    } else {
      this.selectedParticipants.add(participantId);
    }

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

    if (this.selectedParticipants.size === allParticipantIds.length) {
      this.selectedParticipants.clear();
    } else {
      this.selectedParticipants = new Set(allParticipantIds);
    }

    this.render();
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
        const isLore = btn.dataset.isLore === 'true';
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
    this.render();
    ui.notifications.info(`Added DC ${dcValue}`);
  }

  static async _onDeletePresetQuick(_event, target) {
    const presetId = target.dataset.presetId;
    const presets = game.settings.get(MODULE_ID, 'dcPresets');
    const filtered = presets.filter((p) => p.id !== presetId);

    await game.settings.set(MODULE_ID, 'dcPresets', filtered);
    this.render();
  }

  static async _onShowCheckDCsPopup(event, target) {
    const skillName = target.dataset.skill;

    // Find all checks for this skill from context
    const context = await this._prepareContext();
    const skillGroup = context.journalCheckGroups.find((g) => g.skillName === skillName);

    if (!skillGroup?.checks?.length) return;

    // Create popup menu
    const menu = document.createElement('div');
    menu.className = 'storyframe-dc-popup';

    menu.innerHTML = `
      <div class="dc-popup-header">${skillName}</div>
      <div class="dc-popup-items">
        ${skillGroup.checks.map((check) => `
          <button type="button"
                  class="dc-option"
                  data-dc="${check.dc}"
                  data-skill="${check.skillName}"
                  data-tooltip="${check.label}">
            ${check.dc}
          </button>
        `).join('')}
      </div>
    `;

    // Position above button
    const rect = target.getBoundingClientRect();
    document.body.appendChild(menu);
    const menuRect = menu.getBoundingClientRect();

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

    // Style DC buttons
    menu.querySelectorAll('.dc-option').forEach((btn) => {
      btn.style.cssText = `
        padding: 12px;
        background: linear-gradient(135deg, rgba(94, 129, 172, 0.25), rgba(94, 129, 172, 0.15));
        border: 1px solid rgba(94, 129, 172, 0.4);
        border-radius: 6px;
        color: var(--sf-accent-primary, #5e81ac);
        cursor: pointer;
        font-size: 1.4em;
        font-weight: 700;
        font-family: var(--font-mono, monospace);
        transition: all 0.15s ease;
      `;

      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'linear-gradient(135deg, rgba(94, 129, 172, 0.35), rgba(94, 129, 172, 0.25))';
        btn.style.transform = 'scale(1.05)';
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'linear-gradient(135deg, rgba(94, 129, 172, 0.25), rgba(94, 129, 172, 0.15))';
        btn.style.transform = 'scale(1)';
      });

      btn.addEventListener('click', async () => {
        const dc = parseInt(btn.dataset.dc);
        const skill = btn.dataset.skill;
        menu.remove();

        // Set DC and request check
        this.currentDC = dc;
        const dcInput = this.element.querySelector('#dc-input');
        if (dcInput) dcInput.value = dc;

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
}
