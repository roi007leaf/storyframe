# Plan 02-02 Summary: GMInterfaceApp Implementation

**Completed:** 2026-01-29
**Phase:** 02-gm-interface
**Type:** execute

## Objective Achievement

✅ Created GMInterfaceApp class with full functionality and UI trigger
✅ GM control window operational with journal reading and speaker management

## What Was Built

### Core Implementation
1. **GMInterfaceApp ApplicationV2 Class** (`scripts/applications/gm-interface.mjs`)
   - 3-column layout: page TOC, content area, speakers sidebar
   - Journal selector in header dropdown
   - Page list with search (Foundry-style TOC)
   - Content area with proper journal HTML structure
   - Speakers gallery with drag-drop support

2. **UI Integration** (`storyframe.mjs`)
   - GM button in tokens toolbar (getSceneControlButtons hook)
   - Button opens/renders GMInterfaceApp
   - Window position persistence (client-side setting)

### Key Features Delivered

**Journal Navigation:**
- Journal dropdown selector in header
- Page TOC with search filter
- Click page to view content
- Support for all page types (text, image, PDF, video)

**Speaker Management:**
- Drag actors from sidebar to add speakers
- Drag images from journal content to add speakers
- Click + button to pick image file
- Click thumbnail to set active speaker
- Hover thumbnail for remove button
- Clear speaker button (narration mode)
- Active speaker highlight (border + shadow)

**Content Display:**
- Matches Foundry's journal HTML structure exactly
- Enriched HTML with links, buttons, inline checks
- Scrollable content area
- Dark theme for readability

## Technical Decisions

### v13 Compatibility Fixes
- **Hook timing:** `socketlib.ready` fires before `init` in v13 → namespace created in init hook with defensive check in socketlib.ready
- **Controls API:** v13 changed from array to object → use `controls.tokens` (plural)
- **Tools API:** v13 changed from array to object → use property assignment instead of push
- **TextEditor:** Use `foundry.applications.ux.TextEditor.implementation.enrichHTML`
- **Dialogs:** Migrated to DialogV2 API

### Layout Redesign
- **Original plan:** 2-column split (journal + speakers)
- **User request:** 3-column Foundry-style (page TOC + content + speakers)
- **Final structure:** Matches Foundry's journal viewer with added speakers sidebar

### Journal Styling
- **Attempted:** Full Foundry journal CSS with parchment background
- **Result:** Text too light/washed out (PF2e-specific styling issues)
- **Solution:** Kept correct HTML structure for functionality, dark theme for readability

## Deviations from Plan

### Scope Additions
1. **Drag images from content:** User-requested feature to drag journal images to speakers gallery
2. **All page types:** Extended beyond text pages to support image, PDF, video pages
3. **Layout redesign:** Changed from 2-column to 3-column Foundry-style layout

### Technical Adaptations
1. **Journal selector:** Changed from sidebar list to header dropdown
2. **Page navigation:** Changed from prev/next buttons to clickable TOC
3. **Background styling:** Reverted parchment to dark theme for readability

## Bugs Fixed During Implementation

1. **Namespace timing:** `game.storyframe` undefined when socketlib.ready fired → moved namespace creation to init hook
2. **Dropdown closing:** Journal selector closing immediately → removed data-action, used change event listener
3. **jQuery dialogs:** Dialog callbacks received jQuery objects → changed to DialogV2 API
4. **Controls array:** v13 changed controls to object → updated to use `controls.tokens`
5. **Tools array:** v13 changed tools to object → updated to use property assignment
6. **Scroll not working:** Flexbox overflow issues → added `min-height: 0` to flex containers

## Files Modified

- `scripts/applications/gm-interface.mjs` (created)
- `templates/gm-interface.hbs` (created)
- `styles/gm-interface.css` (created)
- `storyframe.mjs` (updated: GM button integration)
- `module.json` (updated: styles array, already had gmWindowPosition setting)

## Success Criteria Met

✅ GM can open control window from FoundryVTT UI
✅ GM can select journal and see content
✅ GM can navigate between pages (via TOC)
✅ GM can add speaker from actor UUID
✅ GM can add speaker from image path
✅ GM can add speaker by dragging images from content
✅ GM can click thumbnail to set active speaker
✅ GM can clear active speaker
✅ Active speaker highlights immediately
✅ Window position/size persists across sessions

## Commits

- 7c6074f: Create Handlebars template for GM window
- 2c1f3a7: Create CSS for GM window layout
- 5f8f62f: Register gm-interface.css in manifest
- 42f8643: Create GMInterfaceApp ApplicationV2 class
- d799bab: Integrate GM button into Foundry UI
- [multiple fixes]: v13 compatibility, layout redesign, bug fixes

## Known Limitations

1. **Journal styling:** Content uses dark theme instead of Foundry's styled parchment (readability trade-off)
2. **System-specific CSS:** PF2e-specific journal styling not fully applied (requires their sheet context)

## Next Steps

Phase 2 complete. Ready for Phase 3: Player Viewer.
