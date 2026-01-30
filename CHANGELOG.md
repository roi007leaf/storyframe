# Changelog

All notable changes to StoryFrame will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
