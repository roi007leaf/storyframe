[![Latest Version](https://img.shields.io/github/v/release/roi007leaf/storyframe?display_name=tag&sort=semver&label=Latest%20Version)](https://github.com/roi007leaf/storyframe/releases/latest)

[![GitHub all releases](https://img.shields.io/github/downloads/roi007leaf/storyframe/total)](https://github.com/roi007leaf/storyframe/releases)

[![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fstoryframe)](https://forge-vtt.com/bazaar)

# StoryFrame

A Foundry VTT module that enhances narrative gameplay by providing GMs with an intelligent sidebar for managing NPCs and coordinating skill checks directly from journal entries. Synchronized speaker portraits for players create immersive storytelling. Supports both **Pathfinder 2e** and **D&D 5e** with system-specific features.

## Features

### GM Sidebar

The GM Sidebar attaches to the side of journal sheets, providing context-aware tools:

**NPC Management**

- **Smart NPC Detection** - Automatically finds NPCs in your journal content:
  - Journal images appear as clickable thumbnails (click to add as NPC)
  - Actor references (@Actor[id]{name}) auto-populate from journal text
  - Drag & drop actors directly from Foundry sidebar
  - Manual image upload via + button
- **Active Speaker** - Click any NPC to set as active speaker (highlights for all players)
- **Quick Actions** - Right-click portraits for full-screen view
- **Auto-filtering** - Already-added NPCs, loot, and hazards filtered from suggestions

**PC & Skill Checks**

- **PC Management** - Add player characters via party button or individual selection
- **Skill Check Coordination** - Select PCs, set DC, click skill to request checks
- **Secret Rolls** - Toggle secret checkbox for GM-only rolls (Stealth, Investigation, etc.)
- **Configurable Skills** - Customize which skill buttons appear (three-dots menu or gear icon)
- **DC Presets Manager** - Save and manage common DC configurations
- **System-Specific DCs**:
  - **PF2e**: Level-based DCs (0-25) with difficulty modifiers (Trivial to Extreme)
  - **D&D 5e**: Difficulty-based DCs (Very Easy to Nearly Impossible)
- **Action Support (PF2e)** - Right-click skills for specific actions (Demoralize, Seek, etc.)

### Player Viewer

- **Synchronized NPC Gallery** - All GM-added NPCs appear with active speaker highlighted
- **Rolls Sidebar** - Dedicated sidebar for pending skill checks (similar to GM view):
  - Grouped by actor when controlling multiple PCs
  - Always visible - no popups or dialogs needed
  - One-click roll buttons for quick responses
  - Shows skill name, DC, and actor avatar
  - Rolls persist until completed (cancelling dialog keeps request active)
- **System Integration**:
  - **PF2e**: Action dialogs with modifiers, degree of success, and lore skills
  - **D&D 5e**: Skill checks respecting Challenge Visibility settings
- **Multi-PC Support** - Players controlling multiple characters see all pending rolls
- **Full-screen View** - Right-click any portrait to enlarge

### Technical

- **Real-time Sync** - All changes broadcast instantly via socketlib
- **Per-Scene State** - NPC and PC lists saved per scene
- **Auto-positioning** - Sidebar docks to journal sheets automatically
- **Keyboard Shortcut** - `Ctrl+Shift+S` toggles player viewer

## Requirements

- Foundry VTT v13+
- [socketlib](https://foundryvtt.com/packages/socketlib) module

## Installation

1. In Foundry VTT, go to **Add-on Modules** > **Install Module**
2. Search for "StoryFrame"
3. Enable the module in your world

## Usage

### Getting Started (GM)

1. **Open a Journal Entry** - StoryFrame sidebar appears automatically on the right
2. **Add NPCs** - The sidebar detects content from your journal:
   - **Journal Images**: Click any image thumbnail to add as NPC
   - **Actor References**: Click any @Actor mention to add as speaker
   - **Drag & Drop**: Drag actor from sidebar onto NPC gallery
   - **Manual**: Click + button to upload custom image
3. **Set Active Speaker** - Click any NPC portrait to highlight for players

### Managing NPCs

- **View Full-screen**: Right-click any NPC portrait
- **Remove NPC**: Click X button on portrait (hover to reveal)
- **Clear All**: Use trash icon in NPCs section header
- **Active Speaker**: Highlighted with blue border, synced to all players

### Skill Checks (GM)

1. **Add PCs**: Click user-group icon or drag PC actors to PCs section
2. **Select Participants**: Click PC portraits (checkmark shows selection)
3. **Set DC**:
   - Use difficulty dropdown (PF2e: by level, D&D 5e: by difficulty)
   - Or use DC Presets Manager for saved configurations
4. **Optional - Secret Roll**: Check "Secret" for GM-only results (e.g., Stealth, Perception)
5. **Request Check**: Click skill button (or right-click for PF2e actions)
   - Three-dots menu shows all available skills
   - Gear icon customizes which skills appear as quick buttons

### For Players

1. **View NPCs**: Press `Ctrl+Shift+S` to open StoryFrame viewer
   - Main area: NPC gallery with active speaker highlighted
   - Right sidebar: Pending skill check requests (when present)
2. **Active Speaker**: Highlighted NPC shows who's currently speaking
3. **Skill Checks**:
   - Pending rolls appear in right sidebar grouped by character
   - Click dice icon to open roll dialog
   - Complete the roll to remove from pending list
   - Cancelling roll dialog keeps request active for later
4. **Multiple Characters**: If controlling multiple PCs, see all roll requests organized by character
5. **Enlarge Portraits**: Right-click any NPC for full-screen view

## Configuration

- **Quick Skills**: Click gear icon next to skill buttons to customize visible skills
- **DC Presets**: Manage saved DC configurations via DC Presets Manager button
- **Player Viewer**:
  - Players toggle with `Ctrl+Shift+S`
  - GM opens for all: Click TV icon
  - GM closes for all: Right-click TV icon

## Architecture

StoryFrame uses system-specific implementations for deep integration:
- **GMSidebarAppPF2e** - PF2e inline checks, lore skills, party actors, level-based DCs
- **GMSidebarAppDND5e** - D&D 5e roll-link-group checks/saves, DC evaluation
- **PlayerViewerApp** - Consistent sidebar design with rolls grouped by actor
- **SystemAdapter** - Centralized system detection, skill/DC configurations
- **SocketManager** - Real-time sync of speakers, participants, and roll requests

## Compatibility

**Foundry VTT**: v13+
**Required Module**: [socketlib](https://foundryvtt.com/packages/socketlib)

**Game Systems**:

- **Pathfinder 2e**: Native support via dedicated PF2e subclass
- **D&D 5e**: Native support via dedicated D&D 5e subclass
- **Other Systems**: Basic NPC speaker functionality

## System-Specific Features

### Pathfinder 2e

- **Skill Actions**: Right-click skills for actions (Seek, Demoralize, Recall Knowledge, etc.)
- **Level-based DCs**: Auto-calculated DCs for party level 0-25
- **Difficulty Modifiers**: Trivial (-10) to Extreme (+10)
- **Degree of Success**: Critical success/success/failure/critical failure
- **Lore Skills**: Full support for character-specific lore skills
  - Automatically detects lore skills (e.g., Cooking Lore, Warfare Lore)
  - Shows in quick skill buttons when single PC selected
  - Available in "All Skills" menu
  - Properly displays in roll requests with formatted names
- **Party Integration**: One-click to add all party members as participants

### D&D 5e

- **18 Skills**: All standard D&D 5e skills supported
- **Difficulty Tiers**: Very Easy (5) to Nearly Impossible (30)
- **Challenge Visibility**: Respects system DC visibility settings
- **Simple Rolls**: Streamlined skill check workflow

## Author

RoiLeaf
