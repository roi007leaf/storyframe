# StoryFrame

A Foundry VTT module that enhances narrative gameplay by providing GMs with a dedicated journal reader and synchronized speaker portraits for players.

## Features

### GM Interface

- **Integrated Journal Reader** - Browse and read journal entries without leaving your workflow
- **Page Navigation** - Quick access to all pages with search filtering
- **Folder Organization** - Journals organized in a collapsible folder tree
- **Favorites System** - Star frequently-used journals for quick access
- **System Theme Support** - Automatically applies styling from PF2e premium modules (Beginner Box, Abomination Vaults, etc.)
- **In-Place Editing** - Open journal pages for editing directly from the interface

### GM Sidebar (Character Panel)

- **NPC Speaker Gallery** - Drag actors or images to add NPCs as speakers
- **Active Speaker Selection** - Click to set which NPC is currently speaking (highlighted for players)
- **PC Participant Management** - Add player characters for skill check coordination
- **Skill Check Requests** - Request skill checks from selected PCs with one click
- **Configurable Quick Skills** - Customize which skill buttons appear for fast access
- **DC by Level** - Automatic DC calculation based on party level with difficulty adjustments (PF2e)
- **Action Support** - Right-click skills to request specific actions (Demoralize, Seek, etc.)

### Player Viewer

- **Synchronized Portraits** - See all NPCs the GM has added, with the active speaker highlighted
- **Multiple Layouts** - Grid, list, or horizontal layout options
- **Skill Check Prompts** - Receive and respond to GM skill check requests
- **PF2e Action Integration** - Execute full PF2e actions with proper dialogs and targeting
- **Image Enlargement** - Right-click portraits to view full-size images

### Technical Features

- **Real-time Synchronization** - All changes sync instantly via socketlib
- **Per-Scene State** - Speaker lists persist per scene
- **Position Memory** - Windows remember their position and size
- **Keyboard Shortcut** - `Ctrl+Shift+S` toggles StoryFrame visibility

## Requirements

- Foundry VTT v13+
- [socketlib](https://foundryvtt.com/packages/socketlib) module

## Installation

1. In Foundry VTT, go to **Add-on Modules** > **Install Module**
2. Search for "StoryFrame" or paste this manifest URL:
   ```
   https://github.com/[author]/storyframe/releases/latest/download/module.json
   ```
3. Enable the module in your world

## Usage

### Opening StoryFrame

- Click the book icon in the token controls toolbar
- Or press `Ctrl+Shift+S`

### Adding NPCs (GM)

1. Open the GM Sidebar (appears alongside the main interface)
2. Drag an actor from the sidebar onto the NPC gallery
3. Or click the **+** button to add an image file as a custom NPC

### Setting the Active Speaker (GM)

- Click on any NPC portrait in the sidebar to set them as the active speaker
- Players will see this NPC highlighted in their viewer

### Adding PCs for Skill Checks (GM)

1. Expand the PCs panel in the sidebar
2. Click **Add All PCs** or drag individual character actors
3. Select PCs by clicking their portraits (checkmark appears)

### Requesting Skill Checks (GM)

1. Select one or more PCs
2. Set the DC using the difficulty selector or manual input
3. Click a skill button to request that check
4. Right-click a skill button to choose a specific action

### Responding to Skill Checks (Player)

1. When the GM requests a check, a prompt appears in your StoryFrame viewer
2. Click the **Roll** button to execute the check
3. The PF2e system dialog will open for any additional choices

## Configuration

### Quick Skill Buttons

Click the gear icon next to the skill buttons to customize which skills appear as quick-access buttons.

### Debug Mode

Enable debug logging in module settings for troubleshooting.

## Compatibility

- **Foundry VTT**: v13+
- **Game Systems**: Designed for PF2e, basic functionality works with any system
- **Premium Modules**: Automatically detects and applies styling from PF2e premium content modules

## License

MIT License

## Author

RoiLeaf

## Support

For bug reports and feature requests, please open an issue on the [GitHub repository](https://github.com/[author]/storyframe/issues).
