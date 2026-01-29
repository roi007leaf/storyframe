# Phase 1: Foundation - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Build secure data layer and socket communication infrastructure for StoryFrame. This phase establishes:
- Module manifest and initialization hooks (init/setup/ready)
- StateManager for speaker data persistence in document flags
- SocketManager for GM→player real-time broadcasts
- Data structures for speaker list, active speaker, and journal selection

No UI in this phase - pure infrastructure that GM/player ApplicationV2 apps will consume.

</domain>

<decisions>
## Implementation Decisions

### Socket Security
- **Use socketlib** — Add socketlib as dependency for built-in GM execution pattern and permission handling
- **No additional validation** — Trust socketlib's built-in patterns, no custom message signing needed

### Claude's Discretion
The user delegated most implementation decisions to Claude. Areas with full discretion:

**Data Storage:**
- Storage location (Scene flags vs JournalEntry flags vs Settings)
- Speaker list scope (per-journal vs global)
- State restoration on GM reconnect
- Deleted actor handling (keep with fallback vs auto-remove)
- Speaker count limits
- Flag schema versioning approach (simple vs semantic)
- Multi-GM conflict resolution
- Export/import functionality (include vs defer to v2)

**Socket Security:**
- Unauthorized action handling (silent vs logged)
- Rate limiting (yes vs no)

**State Structure:**
- Speaker organization (array vs object)
- Order tracking (explicit field vs array position)
- Active speaker reference (by ID vs by index)
- Actor data caching (UUID-only vs snapshot)

**Module Initialization:**
- Settings registration hook (init vs setup)
- UI button placement for opening control window
- Settings config menu inclusion
- Initialization logging verbosity

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard Foundry v13 module patterns.

Research (PITFALLS.md) identified critical requirements:
- Socket handlers MUST validate permissions (socketlib addresses this)
- Flag schema MUST include version number for migrations
- Hook sequence MUST be correct (init→setup→ready)
- Manifest MUST be valid JSON with required fields

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-01-29*
