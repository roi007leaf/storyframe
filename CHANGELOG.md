# Changelog

<!-- markdownlint-disable MD024 -->

All notable changes to StoryFrame will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.4.0] - 2026-03-01

### Added

- **Save playlist & background per scene** — floppy disk icon on each scene in the cinematic left panel saves the currently playing playlist and cinematic background; loading that scene restores both automatically
- **Save scene from cinematic** — plus button in the cinematic left panel's Speaker Scenes header opens the scene editor to save current speakers as a new scene
- **Cinematic close fade-out** — closing the cinematic scene now plays a 1-second fade-to-black animation instead of disappearing instantly
- **Music fade-out on cinematic close** — all playing playlists gradually fade to silence during the close animation using Foundry's Sound.fade() API

### Fixed

- **Music continues after closing cinematic** — all playing playlists are now stopped when the cinematic scene closes
- **Scene list not updating after save** — cinematic left panel now listens for `speakerScenes` setting changes and re-renders automatically

## [2.3.4] - 2026-02-28

### Fixed

- **Cinematic chat log flicker during rolls** — state changes from rolls falsely triggered full re-renders because speaker change detection compared mutable properties (label, imagePath) that differ between scene-flag reads and socket broadcasts; structural changes now only compare speaker IDs, and property changes (name/image edits) use targeted DOM patching instead of full re-renders
- **Chat scroll position lost during re-renders** — browsers reset scrollTop when DOM nodes are replaced; now preserves and restores scroll position across ApplicationV2 re-renders
- **Dice So Nice roll cards flashing empty then full** — initial render during DSN animation showed hidden content; now defers chat append until `diceSoNiceRollComplete` fires
- **Camera feed label format** — camera name tags now show `PlayerName\CharacterName` instead of just the username
- **Camera feeds not visible on GM side** — relaxed WebRTC video track check and added event listeners for remote streams
- **Deprecated `getHTML()` API** — migrated cinematic chat rendering to use `renderHTML()` where available for Foundry v13 compatibility
- **Save-type pending rolls missing orange accent on player side** — added `data-check-type` attribute to player roll buttons so the existing CSS styling applies

## [2.3.3] - 2026-02-28

### Fixed

- **Cinematic chat log not updating after rolls** — chat hook callbacks closed over a specific DOM element that became stale after re-renders; now looks up the current container each time
- **Deprecated global TextEditor warning** — migrated `TextEditor.enrichHTML` and `TextEditor.getDragEventData` to the v13 namespaced `foundry.applications.ux.TextEditor.implementation`

## [2.3.2] - 2026-02-28

### Fixed

- **Cinematic popups hidden behind overlay** — DC preset dropdown, skill actions menu, and other body-level popups now render inside the cinematic `<dialog>` so they appear above the top-layer overlay
- **File picker hidden behind cinematic overlay** — added z-index override for the Foundry file picker during cinematic mode
- **getComputedStyle crash on preset dropdown** — fixed TypeError when opening the DC preset popup from cinematic mode (proxy element is not a DOM Element)
- **Speaker name editing ignored for actor-backed speakers** — editing a speaker's name now correctly uses the custom label instead of always falling back to the actor's original name, in both the GM sidebar and cinematic scene
- **Cinematic scene not updating on speaker rename** — added `label` to the speaker change-detection key so name edits trigger a re-render

## [2.3.1] - 2026-02-27

### Improved

- **Unified bottom row** — camera feeds and PC portrait buttons now share a single row; players with active cameras show their video feed, players without show a clickable PC portrait
- **PC portraits vertically centered** — smaller PC portrait buttons align to the middle of camera feeds for a cleaner mixed layout
- **Auto-hide sidebars in cinematic mode** — Foundry's sidebar and StoryFrame's own GM/player sidebar automatically close when entering cinematic mode and restore when exiting
- **Add Speakers Hidden setting** — new module setting that makes newly added NPC speakers start hidden from players by default

### Fixed

- **Filmstrip overlap with bottom row** — fixed CSS specificity bug where the filmstrip reserve calculation used the PC-only height (60px) instead of the camera feed height when both were present
- **Player PC row not showing** — tightened the A/V active check to require actual live video tracks, so the PC row appears when A/V integration is enabled but no cameras are on
- **D&D 5e roll dialog behind cinematic overlay** — roll configuration dialogs (`<dialog>` elements) now correctly appear above the cinematic scene
- **Oversized chat avatars in cinematic chat** — D&D 5e speaker portrait images are now constrained to proper size inside the cinematic chat panels

## [2.3.0] - 2026-02-27

### Added

- **Open Scene from Cinematic Mode** — new map button in the GM cinematic controls opens a scene picker dialog
  - Displays all FoundryVTT scenes organized by folder hierarchy with thumbnails
  - Collapsible folders with chevron toggle (remembers state within session)
  - Search filter matches scene names and folder names (matching a folder shows all its scenes)
  - Natural numeric sorting (e.g. "2. Into the Wild" before "10. Sound of a Thousand Screams")
  - Active scene badge shows which scene is currently loaded
  - Eye icon preview lets the GM view the full scene background image before committing
  - Selecting a scene closes cinematic mode and activates the scene for all players

## [2.2.0] - 2026-02-27

### Added

- **Per-track volume sliders** — now-playing section shows all currently playing tracks grouped by playlist, each with an individual volume slider
- **Per-track loop button** — toggle repeat on individual tracks directly from the now-playing section
- **Collapsible now-playing playlists** — click the playlist name header to collapse/expand its track list
- **Global volume reset** — after using the master volume slider, a reset button appears to restore each track to its original volume
- **Play all tracks in playlist** — clicking a playlist name now plays all tracks simultaneously regardless of shuffle mode
- **Auto-expand playing playlists** — playlists with active tracks automatically expand in the playlist browser

- **Populate from Scene** — new button on the NPCs tab scans the current FoundryVTT scene for tokens, opens a dialog with actor portraits and checkboxes, and lets the GM bulk-add selected actors as speakers while saving a StoryFrame scene snapshot
  - Deduplicates tokens by base actor (handles unlinked tokens correctly)
  - Filters out player characters, loot, and hazard actor types
  - Select All / Deselect All toggle
  - Scene name defaults to the current FoundryVTT scene name

### Improved

- Global volume slider now controls all playing tracks at once (debounced for performance)
- Per-track volume updates are debounced to avoid flooding the server

### Fixed

- NPC name dialog now appears above the GM sidebar instead of behind it
- "Clear Active Speaker" button now visually deselects the speaker in the NPC list
- "Remove All Speakers" button now reliably re-renders the sidebar

## [2.1.1] - 2026-02-27

### Fixed

- Active speaker switching no longer triggers a full re-render — spotlight and filmstrip update in place, preserving camera feeds and avoiding animation flicker
- Speaker name visibility toggle now syncs to the player cinematic view immediately
- Camera row hides automatically when no active video feeds are present
- Intro animations (fade-in, speaker entrance) no longer replay when the scene re-renders

## [2.1.0] - 2026-02-27

### Added

- **PF2e Party Sheet button in nameplate** — a party-users icon appears inline in the active speaker nameplate when running PF2e with a party actor; click to open the party sheet
- **Speaker name visibility toggle in spotlight** — GM sees an eye button on the left side of the active speaker nameplate to toggle name visibility for players; nameplate text shows strikethrough when hidden
- **Cinematic chat message limit setting** — configurable client setting (default 10, range 1–50) controlling the maximum number of recent messages shown in the cinematic chat log
- **Camera/A/V feed row** — when A/V is active, camera feeds replace the PC row above the filmstrip

### Improved

- PC row now pushes the filmstrip up (matching camera row behaviour)
- NPC name input now pre-fills with the image filename (minus extension, dashes/underscores replaced with spaces) when adding speakers from the file picker or from journal images

## [2.0.1] - 2026-02-27

### Fixed

- Challenge Builder dialog failing to render due to missing `json` Handlebars helper — pre-serialize actions data in context instead

## [2.0.0] - 2026-02-26

### Added

- **Frame Mode** — a full-screen cinematic overlay launched from a new film-reel button in the Tokens toolbar (GM only); replaces the normal Foundry UI with an immersive scene for both GM and players

  **Stage**
  - Letterbox bars, dark vignette, and fade-in animation on launch
  - Active speaker spotlight with portrait, glow, and nameplate; deselect button sits inline next to the name
  - Image preview mode — GM can push a full-screen image to all players; players see it with a close button
  - Filmstrip of inactive speakers along the bottom; click any to make them active
  - PC row above the filmstrip showing all party members (PF2e party roster, or all player-owned characters on other systems); click to open character sheet

  **GM — Right Panel (slide-out)**
  - DC input with preset picker and secret-roll toggle
  - Skill check buttons — request rolls from all participants with one click; opens Full Sidebar for advanced targeting
  - Challenge deployment — send saved challenges from the library directly to players
  - Chat log with full context-menu support

  **GM — Left Panel (slide-out)**
  - Speaker Scenes — load saved NPC lineups with a single click
  - Journal browser — search and open journal entries; inline page tabs, image buttons, minimise/restore; auto-opens the scene journal if one is linked
  - Music player — transport controls (play/pause, stop, prev/next, shuffle, repeat), volume slider, now-playing display, playlist browser with expand/collapse, and full-text track search

  **GM — Filmstrip speaker controls**
  - Per-speaker buttons: hide from players, toggle name visibility, edit display name, remove, and cycle alt images
  - Inline left/right arrows for alt-image navigation

  **GM — Floating panels**
  - Pending rolls panel — live list of outstanding roll requests with per-request cancel; draggable, position persisted
  - Active challenges panel — live list of active challenges with remove button; draggable, position persisted

  **Player view**
  - Roll panel (bottom-right, collapsible) — shows pending skill-check requests grouped by actor; "Choose One" badge for batch groups; auto-expands on new arrivals
  - Challenge panel (bottom-left, collapsible) — shows active challenges with per-option skill buttons; buttons are locked and greyed out for skills below the required proficiency rank; auto-expands on new arrivals
  - Player chat (top-right, collapsible) — scrollable chat log with live message appending

  **Resizable & persistent UI**
  - Both GM panels have drag handles on their inner edges; widths clamp 200–600 px and are saved per client
  - Section heights within each panel are drag-resizable and persisted
  - Relaunch button pushes the current scene to all connected players mid-session

- **Speaker Controls Mode setting** — client setting with three display options for speaker action buttons (edit, remove, hide, image nav) on speaker cards in both the regular sidebar and the Frame Mode filmstrip:
  - _Hover_ — buttons appear as an overlay on mouse-over (default)
  - _Sides_ — edit/hide/remove on the left edge, image navigation on the right edge, always visible
  - _Bottom bar_ — all controls in a bar below the speaker name, always visible

- **Grid size slider** — a range slider in the GM sidebar toolbar lets you continuously resize speaker cards in standalone mode without entering grid-lock; saved per client

### Fixed

- **Dice So Nice above Frame Mode** — 3D dice now render above the cinematic overlay instead of being hidden behind it
- **Frame Mode chat log with Dice So Nice** — roll messages re-render in the cinematic chat log after the DSN animation completes, so results are always visible
- **Filmstrip position with GM panels** — the inactive-speaker filmstrip no longer shifts left/right when GM panels open or close; it now only yields space for player-side UI panels
- **Spotlight size with closed panels** — the active speaker portrait no longer shrinks when a panel is closed; it only adjusts for panels that are currently open
- **Right-click image fullscreen for active speaker** — right-clicking the active speaker spotlight portrait in the non-cinematic Player Viewer now correctly opens the fullscreen image popup, matching the behaviour for inactive speakers
- **Party PCs in Frame Mode** — the PC row now draws from the same party-member source used everywhere else in StoryFrame (PF2e party actor members, or all player-owned characters) rather than only the manually added session participants

## [1.16.2] - 2026-02-25

### Fixed

- **Grid lock captures current card size** — lock now freezes cards at their current width instead of a hardcoded 100px, letting users resize to a comfortable size before locking

## [1.16.1] - 2026-02-25

### Fixed

- **PF2e action enricher ctrl-click** — moved to document-level capture handler so ctrl-click reliably triggers roll requests
- **NaN DC display** — action enrichers and inline checks with missing or non-numeric DC values now show "—" instead of NaN; fallback to sidebar's current DC on apply
- **PF2e action enricher support** — `[[/act ...]]` enrichers (`span[data-pf2-action]`) now parsed for check panel, ctrl-click roll requests, in-view highlighting, and challenge creation from journal; includes DC and variant extraction
- **Challenge action variants** — challenge skill options support PF2e action variants; variant dropdown in challenge builder auto-populates from action selection
- **Player variant restriction** — players see variant names on challenge buttons but cannot access variant popup (roll-only)

## [1.16.0] - 2026-02-25

### Added

- **Grid lock toggle** — lock/unlock speaker grid size in standalone mode; locked uses fixed 100px cards, unlocked scales cards with window
- **Responsive speaker grid** — cards grow proportionally when expanding standalone window; drawer mode fixed at 3 per row
- **Standalone position memory** — standalone sidebar remembers its position and size across close/reopen

### Fixed

- **Speaker actions no longer re-render window** — cycling images and setting active speaker update DOM directly instead of triggering full re-render, preserving user-set window size
- **Drawer width reset** — sidebar resets to default width when attaching as drawer, preventing oversized drawer from standalone resize
- **Speaker control buttons** — scale with card size via container queries, positioned inside card border

## [1.15.0] - 2026-02-25

### Added

- **Monk's Enhanced Journal support** — sidebar attaches to MEJ windows with toggle button, check enrichment, and proper close/reattach behavior, matching standard journal integration

- **Monks TokenBar integration** — when enabled in settings and Monks TokenBar is active, skill checks and saves requested through StoryFrame route through MTB's group roll UI instead of built-in player viewer prompts; roll results are captured back into StoryFrame's roll history via the `monks-tokenbar.updateRoll` hook

### Fixed

- **Hidden speakers no longer keep player viewer open** — player viewer now filters out hidden speakers when deciding whether to close, so it properly closes when all visible speakers are removed

## [1.14.0] - 2026-02-24

### Added

- **Peek at canvas** — bind a key in Configure Controls > StoryFrame > "Peek at Canvas", then hold it to fade the journal away for a quick look at the canvas; release to restore; works reliably even while interacting with sidebar form elements
- **Peek hides sidebar setting** — client setting to control whether the StoryFrame sidebar also fades during peek (default: yes)

## [1.13.0] - 2026-02-24

### Added

- **Actor populate mode** — drag any `@Actor` link from a journal entry to enter populate mode: the journal fades out, a ghost label follows the cursor showing the actor name and remaining count, and left-clicking on the canvas places one token per click snapped to the grid; right-click panning is preserved; Escape or the floating trash-can button exits populate mode early; numbered links (e.g. "4 Bloom Cultists") place one token per click with a countdown that auto-exits when all are placed

## [1.12.0] - 2026-02-24

### Added

- **Daggerheart system support** — StoryFrame now works with the [Daggerheart](https://foundryvtt.com/packages/daggerheart) game system; the GM sidebar shows six core traits in two categories: **Physical** (Agility, Strength, Finesse) and **Mental** (Instinct, Presence, Knowledge); no saves section (Daggerheart has no saving throws)
- **Daggerheart journal integration** — the StoryFrame sidebar toggle button is injected into Daggerheart journal headers; Ctrl+clicking a `.duality-roll-button` (e.g. `[[/dr trait=strength difficulty=14]]`) opens the Roll Requester Dialog with trait and DC pre-populated; journal content is scanned for both StoryFrame text-enriched spans and native duality roll buttons
- **Daggerheart difficulty presets** — the DC preset popup now includes a **Difficulty** tab for Daggerheart with six fixed tiers: Very Easy (DC 8), Easy (DC 11), Standard (DC 15), Hard (DC 18), Very Hard (DC 22), Extreme (DC 26)
- **Daggerheart secret rolls** — blind/secret roll mode is forwarded to `actor.diceRoll` so Daggerheart trait rolls respect the GM's secret toggle
- **Daggerheart player-side roll execution** — players receive trait roll requests and execute them via `actor.diceRoll({ roll: { trait, type: 'trait', difficulty } })` with the correct full trait name (agility, strength, finesse, instinct, presence, knowledge)

## [1.11.0] - 2026-02-23

### Added

- **sf2e-anachronism support** — when the [sf2e-anachronism](https://foundryvtt.com/packages/sf2e-anachronism) module is active, two Starfinder 2e skills are added to the PF2e skill panel: **Computers** (Utility category, with Access Infosphere, Decipher Writing, Disable a Device, Hack, Operate Device, Recall Knowledge) and **Piloting** (Physical category, with Drive, Navigate, Recall Knowledge, Run Over, Stop, Stunt, Take Control)

## [1.10.1] - 2026-02-23

### Fixed

- **D&D 5e "Request Roll" button opens StoryFrame dialog** — clicking the chat-bubble icon on a `[[/check]]` or `[[/save]]` inline enricher now opens StoryFrame's Roll Requester Dialog instead of D&D 5e's native handler; implemented via a document-level capture-phase listener registered at module ready, mirroring the existing PF2e Ctrl+click pattern
- **Journal check highlighting works for D&D 5e** — `IntersectionObserver` and manual visibility fallback now detect both PF2e `a.inline-check` and D&D 5e `span.roll-link-group` elements; a shared `_getCheckElementInfo` helper normalises skill name and DC from either format
- **Journal save highlighting works for D&D 5e** — `groupChecksBySkill` now looks up save names from `getSaves()` (e.g. `"Dexterity Save"`) rather than falling back to the raw slug (`"Dex"`), so the `in-view` highlight on sidebar save buttons correctly activates when a saving throw is scrolled into view
- **Missing D&D 5e skill icons** — `fa-fist-raised` (Intimidation, renamed in FA 6) corrected to `fa-hand-fist`; `fa-mouth` (Persuasion, non-existent in FA 6 Free) corrected to `fa-comments`
- **Missing i18n keys** — `STORYFRAME.Notifications.Speaker.OpeningSidebarsForPlayers` and `ClosingSidebarsForPlayers` were referenced in code but absent from `en.json`; both keys added to the `Speaker` notification group

## [1.10.0] - 2026-02-22

### Added

- **Target Selector for damage rolls** — Ctrl+click (or Cmd+click on Mac) any inline damage roll link (`data-damage-roll`) in a journal entry to open the Target Selector dialog instead of rolling immediately; works on all game systems
- **Target Selector dialog** — shows all player-owned PC tokens on the current scene as portrait cards; left-click to select/deselect targets; click **Roll Damage** to set `game.user.targets` and execute the roll normally
- **Damage formula display** — parses raw FoundryVTT formulas into a structured header: monospace dice expression + coloured damage-type badge(s) in Pascal case (e.g. `{2d6[fire]}` → `2d6` + orange **Fire** badge); covers all dnd5e and PF2e damage types with per-type colours (fire, cold, lightning/electricity, acid, necrotic/negative/void, radiant/positive/vitality, psychic/mental, force, thunder/sonic, slashing, bludgeoning, piercing, poison, bleed, good, evil, chaotic, lawful, spirit)

## [1.9.0] - 2026-02-22

### Added

- **Token image as alternate** — dragging an actor whose token image differs from their portrait auto-populates it as a cycling option; actor portrait and token image are always available regardless of cycling state
- **Alternate images per speaker** — GM can add custom images to any speaker via a file picker (`+` button in the image nav); cycle with `<`/`>` arrows; remove custom images with the trash button (only available for custom images, not built-in actor/token images)
- **Hide speaker from players** — new toggle (`fa-user-slash`) in the speaker thumbnail hover controls hides a speaker entirely from the player viewer; hidden speakers appear blurred in the GM sidebar; GM always sees all speakers
- **Active speaker spotlight** — when a speaker is set active, a dedicated spotlight panel appears on the left side of the player viewer showing their portrait large; the active speaker is removed from the gallery to avoid duplication
- **Spotlight setting** — new client setting "Active Speaker Spotlight" (default on) to toggle the spotlight panel
- **"Now Speaking" label** — spotlight panel shows an "NOW SPEAKING" eyebrow label and the speaker's name below their portrait

### Changed

- **Player viewer layout** — spotlight occupies ~50% of the width (min 180px, max 380px) as a fixed left column; the speaker gallery fills the remaining 50% and scales with the window
- **Image nav controls** — add/remove/cycle image buttons are grouped in a centered row at the bottom of each GM sidebar thumbnail, always visible on hover; `+` opens file picker, `🗑` removes the current custom image, `<`/`>` cycle through all images
- **Speaker action buttons** — all five action buttons (hide-from-players, hide-name, edit, remove, add-image) are now in a single centered flex row above the thumbnail, preventing overflow on narrow thumbnails

## [1.8.4] - 2026-02-21

### Added

- **Challenge option rolls use selected token** — when a player clicks a challenge skill option, the roll now uses the selected token's actor if it belongs to the valid actor pool (party members in PF2e, owned characters otherwise); falls back to the first valid pool member, then any owned character

### Fixed

- **Challenge builder secret button renders black area** — `position: relative` added to `.secret-checkbox` in both skill and save rows to properly contain the hidden `position: absolute` checkbox input; `will-change: box-shadow` added to the animated checked label to give it its own GPU compositing layer and prevent the Chromium/Electron rendering bug where an `overflow-y: auto` scroll container paints black below an animated element
- **Challenge builder skill and save secret buttons now match** — save row secret button active highlight updated to match the cyan style used by the skill row

## [1.8.3] - 2026-02-21

### Fixed

- **Inline `@Check` wrongly secret** — PF2e compendium auto-detection was firing even for checks without `secret` in their traits, marking Recall Knowledge rolls as secret against the author's intent; auto-detection now only runs when no explicit `isSecretOverride` is passed; inline check callers pass the traits-derived boolean explicitly
- **`bringToTop` crash on unrendered dialog** — when a second `subscribe()` call arrived while the first dialog was still rendering, `addChecks` called `bringToTop` before `this.element` was available; both call sites now guard with `if (this.element)`

## [1.8.2] - 2026-02-21

### Added

- **Proficiency badges on challenge library cards** — each skill pill in the GM sidebar library and standalone challenge library now shows a colour-coded proficiency requirement badge when `minProficiency > 0`: blue=Trained (T), green=Expert (E), purple=Master (M), gold=Legendary (L)

### Fixed

- **Challenge update not syncing to players** — `_handleStateUpdate` replaced `stateManager.state` with a new object but left all domain managers (`challengeManager`, etc.) pointing at the stale reference; added `StateManager.syncState()` which updates all managers atomically and switched the socket handler to use it
- **Challenge directory showing "Option 1/2/3"** — renaming an option in the builder then removing another option reset all names back to "Option N"; the renumber step on remove now only removes the card and leaves custom names untouched; new option inputs use placeholder instead of value so blank names are no longer pre-filled with "Option N"
- **Challenge update matched by `templateId`** — the edit+save flow now identifies the live active challenge via `templateId` (stamped when presenting from library) instead of fragile name-matching; name fallback retained for older data

## [1.8.1] - 2026-02-21

### Added

- **Roll Requester singleton** — only one Roll Requester dialog can be open at a time; Cmd+clicking a second inline check or clicking a skill button while the dialog is already open adds the check to it instead of opening a second dialog
- **Check stacking via subscribe pattern** — all entry points (inline checks, journal skills, sidebar skill/save/action/variant buttons, batch send, challenge requests) now share the same singleton dialog via `RollRequestDialog.subscribe()`; every caller awaits the shared result and sends its own check independently
- **Deduplication** — re-clicking the same check (same skill, action, variant, DC, secret) while the dialog is open silently drops the duplicate
- **Shared `batchGroupId`** — the dialog generates one group ID on submit so all concurrent subscribers honour "Allow Only One" as a unified group
- **Journal Lore section** — lore skills extracted from journal content appear in a dedicated "Journal Lore" section below Journal Skills, with "-lore" suffix stripped from button labels for compact display
- **Roll Requester resizes with window** — participant grid fills available height when the window is dragged taller; whole content area scrolls when checks overflow

### Changed

- **Inline `@Check` action & label now forwarded** — `action:xxx` embedded in the PF2e `data-pf2-traits` attribute and the `name:` label (`data-pf2-label`) are extracted at click time; the action slug is passed through to `requestSkillCheck` so the player executes the correct action (e.g. Sense Motive instead of plain Perception); the Roll Requester dialog displays the label as the action name
- **Roll Requester add-checks is flicker-free** — new checks are injected directly into the DOM without re-rendering; window grows by the exact overflow pixel amount instead of resetting to `height: auto`

## [1.8.0] - 2026-02-18

### Added

- **Action/variant batch highlighting** - Action menu items and variant popup items show gold highlight when batched; re-opening popup pre-marks already-batched items
- **Roll Requester send button disabled** when no participant selected; enables on first selection
- **Ctrl/Cmd+click intercepts any chat post** - Holding Ctrl/Cmd while clicking any "post to chat" button opens Roll Requester instead of posting directly

- **Batch skill actions & variants** - Shift+click actions in the skill actions menu or variants in the variant popup to add them to the batch queue
- **Per-check DC capture** - Each item shift-clicked into a batch captures the current DC and secret toggle at that moment; different checks in the same batch can now have different DCs

### Changed

- **All skills shown by default** - Removed "configure quick skills" button; all system skills now always visible in the PCs tab skill grid
- **Allow Only One moved to Roll Requester** - Removed the toggle from the sidebar controls bar; use the checkbox in the Roll Requester dialog instead
- **Per-check secret capture** - Secret toggle state captured at shift-click time per batch item; dialog also shows correct per-check secret badge
- **Journal skill shift-click toggle** - Shift-clicking a journal skill button when all its checks are already batched now removes them (full toggle)

- **PCs tab simplified** - Removed participant selection; skill/save buttons now open Roll Requester directly with all player-owned PCs (or PF2e party members), no pre-selection needed
- **DC preset popup** - Now renders as a body-level fixed popup, no longer clipped by the journal window
- **PF2e party members in Roll Requester** - Roll Requester uses PF2e party actor members when a party exists, falls back to all player-owned characters
- **PF2e inline check Cmd+Click** - Cmd/Ctrl+click on an inline check repost button opens Roll Requester without posting to chat
- **Challenge option names** - Player sidebar now shows option names above skill buttons

## [1.7.6] - 2026-02-15

### Added

- **Journal Minimize/Maximize Support** - GM sidebar now hides/shows automatically when attached journal is minimized/maximized
  - Sidebar hides when journal window is minimized (double-click title bar)
  - Sidebar reappears and repositions when journal is maximized
  - Uses MutationObserver to detect window state changes
  - Proper cleanup of observers when journals close

### Fixed

- **PF2e Action Variants Support** - Fixed "Unknown variant" errors for actions requiring variants ([#12](https://github.com/roi007leaf/storyframe/issues/12))
  - Added variant support to roll request data flow (actionVariant parameter)
  - Actions like "Create a Diversion" and "Perform" now execute without errors
  - Default variants automatically applied (gesture for Create a Diversion, dance for Perform, stabilize for Administer First Aid)
  - Variants passed through to PF2e action system correctly
  - Ready for future UI enhancement for variant selection

- **PF2e Action Names Display** - Actions now show proper names instead of generic skill tests ([#12](https://github.com/roi007leaf/storyframe/issues/12))
  - Actions like "Create a Diversion" display correctly instead of showing as "Deception test"
  - Added action name mapping from slugs to display names (e.g., "create-a-diversion" → "Create a Diversion")
  - Challenge buttons show action name prominently when present
  - Roll requests show action name in parentheses after skill (e.g., "Deception (Create a Diversion)")
  - Tooltips updated to include action names for better clarity

- **PF2e Inline Check Ctrl+Click** - Fixed ctrl+click on PF2e inline checks to open Roll Requester dialog
  - Removed restrictive `.with-repost` class requirement from selector
  - Added fallback to check element if repost icon not found
  - Event listener now properly intercepts clicks on both repost icons and check elements
  - Works with all PF2e inline check formats in journal entries

### Changed

- **Player Sidebar Dimensions** - Improved default size and made resizable
  - Increased default width: 340px → 380px
  - Increased default height: 600px → 650px
  - Added minimum constraints (320px width, 500px height)
  - Made sidebar resizable for player customization
  - Prevents cramped appearance on first open

## [1.7.5] - 2026-02-11

### Added

- **Skill & Category Reordering** - Drag-and-drop reordering in GM sidebar
  - Drag skill buttons to reorder within categories
  - Drag category labels to reorder categories
  - Custom order persisted to world settings
  - Fast animations with smooth transitions

### Fixed

- **Category Order Persistence** - Category order now properly persists when sidebar reopens
  - Applied saved category order to template rendering
  - Custom ordering now respected on every sidebar render

- **Player Challenge Selection** - Fixed "Challenge no longer active" error when players select challenge options
  - Updated player-viewer to use new multi-challenge system (activeChallenges array)
  - Challenge buttons now properly lookup challenge by ID

- **GM Sidebar Independence** - GM sidebar no longer requires journal tab to be open
  - Added token control button to open/close sidebar independently
  - Sidebar works in standalone mode or attached to journals (drawer mode)
  - Made sidebar resizable and minimizable in standalone mode
  - Updated keybinding warnings for clearer instructions

- **Standalone Mode Stability** - Fixed errors when GM sidebar opens without parent journal
  - Added null checks for element cleanup in close handler
  - Fixed journal content extraction to handle missing parent interface
  - Prevented errors when toggling sidebar in standalone mode

## [1.7.4] - 2026-02-09

### Changed

### Smart Player Window Management

- **Viewer Auto-Open** - Opens only when speakers are added (shows NPCs)
  - No longer opens for rolls/challenges without speakers
  - Closes automatically when all speakers removed
  - Players can manually open if speakers exist

- **Sidebar Auto-Open** - Opens independently when rolls/challenges added
  - Auto-opens for pending rolls or active challenges
  - Stays open when viewer closes if content remains
  - Independent from viewer lifecycle

- **Selective Opening** - Only opens for players with relevant content
  - Auto-opens only for players who have rolls/challenges targeted to them
  - Other players don't see auto-opening unless they have content
  - Manual open shows notification if no content

- **GM Controls Split** - Separate buttons for viewer and sidebar
  - NPCs tab: "Open viewer on players" button (TV icon)
  - PCs tab: "Open sidebars on players" button (sidebar icon)
  - Both support right-click to close

### Fixed

- **Sidebar Positioning** - Properly attaches sidebar to viewer when viewer opens
  - Fixed sidebar not repositioning when viewer opens with sidebar already rendered
  - Added delays to ensure viewer element exists before positioning
  - Sidebar now correctly positions as drawer in all scenarios

- **Scene Control Button** - Fixed deprecated onClick usage
  - Updated to use onChange with proper button configuration
  - Fixed button staying active preventing repeated clicks
  - Button now clickable multiple times

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
