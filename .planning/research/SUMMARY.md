# Project Research Summary

**Project:** StoryFrame
**Domain:** FoundryVTT v13 Module Development (Journal/Dialogue Enhancement)
**Researched:** 2026-01-29
**Confidence:** HIGH

## Executive Summary

StoryFrame is a FoundryVTT module enabling GMs to display journal text alongside speaker portraits in a unified reading interface. Research shows this fills a gap between Theatre Inserts (cinematic but chat-based, requires extensive setup) and ConversationHUD (portrait-only, no text integration). The recommended approach: dual ApplicationV2 architecture (GM control + player viewer), native sockets for broadcast, document flags for persistence, zero-setup UX as competitive differentiator.

Technical foundation is solid: v13's ApplicationV2 is mature (all core UIs converted), socket patterns well-documented, flag persistence reliable. Critical risk is socket security — socket handlers need permission validation from day one (malicious clients can execute GM operations). Secondary risks: ApplicationV2 lifecycle misunderstandings (async/sync mixing causes race conditions), journal permission complexity (two-level entry+page permissions with known core bugs).

Architecture research strongly recommends role-separated apps over conditional rendering, centralized socket manager over scattered emits, and document flags over module settings for state. Build order matters: data layer → sockets → GM app → player app → polish. Deferring socket security or ApplicationV2 patterns = expensive rewrites later.

## Key Findings

### Recommended Stack

Core stack: TypeScript 5.x + Vite 6.x + Handlebars + ApplicationV2. V13 is stable (all core UIs ApplicationV2-converted), types available from League-of-Foundry-Developers main branch, Vite standard in community. ApplicationV2 + HandlebarsApplicationMixin for UI (unless building complex reactive state), native `game.socket` for GM→player broadcasts (socketlib only if complexity grows), document flags on Scene/JournalEntry for persistence.

**Core technologies:**
- **FoundryVTT API v13.350+**: Platform runtime — v13 stable, ApplicationV2 mandatory (v1 deprecated in v16)
- **TypeScript 5.x**: Type-safe development — standard for modules, use `target: "esnext"` (Foundry uses bleeding-edge JS)
- **Vite 6.x**: Build tool — community standard, fast HMR, Rollup production builds
- **ApplicationV2 + HandlebarsApplicationMixin**: UI framework — v13's modern approach, better lifecycle than v1
- **Native sockets**: Real-time sync — simple broadcast patterns, namespace as `module.storyframe`
- **Document flags**: Persistence — JSON-serializable data on Scene/Journal, auto-saved, permission-aware

### Expected Features

StoryFrame's value proposition: journal text + speaker gallery in one UI, minimal setup. Theatre Inserts requires emote config and uses chat; ConversationHUD is portrait-only, needs separate journal. Competitive advantage is "just open and go."

**Must have (table stakes):**
- Display speaker gallery (thumbnails) — every dialogue module has this
- Show active speaker indicator — highlight/border/scale who's talking
- GM click to change active speaker — basic interaction
- Real-time broadcast to players — multiplayer table stakes
- Read journal text — core value prop (differentiator from ConversationHUD)
- Add speaker from actor — basic data source
- Add speaker from image path — improvisation support
- Works without tokens on scene — critical for dialogue-heavy campaigns

**Should have (competitive):**
- Remove speaker from gallery — cleanup, add after basic gallery works
- Reorder speakers — polish, add when users request
- Speaker labels/names — add if feedback shows confusion
- Save conversation to journal — persistence, add for recurring scenes

**Defer (v2+):**
- Multiple conversation slots — wait for demand
- Monk's Enhanced Journal integration — wait until MVP proves demand
- Narrator mode (no active speaker) — niche, unclear demand
- Export conversation log — unclear value

### Architecture Approach

Dual ApplicationV2 pattern: separate GM control app (story picker, speaker management) and player viewer (read-only display). Centralized SocketManager handles all emit/on with namespace enforcement. StateManager abstracts document flags (preferably Scene flags for active session state). ActorResolver converts stored UUIDs to Actor references with graceful fallbacks for deletions.

**Major components:**
1. **GMControlApp (ApplicationV2)** — story selection, speaker management, broadcast controls (GM-only features)
2. **PlayerViewer (ApplicationV2)** — synchronized read-only display (clean role separation, independent styling)
3. **SocketManager** — centralized socket communication (namespace enforcement, prevents collisions)
4. **StateManager** — document flags abstraction (Scene.setFlag persistence, JSON state structure)
5. **ActorResolver** — UUID resolution (fromUuid with null handling for deleted actors)

**Key patterns:**
- Role-separated apps over conditional rendering (cleaner, independent templates, better testing)
- Centralized sockets over scattered emits (single source of truth, enforces `module.storyframe` namespace)
- Document flags over module settings (auto-saved, permission-aware, survives restart)
- UUID storage with async resolution (cross-scene/compendium, graceful deletion handling)

### Critical Pitfalls

Research identified 6 critical pitfalls with high impact if deferred. Top priority: socket security and ApplicationV2 lifecycle understanding from phase 1.

1. **Socket handlers without permission validation** — Players execute GM operations. Fix: ALWAYS check `game.user.isGM` or `document.testUserPermission()` in socket handlers. Consider socketlib for built-in GM execution. Address in Phase 1 (architecture) — can't retrofit security.

2. **ApplicationV2 lifecycle misunderstanding** — UI desyncs, race conditions, form data loss. Mixed async/sync behavior, hooks not awaited. Fix: Use `_prepareContext()` (async/awaited), avoid v1 patterns, no jQuery assumptions, handle form validation stripping nested data. Address in Phase 1 — wrong patterns = rewrite all UI code.

3. **Journal permission model confusion** — Two-level (entry+page) permissions with known core bugs. Map notes use entry permissions (ignore page), "Show Players" doesn't save ownership (#13213), inheritance broken (#7662). Fix: Set BOTH levels explicitly, test with player accounts, document workarounds. Address in Phase 2 (permission system) — affects core UX.

4. **Document flag schema evolution without migration** — Module updates break worlds, data loss, no built-in migration for module flags. Fix: Version flag schema (`flags.storyframe.version`), write migration on init, test with real data, idempotent migrations. Address in Phase 1 — retrofitting migrations = pain.

5. **Hook timing dependency bugs** — Module conflicts, load order issues, compendium access failures. Hook sequence: `init` (CONFIG), `setup` (documents loading), `ready` (everything initialized). Fix: Register settings in `init`, modify CONFIG in `init`, access documents in `ready`, mark as "library" if other modules depend. Address in Phase 1 — wrong hook = unreliable foundation.

6. **Manifest validation errors** — Users can't install. JSON strict (no trailing commas), `id` must match folder name, missing `packs[].type` most common error. Fix: Validate JSON, required fields (`id`, `title`, `description`, `version`), use `compatibility` object (v10+), test install from URL. Address in Phase 0 (setup) — invalid manifest = module doesn't exist.

## Implications for Roadmap

Based on architecture dependencies and pitfall prevention, recommend 4-phase structure: Foundation → Core Features → Polish → Extensions.

### Phase 1: Foundation (Data Layer + Sockets)
**Rationale:** Everything depends on state management and communication. Socket security and ApplicationV2 patterns must be correct from start — retrofitting = expensive rewrites.

**Delivers:**
- StateManager with versioned flag schema
- SocketManager with permission validation
- Module initialization (correct hooks)
- Valid manifest structure

**Addresses:**
- Pitfall #1 (socket security) — enforce GM permission checks
- Pitfall #4 (flag migrations) — version schema from day one
- Pitfall #5 (hook timing) — correct initialization sequence
- Pitfall #6 (manifest) — validate before development

**Avoids:** Building on insecure/unreliable foundation. Critical bugs compound if deferred.

**Research flag:** LOW — socket patterns and flag storage well-documented, standard implementations available.

### Phase 2: GM Control Interface
**Rationale:** GM app provides state modification interface. Requires Phase 1 (StateManager/SocketManager) complete. ApplicationV2 patterns from architecture research guide implementation.

**Delivers:**
- GMControlApp (ApplicationV2)
- Journal picker UI
- Speaker management (add/remove from actor or image)
- Broadcast on change

**Uses:**
- ApplicationV2 + HandlebarsApplicationMixin (STACK.md)
- Centralized socket pattern (ARCHITECTURE.md)
- Document flags for persistence (STACK.md)

**Implements:**
- Dual ApplicationV2 pattern (ARCHITECTURE.md)
- GM-only controls (FEATURES.md table stakes)

**Addresses:**
- Pitfall #2 (ApplicationV2 lifecycle) — use async `_prepareContext()`, avoid v1 patterns
- Pitfall #3 (journal permissions) — handle two-level permissions, test with player account

**Avoids:** Conditional rendering (anti-pattern from ARCHITECTURE.md), mixing v1/v2 patterns (causes race conditions).

**Research flag:** LOW — ApplicationV2 well-documented, HandlebarsApplicationMixin has official examples, journal picker standard pattern.

### Phase 3: Player Viewer Sync
**Rationale:** Player viewer consumes synced state. Requires Phase 1 (sockets) + Phase 2 (GM state source) complete. Separate app (not conditional rendering) per architecture recommendation.

**Delivers:**
- PlayerViewer (ApplicationV2)
- Read-only journal text display
- Speaker gallery with active indicator
- Socket listener for auto-refresh
- Actor UUID resolution

**Uses:**
- ActorResolver for UUID→Actor (ARCHITECTURE.md)
- Socket event handling (ARCHITECTURE.md)
- Same state structure as GM app

**Implements:**
- Role-separated ApplicationV2 (ARCHITECTURE.md)
- Real-time broadcast (FEATURES.md table stakes)
- Journal text integration (FEATURES.md key differentiator)

**Addresses:**
- Actor deletion handling (UUID resolution with fallbacks)
- Cross-scene actor references (UUID not ID)

**Avoids:** Synchronous actor access (anti-pattern from PITFALLS.md), assuming world-only actors.

**Research flag:** LOW — Player viewer simpler than GM app, socket listening standard, UUID resolution documented.

### Phase 4: UX Polish & Advanced Features
**Rationale:** Core functionality complete (Phases 1-3), now add competitive features from FEATURES.md "should have" list based on user feedback.

**Delivers:**
- Remove speaker from gallery
- Reorder speakers (drag-to-reorder)
- Speaker labels/names
- Conversation save/restore (flags on JournalEntry)
- Hotkeys for speaker switching (optional)

**Addresses:**
- FEATURES.md P2 (should have) items
- Quality of life improvements

**Research flag:** MEDIUM — Drag-to-reorder needs ApplicationV2 event handling research, conversation save/restore needs JournalEntry flag pattern investigation.

### Phase Ordering Rationale

- **Phase 1 first:** Foundation must be correct. Socket security, ApplicationV2 lifecycle, flag versioning, hook timing — all high-recovery-cost if wrong. Can't build on insecure/unreliable base.
- **Phase 2 before 3:** GM app sources state, player app consumes. Can't test player sync without GM state source. GM app validates StateManager/SocketManager integration.
- **Phase 3 before 4:** Core loop (GM broadcasts → players see) must work before polish features. Player viewer validates socket patterns, tests multi-client sync.
- **Phase 4 last:** Polish features need user feedback from working MVP. Some (drag-to-reorder, hotkeys) are power-user requests, unclear priority until real usage.

**Dependency chain:**
```
Phase 1 (Foundation) → Phase 2 (GM App) → Phase 3 (Player Viewer) → Phase 4 (Polish)
        ↓                     ↓                     ↓
   [All phases]         [Phases 2-4]         [Phases 3-4]
```

### Research Flags

**Phases with standard patterns (skip `/gsd:research-phase`):**
- **Phase 1:** Socket patterns well-documented in FoundryVTT wiki, flag storage standard, manifest validation straightforward
- **Phase 2:** ApplicationV2 has official docs + community wiki, journal picker standard pattern, speaker management CRUD operations
- **Phase 3:** Player viewer simpler than GM app, socket listening documented, UUID resolution has examples

**Phases possibly needing deeper research:**
- **Phase 4:** Drag-to-reorder in ApplicationV2 may need event handling investigation, conversation save/restore to JournalEntry flags needs pattern research if complexity emerges

Overall: Research coverage HIGH, standard patterns apply. Phase 4 is only uncertainty (depends on feature complexity in practice).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | V13 stable, ApplicationV2 complete, types available, Vite community standard. Official docs + wiki comprehensive. |
| Features | HIGH | Clear competitor landscape (Theatre Inserts, ConversationHUD), table stakes well-defined, differentiator identified (journal + gallery unified). MVP scope clear. |
| Architecture | HIGH | Dual ApplicationV2 pattern standard for GM tools, socket patterns documented, flag persistence reliable. Build order validated by dependency analysis. |
| Pitfalls | MEDIUM | Top 6 pitfalls identified with prevention strategies. Some drawn from issue tracker (journal permissions bugs confirmed). Performance/security patterns verified across sources. Hook timing well-documented. ApplicationV2 lifecycle nuances require attention. |

**Overall confidence:** HIGH

Research sources: Official FoundryVTT API docs, community wiki (curated), League-of-Foundry-Developers GitHub, verified module implementations. Core patterns consensus across multiple sources.

### Gaps to Address

**Minor gaps (handle during implementation):**

1. **ApplicationV2 drag-to-reorder events** — Phase 4 feature. Official docs cover event handling, may need experimentation for drag UX. Not blocking, defer until phase.

2. **Journal permission bug workarounds** — Known core bugs (#7662, #7730, #13213) documented but workarounds sparse. Plan to set both entry+page permissions explicitly, test extensively with player accounts. Document quirks for users.

3. **Performance at scale** — Research covers 0-50 player scaling, suggests debouncing and lazy-loading. StoryFrame likely 0-10 players (typical table size), standard patterns sufficient. Monitor in beta if larger groups adopt.

4. **Monk's Enhanced Journal compatibility** — Deferred to v2+, no research done. If users request early, need integration investigation (likely minor — just different journal sheet hooks).

**Validation during planning:**

- **Socket security pattern:** Code review Phase 1 for permission checks in every socket handler
- **ApplicationV2 lifecycle:** UI testing in Phase 2 for race conditions, form save issues
- **Multi-user sync:** Test with 2+ connected clients in Phase 3 (not just solo GM testing)
- **Journal permissions:** Test with actual player account in Phase 2-3 (verify both levels set)

## Sources

### Primary (HIGH confidence)
- [FoundryVTT API v13.350](https://foundryvtt.com/api/) — Official API documentation
- [ApplicationV2 API Documentation](https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html) — Official v2 reference
- [ApplicationV2 Community Wiki](https://foundryvtt.wiki/en/development/api/applicationv2) — Comprehensive guide
- [Release 13.341](https://foundryvtt.com/releases/13.341) — V13 release notes
- [Package Best Practices](https://foundryvtt.wiki/en/development/guides/package-best-practices) — Official checklist
- [Sockets API Wiki](https://foundryvtt.wiki/en/development/api/sockets) — Socket patterns
- [Document Flags API](https://foundryvtt.wiki/en/development/api/flags) — Flag usage
- [Handling Data: Flags, Settings, Files](https://foundryvtt.wiki/en/development/guides/handling-data) — Storage patterns

### Secondary (MEDIUM confidence)
- [League-of-Foundry-Developers foundry-vtt-types](https://github.com/League-of-Foundry-Developers/foundry-vtt-types) — TypeScript types (v13 beta)
- [Theatre Inserts Module](https://foundryvtt.com/packages/theatre) — Competitor analysis
- [ConversationHUD Module](https://foundryvtt.com/packages/conversation-hud) — Competitor analysis
- [GitHub Issues #7662, #7730, #13213](https://github.com/foundryvtt/foundryvtt/issues) — Journal permission bugs
- [Vite Guide](https://foundryvtt.wiki/en/development/guides/vite) — Build tool setup

### Tertiary (Community resources)
- Community module templates — ApplicationV2 implementation examples
- FoundryVTT Discord #module-development — Patterns and pitfall discussions
- DM Lair/Bryan's Preferred Modules lists — Feature landscape research

---
*Research completed: 2026-01-29*
*Ready for roadmap: yes*
