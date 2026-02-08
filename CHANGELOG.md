# Changelog

All notable changes to StoryFrame will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.7.3] - 2026-02-08

### Added

#### Hidden Actor Names (Mystery NPCs)

- **ALT+Drag/Click to Hide Names** - Add mystery NPCs whose identity is concealed from players
  - Hold ALT while dragging actors to add them with hidden names
  - Hold ALT while clicking journal actors to add with hidden names
  - Players see "Unknown" instead of real name in all UI elements
  - GMs always see the real name
  - Works for both speakers (NPCs) and participants (PCs)

- **Toggle Visibility Button** - Control when to reveal NPC identities
  - Yellow eye/eye-slash button appears on hover (left of edit button)
  - Click to toggle between hidden and revealed states
  - Eye icon (👁️) when hidden → click to reveal
  - Eye-slash icon (👁️‍🗨️) when visible → click to hide
  - Instant synchronization to all connected players

- **Visual Indicators** - Clear feedback for GMs about hidden names
  - Eye-slash badge on bottom-right of speaker image (GM only)
  - Badge appears in GM sidebar thumbnails
  - Badge appears in speaker wheel
  - Italicized label text in speaker wheel for hidden speakers
  - Tooltips explain hidden state

- **Speaker Wheel Support** - Hidden names work throughout the system
  - Unknown speakers show "Unknown" label to players
  - Eye-slash badge indicates hidden status (GM view)
  - Clicking hidden speaker to activate reveals their name
  - All saved scenes preserve hidden name flags

### Fixed

- **Player Viewer Synchronization** - Critical bug affecting all state updates
  - Fixed incorrect reference: `playerApp` → `playerViewer`
  - Affects 6 files: speaker-manager, participant-manager, socket-manager, challenge-manager, roll-tracker, state-manager
  - Players now see real-time updates when speakers/participants change
  - Scene selection in speaker wheel now properly updates player view
  - All state changes now properly sync to players

- **CTRL+Click Roll Requester** - Fixed broken journal inline check functionality
  - Added `stopImmediatePropagation()` to prevent PF2e's handler from running
  - Added event capture phase (`{ capture: true }`) to intercept before PF2e
  - CTRL+clicking journal inline check repost buttons now opens Roll Requester Dialog
  - Prevents unwanted repost-to-chat behavior
  - Debug logging added to track event interception

- **Speaker Wheel Label Width** - Long speaker names now display fully
  - Increased max-width: 100px → 200px
  - Removed 3-line clamp restriction (wraps as needed)
  - Added `word-break: break-word` for proper wrapping
  - Names like "Black Tear Cutthroat" now show completely

### Technical

- **New State Properties**
  - `speaker.isNameHidden` - Boolean flag for name visibility
  - `participant.isNameHidden` - Boolean flag for participant name visibility

- **New Methods**
  - `SpeakerManager.toggleSpeakerNameVisibility(speakerId)` - Toggle visibility state
  - `StateManager.toggleSpeakerNameVisibility(speakerId)` - Facade method
  - `SocketManager.requestToggleSpeakerVisibility(speakerId)` - Socket request

- **New Socket Handlers**
  - `toggleSpeakerVisibility` - GM-executed toggle handler

- **New UI Actions**
  - `toggleSpeakerVisibility` - Registered in GMSidebarAppBase actions

- **Modified Methods**
  - `SpeakerManager.addSpeaker()` - Accepts `isNameHidden` parameter
  - `SpeakerManager.resolveSpeaker()` - Hides name from non-GM users
  - `ParticipantManager.addParticipant()` - Accepts `isNameHidden` parameter
  - `StateManager.addSpeaker()` - Passes through `isNameHidden` parameter
  - All name resolution functions check `isNameHidden` flag and user permissions

- **New Localization Keys**
  - `STORYFRAME.UI.Labels.HiddenFromPlayers` - "Hidden from Players"
  - `STORYFRAME.UI.Tooltips.NameHiddenFromPlayers` - "This name is hidden from players"
  - `STORYFRAME.UI.Tooltips.ToggleNameVisibility` - "Toggle name visibility for players"
  - `STORYFRAME.UI.Tooltips.HoldAltToHide` - "Hold ALT while dragging to hide name from players"

## [1.7.2] - 2026-02-07

### Added

#### Speaker Management Enhancements

- **Edit Speaker Names** - Rename NPCs with hover-revealed edit button
  - Blue pencil icon appears on hover (left of remove button)
  - Click to edit speaker name via dialog prompt
  - Works for all speaker types (images, actors, journal sources)
  - Clear visual indicator with tooltip

- **Update Scene with Current Speakers** - Quick scene updates from scenes popup
  - Sync icon button in saved scenes list
  - Updates scene speakers without opening editor
  - Speaker count updates instantly in UI

### Changed

#### Speaker Data Consistency

- **Unified Speaker Property Model** - Improved data consistency
  - All speaker sources now use `label` as single source of truth
  - Resolution process converts `label` → `name` for display
  - Scene editor strips redundant properties before saving
  - Speaker wheel consistently resolves all speakers

#### UX Refinements

- **Reduced Notification Noise** - Removed redundant notifications
  - Removed "Speaker name updated" (UI updates immediately)
  - Removed "Added as NPC" messages (visual feedback sufficient)
  - Removed "Speaker added to scene" in editor (list updates immediately)
  - Kept important notifications for remote actions and errors

## [1.7.1] - 2026-02-07

### Added

#### DC Preset System Enhancements

- **Party Level DC Calculator** - Dynamic DC calculation based on party level
  - Calculates average level from selected participants (or all participants)
  - Difficulty-based DC options (Trivial, Low, Moderate, High, Severe, Extreme for PF2e)
  - Automatic DC calculation: Base DC (for level) + Difficulty adjustment
  - Available in both Challenge Builder and PCs tab

- **Tabbed DC Preset Dropdown** - Organized interface for DC selection
  - Tab 1: "Presets" - Custom GM-defined DC presets
  - Tab 2: "Party Lvl X" - Difficulty-based DCs for current party level
  - Click bookmark button (📑) next to DC inputs to open
  - Compact 220px width, 100px max-height body
  - Scrollable tab content for many presets

- **Preset Management** - Add/remove DC presets directly from dropdown
  - Add presets: Enter DC value, auto-generates name "DC X"
  - Remove presets: X button on each preset (shows on hover)
  - Instant updates with dropdown refresh
  - System-specific presets (PF2e/D&D5e)

### Changed

#### Code Organization & DRY Improvements

- **Shared DC Dropdown Component** - Eliminated code duplication
  - Created `scripts/utils/dc-preset-dropdown.mjs` utility
  - Created `styles/dc-preset-dropdown.css` shared stylesheet
  - ~250 lines of duplicate JS code eliminated
  - ~445 lines of duplicate CSS eliminated
  - Single source of truth for dropdown logic and styling

#### UI Refinements

- **Improved Readability** - Enhanced dropdown visual clarity
  - Larger tabs (11px font, 8px/12px padding)
  - Bigger preset buttons (13px font, 38px min-height)
  - Brighter colors for better contrast (#81a1ff active tabs, #b5d5ff DCs)
  - Increased spacing throughout (6-12px gaps and padding)
  - Better hover states with enhanced shadows

- **Simplified Preset Form** - Streamlined user experience
  - Removed name input field - only DC value needed
  - Auto-generated preset names ("DC 15", "DC 20", etc.)
  - Wider DC input for better UX
  - Green add button, red remove buttons

- **Layout Improvements** - Better visual organization
  - PCs tab: All DC controls on single row (Select All, DC, Preset, Secret)
  - Secret roll button moved outside dc-input-group container
  - Removed separate difficulty selector dropdown (integrated into preset tabs)
  - Cleaner, more compact layout

### Fixed

- **Dropdown Positioning & Visibility**
  - Added `overflow: visible` to parent containers (dc-controls-bar, dc-controls-row, preset-selector)
  - Prevents dropdown from being clipped by sidebar overflow
  - Reduced dropdown height to fit in constrained spaces
  - Absolute positioning with proper z-index (10000)

- **Action Handler Fixes**
  - Fixed class name mismatch (`.preset-dropdown` vs `.dc-preset-dropdown`)
  - Resolved TypeError when adding/removing presets
  - All dropdown interactions now functional (apply, add, remove)

- **Ctrl+Click Roll Requester** - Fixed broken functionality
  - Properly extracts selectedIds and allowOnlyOne from dialog result
  - Generates batchGroupId for grouped requests
  - Passes checkType and allow-only-one parameters

## [1.7.0] - 2026-02-06

### Added

#### Saving Throws Support

- **Complete Save System** - Full support for saving throws across all features
  - Added save support to Challenge Builder with separate "Saving Throws" section
  - Saves display with distinctive orange accent (#dc7633) throughout the UI
  - Proper capitalization for save names ("Reflex" instead of "REFLEX")
  - Save validation removed (all actors have all saves)
  - checkType field ('skill' or 'save') added to challenge data structure

#### Challenge Builder Enhancements

- **Separate Saves Section** - Saves now have their own dedicated section with orange theme
  - Distinct "Skills" and "Saving Throws" sections in Challenge Builder
  - "Add Save" button with orange styling
  - Save rows include: save dropdown, DC input, secret checkbox, remove button
  - No proficiency requirements for saves (removed from save UI)
  - No action selection for saves (PF2e actions only apply to skills)
- **Save Only Button** - Option to save challenges without presenting
  - "Save to Library" button (create mode) - blue styling
  - "Update" button (edit mode) - updates library entry only
  - "Present Challenge"/"Update and Present" remains as primary action (green)
- **DC Quick Select** - HTML5 datalist for common DC values
  - Click any DC input to see preset suggestions (10, 12, 15, 18, 20, 22, 25, 30, 35, 40)
  - Still allows manual DC entry
  - Works for both skills and saves
- **Dropdown Tooltips** - Hover to see full text of truncated dropdowns
  - All select elements show full selected text as tooltip
  - Automatically updates when selection changes

#### Allow Only One Feature

- **Batched Roll Mutual Exclusion** - Players can only roll one check from a group
  - "Allow only one" checkbox in Roll Requester Dialog
  - When enabled, rolling one check auto-dismisses others in the group
  - Participant-specific dismissal (each player's choices are independent)
  - Visual indicator with green "Choose One" badge
  - Batched rolls grouped by batchGroupId in player sidebar
  - Works for both skill checks and saves

#### Orange Theme for Saves

- **Consistent Visual Identity** - Orange accent for all save-related UI
  - GM Sidebar: Orange save buttons and category headers
  - Journal: Orange save check buttons and DC badges
  - Challenge Builder: Orange saves section, pills, and buttons
  - Player Challenges: Orange save buttons
  - Player Pending Rolls: Orange save roll buttons
  - Challenge Library: Orange save pills with proper capitalization
  - Roll Requester: Save-aware dialog text ("Found X save(s)")

### Fixed

- **Ctrl+Click Roll Requester** - Fixed regression in journal repost icon behavior
  - Updated storyframe.mjs to handle new RollRequestDialog object format
  - Properly extracts selectedIds and allowOnlyOne from dialog result
  - Generates shared batchGroupId for grouped requests
  - Passes checkType and allow-only-one parameters correctly
- **Challenge Display** - Fixed challenge rendering in GM sidebar
  - Made prepareChallengesContext async to properly load save names
  - Added await when calling async context preparation function
  - Saves now display with correct names and styling
- **UI Polish** - Various layout and styling improvements
  - Reduced dropdown padding and font size to prevent text truncation
  - Left-aligned select dropdown text for better readability
  - Flexible width constraints to fit dialog width
  - Sticky footer in Roll Requester Dialog

### Changed

- **Roll Requester Dialog** - Enhanced layout and behavior
  - Increased default height to 700px for better content visibility
  - Implemented proper flexbox layout for sticky footer
  - Footer stays at bottom when resizing dialog
  - Resizable dialog for user customization

## [1.6.2] - 2026-02-05

### Fixed

- **D&D 5e Skill Check Parsing** - Journal check detection and parsing
  - Fixed parser to detect both `data-type="check"` and `data-type="skill"` attributes
  - Added support for both single (`<a class="roll-action">`) and grouped (`<span class="roll-link-group">`) check elements
  - Fixed skill vs ability priority - now prefers `data-skill` over `data-ability` when both present
  - Added pipe-separated skill handling (e.g., `data-skill="acr|ath"`)
  - Fixed journal checks to show full skill names instead of abbreviations (e.g., "Deception" not "Dec")
- **D&D 5e Skill Display** - All 18 skills now visible in sidebar
  - Fixed skill categorization to use D&D 5e-specific categories instead of PF2e slugs
  - Added Physical, Mental, Social, and Utility skill categories for D&D 5e
  - Generates all skills from SystemAdapter instead of relying on quickButtonSkills setting
- **D&D 5e Skill Icons** - Added icons for all skills
  - Added Font Awesome icons for all 18 D&D 5e skills
  - Fixed duplicate icon issue (Insight changed from `fa-eye` to `fa-lightbulb`)
- **D&D 5e Challenge Handler** - Fixed function call error
  - Fixed `sidebar._requestSkillCheck is not a function` error
  - Added proper import for SkillCheckHandlers module
  - Updated function call to use correct signature
- **Skill Category Headers** - Centered category labels
  - Added `text-align: center` to `.category-label` in sidebar CSS

## [1.6.0] - 2026-02-05

### Added

#### Speaker Wheel System

- **Radial Speaker Selection Wheel** - Quick NPC speaker selection via keybind
  - Opens at mouse cursor position with radial layout
  - Calculates optimal radius based on item count
  - Items positioned with trigonometric placement
  - Animated appearance with scale-in animation
  - Center button: Cancel (scenes) or Clear (direct speakers)
  - Escape key to close wheel
- **Speaker Scenes** - Save and reuse speaker groups
  - Create named scenes from current speakers
  - Two-level navigation: Scenes → Speakers
  - Scene items styled with icon and label
  - Shift+click scene to edit in dedicated editor
  - Right-click scene to delete with confirmation
  - Automatic fallback to direct speakers if no scenes
  - Session memory: Returns to last selected scene
- **Scene Editor Dialog** - Comprehensive scene builder
  - Add speakers from journal images (with name prompt)
  - Add speakers from journal actors (auto-named)
  - Drag and drop actors directly into scene
  - Remove speakers from scene
  - Add all current speakers with one click
  - Visual grid layout for sources
  - Inline speaker list with remove buttons
  - Used for both creating and editing scenes
  - Edit button in scene management popup
  - Shift+click scene in wheel to edit
- **Active Speaker Indication** - Visual feedback in wheel
  - Golden border and glow effect on active speaker
  - Star badge with pop animation
  - Scales up slightly for emphasis
  - Enhanced hover effects when active
  - Consistent positioning (no layout shift)
- **Smart Mouse Tracking** - Accurate wheel positioning
  - Global mousemove listener initialized on module ready
  - Persistent tracking throughout session
  - Position memory prevents jumping during scene transitions
  - Initial position saved per wheel session
- **Back Navigation** - Navigate between scenes and speakers
  - Back button in speaker view returns to scene selection
  - Maintains wheel position during navigation
  - Blue color-coded for navigation context

### Changed

- **Speaker Images** - Cropped to show faces
  - `object-position: top center` for better portrait framing
  - 72px square thumbnails with 8px border radius
  - Border styling matches theme colors

- **Transform Composition** - Active speaker positioning
  - Scale effect applied to child elements instead of container
  - Preserves inline translate transform for radial positioning
  - No more snapping to center when speaker becomes active
- **Z-Index Layering** - Proper stacking order
  - Center button: z-index 100 (always on top)
  - Active speaker: z-index 50 (above others)
  - Hovered items: z-index 10 (above siblings)
- **Lore Skills Display** - GM sidebar PCs tab quick skills
  - Lore skills now update immediately when selecting/deselecting participants
  - Added render() calls to participant selection handlers
  - Fixes delay where lore skills only appeared on manual rerender

### Technical

- **New Module**: `scripts/speaker-wheel.mjs`
  - `initMouseTracking()` - Initialize global mouse listener
  - `showSpeakerWheel()` - Main entry point with scene/speaker routing
  - `showSceneWheel()` - Scene selection level
  - `showSceneSpeakers()` - Speaker selection within scene
  - `showSpeakersWheel()` - Direct speaker selection
  - `hideSpeakerWheel()` - Cleanup and removal
  - `calculateRadius()` - Dynamic radius calculation
- **New Module**: `scripts/scene-editor.mjs`
  - `showSceneEditor()` - Dedicated scene creation/editing dialog
  - Handles journal image/actor extraction
  - Drag and drop support for actors
  - Speaker list management with add/remove
- **New Stylesheet**: `styles/speaker-wheel.css`
  - Radial item positioning and animations
  - Active speaker styling with golden accents
  - Scene item styling with green theme
  - Split button layout for back/clear
  - Responsive scaling for small screens
- **New Stylesheet**: `styles/scene-editor.css`
  - Modal dialog with backdrop
  - Grid layout for source items
  - Speaker list with inline remove buttons
  - Drag and drop visual feedback
- **Memory Management**
  - Persistent mousemove listener (intentional, not a leak)
  - Session-scoped scene memory
  - Per-session wheel position tracking

## [1.5.0] - 2026-02-04

### Internal - Comprehensive Codebase Refactoring

This release focuses entirely on internal code organization and architecture improvements. **No user-facing changes** - all functionality remains identical and fully backward compatible.

#### Phase 1: Foundation Setup

- **Added** `scripts/constants.mjs` - Centralized all module constants (MODULE_ID, LIMITS, SELECTORS)
- **Added** `scripts/utils/` - Shared utility modules:
  - `element-utils.mjs` - DOM element extraction and manipulation
  - `validation-utils.mjs` - Window position validation
  - `dom-utils.mjs` - DOM query helpers
- **Eliminated** ~90 lines of duplicate code across 9 files

#### Phase 2: Hook Consolidation

- **Added** `scripts/hooks/journal-hooks.mjs` - Unified journal sheet handlers
- **Added** `scripts/hooks/player-viewer-hooks.mjs` - Player viewer lifecycle handlers
- **Refactored** storyframe.mjs from 639 to 355 lines (44% reduction)
- **Eliminated** ~283 lines of duplicated hook code
- **Consolidated** 5 duplicate hooks into 2 unified handlers

#### Phase 3: State Management Refactoring

- **Added** domain-specific managers in `scripts/state/`:
  - `speaker-manager.mjs` - Speaker operations
  - `participant-manager.mjs` - Participant operations
  - `roll-tracker.mjs` - Roll tracking and history
  - `challenge-manager.mjs` - Challenge management
  - `persistence.mjs` - State persistence and migrations
- **Refactored** StateManager to orchestrator/facade pattern
- **Reduced** state-manager.mjs from 556 to 272 lines (51% reduction)
- **Improved** separation of concerns and testability

#### Phase 4: GM Sidebar Modularization

- **Reorganized** sidebar into `scripts/applications/gm-sidebar/` directory
- **Added** 7 specialized handler modules (3,297 lines):
  - `managers/speaker-handlers.mjs` (398 lines)
  - `managers/participant-handlers.mjs` (270 lines)
  - `managers/skill-check-handlers.mjs` (783 lines)
  - `managers/challenge-handlers.mjs` (484 lines)
  - `managers/journal-handlers.mjs` (326 lines)
  - `managers/dc-handlers.mjs` (263 lines)
  - `managers/ui-helpers.mjs` (773 lines)
- **Refactored** GMSidebarAppBase to composition/delegation pattern
- **Reduced** main sidebar from ~5,000 to 819 lines (84% reduction!)
- **Net reduction** of ~4,080 lines while improving organization

#### Phase 5: System Code Consolidation

- **Organized** system-specific data into `scripts/system/`:
  - `pf2e/skills.mjs`, `pf2e/actions.mjs`, `pf2e/dc-tables.mjs`
  - `dnd5e/skills.mjs`, `dnd5e/dc-tables.mjs`
- **Refactored** system-adapter.mjs to facade pattern
- **Reduced** system-adapter.mjs from 401 to 148 lines (63% reduction)
- **Eliminated** duplicate system data across multiple files
- **Improved** extensibility for adding new game systems

#### Documentation

- **Added** ARCHITECTURE.md - Comprehensive architecture documentation
- **Added** REFACTORING_PLAN.md - Detailed refactoring plan and approach
- **Updated** CHANGELOG.md - This file

#### Overall Impact

- **~5,000 lines eliminated** through deduplication and reorganization
- **23 new focused modules created** from monolithic files
- **100% backward compatible** - no breaking changes
- **Improved maintainability** - clear separation of concerns
- **Enhanced testability** - isolated, focused modules
- **Better organization** - logical directory structure
- **Zero user-facing changes** - all functionality identical

### Technical Debt Eliminated

- Removed 145+ lines of duplicate journal hook code
- Removed 400+ lines of duplicate state management code
- Removed 4,000+ lines of duplicate sidebar code
- Removed 250+ lines of duplicate system data
- Centralized all magic numbers and strings into constants

### Developer Experience Improvements

- Clear module boundaries for easier navigation
- Single responsibility per file
- Consistent patterns (facade, delegation, composition)
- Easy to extend with new features
- Ready for unit testing
- Self-documenting architecture

## [1.4.0] - 2026-02-01

### Added

- **GM Sidebar Tabbed Layout** - Reorganized into three dedicated tabs
  - NPCs tab: Speaker gallery with journal images and actors
  - PCs tab: Participant management with skill buttons and DC controls
  - Challenges tab: Challenge library with create and present options
  - Cleaner navigation, focused content per tab
  - Auto-hide empty sections, show only relevant controls
- **Player Sidebar Tabbed Layout** - Separate tabs for challenges and rolls
  - Challenge tab: Active challenge with skill options grid
  - Rolls tab: Pending rolls grouped by actor
  - Keyboard shortcuts (1-9) for quick roll execution
  - Tab key to switch between tabs, Escape to close
  - Auto-switch to rolls tab when no challenge active

### Changed

- **GM Sidebar PC Grid** - Made sticky like DC and level controls
  - PC grid now in sticky controls bar for constant visibility
  - Removed selected avatars display section
  - Replaced with simple "Select All/Deselect" button
  - Cleaner, more compact layout
- **DC Controls Layout** - Level and difficulty selector moved to same row as secret button
  - Single row for all controls: Select All, DC input, Level/Difficulty, Secret
  - More compact, efficient use of space

### Fixed

- **Challenge Skill Rolls** - Allow optional DC values
  - Skills in challenges no longer require DC to be set
  - Validation now only requires skill, DC is optional
  - Fixes "Invalid skill or DC" error for challenges without DC
- **Challenge Keyboard Hints** - Fixed positioning on skill buttons
  - Added `position: relative` to challenge buttons
  - Keyboard hints now appear on buttons instead of challenge title

  ### Player Sidebar System (Major Refactor)

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

### Create Challenge from Selection

- **Quick Create** - Magic wand button in Challenges section
- **Text Selection** - Select journal text with skill checks
- **Auto-Parse** - Extracts all inline checks from HTML
- **Name Prompt** - Dialog to name the challenge
- **Auto-Save** - Saves directly to challenge library
- **Clean Descriptions** - Removes DC text patterns
- **Skill Mapping** - Converts full names to proper slugs

### Journal Check Features

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

### Performance & Rendering

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

### Skill System Fixes

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

### Pending Roll Management

- **Secret Roll Cleanup** - Automatic removal for blind rolls
  - Regular rolls: Stay on cancel (retry)
  - Secret rolls: Remove when action fails/returns null
  - Successful rolls: Always removed
- **Action Fallback** - Failed actions fall back to basic roll
  - Ensures roll always executes
  - Pending roll always gets submitted/removed
  - Better reliability for Seek, Demoralize, etc.

### Layout & Positioning

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

### Bug Fixes

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

### Size & Spacing Adjustments

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

### Visual Refinements

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

- Custom speaker sorting and filtering
- Integration with other narrative modules

---
