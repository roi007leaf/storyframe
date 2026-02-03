# Phase 8 Context: Skill UI & Batch Roll Requests

**Created:** 2026-02-03
**Phase Goal:** Polished skill interface with intelligent grouping, batch roll requests, per-skill proficiency filtering, and robust challenge management

## Implementation Decisions

This context guides research and planning. These decisions are locked for Phase 8.

---

## 1. Skill Grid Layout & Organization

**Grid Density:**
- Use CSS auto-fill grid
- Fit as many skills as possible while maintaining minimum button size
- Responsive to window size (not fixed 4-column)
- Target ~4 skills per row at standard width, adjust automatically

**Category Spacing:**
- Minimal separation (8-12px) between categories
- Categories flow together, headers provide grouping
- Maintain compact, dense layout

**Empty Category Behavior:**
- Hide completely when category has no visible skills
- Remove header AND layout space entirely
- Layout reflows when categories become empty/visible

**Category Headers:**
- Clear section headers (medium weight)
- Distinct from skill buttons but not overwhelming
- Physical, Magical (renamed from Mental), Social, Utility

**Skill Grouping (from success criteria):**
- Stealth and Thievery → Physical (DEX-based)
- Mental → rename to Magical
- Perception → Utility (not standalone)

**Display Order (fixed, from success criteria):**
1. Journal Checks (top)
2. Lore Skills
3. Quick Skill Buttons (bottom)

---

## 2. Multi-skill Selection Pattern

**Selection Interaction:**
- Shift+click to multi-select skills
- First click selects one skill
- Shift+click adds more to selection
- Common desktop pattern, familiar to users

**Participant Requirement:**
- Block skill selection entirely if no participants chosen
- Skills cannot be shift+clicked until participants are selected
- Prevents invalid state where skills are selected but no one to send to

**Visual Feedback:**
- Selected skills show highlighted border/background
- Distinct visual state for selected skills
- Clear indication of what's in the selection set

**Lore Skills:**
- Aggregate from selected PCs only
- Lore skills shown dynamically based on participants
- Each PC contributes their lore skills to the available pool
- Players only see lore skills they actually possess

**Batch Request Trigger:**
- "Request Roll(s)" button appears when skills are selected
- Button triggers the batch roll request
- Button visible only when selection is active

**Deselection:**
- Both methods supported:
  1. Shift+click on already-selected skill removes it
  2. "Clear All" button clears entire selection
- Flexible workflow for different GM preferences

**Challenge Creation:**
- Both options available after selecting skills:
  1. "Quick Request" → one-time batch roll request (not persistent)
  2. "Create Challenge" → persistent multi-round challenge
- GM chooses workflow based on context
- Same selection interface, different outcomes

**Skill Selection Limits:**
- No restrictions on which skills can be selected together
- GM can select any combination freely
- No validation on attribute types, skill categories, etc.
- Trust GM judgment on what makes sense narratively

---

## 3. Challenge UI & Interaction

**Collapse/Expand Behavior:**
- Click anywhere on challenge header to toggle
- No dedicated icon needed
- Entire header is interactive target
- Intuitive single-click interaction

**Concurrent Challenge Layout:**
- Challenges stacked vertically
- Chronological order (oldest first, newest last)
- Simple linear stack, no grouping/tabs

**Challenge Uniqueness (hard requirement from success criteria):**
- Only one active challenge per unique name
- Block creation with error message if duplicate detected
- Error: "Challenge 'X' already exists"
- Prevents accidental duplication

**Challenge Header Content (collapsed state):**
- Challenge name + status summary
- Status example: "3/5 players responded"
- Brief, scannable information when collapsed
- Full details visible when expanded

**Challenge Header Visual:**
- Clickable (entire header is interaction zone)
- Collapsible/expandable independently per challenge
- Visual indicator of expand/collapse state (chevron/arrow)

---

## 4. Proficiency Filter Presentation

**Filter Placement:**
- Overlay when shift+clicking skill
- Selecting a skill shows proficiency requirement overlay
- Inline with selection interaction, not separate panel

**Filter UI Component:**
- Dropdown menu in overlay
- Options: Any, Trained+, Expert+, Master+, Legendary+ (Mythic if applicable)
- Simple dropdown selection

**Default Filter State:**
- No filter (Any) by default
- GM can restrict if needed
- Don't assume proficiency requirements

**Filter Indication:**
- Badge on skill button when filter is active
- Small badge/chip shows proficiency level (e.g., "Expert+")
- Visual indicator on the selected skill itself
- Clear at-a-glance indication of filter state

**Per-skill Filtering (critical requirement from success criteria):**
- Each skill has its own independent proficiency filter
- NOT a global filter applied to all skills
- Example: Thievery → Expert+, Crafting → Trained+, Engineering Lore → Any
- Players only see skills where they meet that skill's requirement

---

## Scope Boundaries

**In scope for Phase 8:**
- Skill UI improvements (grouping, layout, empty state handling)
- Multi-skill selection workflow
- Batch roll requests (one-time, atomic)
- Per-skill proficiency filtering
- Challenge creation from skill selection
- Challenge uniqueness validation
- Concurrent challenge display

**Explicitly out of scope:**
- Multi-round challenge mechanics (covered in Phase 6)
- Roll result aggregation/display (Phase 6)
- PF2e system integration details (Phase 6)
- Journal integration (Phase 5)
- Premium module styling (Phase 7)

---

## Technical Constraints

**From success criteria:**
- Grid density targets 4 skills per row (except Social category) → auto-fill grid achieves this
- Only one active challenge per unique name → enforce with validation
- Multiple different named challenges can be active simultaneously → support in UI
- Challenge headers collapsible/expandable independently → individual state per challenge

**From multi-PC batch roll requirements:**
- Aggregate all relevant skills and lore skills across selected PCs
- Each player prompted only with skills they possess
- Batch request is atomic (one request, not multiple prompts)
- Request does not persist like a multi-round challenge

---

## User Experience Goals

**Design Intent (from success criteria):**
- Reduce GM friction during live play
- Minimize player decision latency when multiple skills are valid
- Support large tables and Pathfinder Society pacing
- Clearly separate batch roll requests (one-off, fast) from challenges (persistent, structured)

**Interaction Priorities:**
1. Speed: Quick skill selection and request sending
2. Clarity: Clear visual feedback for selections and filters
3. Flexibility: Support both quick requests and persistent challenges
4. Prevention: Block invalid states (no participants, duplicate challenges)

---

## Next Steps

With this context locked:
1. Research: Investigate PF2e skill data structures, proficiency levels, lore skill handling
2. Planning: Break down into executable tasks with this UX as the target
3. Implementation: Build to these decisions without re-asking the user
