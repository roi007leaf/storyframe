# Phase 6: PC Participants & PF2e Check Rolls - Research

**Researched:** 2026-01-30
**Domain:** Foundry VTT PF2e System Integration, Socket Communication, Skill Check APIs
**Confidence:** MEDIUM

## Summary

This phase integrates with the PF2e system to manage PC participants and request skill checks. The PF2e system provides actor-based skill roll APIs, and multiple existing modules demonstrate patterns for requesting rolls from players via sockets. The key challenge is triggering rolls on player clients while respecting PF2e's native roll dialog and chat card generation.

**Key findings:**
- PF2e actors use `actor.system.skills[slug]` for skill data and expose roll methods
- Existing modules (PF2e Request Rolls, PF2e Roll Manager) use socket patterns to request player rolls
- PF2e has 16 core skills identified by 3-letter slugs (acr, arc, ath, cra, dec, dip, itm, med, nat, occ, prf, rel, soc, ste, sur, thi)
- Perception checks use `actor.system.perception` (separate from skills)
- Secret/blind rolls controlled via ChatMessage rollMode and DC visibility options
- Roll results appear as PF2e chat cards with degree-of-success calculation

**Primary recommendation:** Use socketlib pattern (already in StoryFrame) to send roll requests to specific player clients, then have each player client call their actor's native roll method locally. Store pending requests in application state and render prompts in player viewer.

## Standard Stack

### Core Libraries
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| socketlib | Latest | Socket communication | Already used in StoryFrame, executeAsGM pattern established |
| PF2e System | 6.x+ | Skill check APIs | Native system, provides actor.system.skills and roll methods |

### Supporting Patterns
| Pattern | Purpose | When to Use |
|---------|---------|-------------|
| executeAsGM | State mutations (add/remove participants) | Persisting participant list to scene flags |
| executeAsUser | Trigger roll on specific client | Requesting roll from specific player |
| executeForEveryone | Broadcast updates | Syncing roll results visibility across clients |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| socketlib | Core Foundry sockets | socketlib provides cleaner API, already integrated in StoryFrame |
| Custom roll UI | PF2e native roll dialog | Custom UI loses PF2e degree-of-success automation and modifier UI |
| Chat-based requests | In-app prompts | Decision already made: prompts appear IN StoryFrame viewer |

**Installation:**
No new dependencies - PF2e system and socketlib already present in project.

## Architecture Patterns

### Recommended State Structure Extension
```javascript
// Extend existing StateManager schema in state-manager.mjs
{
  version: 1,
  activeJournal: string|null,
  activeSpeaker: string|null,
  speakers: [...],
  participants: [{           // NEW: PC participants
    id: string,              // Unique ID (randomID)
    actorUuid: string,       // PC Actor UUID
    userId: string           // Owning user ID (for targeting socket)
  }],
  pendingRolls: [{           // NEW: Active roll requests
    id: string,              // Request ID
    participantId: string,   // Target participant
    skillSlug: string,       // 'per' or skill slug (acr, dip, etc)
    dc: { value: number, visibility: string }, // DC config
    timestamp: number        // When requested
  }],
  rollHistory: [{            // NEW: Session roll results
    requestId: string,
    participantId: string,
    skillSlug: string,
    total: number,
    degreeOfSuccess: number, // -1 crit fail, 0 fail, 1 success, 2 crit success
    timestamp: number,
    chatMessageId: string    // Link to chat card
  }]
}
```

### Pattern 1: Add Participant Flow
**What:** GM adds PC to participant list
**When to use:** Via drag-drop, dropdown, or "Add All PCs" button

```javascript
// In gm-interface.mjs
async addParticipant(actorUuid) {
  const actor = await fromUuid(actorUuid);
  if (!actor || actor.type !== 'character') return;

  // Find owning user
  const userId = game.users.find(u =>
    actor.testUserPermission(u, 'OWNER') && !u.isGM
  )?.id;

  if (!userId) {
    ui.notifications.warn('No player owns this character');
    return;
  }

  const participantData = { actorUuid, userId };
  await game.storyframe.socketManager.requestAddParticipant(participantData);
}
```

### Pattern 2: Request Skill Check Flow
**What:** GM requests check from participant(s), player receives prompt in viewer
**When to use:** GM clicks skill button after selecting participant(s)

```javascript
// GM side - in gm-interface.mjs
async requestSkillCheck(participantIds, skillSlug, dcConfig) {
  for (const participantId of participantIds) {
    const participant = this.state.participants.find(p => p.id === participantId);
    if (!participant) continue;

    const requestId = foundry.utils.randomID();
    const request = {
      id: requestId,
      participantId,
      skillSlug,
      dc: dcConfig, // { value: 20, visibility: 'gm'|'all'|'none' }
      timestamp: Date.now()
    };

    // Add to pending via GM state manager
    await game.storyframe.socketManager.requestAddPendingRoll(request);

    // Trigger on player client
    await game.storyframe.socketManager.executeAsUser(
      'promptSkillCheck',
      participant.userId,
      requestId
    );
  }
}

// Player side - in player-viewer.mjs (handler registered in SocketManager)
async _handlePromptSkillCheck(requestId) {
  const request = this.state.pendingRolls.find(r => r.id === requestId);
  if (!request) return;

  // Update UI to show prompt (render will pick it up)
  this.render();
}
```

### Pattern 3: Execute Roll on Player Client
**What:** Player clicks roll button in StoryFrame prompt, triggers native PF2e roll
**When to use:** Player responds to check request

```javascript
// Player side - in player-viewer.mjs
async executeRoll(requestId) {
  const request = this.state.pendingRolls.find(r => r.id === requestId);
  if (!request) return;

  const participant = this.state.participants.find(p => p.id === request.participantId);
  const actor = await fromUuid(participant.actorUuid);

  // Trigger native PF2e roll
  let roll;
  if (request.skillSlug === 'per') {
    // Perception check
    roll = await actor.perception.roll({
      dc: request.dc,
      skipDialog: false // Show PF2e modifier dialog
    });
  } else {
    // Skill check
    roll = await actor.skills[request.skillSlug].roll({
      dc: request.dc,
      skipDialog: false
    });
  }

  // Extract result and send to GM
  const result = {
    requestId,
    participantId: request.participantId,
    skillSlug: request.skillSlug,
    total: roll.total,
    degreeOfSuccess: roll.degreeOfSuccess?.value ?? 0,
    timestamp: Date.now(),
    chatMessageId: roll.options.message?.id
  };

  // Submit result via socket to GM
  await game.storyframe.socketManager.requestSubmitRollResult(result);
}
```

### Pattern 4: Identify Player Characters
**What:** Get all PC actors owned by non-GM players
**When to use:** "Add All PCs" button, participant dropdown population

```javascript
// In gm-interface.mjs
getPlayerCharacters() {
  return game.actors.filter(actor => {
    if (actor.type !== 'character') return false;

    // Check if any non-GM user has OWNER permission
    return game.users.some(user =>
      !user.isGM &&
      actor.testUserPermission(user, 'OWNER')
    );
  });
}
```

### Anti-Patterns to Avoid
- **Rolling on GM client for players:** PF2e rolls need actor's full context and player's modifier choices. Always execute on owning player's client.
- **Storing full actor data:** Store actorUuid and resolve as needed. Actor data can change between requests.
- **Bypassing PF2e roll dialog:** Players expect to add circumstance bonuses, hero points, etc. Use `skipDialog: false` unless explicitly designing "quick roll" feature.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Degree of success calculation | Custom DC comparison | PF2e native roll system | PF2e calculates crit success/fail (10 over/under DC), handles modifiers |
| Skill list with categories | Hard-coded arrays | PF2e CONFIG.PF2E.skills | Localized, handles lore skills, stays current with system updates |
| Roll visibility (secret/blind) | Custom chat filtering | ChatMessage rollMode | Core Foundry feature, integrates with PF2e roll options |
| Recall Knowledge skill selection | Manual GM choice | PF2e creature traits → skill mapping | System has built-in logic (Arcana for magical, Nature for beasts, etc.) |

**Key insight:** PF2e system handles complex roll mechanics (circumstance bonuses, conditions, proficiency, item bonuses, degree of success). Always use actor's native roll methods rather than re-implementing.

## Common Pitfalls

### Pitfall 1: Socket Targeting Issues
**What goes wrong:** Using `executeAsGM` for player actions or not tracking userId with participants
**Why it happens:** StoryFrame's existing socket pattern only uses executeAsGM (state mutations)
**How to avoid:**
- Store `userId` with each participant (not just actorUuid)
- Use socketlib's `executeAsUser(handlerName, userId, ...args)` to target specific player
- Register player-side handlers for roll prompts
**Warning signs:** Rolls execute on GM client instead of player, permission errors

### Pitfall 2: Perception vs Skills Structure Mismatch
**What goes wrong:** Treating perception like a skill (actor.skills.perception doesn't exist)
**Why it happens:** Perception was a skill in PF1e, and "Sense Motive" is described as Perception-based
**How to avoid:**
- Check if slug is 'per' → use `actor.perception.roll()` or `actor.system.perception`
- All other checks → use `actor.skills[slug].roll()` or `actor.system.skills[slug]`
- Sense Motive is a Perception check, not a separate skill in PF2e
**Warning signs:** `Cannot read property 'roll' of undefined` when requesting Perception

### Pitfall 3: Stale Roll Requests
**What goes wrong:** Pending roll requests persist after scene change, logout, or cancellation
**Why it happens:** pendingRolls stored in scene flags, no cleanup logic
**How to avoid:**
- Add "Cancel Request" button for GM
- Clear participant's pending rolls on participant removal
- Optional: Add timestamp expiry (auto-clear after 5 minutes)
- Hook into scene change to clear all pending rolls
**Warning signs:** Players see old roll prompts after rejoining or switching scenes

### Pitfall 4: Roll History Bloat
**What goes wrong:** rollHistory array grows unbounded, scene flags get huge
**Why it happens:** Every roll adds to history, never pruned
**How to avoid:**
- Limit to last 50 rolls per scene
- OR: Clear history on scene activation (session-based)
- OR: Store in memory only (game.storyframe.sessionRolls), not in flags
- Document choice in PLAN.md
**Warning signs:** Scene flag updates slow down, render lag

### Pitfall 5: DC Visibility Implementation Complexity
**What goes wrong:** Trying to hide DC from chat card HTML or intercept PF2e roll rendering
**Why it happens:** PF2e controls its own chat card generation
**How to avoid:**
- **For PF2e system:** Use `dc.visibility` option in roll config ('gm', 'owner', 'all', 'none')
- **For StoryFrame viewer:** Control DC display in your own roll history UI, not the chat card
- Accept that standard PF2e chat cards follow system rules, StoryFrame adds extra UI layer
**Warning signs:** Complex chat message hooks, trying to modify PF2e templates

## Code Examples

### Example 1: Getting All Player Characters (Auto-Populate)
```javascript
// Source: Derived from Foundry VTT wiki macro examples
// https://foundryvtt.wiki/en/basics/Macros

function getPlayerCharacters() {
  const pcs = [];

  for (const actor of game.actors) {
    // Only character type actors
    if (actor.type !== 'character') continue;

    // Find the owning user (non-GM)
    const owner = game.users.find(user =>
      !user.isGM && actor.testUserPermission(user, 'OWNER')
    );

    if (owner) {
      pcs.push({ actor, user: owner });
    }
  }

  return pcs;
}

// Usage in GM interface
async addAllPlayerCharacters() {
  const pcs = getPlayerCharacters();

  for (const { actor, user } of pcs) {
    await this.addParticipant(actor.uuid);
  }

  ui.notifications.info(`Added ${pcs.length} player characters`);
}
```

### Example 2: PF2e Skill Roll with DC
```javascript
// Source: Derived from PF2e system patterns and community examples
// https://github.com/foundryvtt/pf2e

// Basic skill roll
const actor = game.actors.getName("Character Name");
await actor.skills.dip.roll(); // Diplomacy check

// With DC configuration
await actor.skills.dec.roll({
  dc: {
    value: 20,           // DC value
    visibility: 'all'     // 'all', 'gm', 'owner', or 'none'
  },
  skipDialog: false       // Show modifier dialog to player
});

// Perception check (separate from skills)
await actor.perception.roll({
  dc: { value: 15, visibility: 'gm' } // Secret DC
});
```

### Example 3: PF2e Skill Slugs Reference
```javascript
// Source: Community documentation and PF2e wiki
// https://foundryvtt.wiki/en/basics/Macros

const PF2E_SKILLS = {
  acr: 'Acrobatics',
  arc: 'Arcana',
  ath: 'Athletics',
  cra: 'Crafting',
  dec: 'Deception',
  dip: 'Diplomacy',
  itm: 'Intimidation',
  med: 'Medicine',
  nat: 'Nature',
  occ: 'Occultism',
  prf: 'Performance',
  rel: 'Religion',
  soc: 'Society',
  ste: 'Stealth',
  sur: 'Survival',
  thi: 'Thievery'
};

// PLUS: Perception (not a skill in PF2e)
// Access via: actor.perception (not actor.skills.perception)

// Quick buttons per CONTEXT decisions:
const QUICK_BUTTON_DEFAULTS = [
  'per',  // Perception (for Sense Motive)
  'dec',  // Deception
  'dip',  // Diplomacy
  'itm',  // Intimidation
  'prf'   // Performance
];
```

### Example 4: ChatMessage Roll Modes
```javascript
// Source: Foundry VTT v13 API Documentation
// https://foundryvtt.com/api/classes/foundry.documents.ChatMessage.html

// When creating roll-based chat messages:
await ChatMessage.create({
  content: "Rolling...",
  rolls: [roll],
  speaker: ChatMessage.getSpeaker({ actor }),
  // Roll mode options:
  // - 'publicroll': Everyone sees roll and result
  // - 'gmroll': GMs see roll, players see "GM rolled privately"
  // - 'blindroll': GMs see roll, players see nothing
  // - 'selfroll': Only roller and GMs see
  rollMode: 'blindroll', // For secret checks
  whisper: [], // Whisper targets (empty for rollMode-controlled)
  blind: false // Controlled by rollMode
});

// PF2e handles this internally when you pass dc.visibility:
// - visibility: 'none' → similar to blindroll
// - visibility: 'gm' → similar to gmroll
// - visibility: 'all' → publicroll
// - visibility: 'owner' → selfroll
```

### Example 5: Socketlib executeAsUser Pattern
```javascript
// Source: StoryFrame existing socket-manager.mjs pattern
// Extends existing executeAsGM pattern to executeAsUser

// In SocketManager constructor (register handler)
this.socket.register('promptSkillCheck', this._handlePromptSkillCheck);

// GM calls this to trigger on specific player
async requestSkillCheckForPlayer(userId, requestData) {
  return await this.socket.executeAsUser(
    'promptSkillCheck',
    userId,
    requestData
  );
}

// Handler runs on target player's client only
async _handlePromptSkillCheck(requestData) {
  console.log(`Received skill check request: ${requestData.skillSlug}`);

  // Add to player's pending rolls (local state update)
  if (game.storyframe.playerApp) {
    game.storyframe.playerApp.showRollPrompt(requestData);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sense Motive skill | Perception check | PF2e core rules (2019) | No actor.skills.sense_motive, use actor.perception |
| Manual degree calculation | Built into roll system | PF2e system inception | Roll object has .degreeOfSuccess property |
| Custom roll dialogs | PF2e native dialog | PF2e v3+ (2022) | skipDialog param controls whether to show |
| String-based permissions | testUserPermission API | Foundry v10+ (2023) | Use actor.testUserPermission(user, 'OWNER') |

**Deprecated/outdated:**
- `actor.data.data.skills`: Use `actor.system.skills` (v10+ data model)
- `game.user.isGM`: Use `game.user.hasRole('GAMEMASTER')` for more granular roles
- jQuery-based dialogs: Use DialogV2 (Foundry v13, already in StoryFrame context)

## Open Questions

### Question 1: Recall Knowledge Skill Auto-Selection
**What we know:**
- Context decisions mention "Recall Knowledge should auto-select appropriate skill based on subject if possible"
- PF2e Workbench module has creature trait → skill mapping
- Requires analyzing target's creature type/traits

**What's unclear:**
- Whether to implement auto-selection in Phase 6 or defer
- How to access target creature's traits (requires targeting system integration)

**Recommendation:**
- Phase 6: Include Recall Knowledge in skill list, but GM manually selects skill
- Future phase: Add "Smart Recall Knowledge" that reads target traits and suggests skill

### Question 2: Quick Button Customization Scope
**What we know:**
- Context decisions say "GM can configure which skills appear as quick buttons"
- Default quick buttons: Social skills (dec, dip, itm, prf) + per

**What's unclear:**
- Per-GM preference (module setting) or per-scene config?
- UI for customization: drag-and-drop? Checkbox list in settings?

**Recommendation:**
- Phase 6: Hard-code default quick buttons (per, dec, dip, itm, prf)
- Module setting for quick button customization: checkboxes in settings menu
- Deferred: Per-scene quick button sets (probably over-engineering)

### Question 3: Roll History Persistence Model
**What we know:**
- Roll history shows past rolls "this session"
- Could store in scene flags (persistent) or memory (session-only)

**What's unclear:**
- Does "session" mean until scene change, until reload, or until conversation ends?
- Should history survive browser refresh?

**Recommendation:**
- Store in scene flags for persistence across reloads
- Clear on scene activation (hook: 'canvasReady') to define "session" as per-scene
- Limit to last 50 rolls to prevent bloat
- Document as "per-scene session" in UI/docs

### Question 4: Multiple Participants Requesting Same Check
**What we know:**
- "Request All" button for group checks
- Each participant gets individual prompt

**What's unclear:**
- Should roll prompts group-display ("Group Diplomacy Check") or show individually?
- Do all participants need to roll before history entry created, or one entry per participant?

**Recommendation:**
- Individual prompts per participant (simpler state management)
- Individual history entries per participant (easier to track who rolled what)
- GM can see all results in roll history panel grouped by timestamp
- Accept minor UX tradeoff: players don't see "group check" label (can add in future)

## Sources

### Primary (HIGH confidence)
- [Foundry VTT v13 ChatMessage API](https://foundryvtt.com/api/classes/foundry.documents.ChatMessage.html) - Roll mode and whisper mechanics
- [Foundry VTT Community Wiki - Macros](https://foundryvtt.wiki/en/basics/Macros) - Player character filtering, skill slugs
- [Archives of Nethys - Sense Motive](https://2e.aonprd.com/Actions.aspx?ID=2302) - Perception-based check in PF2e

### Secondary (MEDIUM confidence)
- [PF2e Request Rolls Module](https://foundryvtt.com/packages/pf2e-request-rolls) - Socket pattern for player roll requests (verified via Foundry VTT package page)
- [PF2e Roll Manager](https://foundryvtt.com/packages/pf2e-roll-manager) - Alternative roll request implementation
- [PF2e System GitHub](https://github.com/foundryvtt/pf2e) - Primary system repository (structure verified, code examples derived)

### Tertiary (LOW confidence - needs verification)
- PF2e actor.skills[slug].roll() API - Inferred from community examples, not verified in official docs
- DC visibility options ('gm', 'all', 'none', 'owner') - Pattern from community modules, exact param structure unverified
- Statistic class structure - Referenced in community discussions but not documented

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - socketlib confirmed, PF2e APIs inferred from community usage
- Architecture: MEDIUM - Socket patterns verified, roll API structure needs code inspection
- Pitfalls: HIGH - Based on known Foundry/PF2e behaviors and existing StoryFrame patterns
- Code examples: MEDIUM - Derived from community examples and API docs, not tested in PF2e context

**Research date:** 2026-01-30
**Valid until:** ~7-14 days (PF2e system updates monthly, Foundry VTT stable)

**Verification needed before implementation:**
1. Inspect PF2e actor object in console to confirm: `actor.skills[slug].roll()` method signature
2. Test `actor.perception.roll()` vs `actor.skills` structure
3. Verify DC parameter structure: `{ value, visibility }` in actual PF2e roll calls
4. Confirm socketlib `executeAsUser` works with current socketlib version in StoryFrame
5. Test ChatMessage with rollMode to understand PF2e chat card behavior

**Research limitations:**
- No access to live PF2e system to inspect actual actor object structure
- Official PF2e API documentation not publicly available (community-maintained wiki pages incomplete)
- Roll method parameter structure derived from module patterns, not official docs
- Some findings based on 2025 sources, may have changed in recent PF2e system updates
