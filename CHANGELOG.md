# Changelog

All notable changes to StoryFrame will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2026-02-01

### Added

#### Player Sidebar System (Major Refactor)
- **Separate Player Sidebar** - Dedicated drawer for challenges and pending rolls
  - Positions alongside player viewer as attached drawer
  - Auto-opens/closes with player viewer
  - Auto-hides when no content (empty challenges and rolls)
  - 340x600px default size
  - Tracks parent viewer movement
- **Player Viewer Simplified** - Now shows only speaker gallery
  - Full width for speakers (no more cramped layout)
  - Clean, focused interface
  - Challenges and rolls moved to sidebar
- **Collapsible Sections** - Both sections independently toggleable
  - Pending Rolls section (collapsible, default expanded)
  - Challenge section (collapsible, default expanded)
  - Full height for pending rolls when no challenge
  - Smooth collapse animations
- **Compact Grid Layouts** - Maximum space efficiency
  - Grid: ~3 buttons per row (90px min width)
  - Vertical stack: Icon → Skill Name → DC badge
  - 54px min height per button
  - Fits 4x more content than previous design
  - 9-10px fonts for skill names
  - Pending rolls: Gold dice icon
  - Challenges: Blue scroll icon
- **Action Names** - Shows skill actions in pending rolls
  - Displays as "Skill (Action)" in micro font
  - 8px font, 80% opacity
  - Example: "Diplomacy (Demoralize)"

#### Create Challenge from Selection
- **Quick Create** - Magic wand button in Challenges section
- **Text Selection** - Select journal text with skill checks
- **Auto-Parse** - Extracts all inline checks from HTML
- **Name Prompt** - Dialog to name the challenge
- **Auto-Save** - Saves directly to challenge library
- **Clean Descriptions** - Removes DC text patterns
- **Skill Mapping** - Converts full names to proper slugs

#### Journal Check Features
- **Scroll Highlighting** - Real-time viewport detection
  - Skill buttons glow when checks visible in journal
  - DC values in popup glow when visible
  - IntersectionObserver with multiple thresholds
  - Tracks scroll position across journal pages
- **DC Popup Highlighting** - Visible DCs glow in popup
  - Brighter background for in-view DCs
  - Accent border and box shadow
  - Maintains highlight on hover
- **Alphabetical Sorting** - Journal checks sorted A-Z
- **MetaMorphic Support** - Works with custom journal sheets
  - PFS adventures fully supported
  - Detects `.journal-entry-pages` container
  - Parses checks across all pages
  - Compatible with Kingmaker and other custom sheets

### Fixed

#### Performance & Rendering
- **Scroll Position Preservation** - No more jumping to top
  - Manual save/restore on all renders
  - MutationObserver for DOM changes
  - Multiple retry strategies (RAF + timeouts)
  - Works for speaker changes, PC selection, presets
- **Eliminated Re-renders** - Direct DOM updates
  - PC selection: Toggle classes directly
  - Speaker changes: Update only when speaker changes
  - DC presets: DOM manipulation instead of render
  - Select all: Updates all participants directly
  - 80%+ reduction in re-render frequency

#### Skill System Fixes
- **Skill Validation** - Prevents invalid skill requests
  - Checks if each PC has the requested skill
  - Skips PCs without the skill with warning
  - Proper slug mapping (soc → society, per → perception)
  - Handles lore skills correctly
- **Crafting Actions** - Added missing PF2e actions
  - craft, repair, identify-alchemy
  - Now execute properly in player viewer
- **Lore Skill Lookup** - Fixed "skill not found" errors
  - Checks `actor.system.skills` for lore skills
  - Proper key format matching (politics-lore)
  - Fallback logic for skill location

#### Pending Roll Management
- **Secret Roll Cleanup** - Automatic removal for blind rolls
  - Regular rolls: Stay on cancel (retry)
  - Secret rolls: Remove when action fails/returns null
  - Successful rolls: Always removed
- **Action Fallback** - Failed actions fall back to basic roll
  - Ensures roll always executes
  - Pending roll always gets submitted/removed
  - Better reliability for Seek, Demoralize, etc.

#### Layout & Positioning
- **DC Preset Popup** - Fixed broken positioning
  - Restructured HTML: `.preset-selector` wraps input and dropdown
  - Dropdown appears in correct location below button
- **Journal Actor Images** - Changed to fit mode
  - `object-fit: contain` instead of `cover`
  - Full image visible without cropping
- **Challenge Section** - Now scrollable
  - `max-height: 50vh` with `overflow-y: auto`
  - Both challenge and pending rolls scroll independently
  - Scroll position preserved during renders

#### Bug Fixes
- **Static Method Calls** - Fixed `_onAddAllPCs` context
  - Proper `.call(this)` usage in inheritance chain
  - D&D 5e and base class both fixed
- **Selection Count** - Updates immediately on PC selection
  - Inline DOM updates for count display
  - Select all button icon/tooltip updates
  - Request bar ready state updates
- **Text Wrapping** - Fixed cutoff in grid buttons
  - Increased min-width: 70px → 90px
  - Font size: 9px → 10px
  - `word-break: break-word` with `hyphens: auto`
  - Buttons taller to accommodate wrapping (54px)

### Changed

#### Size & Spacing Adjustments
- **Sidebar Dimensions** - Optimized for content
  - Player sidebar: 340px wide, 600px tall
  - Grid buttons: 90px min width, 54px min height
- **Compact Spacing** - Reduced padding throughout
  - Section padding: 8px
  - Button gaps: 3-4px
  - Actor groups: 8px padding
  - Option groups: 8px padding
- **Font Size Reductions** - Better content density
  - Headers: 11px
  - Skill names: 10px
  - Descriptions: 11px
  - DC badges: 9-10px
  - Action names: 8px
  - Line heights: 1.1-1.2

#### Visual Refinements
- **Avatar Sizes** - Smaller for compact design
  - Player sidebar: 24px
  - Challenge header: 32px
- **Section Headers** - Unified styling
  - Consistent padding and typography
  - Hover effects on collapsible headers
  - Chevron rotation on collapse

### Technical

- **ESLint Config** - Added `FormDataExtended` to globals
- **Module Registration** - Player sidebar CSS and lifecycle
- **State Management** - Player sidebar integrated in state updates
- **Socket Manager** - Renders player sidebar on state changes
- **Lifecycle Hooks** - `renderPlayerViewerApp`, `closePlayerViewerApp`
- **System Adapter** - Skill name resolution in player sidebar
- **Intersection Observer** - Cleanup on sidebar close

## [1.3.0] - 2026-02-01

### Added

#### Multi-Option Challenge System
- **Present Challenge** - GM broadcasts multi-option skill challenges to all players
  - Proper ApplicationV2 dialog class with dedicated template and CSS
  - Card-based builder with name, optional image, and multiple options
  - Scrollable dialog for long challenges (max-height: 90vh)
  - Each option: description + multiple skill-DC pairs
  - Each skill can have different DC (e.g., "Crafting DC 15 OR Diplomacy DC 17")
  - **Lore skills support** - All lore skills from participants available in dropdown
  - **Skill actions (PF2e)** - Optional action dropdown per skill (e.g., "Demoralize")
  - Add/remove skills within each option
  - Add/remove option cards
  - Visible to ALL players (no participant selection needed)
  - Players self-select which option to attempt
  - Respects system DC visibility settings (hides DCs if metagame setting off)
  - Options remain available after use (no auto-removal)
- **Challenge Library** - Save and reuse prepared challenges
  - Proper ApplicationV2 dialog class with dedicated template and CSS
  - Folder icon button in PCs section (always available)
  - Beautiful card layout showing challenge name and options preview
  - "Present to All Players" button per challenge
  - Delete button with confirmation
  - "Save to library" checkbox in builder dialog
  - Challenges stored per-world, templates reusable across scenes
- **Player Challenge UI** - Players see challenge in rolls sidebar
  - Challenge name and optional image
  - Each option shows as card with description
  - Click any skill button to immediately roll with its DC
  - DC badge shows if system allows
  - Direct roll execution with DC pre-filled
- **Styled Dialog** - Custom StoryFrame button styling throughout
  - Gradient buttons with hover/active effects
  - Color-coded actions (blue=add, red=remove, green=submit)
  - Box shadows and lift animations
- **Clear Challenge** - GM can manually clear active challenge (click indicator)

## [1.1.0] - 2026-02-01

### Added

#### Journal Content Integration
- **Journal Images Gallery** - All images in journal automatically appear in NPC panel
  - Grid layout with compact square thumbnails (50px)
  - Click to add image as NPC speaker with custom name prompt
  - Right-click to view full-screen
  - Filters out images already used as speakers
- **Journal Actors Gallery** - Actor references (@Actor[id]{name}) auto-detected
  - Parsed from Foundry content links in journal pages
  - Grid layout matching image gallery style
  - Click to add actor as NPC speaker instantly
  - Right-click to view actor portrait full-screen
  - Filters out actors already added as speakers, loot actors, and hazards

#### Skill Check Enhancements
- **Secret Rolls** - New checkbox in DC controls for GM-only rolls (blind mode)
- **System-Specific Skill Menus** - Three-dots and gear menus now show correct skills per system
- **D&D 5e Inline Checks** - Auto-detects `[[/check skill dc=15]]` and `[[/save ability dc=12]]` syntax

#### UI Enhancements
- **PC hover border** - PCs now show accent border on hover for better interactivity
- **Compact galleries** - Journal images/actors use 50px grid for more items per row
- **Cleaner UI** - Removed + icons from journal images for simpler appearance
- **DC dropdown fix** - Click events no longer auto-close dropdowns

### Changed
- **Major Refactor**: System-specific implementations
  - Created `GMSidebarAppBase` abstract class with common functionality
  - Created `GMSidebarAppPF2e` subclass for PF2e-specific features
  - Created `GMSidebarAppDND5e` subclass for D&D 5e-specific features
  - Moved skill mapping to `SystemAdapter` module
- Journal-sourced NPCs now integrated directly into sidebar workflow
- NPC panel structure reorganized with journal content sections
- **Full D&D 5e Support** - Sidebar now works with D&D 5e journal sheets (JournalEntrySheet5e)
- **System-Specific Defaults** - Quick skill buttons default to appropriate skills per system
- **NPC section sizing** - Now sizes to content (max 60vh) instead of filling viewport
- **Player viewer control** - Right-click TV icon closes viewers for all players

### Fixed
- D&D 5e check detection now parses `<span class="roll-link-group">` correctly
- D&D 5e rolls now evaluate success/failure with `config.target` DC
- D&D 5e actor links (@UUID format) now detected in journal
- ApplicationV2 element handling for both PF2e and D&D 5e journal sheets
- jQuery object unwrapping for proper DOM access
- Journal actor filtering now correctly uses UUID comparison

### Removed
- Debug console.log statements throughout codebase
- Hardcoded system-specific logic from base class

## [1.0.3] - 2026-01-31

### Added

#### Rich Text Editor Enhancements

- **Comprehensive formatting toolbar** with dropdowns for:
  - Font family selection (18 fonts including Foundry-specific fonts)
  - Font size selection (8pt - 36pt)
  - Block format selection (Paragraph, Headings 1-6, Blockquote, Preformatted, Div)
- **Foundry VTT format tools**:
  - Secret Block insertion for GM-only content
  - Code Block formatting
  - Horizontal Rule insertion
- **PF2e-specific format tools**:
  - Inline Header formatting
  - Info Block, Stat Block, and Written Note templates
  - Trait tag insertion
  - Action Glyph icons (1/2/3/Free/Reaction)
  - GM Text Block and GM Text Inline for system-specific GM content
- **Collapsible toolbar categories** - Foundry and PF2e format groups expand/collapse for cleaner UI
- **Active format highlighting** - Toolbar buttons highlight in blue when that format is applied to selected text
- **Format toggling** - Click a highlighted format button to remove that formatting
- **HTML Source View** - Toggle between WYSIWYG and raw HTML editing
- **FilePicker integration** - Image insertion now uses Foundry's file browser instead of URL prompts
- **Image management** - Click images to select them, press Delete to remove
- **Selected text preservation** - Format buttons wrap selected text instead of replacing it
- **Enhanced clear formatting** - Removes all formatting including PF2e/Foundry special blocks

### Changed

- Replaced Quill.js with custom contenteditable-based editor for better control and Foundry integration
- Extracted editor into separate `StoryFrameEditor` class in `scripts/storyframe-editor.mjs`
- Save button now automatically exits edit mode and returns to rendered view
- Toolbar uses compact, wrapping layout with proper flex-wrap behavior

### Fixed

- Module release workflow now includes `storyframe.mjs` in the module.zip archive
- Toolbar button active states now properly reset when selection changes
- Format buttons preserve and wrap selected text instead of replacing it

## [1.0.2] - 2026-01-30

### Fixed

- Download links in module.json manifest now correctly point to latest release assets

## [1.0.1] - 2026-01-30

### Fixed

- Removed debug console logs from gm-sidebar.mjs and gm-interface.mjs

## [1.0.0] - 2026-01-30

### Added

#### Core Features

- Integrated journal reader for GMs with seamless navigation
- Real-time speaker synchronization between GM and players via socketlib
- NPC speaker gallery with drag-and-drop support
- Active speaker highlighting system
- Player character participant management for skill checks
- Keyboard shortcut (`Ctrl+Shift+S`) to toggle StoryFrame

#### GM Interface

- Journal dropdown with folder organization and collapsible tree structure
- Favorites system - star frequently-used journals for quick access
- Page navigation with search filtering
- Back/forward navigation buttons for journal history
- Previous/next page navigation buttons
- Rich text editor powered by Quill.js for inline journal editing
- Unsaved changes protection with confirmation dialogs
- "Edit in Foundry" button to open native journal editor
- Support for all journal page types: text, image, PDF, video, and map
- Map page support with scene thumbnails and quick view buttons
- Automatic theme detection and styling for PF2e premium modules

#### GM Sidebar (Character Panel)

- Drawer-style window that attaches to main interface
- NPC speaker gallery with image upload and actor drag support
- Active speaker selection
- PC participant management with drag-and-drop
- Bulk participant selection (select/deselect all)
- Skill check request system with quick-access buttons
- Configurable quick skill buttons
- Pending roll indicator with popup management
- Right-click NPC portraits to view enlarged images

#### Player Viewer

- Synchronized NPC portrait gallery
- Active speaker highlighting
- Multiple layout options: grid, list, horizontal
- Skill check prompts with roll execution
- Right-click to enlarge portraits
- Auto-open when speakers are added
- Persistent layout preferences

#### Multi-System Support

**Pathfinder 2e:**

- Full PF2e skill action support (Seek, Demoralize, Recall Knowledge, etc.)
- DC by level calculation (Level 0-25)
- Difficulty adjustments: Trivial, Low, Low-Med, Standard, Med-High, High, Extreme
- Degree of success tracking (critical success/success/failure/critical failure)
- Integration with `game.pf2e.actions` for proper action execution
- Respects PF2e metagame settings for DC visibility
- All 17 PF2e skills with their specific actions

**D&D 5th Edition:**

- All 18 standard D&D 5e skills
- Difficulty-based DC system: Very Easy (5), Easy (10), Medium (15), Hard (20), Very Hard (25), Nearly Impossible (30)
- Full Challenge Visibility integration - respects system privacy settings
- Simple skill checks without action complexity
- Proper chat message formatting with DC display

#### Technical Features

- Per-scene state persistence
- Window position and size memory
- Module CSS override protection
- Dynamic system detection and adaptation
- Real-time socket synchronization
- Automatic cleanup on scene changes

### Changed

- Replaced "All"/"None" text buttons with icons and tooltips
- Moved pending rolls from sidebar section to floating indicator badge
- Replaced ProseMirror with Quill.js for better editor stability

### Fixed

- Editor scrolling issues
- Editor visual rendering problems
- Challenge visibility settings now properly respected in D&D 5e
- Player viewer initialization checks to prevent undefined errors
- Map page rendering (no longer shows "Unsupported page type")
- Console output cleaned - removed all debug logs

### Technical Details

- Built on ApplicationV2 with HandlebarsApplicationMixin
- Uses socketlib for real-time communication
- Quill.js 1.3.7 for rich text editing (loaded from CDN)
- CSS variable-based design system
- Modular architecture with separate concerns

### Requirements

- Foundry VTT v13 or higher
- socketlib module

---

## Future Considerations

- Additional game system support
- Roll history tracking and display
- Export/import speaker galleries
- Custom speaker sorting and filtering
- Integration with other narrative modules

---

[1.0.0]: https://github.com/[author]/storyframe/releases/tag/v1.0.0
