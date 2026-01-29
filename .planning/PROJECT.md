# StoryFrame

## What This Is

A FoundryVTT v13 module that lets GMs read journal entries while controlling an NPC speaker gallery that broadcasts to players in real-time. GM sees journal text alongside speaker thumbnails, clicks to change active speaker, and players automatically see the current speaker's portrait and name.

## Core Value

GM can read journal dialogue without interruption while players see who's speaking.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] GM opens journal viewer window showing journal text and speaker gallery
- [ ] Speaker gallery displays all NPCs in conversation as thumbnails
- [ ] Current speaker is highlighted/enlarged in gallery
- [ ] GM clicks any thumbnail to change active speaker
- [ ] Players see current speaker portrait + name in real-time (auto-update via socket)
- [ ] GM can add speakers from existing actors (UUID-based)
- [ ] GM can add speakers from image paths (file picker)
- [ ] GM can add/edit speakers mid-session without closing viewer
- [ ] Speaker portrait clears/hides during narration (no active speaker)
- [ ] Tool works with zero pre-planned speakers (create on-the-fly)
- [ ] Speaker data persists in journal document flags
- [ ] Player viewer is read-only (no editing)
- [ ] Only GM can open main tool and edit speakers
- [ ] Module is system-agnostic (works with any Foundry system)

### Out of Scope

- Audio/sound effects — not part of core reading experience
- Player editing capabilities — GM-only tool, players are viewers
- Automatic speaker detection from text — manual cue setup only
- Multiple simultaneous conversations — one active journal at a time

## Context

**Current workflow pain:** GM opens journal, clicks NPC images to show players, this disrupts reading the text. GM wants to keep eyes on text while changing speakers.

**Usage pattern:**
- Used for all dialogue scenes (not just special moments)
- Mix of pre-planned speakers and adding them mid-session
- Mostly linear progression through dialogue with occasional backtracking
- GM needs to see the speaker portrait too (visual reminder of who's talking)

**Technical environment:**
- FoundryVTT v13
- Must use v13 APIs (ApplicationV2, modern hooks)
- Avoid deprecated patterns

## Constraints

- **Platform**: FoundryVTT v13 — must use ApplicationV2 and v13-compatible APIs
- **Compatibility**: System-agnostic — cannot depend on specific system's data structures
- **Data persistence**: Document flags only — use `journalEntry.setFlag(MODULE_ID, "speakers", data)`
- **Permissions**: GM-only editing — gate all modification behind `game.user.isGM`
- **Architecture**: Socket-based broadcast — use `game.socket.emit` for real-time player updates

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Gallery view vs list+large | User selected gallery with highlighted current speaker | — Pending |
| Click to change vs keyboard | User prefers clicking thumbnails directly | — Pending |
| Real-time vs manual broadcast | User expects automatic updates when speaker changes | — Pending |
| Both actors and images | Flexibility needed for both prepared (actors) and improvised (images) | — Pending |

---
*Last updated: 2026-01-29 after initialization*
