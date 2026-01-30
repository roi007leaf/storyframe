# StoryFrame

A Foundry VTT module that enhances narrative gameplay by providing GMs with a dedicated journal reader and synchronized speaker portraits for players. Supports both **Pathfinder 2e** and **D&D 5e** with system-specific features.

## Features

### GM Interface

- **Integrated Journal Reader** - Browse and read journal entries without leaving your workflow
- **Rich Text Editor** - Edit journal pages inline with Quill.js WYSIWYG editor
- **Page Navigation** - Quick access to all pages with search filtering and prev/next buttons
- **History Navigation** - Back/forward buttons for navigating through journal links
- **Folder Organization** - Journals organized in a collapsible folder tree
- **Favorites System** - Star frequently-used journals for quick access
- **System Theme Support** - Automatically applies styling from PF2e premium modules (Beginner Box, Abomination Vaults, etc.)
- **Unsaved Changes Protection** - Warns before losing unsaved edits when navigating

### GM Sidebar (Character Panel)

- **NPC Speaker Gallery** - Drag actors or images to add NPCs as speakers
- **Active Speaker Selection** - Click to set which NPC is currently speaking (highlighted for players)
- **PC Participant Management** - Add player characters for skill check coordination
- **Skill Check Requests** - Request skill checks from selected PCs with one click
- **Configurable Quick Skills** - Customize which skill buttons appear for fast access
- **System-Specific DC Settings**:
  - **PF2e**: Automatic DC calculation based on party level with difficulty adjustments (Trivial to Extreme)
  - **D&D 5e**: Difficulty-based DCs (Very Easy to Nearly Impossible) with Challenge Visibility support
- **Action Support (PF2e)** - Right-click skills to request specific actions (Demoralize, Seek, etc.)

### Player Viewer

- **Synchronized Portraits** - See all NPCs the GM has added, with the active speaker highlighted
- **Multiple Layouts** - Grid, list, or horizontal layout options
- **Skill Check Prompts** - Receive and respond to GM skill check requests
- **System-Specific Roll Integration**:
  - **PF2e**: Full action support with degree of success tracking
  - **D&D 5e**: Skill checks with proper Challenge Visibility settings
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

### Editing Journal Pages (GM)

1. Navigate to the page you want to edit
2. Click the **Edit** button (pencil icon) in the header
3. Make your changes in the Quill.js rich text editor with formatting toolbar
4. Click **Save** to save changes, or **Cancel** to discard
5. Use `Ctrl+S` as a keyboard shortcut to save

The editor will warn you if you try to navigate away with unsaved changes. Alternatively, click the **Open in Foundry Editor** button to edit in Foundry's native journal editor.

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
2. Review the requested skill and DC (if visible based on system settings)
3. Click the **Roll** button to execute the check
4. The system roll dialog will open:
   - **PF2e**: Full action dialog with options and modifiers
   - **D&D 5e**: Skill check dialog with DC visible based on Challenge Visibility setting

## Configuration

### Quick Skill Buttons

Click the gear icon next to the skill buttons to customize which skills appear as quick-access buttons.

### Debug Mode

Enable debug logging in module settings for troubleshooting.

## Compatibility

- **Foundry VTT**: v13+
- **Game Systems**:
  - **Pathfinder 2e (PF2e)**: Full support with actions, degree of success, and level-based DCs
  - **D&D 5th Edition (D&D 5e)**: Full support with skill checks and Challenge Visibility integration
  - **Other Systems**: Basic journal reader and speaker functionality
- **Premium Modules**: Automatically detects and applies styling from PF2e premium content modules

## System-Specific Features

### Pathfinder 2e
- **Skill Actions**: Right-click skills to choose specific actions (Seek, Demoralize, Recall Knowledge, etc.)
- **DC by Level**: Automatic DC calculation based on party level (Level 0-25)
- **Difficulty Adjustments**: Trivial, Low, Standard, High, Extreme modifiers
- **Degree of Success**: Full support for critical success/success/failure/critical failure
- **Metagame Settings**: Respects PF2e's DC visibility settings

### D&D 5e
- **Skill Checks**: All 18 standard D&D 5e skills
- **Difficulty DCs**: Very Easy (5), Easy (10), Medium (15), Hard (20), Very Hard (25), Nearly Impossible (30)
- **Challenge Visibility**: Respects D&D 5e's Challenge Visibility system setting
  - **All**: Players see DCs in roll requests and chat
  - **GM**: Only GM sees DCs
  - **None**: DCs hidden from chat (players still see in roll request UI)
- **Simple Skill Rolls**: Direct skill checks without action complexity

## License

MIT License

## Author

RoiLeaf

## Support

For bug reports and feature requests, please open an issue on the [GitHub repository](https://github.com/[author]/storyframe/issues).
