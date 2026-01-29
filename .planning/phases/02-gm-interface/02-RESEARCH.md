# Phase 2: GM Interface - Research

**Researched:** 2026-01-29
**Domain:** FoundryVTT v13 ApplicationV2 UI development - GM control window
**Confidence:** HIGH

## Summary

Phase 2 requires a GM-only ApplicationV2 window combining journal reading with speaker management. The window must support resizable layout split between journal display and speaker gallery, actor/image-based speaker addition, click-to-set-active interaction, and real-time broadcast to player viewers.

The standard approach uses:
- ApplicationV2 with HandlebarsApplicationMixin for template-based rendering
- PARTS property for multi-section layout (header, journal, gallery)
- Manual CSS/JS for resizable split (no built-in split pane support)
- `game.journal` collection iteration with `selectOptions` Handlebars helper for dropdown
- `TextEditor.getDragEventData()` for actor drag-drop handling
- FilePicker button binding for image selection (data-type="image")
- CSS Grid for speaker gallery with active state highlighting
- Click handlers calling socket methods to broadcast state changes

**Primary recommendation:** Use side-by-side layout (journal left, gallery right) with CSS Grid for gallery, HTML resize handle with mousemove listeners, and click-to-set-active (not toggle) for speaker selection.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ApplicationV2 | v13+ | Window framework | Native FoundryVTT application base class |
| HandlebarsApplicationMixin | v13+ | Template rendering | Official template integration for ApplicationV2 |
| FilePicker | v13+ | Image selection | Native file browser with image filtering |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CSS Grid | CSS3 | Gallery layout | Responsive thumbnail grid, native browser support |
| Handlebars helpers | v13+ | Form elements | selectOptions for dropdowns, built-in FoundryVTT helpers |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual CSS resize | Split.js library | Library adds dependency, manual approach is ~50 lines of code |
| CSS Grid | Flexbox | Grid simpler for uniform thumbnails, Flexbox better for complex layouts |
| Click-to-set-active | Click-to-toggle | Toggle requires "deselect" concept, narration mode handled by clear button |

**Installation:**
No additional dependencies - all tools are built into FoundryVTT v13.

## Architecture Patterns

### Recommended Project Structure
```
storyframe/
├── templates/
│   └── gm-interface.hbs    # Main GM window template
├── scripts/
│   ├── applications/
│   │   └── gm-interface.mjs    # GMInterfaceApp ApplicationV2 class
│   ├── state-manager.mjs       # From Phase 1
│   └── socket-manager.mjs      # From Phase 1
└── styles/
    └── gm-interface.css        # Window styling
```

### Pattern 1: ApplicationV2 with HandlebarsApplicationMixin
**What:** Combine ApplicationV2 base with Handlebars template rendering
**When to use:** All FoundryVTT v13 UI windows with templates
**Example:**
```javascript
// Source: https://foundryvtt.com/api/classes/foundry.HandlebarsApplication.html
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class GMInterfaceApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'storyframe-gm-interface',
    classes: ['storyframe', 'gm-interface'],
    tag: 'div',
    window: {
      title: 'StoryFrame GM Interface',
      resizable: true,
      icon: 'fas fa-book-open'
    },
    position: {
      width: 900,
      height: 600
    },
    actions: {
      selectJournal: this._onSelectJournal,
      addSpeaker: this._onAddSpeaker,
      setSpeaker: this._onSetSpeaker,
      removeSpeaker: this._onRemoveSpeaker,
      clearSpeaker: this._onClearSpeaker
    }
  };

  static PARTS = {
    header: {
      template: 'modules/storyframe/templates/gm-interface-header.hbs'
    },
    content: {
      template: 'modules/storyframe/templates/gm-interface.hbs',
      scrollable: ['.journal-content', '.speaker-gallery']
    }
  };

  async _prepareContext(options) {
    const state = game.storyframe.stateManager.getState();
    const journals = game.journal.map(j => ({ id: j.id, name: j.name }));

    return {
      journals,
      selectedJournal: state.activeJournal,
      journalContent: await this._getJournalContent(state.activeJournal),
      speakers: await this._prepareSpeakers(state.speakers),
      activeSpeaker: state.activeSpeaker
    };
  }

  async _prepareSpeakers(speakers) {
    return Promise.all(speakers.map(async s => {
      if (s.actorUuid) {
        const actor = await fromUuid(s.actorUuid);
        return {
          ...s,
          img: actor?.img || s.imagePath || 'icons/svg/mystery-man.svg',
          name: actor?.name || s.label || 'Unknown'
        };
      }
      return {
        ...s,
        img: s.imagePath || 'icons/svg/mystery-man.svg',
        name: s.label
      };
    }));
  }
}
```

### Pattern 2: Resizable Split Pane (Manual CSS/JS)
**What:** HTML resize handle with mousemove event tracking
**When to use:** Split layouts within ApplicationV2 windows
**Example:**
```javascript
// Source: https://blog.openreplay.com/resizable-split-panes-from-scratch/
class GMInterfaceApp extends HandlebarsApplicationMixin(ApplicationV2) {
  _onRender(context, options) {
    super._onRender(context, options);
    this._attachResizeHandler();
  }

  _attachResizeHandler() {
    const resizer = this.element.querySelector('.resize-handle');
    const leftPane = this.element.querySelector('.journal-pane');
    const container = this.element.querySelector('.split-container');

    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
      isResizing = true;
      document.body.style.cursor = 'col-resize';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;

      const containerRect = container.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      const minWidth = 300;
      const maxWidth = containerRect.width - 300;

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        leftPane.style.width = `${newWidth}px`;
      }
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = 'default';
      }
    });
  }
}
```

**CSS:**
```css
.split-container {
  display: flex;
  height: 100%;
}

.journal-pane {
  flex: 0 0 450px; /* Initial width */
  overflow-y: auto;
  padding: 1rem;
}

.resize-handle {
  flex: 0 0 4px;
  background: var(--color-border-dark);
  cursor: col-resize;
}

.resize-handle:hover {
  background: var(--color-border-highlight);
}

.gallery-pane {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}
```

### Pattern 3: Actor Drag-Drop Handler
**What:** Handle actor drops using TextEditor.getDragEventData
**When to use:** Accepting actor drops from sidebar
**Example:**
```javascript
// Source: https://foundryvtt.com/api/classes/foundry.applications.ux.TextEditor.html
class GMInterfaceApp extends HandlebarsApplicationMixin(ApplicationV2) {
  _onRender(context, options) {
    super._onRender(context, options);
    this._attachDragDropHandlers();
  }

  _attachDragDropHandlers() {
    const dropZone = this.element.querySelector('.speaker-gallery');

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      const data = TextEditor.getDragEventData(e);

      if (data.type === 'Actor') {
        const actor = await fromUuid(data.uuid);
        if (actor) {
          await this._addActorSpeaker(actor);
        }
      }
    });
  }

  async _addActorSpeaker(actor) {
    const speaker = {
      id: foundry.utils.randomID(),
      actorUuid: actor.uuid,
      imagePath: null,
      label: actor.name
    };

    await game.storyframe.socketManager.broadcastAddSpeaker(speaker);
  }
}
```

### Pattern 4: FilePicker Integration
**What:** Button-triggered FilePicker for image selection
**When to use:** Selecting images without actors
**Example:**
```javascript
// Source: https://foundryvtt.com/api/classes/foundry.applications.apps.FilePicker.html
class GMInterfaceApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    // ... other options
    actions: {
      browseImage: this._onBrowseImage
    }
  };

  static async _onBrowseImage(event, target) {
    const app = this;

    new FilePicker({
      type: 'image',
      current: '',
      callback: async (path) => {
        // User selected image
        const speaker = {
          id: foundry.utils.randomID(),
          actorUuid: null,
          imagePath: path,
          label: '' // Will prompt for label
        };

        await app._addImageSpeaker(speaker);
      }
    }).render(true);
  }

  async _addImageSpeaker(speaker) {
    // Prompt for label if not provided
    if (!speaker.label) {
      const label = await Dialog.prompt({
        title: 'Speaker Name',
        content: '<input type="text" name="label" placeholder="Speaker name">',
        callback: (html) => html.querySelector('[name="label"]').value
      });
      speaker.label = label || 'Unnamed';
    }

    await game.storyframe.socketManager.broadcastAddSpeaker(speaker);
  }
}
```

### Pattern 5: Journal Selector with Handlebars
**What:** Dropdown populated from game.journal using selectOptions helper
**When to use:** Selecting from document collections
**Example:**
```handlebars
{{!-- Source: https://foundryvtt.com/api/functions/foundry.applications.handlebars.selectOptions.html --}}
<div class="form-group">
  <label>Select Journal</label>
  <select name="journal" data-action="selectJournal">
    <option value="">-- Select Journal --</option>
    {{selectOptions journals selected=selectedJournal nameAttr="id" labelAttr="name"}}
  </select>
</div>
```

**Context preparation:**
```javascript
async _prepareContext(options) {
  const journals = {};
  for (let journal of game.journal) {
    journals[journal.id] = journal.name;
  }

  return {
    journals,
    selectedJournal: state.activeJournal
  };
}
```

### Pattern 6: Speaker Gallery with CSS Grid
**What:** Responsive grid of speaker thumbnails with active state
**When to use:** Displaying collection of clickable thumbnails
**Example:**
```handlebars
<div class="speaker-gallery">
  {{#each speakers}}
  <div class="speaker-thumbnail {{#if (eq ../activeSpeaker this.id)}}active{{/if}}"
       data-action="setSpeaker"
       data-speaker-id="{{this.id}}">
    <img src="{{this.img}}" alt="{{this.name}}">
    <div class="speaker-name">{{this.name}}</div>
    <button class="remove-speaker" data-action="removeSpeaker" data-speaker-id="{{this.id}}">
      <i class="fas fa-times"></i>
    </button>
  </div>
  {{else}}
  <div class="empty-state">
    <p>No speakers added yet</p>
    <p>Drag actors here or use the Add Speaker button</p>
  </div>
  {{/each}}
</div>
```

**CSS:**
```css
/* Source: https://www.w3schools.com/howto/howto_css_image_grid_responsive.asp */
.speaker-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 1rem;
  padding: 1rem;
}

.speaker-thumbnail {
  position: relative;
  cursor: pointer;
  border: 2px solid transparent;
  border-radius: 4px;
  transition: all 0.2s;
}

.speaker-thumbnail:hover {
  border-color: var(--color-border-highlight);
  transform: scale(1.05);
}

.speaker-thumbnail.active {
  border-color: var(--color-text-hyperlink);
  box-shadow: 0 0 8px var(--color-shadow-highlight);
}

.speaker-thumbnail img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 4px;
}

.speaker-name {
  text-align: center;
  font-size: 0.85rem;
  margin-top: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remove-speaker {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.7);
  border: none;
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
}

.speaker-thumbnail:hover .remove-speaker {
  opacity: 1;
}
```

### Pattern 7: Action Handlers
**What:** ApplicationV2 action routing for click events
**When to use:** All user interactions in ApplicationV2
**Example:**
```javascript
class GMInterfaceApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    actions: {
      selectJournal: this._onSelectJournal,
      setSpeaker: this._onSetSpeaker,
      removeSpeaker: this._onRemoveSpeaker,
      clearSpeaker: this._onClearSpeaker
    }
  };

  static async _onSelectJournal(event, target) {
    const journalId = target.value;
    if (!journalId) return;

    await game.storyframe.socketManager.broadcastSetActiveJournal(journalId);
  }

  static async _onSetSpeaker(event, target) {
    const speakerId = target.closest('[data-speaker-id]').dataset.speakerId;
    await game.storyframe.socketManager.broadcastSetActiveSpeaker(speakerId);
  }

  static async _onRemoveSpeaker(event, target) {
    event.stopPropagation(); // Don't trigger setSpeaker
    const speakerId = target.closest('[data-speaker-id]').dataset.speakerId;

    const confirm = await Dialog.confirm({
      title: 'Remove Speaker',
      content: '<p>Remove this speaker from the gallery?</p>'
    });

    if (confirm) {
      await game.storyframe.socketManager.broadcastRemoveSpeaker(speakerId);
    }
  }

  static async _onClearSpeaker(event, target) {
    await game.storyframe.socketManager.broadcastSetActiveSpeaker(null);
  }
}
```

### Anti-Patterns to Avoid
- **Using third-party split pane libraries:** Adds dependency for simple functionality, ~50 lines of vanilla JS sufficient
- **Toggle-based active speaker:** Requires deselect action, "click to set" more intuitive, separate "Clear" button for narration mode
- **Modifying state directly in UI:** All state changes must go through SocketManager to broadcast to players
- **Not handling deleted actors:** fromUuid returns null, must check and provide fallback image
- **Deep nesting in Handlebars:** Keep templates flat, prepare all data in _prepareContext
- **Inline styles in templates:** Use CSS classes with state-driven class toggles

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Journal dropdown | Custom journal search UI | `<select>` with selectOptions helper | Native HTML select is accessible, performant, familiar UX |
| Image selection | Custom file browser | FilePicker with type: 'image' | Handles S3/Forge/local sources, permission checking, preview |
| Drag-drop data extraction | Parse event.dataTransfer manually | TextEditor.getDragEventData | Handles FoundryVTT drag formats, validates UUIDs |
| Thumbnail grid layout | Absolute positioning | CSS Grid with auto-fill | Responsive without breakpoints, handles varying container sizes |
| Speaker deduplication | Complex ID comparison | UUID string comparison | Actor UUIDs are globally unique, simple === check |

**Key insight:** FoundryVTT provides high-level helpers (selectOptions, FilePicker, TextEditor.getDragEventData) that handle edge cases like deleted documents, permission checks, and multi-source file locations. Modern CSS (Grid, aspect-ratio) eliminates need for JavaScript-based layout calculations.

## Common Pitfalls

### Pitfall 1: Resizing Without Min/Max Constraints
**What goes wrong:** User drags resize handle off-screen, panes become invisible or unusable
**Why it happens:** MouseMove events track cursor position without bounds checking
**How to avoid:** Calculate container width, enforce min width (e.g., 300px) on both panes
**Warning signs:** Dragging resize handle past edge causes layout collapse

### Pitfall 2: Journal Content XSS Vulnerability
**What goes wrong:** Journal HTML not sanitized, custom scripts could execute
**Why it happens:** Directly inserting journal.text.content into template
**How to avoid:** Use FoundryVTT's TextEditor.enrichHTML for safe rendering
**Warning signs:** Journal contains `<script>` or inline event handlers

### Pitfall 3: Missing GM Permission Check
**What goes wrong:** Non-GM users can open GM interface
**Why it happens:** No permission gate on window open
**How to avoid:** Check `game.user.isGM` before rendering, return early if false
**Warning signs:** Players can access GM controls

### Pitfall 4: Not Awaiting fromUuid
**What goes wrong:** Speaker images don't load, race condition errors
**Why it happens:** fromUuid is async but not awaited
**How to avoid:** Use Promise.all in _prepareSpeakers to await all UUID resolutions
**Warning signs:** Speakers show mystery-man icon briefly then update

### Pitfall 5: Event Bubbling on Remove Button
**What goes wrong:** Clicking remove button also triggers setSpeaker
**Why it happens:** Remove button is child of speaker thumbnail with setSpeaker action
**How to avoid:** Call event.stopPropagation() in remove handler
**Warning signs:** Clicking X selects speaker before confirming removal

### Pitfall 6: Hardcoded Icon Paths
**What goes wrong:** Fallback icons show 404 errors on some installations
**Why it happens:** Using absolute paths like /icons/svg/mystery-man.svg
**How to avoid:** Use relative paths: icons/svg/mystery-man.svg (Foundry resolves correctly)
**Warning signs:** Console errors about missing icon files

### Pitfall 7: Missing Empty State Handling
**What goes wrong:** Blank gallery area when no speakers added
**Why it happens:** No {{else}} clause in Handlebars {{#each}} block
**How to avoid:** Always include empty state with instructions in {{else}}
**Warning signs:** Confusing empty white space, user doesn't know what to do

### Pitfall 8: CSS Specificity Wars with Foundry Styles
**What goes wrong:** Window styles don't apply or conflict with core Foundry styles
**Why it happens:** V13 uses CSS Layers, custom styles may be in wrong layer
**How to avoid:** Use .storyframe class prefix, add styles to module layer via manifest
**Warning signs:** Styles work in browser DevTools but not in actual window

### Pitfall 9: Not Persisting Split Pane Position
**What goes wrong:** User's preferred split position resets on window close/reopen
**Why it happens:** Split position only stored in DOM, not in settings
**How to avoid:** Save split ratio to game.settings on resize, restore in _onRender
**Warning signs:** User repeatedly adjusts same split position

### Pitfall 10: Synchronous State Reads After Async Writes
**What goes wrong:** UI shows stale data after state update
**Why it happens:** setFlag is async, calling render() before it completes
**How to avoid:** Await socketManager methods, StateManager calls render() after persistence
**Warning signs:** UI updates inconsistently, requires manual refresh

## Code Examples

Verified patterns from official sources:

### Complete GMInterfaceApp Class
```javascript
// Source: https://foundryvtt.com/api/classes/foundry.HandlebarsApplication.html
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class GMInterfaceApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'storyframe-gm-interface',
    classes: ['storyframe', 'gm-interface'],
    tag: 'div',
    window: {
      title: 'StoryFrame GM Interface',
      resizable: true,
      icon: 'fas fa-book-open'
    },
    position: {
      width: 900,
      height: 600
    },
    actions: {
      selectJournal: this._onSelectJournal,
      addSpeakerFromImage: this._onAddSpeakerFromImage,
      setSpeaker: this._onSetSpeaker,
      removeSpeaker: this._onRemoveSpeaker,
      clearSpeaker: this._onClearSpeaker
    }
  };

  static PARTS = {
    content: {
      template: 'modules/storyframe/templates/gm-interface.hbs',
      scrollable: ['.journal-content', '.speaker-gallery']
    }
  };

  async _prepareContext(options) {
    const state = game.storyframe.stateManager.getState();

    // Prepare journals for dropdown
    const journals = {};
    for (let journal of game.journal) {
      journals[journal.id] = journal.name;
    }

    // Prepare journal content
    let journalContent = '';
    if (state.activeJournal) {
      const journal = game.journal.get(state.activeJournal);
      if (journal) {
        // Get first text page or combine all text pages
        const textPage = journal.pages.find(p => p.type === 'text');
        if (textPage) {
          // Sanitize and enrich HTML
          journalContent = await TextEditor.enrichHTML(textPage.text.content, {
            async: true,
            secrets: game.user.isGM
          });
        }
      }
    }

    // Prepare speakers with resolved actor data
    const speakers = await Promise.all((state.speakers || []).map(async s => {
      if (s.actorUuid) {
        const actor = await fromUuid(s.actorUuid);
        return {
          ...s,
          img: actor?.img || s.imagePath || 'icons/svg/mystery-man.svg',
          name: actor?.name || s.label || 'Unknown',
          actorDeleted: !actor
        };
      }
      return {
        ...s,
        img: s.imagePath || 'icons/svg/mystery-man.svg',
        name: s.label
      };
    }));

    return {
      journals,
      selectedJournal: state.activeJournal,
      journalContent,
      speakers,
      activeSpeaker: state.activeSpeaker,
      hasSpeakers: speakers.length > 0
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this._attachResizeHandler();
    this._attachDragDropHandlers();
  }

  _attachResizeHandler() {
    const resizer = this.element.querySelector('.resize-handle');
    if (!resizer) return;

    const leftPane = this.element.querySelector('.journal-pane');
    const container = this.element.querySelector('.split-container');
    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
      isResizing = true;
      document.body.style.cursor = 'col-resize';
      e.preventDefault();
    });

    const onMouseMove = (e) => {
      if (!isResizing) return;

      const containerRect = container.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      const minWidth = 300;
      const maxWidth = containerRect.width - 300;

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        leftPane.style.width = `${newWidth}px`;
      }
    };

    const onMouseUp = () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = 'default';
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // Clean up on close
    this.addEventListener('close', () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    });
  }

  _attachDragDropHandlers() {
    const dropZone = this.element.querySelector('.speaker-gallery');
    if (!dropZone) return;

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');

      const data = TextEditor.getDragEventData(e);

      if (data.type === 'Actor') {
        const actor = await fromUuid(data.uuid);
        if (actor) {
          const speaker = {
            id: foundry.utils.randomID(),
            actorUuid: actor.uuid,
            imagePath: null,
            label: actor.name
          };
          await game.storyframe.socketManager.broadcastAddSpeaker(speaker);
        }
      }
    });
  }

  static async _onSelectJournal(event, target) {
    const journalId = target.value;
    await game.storyframe.socketManager.broadcastSetActiveJournal(journalId);
  }

  static async _onAddSpeakerFromImage(event, target) {
    const app = this;

    new FilePicker({
      type: 'image',
      current: '',
      callback: async (path) => {
        const label = await Dialog.prompt({
          title: 'Speaker Name',
          content: `
            <div class="form-group">
              <label>Speaker Name</label>
              <input type="text" name="label" placeholder="Speaker name" autofocus>
            </div>
          `,
          callback: (html) => html.querySelector('[name="label"]').value
        });

        const speaker = {
          id: foundry.utils.randomID(),
          actorUuid: null,
          imagePath: path,
          label: label || 'Unnamed'
        };

        await game.storyframe.socketManager.broadcastAddSpeaker(speaker);
      }
    }).render(true);
  }

  static async _onSetSpeaker(event, target) {
    const speakerId = target.closest('[data-speaker-id]').dataset.speakerId;
    await game.storyframe.socketManager.broadcastSetActiveSpeaker(speakerId);
  }

  static async _onRemoveSpeaker(event, target) {
    event.stopPropagation();
    const speakerId = target.closest('[data-speaker-id]').dataset.speakerId;

    const confirm = await Dialog.confirm({
      title: 'Remove Speaker',
      content: '<p>Remove this speaker from the gallery?</p>'
    });

    if (confirm) {
      await game.storyframe.socketManager.broadcastRemoveSpeaker(speakerId);
    }
  }

  static async _onClearSpeaker(event, target) {
    await game.storyframe.socketManager.broadcastSetActiveSpeaker(null);
  }
}
```

### Handlebars Template
```handlebars
{{!-- modules/storyframe/templates/gm-interface.hbs --}}
{{!-- Source: https://foundryvtt.wiki/en/development/api/applicationv2 --}}
<div class="split-container">
  <div class="journal-pane">
    <div class="journal-selector">
      <label>Journal Entry</label>
      <select name="journal" data-action="selectJournal">
        <option value="">-- Select Journal --</option>
        {{selectOptions journals selected=selectedJournal}}
      </select>
    </div>

    <div class="journal-content">
      {{#if journalContent}}
        {{{journalContent}}}
      {{else}}
        <div class="empty-state">
          <p>No journal selected</p>
          <p>Select a journal from the dropdown above</p>
        </div>
      {{/if}}
    </div>
  </div>

  <div class="resize-handle"></div>

  <div class="gallery-pane">
    <div class="gallery-header">
      <h3>Speakers</h3>
      <button type="button" data-action="addSpeakerFromImage">
        <i class="fas fa-plus"></i> Add from Image
      </button>
      <button type="button" data-action="clearSpeaker">
        <i class="fas fa-times"></i> Clear Speaker
      </button>
    </div>

    <div class="speaker-gallery">
      {{#if hasSpeakers}}
        {{#each speakers}}
          <div class="speaker-thumbnail {{#if (eq ../activeSpeaker this.id)}}active{{/if}} {{#if this.actorDeleted}}deleted{{/if}}"
               data-action="setSpeaker"
               data-speaker-id="{{this.id}}"
               title="{{this.name}}{{#if this.actorDeleted}} (Actor Deleted){{/if}}">
            <img src="{{this.img}}" alt="{{this.name}}">
            <div class="speaker-name">{{this.name}}</div>
            <button type="button" class="remove-speaker" data-action="removeSpeaker" data-speaker-id="{{this.id}}" title="Remove">
              <i class="fas fa-times"></i>
            </button>
          </div>
        {{/each}}
      {{else}}
        <div class="empty-state">
          <p>No speakers added yet</p>
          <p>Drag actors here or use the Add from Image button</p>
        </div>
      {{/if}}
    </div>
  </div>
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Application class | ApplicationV2 class | v12-v13 | New render lifecycle, actions system, PARTS structure |
| FormApplication | HandlebarsApplicationMixin | v13 | Template-based rendering replaces getData/activateListeners split |
| Manual Handlebars compilation | PARTS property | v13 | Automatic template loading, caching, partial re-render |
| Inline event listeners | actions in DEFAULT_OPTIONS | v13 | Declarative action routing via data-action attributes |
| Custom drag-drop parsing | TextEditor.getDragEventData | v10+ | Standardized drag data format across all document types |
| Float-based layouts | CSS Grid/Flexbox | CSS3 (standard) | Responsive without JavaScript, simpler code |

**Deprecated/outdated:**
- **Application class**: Use ApplicationV2 for new windows
- **FormApplication**: Use ApplicationV2 with HandlebarsApplicationMixin
- **activateListeners**: Use actions system for click/change handlers
- **getData**: Use _prepareContext (returns object, not merged with super)
- **Manual event delegation**: Use data-action attributes with actions config

## Open Questions

Things that couldn't be fully resolved:

1. **Split pane position persistence scope**
   - What we know: Can save to game.settings or user settings
   - What's unclear: Should split position be per-user or per-world?
   - Recommendation: Use `scope: 'client'` setting for per-user preference, more intuitive

2. **Journal content display depth**
   - What we know: JournalEntry has multiple pages, pages can be nested
   - What's unclear: Show all text pages combined, or single page selector?
   - Recommendation: Show all text pages combined in order for GM's reading flow, keep it simple

3. **Duplicate speaker handling**
   - What we know: Can check if actorUuid already exists in speakers array
   - What's unclear: Prevent duplicates silently, or show warning?
   - Recommendation: Show toast warning but don't add duplicate, user may have made mistake

4. **Gallery thumbnail size responsiveness**
   - What we know: CSS Grid auto-fill with minmax handles basic responsiveness
   - What's unclear: Fixed grid columns or fully fluid?
   - Recommendation: Use auto-fill for fluid layout, works with varying window sizes

5. **Active speaker visual treatment intensity**
   - What we know: Border color change is standard pattern
   - What's unclear: Additional visual treatment (scale, glow, overlay)?
   - Recommendation: Border + subtle box-shadow, avoid dramatic changes that distract from reading

## Sources

### Primary (HIGH confidence)
- [ApplicationV2 API Documentation](https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html) - Window configuration, render lifecycle
- [HandlebarsApplication API](https://foundryvtt.com/api/classes/foundry.HandlebarsApplication.html) - PARTS structure, template integration
- [FilePicker API Documentation](https://foundryvtt.com/api/classes/foundry.applications.apps.FilePicker.html) - Image selection pattern
- [TextEditor API Documentation](https://foundryvtt.com/api/classes/foundry.applications.ux.TextEditor.html) - getDragEventData method
- [selectOptions Helper](https://foundryvtt.com/api/functions/foundry.applications.handlebars.selectOptions.html) - Dropdown generation
- [Journal Collection API](https://foundryvtt.com/api/classes/foundry.documents.collections.Journal.html) - Iterating journals
- [ApplicationV2 Community Wiki](https://foundryvtt.wiki/en/development/api/applicationv2) - Best practices

### Secondary (MEDIUM confidence)
- [ApplicationV2 Conversion Guide](https://foundryvtt.wiki/en/development/guides/applicationV2-conversion-guide) - Migration patterns (wiki content not fully accessible)
- [CSS Cascade Layers Guide](https://foundryvtt.wiki/en/development/guides/css-cascade-layers) - V13 CSS organization
- [Package Best Practices](https://foundryvtt.wiki/en/development/guides/package-best-practices) - Development standards
- [Resizable Split Panes Tutorial](https://blog.openreplay.com/resizable-split-panes-from-scratch/) - Manual CSS/JS implementation
- [Creating Responsive Image Grid (W3Schools)](https://www.w3schools.com/howto/howto_css_image_grid_responsive.asp) - CSS Grid gallery pattern

### Tertiary (LOW confidence)
- WebSearch results about split pane libraries - context for "don't use library" recommendation
- WebSearch results about CSS Grid patterns - cross-referenced with W3Schools for accuracy

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools are built into FoundryVTT v13, official API docs available
- Architecture patterns: HIGH - ApplicationV2, FilePicker, TextEditor verified with official docs
- Resizable split pane: MEDIUM - No built-in support, manual implementation pattern from web tutorial (common pattern but not FoundryVTT-specific)
- UI/UX patterns: MEDIUM - CSS Grid and active state patterns are standard web dev, but specific application to FoundryVTT context based on community practices
- Pitfalls: HIGH - Permission checks, async handling, event bubbling documented in official sources

**Research date:** 2026-01-29
**Valid until:** 60 days (FoundryVTT v13 stable, ApplicationV2 mature API)
