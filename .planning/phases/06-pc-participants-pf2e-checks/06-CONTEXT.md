# Phase 6: PC Participants & PF2e Check Rolls - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

<domain>
## Phase Boundary

GM can define which PC characters are participating in a conversation and request PF2e system check rolls from them. Players receive prompts in their StoryFrame viewer and results are visible according to GM preferences. This phase adds participant management and roll integration — new roll types or automation belong in future phases.

</domain>

<decisions>
## Implementation Decisions

### Participant Management
- Collapsible panel in GM interface (separate from speakers)
- Multiple add methods: drag from sidebar, dropdown selector, OR auto-populate all logged-in players' PCs
- Participants can be removed individually from panel

### Participant vs Speaker Relationship
- Claude's discretion on whether speakers auto-become participants
- Claude's discretion on persistence behavior (likely mirror speaker persistence to scene flags for consistency)

### Check Request Flow
- Quick buttons for common checks PLUS full categorized menu for all skills
- Quick buttons include: Social skills (Deception, Diplomacy, Intimidation, Performance), Perception + Sense Motive, Recall Knowledge
- GM can configure which skills appear as quick buttons (custom favorites)
- Targeting: Click participant(s) first, then choose skill — plus "Request All" button for group checks
- DC input: Optional with quick presets (10, 15, 20, 25, 30) plus custom entry

### Player Prompts
- Check requests appear IN the StoryFrame viewer (not dialog or chat)
- Prompt shows skill name only — no context hints, no DC revealed
- No timeout — request stays until player responds or GM cancels
- Roll only — no dismiss option, player must roll

### Result Visibility
- Results appear in BOTH StoryFrame AND chat (standard PF2e chat card)
- GM controls DC reveal per-check (secret or revealed)
- Collapsible roll history in StoryFrame showing past rolls this session
- GM controls per-check whether other players see each other's results in StoryFrame

### Claude's Discretion
- Speaker/participant relationship implementation
- Participant persistence behavior
- Exact UI layout for collapsible panels
- Roll history data structure and limits
- PF2e API integration approach for triggering rolls

</decisions>

<specifics>
## Specific Ideas

- Quick buttons should feel accessible for common social encounter checks
- Recall Knowledge should auto-select appropriate skill based on subject if possible
- Roll prompts should be unobtrusive but noticeable in the viewer

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-pc-participants-pf2e-checks*
*Context gathered: 2026-01-30*
