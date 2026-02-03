# Phase 8: Skill UI & Batch Roll Requests - Research

**Researched:** 2026-02-03
**Domain:** Foundry VTT ApplicationV2, CSS Grid layouts, PF2e proficiency system, multi-select UI patterns
**Confidence:** HIGH

## Summary

This phase enhances the GM sidebar skill interface with responsive CSS Grid layout, shift-click multi-selection, per-skill proficiency filtering, and batch roll request capabilities. The existing codebase already has the foundational patterns in place: ApplicationV2 with HandlebarsApplicationMixin, state management for challenges and pending rolls, and PF2e-specific skill data extraction.

The research focused on four key areas: (1) CSS Grid auto-fill for responsive skill button layouts targeting ~4 per row, (2) Foundry VTT ApplicationV2 best practices for event handling and rendering, (3) PF2e proficiency rank structure (0-4 numeric values) for filtering skills, and (4) HTML multi-select shift-click patterns for intuitive skill selection.

The standard approach is to use CSS `grid-template-columns: repeat(auto-fill, minmax(min-width, 1fr))` for responsive layouts, handle multi-select with shift-click event listeners tracking last selected item for range selection, store per-skill proficiency filters in component state (not global), and leverage the existing `_getLoreSkills()` and `_getAvailableSkills()` patterns from Phase 6 for aggregating skills across selected participants.

**Primary recommendation:** Use CSS Grid auto-fill with minmax for responsive layout, implement shift-click multi-select with Set-based state tracking, add per-skill proficiency metadata to selection state, and extend existing challenge validation to enforce unique challenge names.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Foundry VTT ApplicationV2 | v13 | Application framework | Official Foundry API, future-proof architecture |
| HandlebarsApplicationMixin | v13 | Template rendering | Foundry's official Handlebars integration for ApplicationV2 |
| CSS Grid | Modern browsers | Responsive layout | Native browser feature, no dependencies |
| PF2e System API | Latest | Skill data access | Official PF2e system for Foundry VTT |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| SystemAdapter | Module internal | System-agnostic skill definitions | Already exists in codebase, use for skill metadata |
| StateManager | Module internal | Challenge and roll state | Already exists, extend for batch operations |
| SocketManager | Module internal | GM↔Player communication | Already exists for roll requests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS Grid auto-fill | Flexbox with wrapping | Grid provides better control over uniform sizing and gaps |
| Shift-click selection | Ctrl-click only | Shift-click enables range selection, standard desktop pattern |
| Set-based state | Array with includes() | Set provides O(1) lookup and automatic deduplication |

**Installation:**
No external dependencies required. All features use native browser APIs and existing Foundry VTT framework.

## Architecture Patterns

### Recommended Project Structure
```
scripts/applications/
├── gm-sidebar.mjs              # Base class, extend for multi-select state
├── gm-sidebar-pf2e.mjs         # PF2e-specific skill/proficiency logic
└── challenge-builder.mjs        # Already handles challenge creation

templates/
├── gm-sidebar.hbs              # Update with grid layout and selection UI
└── partials/
    └── skill-button.hbs        # Optional: reusable skill button with filter badge

styles/
└── gm-sidebar.css              # Add grid layout, selection states, filter UI
```

### Pattern 1: CSS Grid Auto-Fill for Responsive Skill Layout
**What:** Use CSS Grid with `repeat(auto-fill, minmax())` to create responsive skill button grid that adapts to sidebar width
**When to use:** For skill categories (Physical, Magical, Social, Utility) and lore skills section
**Example:**
```css
/* Source: Verified from CSS-Tricks and MDN documentation */
.skill-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

/* Hide empty categories completely */
.skill-category:empty,
.skill-category:not(:has(.skill-btn)) {
  display: none;
}
```

**Key difference: auto-fill vs auto-fit**
- `auto-fill`: Maintains empty columns, consistent spacing even with few items
- `auto-fit`: Collapses empty columns, items expand to fill available space
- **Use auto-fill** for skill buttons to maintain uniform size and prevent stretching

### Pattern 2: Shift-Click Multi-Select with Range Selection
**What:** Track selection state with Set, implement shift-click for range selection between last and current
**When to use:** For skill button selection when participants are already chosen
**Example:**
```javascript
// Source: Common desktop application pattern, verified in TanStack discussions
constructor() {
  super();
  this.selectedSkills = new Set(); // Efficient O(1) lookup
  this.lastSelectedSkill = null;   // Track for shift-click range
  this.skillProficiencyFilters = new Map(); // skill slug -> proficiency level
}

async _onSkillClick(event, target) {
  const skillSlug = target.dataset.skill;

  // Block if no participants selected
  if (this.selectedParticipants.size === 0) {
    ui.notifications.warn('Select participants first');
    return;
  }

  if (event.shiftKey && this.lastSelectedSkill) {
    // Range selection: select all skills between last and current
    this._selectRange(this.lastSelectedSkill, skillSlug);
  } else if (event.shiftKey) {
    // Shift-click toggles individual selection
    this._toggleSkillSelection(skillSlug);
  } else {
    // Regular click: clear and select one
    this.selectedSkills.clear();
    this.selectedSkills.add(skillSlug);
  }

  this.lastSelectedSkill = skillSlug;
  this.render();
}

_selectRange(fromSlug, toSlug) {
  // Get all skill buttons in DOM order
  const skillButtons = Array.from(this.element.querySelectorAll('[data-skill]'));
  const fromIndex = skillButtons.findIndex(btn => btn.dataset.skill === fromSlug);
  const toIndex = skillButtons.findIndex(btn => btn.dataset.skill === toSlug);

  const [start, end] = fromIndex < toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex];

  for (let i = start; i <= end; i++) {
    this.selectedSkills.add(skillButtons[i].dataset.skill);
  }
}
```

### Pattern 3: Per-Skill Proficiency Filtering with Visual Badges
**What:** Store proficiency filter per skill slug, show filter UI on shift-click, display badge on button when filtered
**When to use:** When GM wants to restrict a skill check to Trained+, Expert+, etc. for specific skills
**Example:**
```javascript
// Source: Based on PF2e proficiency rank structure (0-4 numeric values)
async _onSkillShiftClick(event, target) {
  const skillSlug = target.dataset.skill;

  // Show proficiency filter overlay
  const overlay = this._createProficiencyOverlay(skillSlug);
  overlay.style.cssText = `
    position: absolute;
    top: ${target.offsetTop}px;
    left: ${target.offsetLeft}px;
    z-index: 100;
  `;

  overlay.innerHTML = `
    <select class="proficiency-filter">
      <option value="0">Any</option>
      <option value="1">Trained+</option>
      <option value="2">Expert+</option>
      <option value="3">Master+</option>
      <option value="4">Legendary+</option>
    </select>
  `;

  overlay.querySelector('select').addEventListener('change', (e) => {
    const level = parseInt(e.target.value);
    if (level === 0) {
      this.skillProficiencyFilters.delete(skillSlug);
    } else {
      this.skillProficiencyFilters.set(skillSlug, level);
    }
    this.render();
  });
}

// In template context preparation
_prepareContext() {
  // ... existing code

  const skillButtons = quickButtonSkills.map(skill => ({
    ...skill,
    proficiencyFilter: this.skillProficiencyFilters.get(skill.slug) || null,
    proficiencyBadge: this._getProficiencyBadge(this.skillProficiencyFilters.get(skill.slug))
  }));

  return { ...context, skillButtons };
}
```

**Template pattern:**
```handlebars
<button type="button" class="skill-btn {{#if selected}}selected{{/if}}"
        data-skill="{{slug}}"
        data-action="skillClick">
  {{shortName}}
  {{#if proficiencyBadge}}
    <span class="proficiency-badge">{{proficiencyBadge}}</span>
  {{/if}}
</button>
```

### Pattern 4: Batch Roll Request Creation
**What:** Aggregate selected skills and participants, create individual roll requests for each participant-skill combination where participant has the skill
**When to use:** When GM selects multiple skills and clicks "Request Roll(s)" for a quick batch request (not a persistent challenge)
**Example:**
```javascript
// Source: Extends existing _requestSkillCheck pattern from Phase 6
async _onBatchRollRequest() {
  if (this.selectedSkills.size === 0) {
    ui.notifications.warn('No skills selected');
    return;
  }

  if (this.selectedParticipants.size === 0) {
    ui.notifications.warn('No participants selected');
    return;
  }

  const state = game.storyframe.stateManager.getState();
  const dc = this.currentDC;
  const isSecret = this.element.querySelector('#secret-roll-checkbox')?.checked || false;

  // Aggregate skills from all selected participants
  const participantSkills = await this._getParticipantSkills(
    state,
    this.selectedParticipants
  );

  // Create roll requests for each participant-skill combination
  const requests = [];
  for (const skillSlug of this.selectedSkills) {
    const proficiencyFilter = this.skillProficiencyFilters.get(skillSlug) || 0;

    for (const participantId of this.selectedParticipants) {
      const participant = state.participants.find(p => p.id === participantId);
      if (!participant) continue;

      // Check if participant has this skill
      if (!participantSkills.get(participantId)?.has(skillSlug)) continue;

      // Check proficiency requirement if set
      if (proficiencyFilter > 0) {
        const skillRank = await this._getSkillRank(participant.actorUuid, skillSlug);
        if (skillRank < proficiencyFilter) continue;
      }

      requests.push({
        id: foundry.utils.randomID(),
        participantId,
        skillSlug,
        actionSlug: null,
        dc,
        isSecret,
        timestamp: Date.now()
      });
    }
  }

  if (requests.length === 0) {
    ui.notifications.warn('No participants have the selected skills');
    return;
  }

  // Add all requests atomically
  await game.storyframe.stateManager.addPendingRolls(requests);

  // Send socket notifications to players
  for (const request of requests) {
    game.storyframe.socketManager.sendRollRequest(request);
  }

  // Clear selection
  this.selectedSkills.clear();
  this.skillProficiencyFilters.clear();
  this.lastSelectedSkill = null;

  ui.notifications.info(`Sent ${requests.length} roll requests`);
}

// Helper: Get skills each participant has
async _getParticipantSkills(state, selectedParticipants) {
  const participantSkills = new Map();

  for (const participantId of selectedParticipants) {
    const participant = state.participants.find(p => p.id === participantId);
    if (!participant) continue;

    const skills = await this.constructor._getAvailableSkills(state, new Set([participantId]));
    participantSkills.set(participantId, skills);
  }

  return participantSkills;
}

// Helper: Get skill proficiency rank for an actor
async _getSkillRank(actorUuid, skillSlug) {
  const actor = await fromUuid(actorUuid);
  if (!actor?.system?.skills) return 0;

  const skill = actor.system.skills[skillSlug];
  return skill?.rank ?? 0; // 0=untrained, 1=trained, 2=expert, 3=master, 4=legendary
}
```

### Pattern 5: Challenge Uniqueness Validation
**What:** Check if a challenge with the same name already exists before creating, block with error message
**When to use:** When GM attempts to create a challenge from the Challenge Builder dialog
**Example:**
```javascript
// Source: Existing challenge structure in state-manager.mjs
async _onSubmitChallenge(formData) {
  const challengeName = formData.get('challengeName').trim();

  // Validate uniqueness
  const state = game.storyframe.stateManager.getState();
  if (state.activeChallenge && state.activeChallenge.name === challengeName) {
    ui.notifications.error(`Challenge "${challengeName}" already exists`);
    return;
  }

  // Create challenge...
  const challengeData = {
    id: foundry.utils.randomID(),
    name: challengeName,
    image: formData.get('challengeImage'),
    selectedParticipants: Array.from(this.selectedParticipants),
    options: this._buildOptionsFromForm(formData)
  };

  await game.storyframe.stateManager.setActiveChallenge(challengeData);
  this.close();
}
```

### Pattern 6: Category Visibility with CSS :has() Selector
**What:** Hide empty skill categories using modern CSS :has() selector, no JavaScript required
**When to use:** When skill categories should disappear if they contain no visible skills
**Example:**
```css
/* Source: Modern CSS selector, supported in all major browsers 2024+ */
.skill-category:not(:has(.skill-btn)) {
  display: none;
  margin: 0;
  padding: 0;
}

/* Alternative: Hide category header if no buttons */
.skill-category-header:has(+ .skill-grid:empty) {
  display: none;
}
```

### Anti-Patterns to Avoid
- **Global proficiency filter:** Don't apply a single proficiency filter to all skills. Each skill needs independent filtering (e.g., Thievery requires Expert+, but Athletics only needs Trained+).
- **Array for selection state:** Don't use Array with `includes()` for selected skills. Use Set for O(1) lookup and automatic deduplication.
- **Duplicate challenge names:** Don't allow multiple challenges with the same name. Players will be confused about which challenge they're responding to.
- **Rendering on every selection change:** Don't call `render()` on every skill click. Batch state updates and render once after shift-click range selection completes.
- **Ignoring participant skills:** Don't send roll requests to participants who don't have the selected skill. Filter before creating requests.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Skill proficiency data | Custom skill rank tracking | PF2e `actor.system.skills[slug].rank` | System provides authoritative rank values (0-4), handles edge cases like skill variants and lore skills |
| Range selection logic | Manual index tracking | DOM order traversal with `findIndex()` | Handles dynamically changing skill lists, respects visual order |
| Challenge state persistence | Custom save/load | Existing StateManager `setActiveChallenge()` | Already handles scene flags, migration, and broadcasting |
| Lore skill aggregation | Manual skill extraction | `GMSidebarAppPF2e._getLoreSkills()` | Already implemented in Phase 6, handles participant filtering |
| Socket communication | Direct socket.emit | SocketManager `sendRollRequest()` | Already handles reconnection, validation, and error handling |
| Skill metadata | Hardcoded skill data | SystemAdapter.getSkills() | Provides system-agnostic skill definitions with actions and abbreviations |

**Key insight:** The codebase already has robust patterns for skill data extraction, state management, and socket communication from Phase 6. Phase 8 extends these patterns rather than replacing them. Don't rebuild what already works—extend the `_getLoreSkills()` and `_getAvailableSkills()` patterns for proficiency filtering, and use the existing challenge state structure.

## Common Pitfalls

### Pitfall 1: CSS Grid Overflow and Button Sizing
**What goes wrong:** Skill buttons either overflow the sidebar or shrink too small to be clickable when using CSS Grid with fixed column counts.
**Why it happens:** Using `grid-template-columns: repeat(4, 1fr)` creates exactly 4 columns regardless of available width. On narrow sidebars, buttons become too small (< 60px) and hard to click.
**How to avoid:** Use `repeat(auto-fill, minmax(70px, 1fr))` to allow the grid to calculate optimal column count based on available width. Set `minmax()` first value to the minimum button width (70px for 3-letter abbreviations).
**Warning signs:** Buttons have `width < 60px` or horizontal scrollbar appears in skill section. Users report "can't click skills" on narrow monitors.

### Pitfall 2: Shift-Click State Loss on Re-render
**What goes wrong:** Shift-click range selection loses the "last selected" reference after the component re-renders, breaking range selection.
**Why it happens:** ApplicationV2 re-renders on state changes. If `this.lastSelectedSkill` isn't persisted as component state, it resets to null on each render.
**How to avoid:** Store `lastSelectedSkill` in the constructor and preserve it across renders. Don't clear it unless the user explicitly deselects all or closes the panel.
**Warning signs:** Range selection works once, then stops working after any state update (DC change, participant toggle, etc.).

### Pitfall 3: Proficiency Filter Applying to Wrong Participants
**What goes wrong:** A proficiency filter set for one participant's lore skill incorrectly filters other participants who don't have that lore skill.
**Why it happens:** Lore skills have dynamic slugs (e.g., "engineering-lore") that may differ across participants. Filtering by slug assumes all participants use the same slug format.
**How to avoid:** When creating batch roll requests, validate each participant has the specific skill slug before checking proficiency. Use `_getAvailableSkills()` per participant, not aggregated skills.
**Warning signs:** Some participants don't receive roll requests they should have received. GM reports "Expected 4 requests, only got 2."

### Pitfall 4: Empty Category Headers Occupying Space
**What goes wrong:** Skill category headers (Physical, Magical, Social, Utility) remain visible even when all skills in that category are hidden, creating visual clutter.
**Why it happens:** Template shows headers unconditionally, relying on JavaScript to hide them. If JavaScript fails or runs before DOM is ready, headers remain visible.
**How to avoid:** Use CSS `:has()` selector to hide headers when the following skill grid is empty. No JavaScript required: `.skill-category-header:has(+ .skill-grid:empty) { display: none; }`
**Warning signs:** Vertical gaps in skill UI where categories should be. Users report "lots of empty space in skills section."

### Pitfall 5: Challenge Name Collision Silent Failure
**What goes wrong:** Creating a challenge with a duplicate name silently overwrites the existing challenge, losing player progress.
**Why it happens:** `StateManager.setActiveChallenge()` doesn't validate uniqueness, just sets `state.activeChallenge` to the new value.
**How to avoid:** Add validation before calling `setActiveChallenge()`. Check if `state.activeChallenge.name === newChallengeName` and show error: `ui.notifications.error('Challenge "X" already exists')`.
**Warning signs:** Players report "my challenge disappeared" or "I was responding to a different challenge." Challenge responses get lost.

### Pitfall 6: Lore Skills Not Updating on Participant Selection Change
**What goes wrong:** Lore skills displayed for multi-PC selection don't update when participants are added/removed, showing stale or incorrect lore skills.
**Why it happens:** Template caches lore skills from initial render. `_prepareContext()` doesn't re-query lore skills when `selectedParticipants` changes.
**How to avoid:** Always call `_getLoreSkills(state, this.selectedParticipants)` in `_prepareContext()`, not just on initial load. Lore skills must be dynamic based on current selection.
**Warning signs:** Lore skills show for participants no longer selected. Selecting a new participant doesn't add their lore skills to the list.

### Pitfall 7: Batch Request Sending Before State Update
**What goes wrong:** Socket messages sent to players before `StateManager.addPendingRolls()` completes, causing "roll request not found" errors on player side.
**Why it happens:** Socket sends are not awaited, running concurrently with state update. If socket arrives before state propagates, player UI can't find the request.
**How to avoid:** `await game.storyframe.stateManager.addPendingRolls(requests)` before sending any socket messages. State must be persisted and broadcast before notifying players.
**Warning signs:** Players receive notification "New roll request" but don't see it in their UI. Console errors: "Roll request [id] not found in state."

## Code Examples

Verified patterns from existing codebase and official sources:

### ApplicationV2 Event Handler Pattern (Existing Pattern)
```javascript
// Source: scripts/applications/gm-sidebar.mjs (lines 44-46, 1746-1756)
static DEFAULT_OPTIONS = {
  actions: {
    requestSkill: GMSidebarAppBase._onRequestSkill,
    toggleParticipantSelection: GMSidebarAppBase._onToggleParticipantSelection,
  }
};

static async _onRequestSkill(_event, target) {
  const skillSlug = target.dataset.skill;
  if (!skillSlug) return;

  if (this.selectedParticipants.size === 0) {
    ui.notifications.warn('No PCs selected');
    return;
  }

  await this._requestSkillCheck(skillSlug, Array.from(this.selectedParticipants));
}
```

### PF2e Lore Skill Extraction (Existing Pattern)
```javascript
// Source: scripts/applications/gm-sidebar-pf2e.mjs (lines 40-68)
static async _getLoreSkills(state, selectedParticipants) {
  // Only show lore skills when exactly 1 PC is selected
  if (selectedParticipants?.size !== 1) return [];
  if (!state?.participants?.length) return [];

  const selectedId = Array.from(selectedParticipants)[0];
  const participant = state.participants.find((p) => p.id === selectedId);
  if (!participant) return [];

  const actor = await fromUuid(participant.actorUuid);
  if (!actor?.system?.skills) return [];

  const lores = new Set();

  // PF2e stores lore skills with keys containing "-lore"
  for (const [key, skill] of Object.entries(actor.system.skills)) {
    if (key.includes('-lore') && skill.label) {
      lores.add(skill.label);
    }
  }

  return Array.from(lores)
    .sort()
    .map((loreName) => ({
      slug: loreName.toLowerCase().replace(/\s+/g, '-'),
      name: loreName,
      isLore: true,
    }));
}
```

### PF2e Skill Rank Access (Verified Pattern)
```javascript
// Source: PF2e system GitHub, verified in actor.system.skills structure
async function getSkillProficiencyRank(actorUuid, skillSlug) {
  const actor = await fromUuid(actorUuid);
  if (!actor?.system?.skills) return 0; // Untrained

  const skill = actor.system.skills[skillSlug];
  if (!skill) return 0;

  // PF2e rank values: 0=Untrained, 1=Trained, 2=Expert, 3=Master, 4=Legendary
  return skill.rank ?? 0;
}

// Usage for filtering
const meetsRequirement = (await getSkillProficiencyRank(actorUuid, 'thi')) >= 2; // Expert+
```

### CSS Grid Responsive Layout (MDN Pattern)
```css
/* Source: CSS-Tricks Auto-Sizing Columns article */
.skill-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.skill-btn {
  min-width: 70px; /* Ensure buttons stay clickable */
  padding: 8px 4px;
  font-size: 0.9em;
  text-align: center;
  cursor: pointer;
  background: var(--button-bg);
  border: 2px solid transparent;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.skill-btn.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.skill-btn:hover:not(.selected) {
  border-color: var(--color-border-hover);
}
```

### Handlebars Template for Skill Grid with Categories
```handlebars
{{! Source: Adapted from templates/gm-sidebar.hbs skill section }}
<div class="skills-section">
  {{#if journalCheckGroups.length}}
  <div class="skill-category journal-checks">
    <h4 class="skill-category-header">Journal Checks</h4>
    <div class="skill-grid">
      {{#each journalCheckGroups}}
        <button type="button" class="skill-btn journal-check {{#if selected}}selected{{/if}}"
                data-skill="{{skillName}}"
                data-action="skillClick"
                data-tooltip="{{skillName}} ({{checks.length}} DCs in journal)">
          {{skillName}}
        </button>
      {{/each}}
    </div>
  </div>
  {{/if}}

  {{#if loreSkills.length}}
  <div class="skill-category lore-skills">
    <h4 class="skill-category-header">
      <i class="fas fa-book"></i> Lore Skills
    </h4>
    <div class="skill-grid">
      {{#each loreSkills}}
        <button type="button" class="skill-btn lore {{#if selected}}selected{{/if}}"
                data-skill="{{slug}}"
                data-action="skillClick">
          {{name}}
          {{#if proficiencyBadge}}
            <span class="proficiency-badge">{{proficiencyBadge}}</span>
          {{/if}}
        </button>
      {{/each}}
    </div>
  </div>
  {{/if}}

  <div class="skill-category quick-skills">
    <h4 class="skill-category-header">Quick Skills</h4>
    <div class="skill-grid">
      {{#each quickButtonSkills}}
        <button type="button" class="skill-btn {{#if selected}}selected{{/if}}"
                data-skill="{{slug}}"
                data-action="skillClick"
                data-tooltip="{{name}}">
          {{shortName}}
          {{#if proficiencyBadge}}
            <span class="proficiency-badge">{{proficiencyBadge}}</span>
          {{/if}}
        </button>
      {{/each}}
    </div>
  </div>
</div>

{{! Batch request controls }}
{{#if (gt selectedSkills.length 0)}}
<div class="batch-request-bar">
  <span class="selected-count">{{selectedSkills.length}} skill(s) selected</span>
  <button type="button" data-action="batchRollRequest" class="batch-request-btn">
    Request Roll(s)
  </button>
  <button type="button" data-action="createChallengeFromSelection" class="challenge-btn">
    Create Challenge
  </button>
  <button type="button" data-action="clearSkillSelection" class="clear-btn">
    Clear
  </button>
</div>
{{/if}}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Application (v1) | ApplicationV2 with HandlebarsApplicationMixin | Foundry v13 (2024) | Requires `_prepareContext()` instead of `getData()`, actions in DEFAULT_OPTIONS, cleaner event handling |
| Fixed grid columns | CSS Grid auto-fill/auto-fit | CSS Grid Level 2 (2020+) | Responsive without media queries, automatically adapts to container width |
| Ctrl-click only | Shift-click range selection | Desktop UX standard | Faster multi-selection, familiar pattern from file managers and tables |
| Global proficiency filter | Per-skill proficiency filtering | Phase 8 requirement | More flexible, allows mixed proficiency requirements in same batch request |
| CSS :empty pseudo-class | CSS :has() relational selector | CSS Selectors Level 4 (2024) | Hide parent based on child state, no JavaScript required for category visibility |

**Deprecated/outdated:**
- **Application (v1):** Foundry VTT v13 deprecates Application in favor of ApplicationV2. Use ApplicationV2 with HandlebarsApplicationMixin for all new applications.
- **activateListeners():** Replaced by `actions` in DEFAULT_OPTIONS for click handlers and `_onRender()` for non-click event listeners.
- **getData():** Replaced by `_prepareContext()` in ApplicationV2. Must be async and should call `super._prepareContext()`.
- **jQuery selectors in Foundry core:** ApplicationV2 uses native HTMLElement, not jQuery. Use `this.element.querySelector()` instead of `this.element.find()`.

## Open Questions

1. **Should lore skills aggregate across multiple selected PCs or only show for single PC?**
   - What we know: Current implementation (`gm-sidebar-pf2e.mjs` line 42) only shows lore skills when exactly 1 PC is selected
   - What's unclear: Phase 8 context says "aggregate lore skills from selected PCs dynamically" but existing code restricts to single PC
   - Recommendation: Update `_getLoreSkills()` to aggregate across all selected PCs. Return union of all lore skills from selected participants, not just when `size === 1`. This matches the "Multi-PC selection aggregates all skills" success criterion.

2. **How should proficiency filter UI be triggered—shift-click or separate icon?**
   - What we know: Context says "Overlay appears when shift+clicking skill" and "Dropdown menu: Any, Trained+, Expert+..."
   - What's unclear: If shift-click is also used for multi-select, how to distinguish between "add to selection" vs "show proficiency filter"?
   - Recommendation: Use shift-click for multi-select (standard pattern), add small filter icon button on each skill button that shows proficiency dropdown on click. This avoids gesture conflict and provides clear visual affordance for filtering.

3. **Should challenge headers show response count when collapsed?**
   - What we know: Context says collapsed header shows "name + status summary (e.g., '3/5 players responded')"
   - What's unclear: Current `activeChallenge` state structure doesn't track individual responses, only holds challenge definition
   - Recommendation: This may require state schema extension beyond Phase 8 scope. For now, collapsed header can show "Challenge active" status. Full response tracking is likely a Phase 9+ feature.

4. **What happens to selected skills when participants change?**
   - What we know: Skills should filter to only those possessed by selected participants
   - What's unclear: Should changing participants clear skill selection, or preserve it and re-validate?
   - Recommendation: Clear skill selection when participants change. This prevents invalid state where selected skills aren't possessed by any participant. Show notification: "Skill selection cleared due to participant change."

## Sources

### Primary (HIGH confidence)
- [Foundry VTT ApplicationV2 API Documentation](https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html) - ApplicationV2 architecture
- [Foundry VTT ApplicationV2 Conversion Guide](https://foundryvtt.wiki/en/development/guides/applicationV2-conversion-guide) - Migration patterns from Application v1
- [Foundry VTT HandlebarsApplicationMixin API](https://foundryvtt.com/api/functions/foundry.applications.api.HandlebarsApplicationMixin.html) - Template rendering API
- [CSS-Tricks: Auto-Sizing Columns in CSS Grid](https://css-tricks.com/auto-sizing-columns-css-grid-auto-fill-vs-auto-fit/) - Grid auto-fill vs auto-fit
- [MDN: CSS Grid Layout](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout) - Grid specification
- [Archives of Nethys: Proficiency Rules](https://2e.aonprd.com/Rules.aspx?ID=3305) - PF2e proficiency rank system
- Codebase analysis: `scripts/applications/gm-sidebar.mjs`, `scripts/applications/gm-sidebar-pf2e.mjs`, `scripts/state-manager.mjs` - Existing patterns

### Secondary (MEDIUM confidence)
- [GeeksforGeeks: Auto-Fit vs Auto-Fill in CSS Grid](https://www.geeksforgeeks.org/css/auto-fit-vs-auto-fill-property-in-css-grid/) - Use case guidance
- [Grid by Example: auto-fill vs auto-fit](https://gridbyexample.com/examples/example37/) - Visual comparison
- [GitHub: PF2e System Custom Proficiency Ranks PR](https://github.com/foundryvtt/pf2e/pull/13711/files) - TypeScript definitions for proficiency ranks
- [TanStack Table: Multi-Row Selection Discussion](https://github.com/TanStack/table/discussions/3068) - Shift-click range selection patterns

### Tertiary (LOW confidence)
- [RPGBOT: PF2e Skills Fundamentals](https://rpgbot.net/p2/how-to-play/skills-fundamentals/) - Player-facing proficiency guide
- Web search results for "HTML multi-select shift-click pattern" - General UX patterns, not Foundry-specific

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All technologies are already in use in the codebase or native browser features
- Architecture: HIGH - Patterns verified from existing codebase (Phase 6) and official Foundry documentation
- Pitfalls: HIGH - Identified from code analysis and CSS Grid/ApplicationV2 known issues
- PF2e proficiency API: MEDIUM - Verified structure from GitHub PR and codebase usage, but not directly documented in official PF2e system docs

**Research date:** 2026-02-03
**Valid until:** ~30 days (Foundry VTT ApplicationV2 API is stable, CSS Grid is a mature standard)
