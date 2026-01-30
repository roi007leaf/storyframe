const MODULE_ID = 'storyframe';

import SystemAdapter from '../system-adapter.mjs';

/**
 * GM Sidebar for StoryFrame
 * Drawer-style window that attaches to the right side of the main GM Interface
 */
export class GMSidebarApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  static DEFAULT_OPTIONS = {
    id: 'storyframe-gm-sidebar',
    classes: ['storyframe', 'gm-sidebar', 'drawer'],
    window: {
      title: 'Characters',
      icon: 'fas fa-users',
      resizable: false,
      minimizable: false,
    },
    position: {
      width: 330,
      height: 500,
    },
    actions: {
      addSpeakerFromImage: GMSidebarApp._onAddSpeakerFromImage,
      setSpeaker: GMSidebarApp._onSetSpeaker,
      removeSpeaker: GMSidebarApp._onRemoveSpeaker,
      clearSpeaker: GMSidebarApp._onClearSpeaker,
      clearAllSpeakers: GMSidebarApp._onClearAllSpeakers,
      clearAllParticipants: GMSidebarApp._onClearAllParticipants,
      togglePCsPanel: GMSidebarApp._onTogglePCsPanel,
      addAllPCs: GMSidebarApp._onAddAllPCs,
      toggleParticipantSelection: GMSidebarApp._onToggleParticipantSelection,
      removeParticipant: GMSidebarApp._onRemoveParticipant,
      toggleSelectAll: GMSidebarApp._onToggleSelectAll,
      requestSkill: GMSidebarApp._onRequestSkill,
      openSkillMenu: GMSidebarApp._onOpenSkillMenu,
      openSkillConfig: GMSidebarApp._onOpenSkillConfig,
      setDCSelect: GMSidebarApp._onSetDCSelect,
      setDifficulty: GMSidebarApp._onSetDifficulty,
      cancelRoll: GMSidebarApp._onCancelRoll,
      openPlayerWindows: GMSidebarApp._onOpenPlayerWindows,
      showPendingRolls: GMSidebarApp._onShowPendingRolls,
    },
  };

  static PARTS = {
    content: {
      template: 'modules/storyframe/templates/gm-sidebar.hbs',
      scrollable: ['.speaker-gallery', '.panel-content'],
    },
  };

  /** @type {GMInterfaceApp|null} Reference to the parent interface */
  parentInterface = null;

  /** @type {Function|null} Bound handler for parent position changes */
  _parentPositionHandler = null;

  constructor(options = {}) {
    super(options);
    this._stateRestored = false;

    // Panel state
    this.pcsPanelCollapsed = false;
    this.selectedParticipants = new Set();
    this.currentDC = null;
    this.currentDifficulty = 'standard'; // Default difficulty

    // Store reference to parent interface (stored as gmApp in game.storyframe)
    this.parentInterface = game.storyframe?.gmApp || null;
  }

  /**
   * Position the drawer adjacent to the parent interface
   * @param {number} retryCount - Number of retry attempts remaining
   */
  _positionAsDrawer(retryCount = 3) {
    if (!this.parentInterface?.rendered || !this.parentInterface.element) {
      // Retry if we have attempts left
      if (retryCount > 0) {
        setTimeout(() => this._positionAsDrawer(retryCount - 1), 100);
      }
      return;
    }

    // Get parent position from the actual DOM element for accuracy
    const parentEl = this.parentInterface.element;
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
    this.setPosition({
      left: adjustedLeft,
      top: newTop,
      height: newHeight,
    });

    // Also set directly on the element as a fallback (some ApplicationV2 implementations need this)
    if (this.element) {
      this.element.style.left = `${adjustedLeft}px`;
      this.element.style.top = `${newTop}px`;
      this.element.style.height = `${newHeight}px`;
    }
  }

  /**
   * Start tracking parent window movements
   */
  _startTrackingParent() {
    if (!this.parentInterface) {
      return;
    }

    if (!this.parentInterface.element) {
      return;
    }

    // Create a MutationObserver to watch for style changes on parent element
    this._parentObserver = new MutationObserver((mutations) => {
      if (this.rendered && this.parentInterface?.rendered) {
        // Only reposition if style actually changed
        for (const mutation of mutations) {
          if (mutation.attributeName === 'style') {
            this._positionAsDrawer(0); // No retries during tracking updates
            break;
          }
        }
      }
    });

    this._parentObserver.observe(this.parentInterface.element, {
      attributes: true,
      attributeFilter: ['style'],
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

  async _prepareContext(options) {
    // Detect system info (needed throughout the method)
    const currentSystem = SystemAdapter.detectSystem();

    const state = game.storyframe.stateManager.getState();

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

    const selectedCount = this.selectedParticipants.size;
    const allSelected = participants.length > 0 && selectedCount === participants.length;

    // Get system-specific DC options and difficulty adjustments
    const dcOptions = SystemAdapter.getDCOptions();
    const difficultyAdjustments = SystemAdapter.getDifficultyAdjustments();

    // For PF2e: Get party level and calculate DC by level
    // For D&D 5e: Use difficulty-based DCs
    let partyLevel = null;
    let calculatedDC = null;

    if (currentSystem === 'pf2e') {
      partyLevel = await this._getPartyLevel();
      calculatedDC =
        partyLevel !== null ? this._calculateDCByLevel(partyLevel, this.currentDifficulty) : null;

      // If using difficulty-based DC, update currentDC
      if (this.currentDC === null && calculatedDC !== null) {
        this.currentDC = calculatedDC;
      }
    }

    // Build difficulty options with current selection (PF2e only)
    const difficultyOptions = difficultyAdjustments
      ? difficultyAdjustments.map((d) => ({
          ...d,
          selected: d.id === this.currentDifficulty,
        }))
      : null;

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
      pcsPanelCollapsed: this.pcsPanelCollapsed,
      currentSystem,
      dcOptions,
      isPF2e: currentSystem === 'pf2e',
      isDND5e: currentSystem === 'dnd5e',
    };
  }

  async _onRender(context, options) {
    super._onRender(context, options);
    this._attachDragDropHandlers();
    this._disableWindowDrag();
    this._attachDCHandlers();
    this._attachImageContextMenu();
    this._attachSkillActionContextMenu();

    // Position as drawer on first render
    if (!this._stateRestored) {
      // Get fresh reference to parent
      this.parentInterface = game.storyframe?.gmApp || null;

      // Use setTimeout to ensure parent element is fully in DOM and positioned
      setTimeout(() => {
        // Position adjacent to parent (with retry logic)
        this._positionAsDrawer(5); // Allow up to 5 retries

        // Start tracking parent movements after positioning
        setTimeout(() => {
          this._startTrackingParent();
        }, 100);
      }, 100); // Increased delay to give parent more time

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
    // DC input field
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

    // PF2e: Difficulty selector
    const difficultySelect = this.element.querySelector('#difficulty-select');
    if (difficultySelect) {
      difficultySelect.addEventListener('change', async (e) => {
        const difficulty = e.target.value;
        this.currentDifficulty = difficulty;

        // Recalculate DC based on party level and new difficulty
        const partyLevel = await this._getPartyLevel();
        if (partyLevel !== null) {
          this.currentDC = this._calculateDCByLevel(partyLevel, difficulty);
          // Update the DC input field
          const dcInput = this.element.querySelector('#dc-input');
          if (dcInput) {
            dcInput.value = this.currentDC;
          }
        }
      });
    }

    // D&D 5e: DC difficulty selector
    const dnd5eDCSelect = this.element.querySelector('#dc-select-dnd5e');
    if (dnd5eDCSelect) {
      dnd5eDCSelect.addEventListener('change', (e) => {
        const dc = parseInt(e.target.value);
        if (!isNaN(dc)) {
          this.currentDC = dc;
          // Update the DC input field
          const dcInput = this.element.querySelector('#dc-input');
          if (dcInput) {
            dcInput.value = this.currentDC;
          }
        }
      });
    }
  }

  /**
   * Attach right-click context menu for NPC image enlargement
   */
  _attachImageContextMenu() {
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
                  callback: (event, button, dialog) => button.form.elements.label.value,
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
  }

  async _onClose(options) {
    // Stop tracking parent movements
    this._stopTrackingParent();

    return super._onClose(options);
  }

  // --- Helper Methods ---

  _getPlayerCharacters() {
    return game.actors.filter((actor) => {
      if (actor.type !== 'character') return false;
      return game.users.some((user) => !user.isGM && actor.testUserPermission(user, 'OWNER'));
    });
  }

  _getSkillName(slug) {
    const skills = SystemAdapter.getSkills();
    const skill = skills[slug];
    return skill?.name || slug.toUpperCase();
  }

  _getSkillShortName(slug) {
    const shortNames = {
      per: 'Per',
      acr: 'Acr',
      arc: 'Arc',
      ath: 'Ath',
      cra: 'Cra',
      dec: 'Dec',
      dip: 'Dip',
      itm: 'Itm',
      med: 'Med',
      nat: 'Nat',
      occ: 'Occ',
      prf: 'Prf',
      rel: 'Rel',
      soc: 'Soc',
      ste: 'Ste',
      sur: 'Sur',
      thi: 'Thi',
    };
    return shortNames[slug] || slug.substring(0, 3);
  }

  async _resolveParticipantName(participant) {
    const actor = await fromUuid(participant.actorUuid);
    return actor?.name || 'Unknown';
  }

  /**
   * Get the party level (average or highest of selected participants)
   * @returns {Promise<number|null>} The party level or null if no participants
   */
  async _getPartyLevel() {
    const state = game.storyframe.stateManager.getState();
    if (!state?.participants?.length) return null;

    // Get levels from all participants
    const levels = await Promise.all(
      state.participants.map(async (p) => {
        const actor = await fromUuid(p.actorUuid);
        // PF2e stores level in system.details.level.value
        return actor?.system?.details?.level?.value ?? actor?.system?.level ?? null;
      }),
    );

    const validLevels = levels.filter((l) => l !== null);
    if (validLevels.length === 0) return null;

    // Use the average level (rounded)
    return Math.round(validLevels.reduce((a, b) => a + b, 0) / validLevels.length);
  }

  /**
   * Calculate DC from level and difficulty
   * @param {number} level - The party level
   * @param {string} difficultyId - The difficulty ID
   * @returns {number} The calculated DC
   */
  /**
   * Calculate DC by level (PF2e only)
   * @param {number} level - The party level
   * @param {string} difficultyId - The difficulty adjustment ID
   * @returns {number} The calculated DC
   */
  _calculateDCByLevel(level, difficultyId) {
    const dcOptions = SystemAdapter.getDCOptions();
    const difficultyAdjustments = SystemAdapter.getDifficultyAdjustments();

    // Find the base DC for the level
    const levelOption = dcOptions.find((opt) => opt.value === level);
    const baseDC = levelOption?.dc || 14;

    // Apply difficulty adjustment
    const difficulty = difficultyAdjustments?.find((d) => d.id === difficultyId);
    const adjustment = difficulty?.adjustment || 0;

    return baseDC + adjustment;
  }

  async _requestSkillCheck(skillSlug, participantIds, actionSlug = null) {
    const state = game.storyframe.stateManager.getState();
    if (!state) return;

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

  static async _onAddSpeakerFromImage(event, target) {
    new FilePicker({
      type: 'image',
      callback: async (path) => {
        const label = await foundry.applications.api.DialogV2.prompt({
          window: { title: 'NPC Name' },
          content: '<input type="text" name="label" placeholder="Enter NPC name" autofocus>',
          ok: {
            label: 'Add',
            callback: (event, button, dialog) => button.form.elements.label.value,
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

  static async _onSetSpeaker(event, target) {
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

  static async _onClearSpeaker(event, target) {
    await game.storyframe.socketManager.requestSetActiveSpeaker(null);
  }

  static async _onClearAllSpeakers(event, target) {
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

  static async _onClearAllParticipants(event, target) {
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

  static async _onTogglePCsPanel(event, target) {
    this.pcsPanelCollapsed = !this.pcsPanelCollapsed;
    this.render();
  }

  static async _onAddAllPCs(event, target) {
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

  static async _onToggleParticipantSelection(event, target) {
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

  static async _onToggleSelectAll(event, target) {
    const state = game.storyframe.stateManager.getState();
    const allParticipantIds = (state.participants || []).map((p) => p.id);

    if (this.selectedParticipants.size === allParticipantIds.length) {
      this.selectedParticipants.clear();
    } else {
      this.selectedParticipants = new Set(allParticipantIds);
    }

    this.render();
  }

  static async _onRequestSkill(event, target) {
    const skillSlug = target.dataset.skill;
    if (!skillSlug) return;

    if (this.selectedParticipants.size === 0) {
      ui.notifications.warn('No PCs selected');
      return;
    }

    await this._requestSkillCheck(skillSlug, Array.from(this.selectedParticipants));
  }

  static async _onOpenSkillMenu(event, target) {
    const allSkills = [
      { slug: 'per', name: 'Perception' },
      { slug: 'acr', name: 'Acrobatics' },
      { slug: 'arc', name: 'Arcana' },
      { slug: 'ath', name: 'Athletics' },
      { slug: 'cra', name: 'Crafting' },
      { slug: 'dec', name: 'Deception' },
      { slug: 'dip', name: 'Diplomacy' },
      { slug: 'itm', name: 'Intimidation' },
      { slug: 'med', name: 'Medicine' },
      { slug: 'nat', name: 'Nature' },
      { slug: 'occ', name: 'Occultism' },
      { slug: 'prf', name: 'Performance' },
      { slug: 'rel', name: 'Religion' },
      { slug: 'soc', name: 'Society' },
      { slug: 'ste', name: 'Stealth' },
      { slug: 'sur', name: 'Survival' },
      { slug: 'thi', name: 'Thievery' },
    ];

    const appInstance = this;

    // Remove any existing skill menu
    document.querySelector('.storyframe-skill-menu')?.remove();

    // Create popup menu
    const menu = document.createElement('div');
    menu.className = 'storyframe-skill-menu';
    menu.innerHTML = allSkills
      .map(
        (s) =>
          `<button type="button" class="skill-option" data-skill="${s.slug}">${s.name}</button>`,
      )
      .join('');

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

    // Add click handlers
    menu.querySelectorAll('.skill-option').forEach((btn) => {
      btn.style.cssText = `
        padding: 8px 14px;
        background: transparent;
        border: none;
        color: #e0e0e0;
        cursor: pointer;
        text-align: left;
        border-radius: 6px;
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
        const skillSlug = btn.dataset.skill;
        menu.remove();

        if (appInstance.selectedParticipants.size === 0) {
          ui.notifications.warn('No PCs selected');
          return;
        }
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

  static async _onOpenSkillConfig(event, target) {
    const allSkills = [
      { slug: 'per', name: 'Perception' },
      { slug: 'acr', name: 'Acrobatics' },
      { slug: 'arc', name: 'Arcana' },
      { slug: 'ath', name: 'Athletics' },
      { slug: 'cra', name: 'Crafting' },
      { slug: 'dec', name: 'Deception' },
      { slug: 'dip', name: 'Diplomacy' },
      { slug: 'itm', name: 'Intimidation' },
      { slug: 'med', name: 'Medicine' },
      { slug: 'nat', name: 'Nature' },
      { slug: 'occ', name: 'Occultism' },
      { slug: 'prf', name: 'Performance' },
      { slug: 'rel', name: 'Religion' },
      { slug: 'soc', name: 'Society' },
      { slug: 'ste', name: 'Stealth' },
      { slug: 'sur', name: 'Survival' },
      { slug: 'thi', name: 'Thievery' },
    ];

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

  static async _onSetDCSelect(event, target) {
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

  static async _onSetDifficulty(event, target) {
    const difficulty = target.value;
    this.currentDifficulty = difficulty;

    // Recalculate DC based on party level and new difficulty
    const partyLevel = await this._getPartyLevel();
    if (partyLevel !== null) {
      this.currentDC = this._calculateDCByLevel(partyLevel, difficulty);
    }

    this.render();
  }

  static async _onCancelRoll(event, target) {
    const requestId = target.closest('[data-request-id]')?.dataset.requestId;
    if (!requestId) return;

    await game.storyframe.socketManager.requestRemovePendingRoll(requestId);
    ui.notifications.info('Roll request cancelled');
  }

  static async _onOpenPlayerWindows(event, target) {
    game.storyframe.socketManager.openAllPlayerViewers();
    ui.notifications.info('Opening StoryFrame on all player clients');
  }

  static async _onShowPendingRolls(event, target) {
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
}
