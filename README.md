[![Latest Version](https://img.shields.io/github/v/release/roi007leaf/storyframe?display_name=tag&sort=semver&label=Latest%20Version)](https://github.com/roi007leaf/storyframe/releases/latest)
[![GitHub all releases](https://img.shields.io/github/downloads/roi007leaf/storyframe/total)](https://github.com/roi007leaf/storyframe/releases)
[![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fstoryframe)](https://forge-vtt.com/bazaar)

# StoryFrame

A FoundryVTT module that enhances narrative gameplay and skill check coordination. StoryFrame provides GMs with intelligent tools for managing speakers and coordinating skill checks, while players receive synchronized displays showing active NPCs, pending rolls, and multi-option challenges.

**Supports Pathfinder 2e and D&D 5e** with system-specific features including proficiency levels, actions, DC tables, and lore skills.

## 📚 Documentation

**[📖 Full Wiki Documentation](https://github.com/roi007leaf/storyframe/wiki)**

Quick Links:
- [Installation Guide](https://github.com/roi007leaf/storyframe/wiki/Installation)
- [Quick Start Guide](https://github.com/roi007leaf/storyframe/wiki/Quick-Start-Guide)
- [GM Guide](https://github.com/roi007leaf/storyframe/wiki/GM-Guide)
- [Player Guide](https://github.com/roi007leaf/storyframe/wiki/Player-Guide)
- [Troubleshooting](https://github.com/roi007leaf/storyframe/wiki/Troubleshooting)
- [FAQ](https://github.com/roi007leaf/storyframe/wiki/FAQ)

## ✨ Features Overview

### 🎭 Speaker Management

**For GMs:**
- **Smart NPC Detection** - Automatically detects NPCs from journal images and actor references
- **Multiple Add Methods** - Drag & drop actors, click journal actors/images, or manual entry
- **Active Speaker Selection** - Click portraits to highlight active speaker for all players
- **Edit Speaker Names** - Hover over speaker to reveal edit button, click to rename
- **Speaker Wheel** - Radial quick-selection menu (keybind) for rapid speaker switching
- **Scene Management** - Save and load speaker configurations for recurring locations/NPCs
- **Quick Scene Updates** - Update saved scenes with current speakers via sync button

**For Players:**
- **Synchronized Gallery** - See all NPCs with active speaker highlighted in real-time
- **Auto-Open** - Player Viewer opens automatically when GM sends content
- **Layout Options** - Grid, list, or horizontal display modes

[📖 Speaker Management Documentation](https://github.com/roi007leaf/storyframe/wiki/Speaker-Management)

### 🎲 Skill Check & Saving Throw Coordination

**For GMs:**
- **PC Management** - Add all PCs, party members, or individuals
- **Batch Operations** - Select multiple PCs and request multiple checks/saves at once
- **Allow Only One** - Option to let players choose only one check from a batched group
- **DC Management**:
  - Manual DC entry (1-60)
  - DC Presets - Save frequently-used DCs
  - System DC Tables - Auto-calculated difficulty based on party level
- **Secret Rolls** - GM-only results for Perception, Insight, Stealth checks
- **Quick Buttons** - Customizable quick-access buttons for common skills and saves
- **Skill Categories** - Physical, Magical, Social, Utility
- **Saving Throws** - Request saves with orange accent theme (PF2e: Fort/Ref/Will, D&D 5e: All abilities)
- **Journal Parsing** - Select text with skill checks and auto-request rolls (keybind)

**For Players:**
- **Player Sidebar** - Dedicated panel for pending roll requests
- **One-Click Rolls** - Click to execute checks directly from sidebar
- **Persistent Requests** - Rolls persist until completed, no dialogs blocking
- **Multi-PC Support** - See all pending rolls when controlling multiple characters

[📖 Skill Checks Documentation](https://github.com/roi007leaf/storyframe/wiki/Skill-Checks)

### 🏆 Challenge System

Create multi-option challenges where players choose their approach:

**Features:**
- **Multiple Options** - 2-4 different approaches per challenge (climb, sneak, persuade, etc.)
- **Skills & Saves** - Each option can require different skills or saving throws at different DCs
- **Proficiency Requirements** (PF2e) - Lock options requiring Trained/Expert/Master/Legendary
- **Challenge Library** - Save challenges for reuse
- **Auto-Creation** - Create challenges from selected journal text (keybind)
- **Visual Interface** - Players see all options and choose their approach
- **Save Only Button** - Save challenges to library without presenting immediately

**Example Challenge:**
```
"Infiltrate the Castle"
Option 1: Climb the Wall - Athletics DC 15
Option 2: Pick the Lock - Sleight of Hand DC 18, Investigation DC 15
Option 3: Bluff Past Guards - Deception DC 16, Persuasion DC 14
Option 4: Resist Charm - Will Save DC 18 (saving throw option)
```

[📖 Challenge System Documentation](https://github.com/roi007leaf/storyframe/wiki/Challenge-System)

### 💾 Scene Management

Save speaker configurations for quick loading:
- **Save Current Speakers** - One-click save of current NPC gallery
- **Scene Editor** - Visual editor for building speaker scenes
- **Quick Loading** - Click scene name to instantly load all speakers
- **Quick Updates** - Update saved scenes with current speakers via sync button
- **Perfect for**: Recurring taverns, councils, shops, party groups

[📖 Scene Editor Documentation](https://github.com/roi007leaf/storyframe/wiki/Scene-Editor)

### ⚡ Speaker Wheel

Radial quick-selection for rapid speaker switching:
- Hold keybind to show wheel
- Move mouse toward speaker portrait
- Release to select
- Perfect for fast-paced dialogue and dramatic moments

[📖 Speaker Wheel Documentation](https://github.com/roi007leaf/storyframe/wiki/Speaker-Wheel)

## 🎮 System Support

### Pathfinder 2e

- **Skills**: All 17 standard skills + custom lore skills
- **Saving Throws**: Fortitude, Reflex, Will with orange accent theme
- **Actions**: Right-click skills for specific actions (Demoralize, Seek, Recall Knowledge, etc.)
- **Proficiency System**: Untrained, Trained, Expert, Master, Legendary
- **DC Tables**: Level-based DCs (0-25) with difficulty modifiers (Trivial to Extreme)
- **Degree of Success**: Critical success/success/failure/critical failure
- **Lore Skills**: Full support for character-specific lore (Academia Lore, Warfare Lore, etc.)
- **Party Integration**: One-click to add all party members

[📖 PF2e Documentation](https://github.com/roi007leaf/storyframe/wiki/PF2e-Support)

### D&D 5e

- **Skills**: All 18 standard skills
- **Ability Saves**: Strength Save, Dexterity Save, etc.
- **DC Tables**: Very Easy (5) to Nearly Impossible (30)
- **Proficiency**: Proficient/Expertise (basic support)
- **Advantage/Disadvantage**: Applied via standard roll dialog

[📖 D&D 5e Documentation](https://github.com/roi007leaf/storyframe/wiki/DnD5e-Support)

## 📋 Requirements

- **FoundryVTT**: Version 13 or higher
- **Required Module**: [socketlib](https://foundryvtt.com/packages/socketlib)
- **Supported Systems**: D&D 5e or Pathfinder 2e

## 🚀 Installation

### From Module Browser (Recommended)

1. In FoundryVTT, go to **Add-on Modules** > **Install Module**
2. Search for "**StoryFrame**"
3. Click **Install**
4. Enable in your world settings

### From Manifest URL

```
https://github.com/roi007leaf/storyframe/releases/latest/download/module.json
```

[📖 Detailed Installation Guide](https://github.com/roi007leaf/storyframe/wiki/Installation)

## 🎯 Quick Start

### For Game Masters

1. **Open GM Sidebar**
   - Open any journal entry
   - Click the StoryFrame toggle button
   - Sidebar appears docked to journal

2. **Add Speakers**
   - Drag actors from Actors sidebar
   - Click journal actors/images
   - Or use "Add NPC" button

3. **Select Active Speaker**
   - Click any portrait to set as active
   - All players see highlighted speaker

4. **Request Skill Checks** (Optional)
   - Add PCs to participant list
   - Select which PCs should roll
   - Set DC and click skill button

[📖 Full Quick Start Guide](https://github.com/roi007leaf/storyframe/wiki/Quick-Start-Guide)

### For Players

1. **Open Player Viewer**
   - Click StoryFrame button in token controls
   - Or wait for auto-open when GM sends content

2. **View Active Speaker**
   - See all NPCs in gallery
   - Active speaker is highlighted

3. **Respond to Skill Checks**
   - Pending rolls appear in Player Sidebar
   - Click to roll
   - Request clears after rolling

[📖 Full Player Guide](https://github.com/roi007leaf/storyframe/wiki/Player-Guide)

## ⌨️ Keybinds

Configure in FoundryVTT Settings > Configure Controls > Module Keybindings:

- **Speaker Selection Wheel** - Hold to show radial speaker menu
- **Request Rolls from Selection** - Parse journal text and request rolls
- **Create Challenge from Selection** - Auto-create challenge from journal checks

## 🎨 Interface Overview

### GM Sidebar (Docks to Journals)

**Tabs:**
- **NPCs** - Speaker gallery and active speaker selection
- **PCs** - Participant management and skill check requests
- **Rolls** - Monitor pending roll requests
- **Challenges** - View and manage active challenges

**Sections:**
- Journal Images - Click images to add as speakers
- Journal Actors - Click actor references to add
- Saved Scenes - Quick-load saved speaker groups
- DC Presets - Saved difficulty configurations
- Challenge Library - Reusable challenges

### Player Viewer (Auto-Opens)

**Main Area:**
- Speaker gallery with active speaker highlighted
- Layout toggle (grid/list/horizontal)

**Player Sidebar:**
- Pending roll requests
- Active challenges with multiple options
- Grouped by character (if controlling multiple)

## 🔧 Technical Details

### Architecture

- **System-Specific Implementations**: Dedicated subclasses for PF2e and D&D 5e
- **Real-Time Sync**: socketlib-based communication for instant updates
- **Scene Flags**: State stored in scene flags for persistence
- **ApplicationV2**: Modern Foundry application architecture

### State Management

- **Per-Scene**: Speakers and participants stored per Foundry scene
- **World Settings**: DC presets, challenge library, saved scenes
- **Client Settings**: UI positions, layouts, preferences

## 🤝 Contributing

Contributions welcome! See the [GitHub repository](https://github.com/roi007leaf/storyframe) for:
- Feature requests
- Bug reports
- Pull requests

## 🐛 Troubleshooting

**Module won't enable?**
- Enable **socketlib** first (required dependency)
- Verify FoundryVTT v13+

**Players not seeing updates?**
- Check socketlib is enabled on both ends
- Verify network connection

**Speaker Wheel not working?**
- Configure keybind in settings
- Must **hold** key, not tap
- Need at least one speaker added

[📖 Full Troubleshooting Guide](https://github.com/roi007leaf/storyframe/wiki/Troubleshooting)

## ❓ FAQ

**Q: Does StoryFrame work with other systems?**
A: Currently only D&D 5e and PF2e have full support. Basic speaker functionality may work with other systems.

**Q: Can I use StoryFrame with Theatre Inserts or ConversationHUD?**
A: Not recommended - may conflict. Test in separate world first.

**Q: Is the Player Viewer required?**
A: No, it's optional. Players can ignore it and just use character sheets normally.

**Q: Can I save speaker groups for recurring NPCs?**
A: Yes! Use the Scene Editor to save and load speaker configurations.

[📖 Full FAQ](https://github.com/roi007leaf/storyframe/wiki/FAQ)

## 📦 Version

Current Version: **1.7.2**

See [Releases](https://github.com/roi007leaf/storyframe/releases) for changelog.

## 📄 License

See repository for license details.

## 👤 Author

**RoiLeaf**

## 🔗 Links

- [Wiki Documentation](https://github.com/roi007leaf/storyframe/wiki)
- [GitHub Repository](https://github.com/roi007leaf/storyframe)
- [Issue Tracker](https://github.com/roi007leaf/storyframe/issues)
- [Releases](https://github.com/roi007leaf/storyframe/releases)

---

**Enhance your storytelling with StoryFrame!** 🎭
