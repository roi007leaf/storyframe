# Pitfalls Research

**Domain:** FoundryVTT Module Development
**Researched:** 2026-01-29
**Confidence:** MEDIUM

## Critical Pitfalls

### Pitfall 1: Socket Handlers Without Permission Validation

**What goes wrong:**
Player clients can trigger GM-only actions through sockets. Malicious/buggy clients execute privileged operations (modifying flags, deleting documents, bypassing permissions).

**Why it happens:**
FoundryVTT sockets have no built-in permission controls. By default, socket events broadcast to ALL connected clients. Developers assume socket.io provides security - it doesn't.

**How to avoid:**
ALWAYS validate permissions in socket handler:

```javascript
function handleEvent(data) {
  if (!game.user.isGM) return; // For GM-only ops
  // Or check document ownership
  const doc = game.journal.get(data.id);
  if (!doc.testUserPermission(game.user, "OWNER")) return;

  // Safe to proceed
}
```

For GM-only operations, use pattern: `if (game.user !== game.users.activeGM) return;`

Consider socketlib module - provides GM execution with permission checks built-in.

**Warning signs:**
- Socket handlers with no permission checks
- Direct document updates from socket events
- "It works when I test alone" (no multi-user testing)
- Session bugs only occur with players present

**Phase to address:**
Phase 1 (Architecture) - establish socket security pattern before any feature work.

---

### Pitfall 2: ApplicationV2 Lifecycle Misunderstanding

**What goes wrong:**
UI state desync, duplicate renders, form data loss, timing-dependent bugs. ApplicationV2 has mixed async/sync behavior - hooks not awaited, some methods run before completion.

**Why it happens:**
ApplicationV2 is new in v13. Developers assume Application v1 patterns work. Critical detail: `renderApplicationV2` hook fires but NOT awaited - async callbacks may not finish before render continues.

Calling `sheet.render(false)` still calls `_prepareContext()` on first render even when force=false (unexpected behavior).

**How to avoid:**
- Use `_prepareContext()` and `_preparePartContext()` (async, awaited)
- Never assume hooks finish before proceeding
- Don't mix v1 and v2 patterns (ContextMenu.create is deprecated for v2)
- Use `_configureRenderOptions()` for part configuration, not constructor
- Remember: no jQuery by default (can still use: `$(this.element)`)
- Form validation strips nested data (handle embedded documents separately)

**Warning signs:**
- Race conditions in UI updates
- "Works sometimes, fails other times"
- Form data doesn't save
- Context menus don't appear
- Styling looks wrong (CSS layers changed in v13)

**Phase to address:**
Phase 1 (Architecture) - ApplicationV2 patterns must be correct from start. Fixing later = rewrite all UI code.

---

### Pitfall 3: Journal Permission Model Confusion

**What goes wrong:**
Players see content they shouldn't. GMs can't access journal pages. Map notes show wrong permissions. Permission changes don't save.

**Why it happens:**
Journal permissions are TWO-LEVEL: entry-level AND page-level. Multiple known bugs:
- Pages inherit entry permissions incorrectly (Issue #7662)
- Map notes use entry permissions, not page permissions (Issue #7730)
- "Show Players" workflow doesn't save ownership changes (Issue #13213)
- Players lose sharing ability after first share (Issue #8716)

System complexity + core bugs = broken permission UX.

**How to avoid:**
- Set permissions at BOTH entry and page level explicitly
- Don't rely on permission inheritance
- Test with actual player accounts (not just solo GM testing)
- Verify permission changes persist after refresh
- For map notes, set entry-level permissions (page-level ignored)
- Avoid "Show Players" workflow for permanent changes
- Document permission quirks for users

**Warning signs:**
- Permission settings that "don't stick"
- Players report seeing/not seeing content inconsistently
- Map note access differs from journal access
- Ownership changes revert on reload

**Phase to address:**
Phase 2 (Permission System) - requires upfront research into known bugs, workarounds. Can't defer - affects core UX.

---

### Pitfall 4: Document Flag Schema Evolution Without Migration

**What goes wrong:**
Module updates break existing worlds. Old flag data causes crashes. Users lose data. "Worked in dev, broken in production."

**Why it happens:**
Flags are flexible key-value storage with NO schema validation. Easy to change flag structure between versions. No built-in migration system for module flags (only core documents have migrations).

Flag structure changes:
- v0.8.0 → flattened Documents from nested data
- v10 → Document as DataModel subclass
- v12 → PerceptionManager flags flattened to 1 dimension

Your module flags need migration strategy from v1.0.

**How to avoid:**
- Version your flag schema: `flags.storyframe.version = 1`
- Write migration on module init:
```javascript
Hooks.once('ready', async () => {
  for (let journal of game.journal) {
    const version = journal.getFlag('storyframe', 'version') || 0;
    if (version < 2) {
      await migrateV1toV2(journal);
      await journal.setFlag('storyframe', 'version', 2);
    }
  }
});
```
- Test migration with real world data (not empty test worlds)
- Log migration progress for debugging
- Make migrations idempotent (safe to run multiple times)
- Consider migration failures (partial updates, interrupted process)

**Warning signs:**
- Flag structure changes between dev iterations
- "Just reset your flags" in dev channel
- No version tracking in saved data
- Assumptions about flag shape

**Phase to address:**
Phase 1 (Architecture) - establish flag schema + versioning BEFORE storing any production data. Retrofitting = pain.

---

### Pitfall 5: Hook Timing Dependency Bugs

**What goes wrong:**
Module features work inconsistently. "Loaded too early" or "too late" bugs. Compendium data not available. Module conflicts.

**Why it happens:**
Foundry has specific hook sequence: `init → i18nInit → setup → ready`

- **init**: Only constructor properties available (CONFIG exists, document data doesn't)
- **setup**: Document data loaded, canvas NOT initialized
- **ready**: Everything initialized

Developers modify CONFIG/CONST before `init` (load order issues). Try to access compendiums before they initialize. Don't understand async constraint: hooks NOT awaited, can't use async callbacks reliably.

**How to avoid:**
- Register settings in `init`
- Modify CONFIG in `init` (after setup = too late for some systems)
- Access documents/compendiums in `ready` or later
- Mark module as "library" type if other modules depend on it (libraries load first)
- Never assume module load order (except libraries)
- Don't use `await` in hooks (not awaited anyway - use promise chains if needed)

**Warning signs:**
- "Sometimes works, sometimes doesn't" on world load
- Errors about undefined documents/compendiums
- Works when module is alone, breaks with other modules
- CONFIG changes don't take effect

**Phase to address:**
Phase 1 (Architecture) - initialization sequence must be correct. Wrong hook usage = unreliable foundation.

---

### Pitfall 6: Manifest Validation Errors Blocking Installation

**What goes wrong:**
Users can't install/update module. "Invalid manifest" errors. Module doesn't appear in list.

**Why it happens:**
JSON is strict (no trailing commas, quotes required). `id` must match folder name EXACTLY. Missing required fields. Wrong field names (v10+ uses `id` not `name` for machine-readable). Deprecated fields (minimumCoreVersion, compatibleCoreVersion) cause warnings even when new compatibility object exists.

Common errors:
- Missing `packs[].type` (most common validation error)
- Invalid JSON syntax
- Duplicate version numbers in releases
- Module name/folder name mismatch

**How to avoid:**
- Validate JSON with linter (https://jsonlint.com/)
- Required fields: `id`, `title`, `description`, `version`
- Use `compatibility` object (v10+) not deprecated fields
- `id` in manifest = folder name (lowercase, hyphens not underscores)
- Each release = unique version number
- Test install from manifest URL before releasing
- Use `esmodules` not `scripts` (modern standard)

**Warning signs:**
- Manifest changes before release
- Manual JSON editing (use schema validation)
- Untested installation process

**Phase to address:**
Phase 0 (Setup) - validate manifest structure before any development. Invalid manifest = module doesn't exist.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hard-coded data paths like `actor.attributes.str.mod` | Fast initial development | Module only works with specific system (D&D 5e) | Never - breaks system-agnostic promise |
| Relative imports between modules | Easy code sharing | Breaks when other module updates/missing | Never - ask dev to expose API instead |
| Overwriting core functions without fallback | Can modify any behavior | High failure risk, breaks with core updates | Only with defensive coding + error fallback |
| Using deprecated Application v1 API | Familiar patterns | Will break in v16, harder to migrate later | Only if supporting pre-v12 Foundry |
| Storing unversioned flags | No migration code needed | Breaking changes = data loss | Never - always version flag schema |
| Skip permission validation in sockets | Fewer lines of code | Security hole, exploitable | Never - validates permission EVERY time |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| socketlib module | Assuming automatic GM permission checks | Still validate permissions in handler - socketlib routes to GM but doesn't validate intent |
| CSS styling | Using old specificity rules | Use CSS Layers (v13+) and CSS variables for theming |
| Localization | Hard-coded English strings | Use game.i18n.localize() for all user-visible text |
| Settings | Registering settings in `setup` or `ready` | Register in `init` hook - too late otherwise |
| Document dependencies | Accessing in `init` or `setup` | Wait for `ready` - document data not loaded yet |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Socket event loops | Infinite socket emissions, client freezes | Never emit socket in response to socket event without guard condition | First multi-client test |
| Re-rendering entire journal on flag change | Noticeable lag, poor UX | Use targeted updates, debounce renders | >10 rapid updates |
| Loading large images in sheets | Slow sheet open, memory issues | Lazy load images, use thumbnails, implement pagination | >50 images |
| Iterating all documents on hooks | Freezes on world load | Index documents once in `ready`, maintain cache | >1000 documents |
| Synchronous flag updates in loops | UI blocking | Batch updates, use single update with multiple flags | >100 updates |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| No permission check in socket handlers | Players execute GM actions, modify any document | Always check `game.user.isGM` or document.testUserPermission() |
| Trusting client-provided IDs in sockets | Client sends wrong ID, modifies wrong document | Validate document exists + user has permission |
| Exposing API without permission wrapper | Other modules bypass permissions | Wrap API methods with permission checks |
| Using innerHTML with user input | XSS injection | Use textContent or sanitize with DOMPurify |
| Storing sensitive data in flags | All users can read flags | Flags are PUBLIC - never store secrets/tokens |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No loading states | "Is it working?" confusion | Show spinners, progress indicators |
| Errors without user feedback | Silent failures, "broken" perception | Toast notifications for errors, log to console |
| Changes don't persist without save button | Data loss, frustration | Auto-save on change with debounce |
| No GM/player distinction in UI | Players see disabled buttons, confusion | Hide UI elements players can't use (not just disable) |
| Breaking live sessions with updates | Mid-game crashes, GM panic | Test with active sessions, add migration notices |
| Complex permission UI | GMs don't understand who sees what | Use visual indicators, preview mode |

## "Looks Done But Isn't" Checklist

- [ ] **Socket handlers:** Verify permission checks exist + tested with non-GM users
- [ ] **ApplicationV2 forms:** Verify embedded document edits handled separately (not in main form)
- [ ] **Journal permissions:** Verify both entry AND page level permissions set + tested with player account
- [ ] **Flag schema:** Verify version number in flags + migration code exists
- [ ] **Hook usage:** Verify using correct hook (init for CONFIG, ready for documents) + no await in hooks
- [ ] **Manifest:** Verify JSON valid + id matches folder + all required fields + compatibility object
- [ ] **Multi-user testing:** Verify tested with 2+ connected clients (not just solo GM)
- [ ] **Error handling:** Verify socket errors don't crash other clients
- [ ] **CSS styling:** Verify works with v13 CSS Layers (not just old specificity rules)
- [ ] **System-agnostic claims:** Verify no hard-coded paths like actor.attributes.str.mod

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Socket without permissions | MEDIUM | Add permission checks, release hotfix, notify users to update ASAP |
| ApplicationV2 v1 patterns | HIGH | Rewrite UI components for v2 lifecycle, extensive testing required |
| Permission bugs | MEDIUM | Document workarounds, set both entry+page permissions explicitly |
| Flag schema breaking change | HIGH | Write migration, test exhaustively, risk data loss if migration fails |
| Hook timing bugs | MEDIUM | Move logic to correct hook, may need to restructure initialization |
| Invalid manifest | LOW | Fix JSON, increment version, re-release (users can't install until fixed) |
| Missing migration | HIGH | Write retroactive migration, handle partially-migrated states |
| CSS broken in v13 | MEDIUM | Refactor to CSS Layers, test across Foundry versions |
| System-specific code | HIGH | Abstract system calls, use settings for data paths, may require redesign |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Socket permissions | Phase 1: Architecture | Code review for permission checks, test with player account |
| ApplicationV2 lifecycle | Phase 1: Architecture | UI renders correctly, no race conditions, form saves work |
| Journal permissions | Phase 2: Core Features | Test with player account, verify both levels set |
| Flag schema migration | Phase 1: Architecture | Migration runs successfully, old data loads correctly |
| Hook timing | Phase 1: Architecture | No load order errors, compendiums accessible, CONFIG applied |
| Manifest validation | Phase 0: Setup | Module installs successfully, appears in package manager |
| System-agnostic code | Phase 1: Architecture | Test with 3+ different systems (D&D 5e, PF2e, system-less) |
| Performance (socket loops) | Phase 3: Polish | Test rapid interactions, monitor for infinite loops |
| Security (socket validation) | Phase 1: Architecture | Security audit, attempt to bypass permissions |
| CSS compatibility | Phase 2: Core Features | Test on v12 and v13, verify layers work |

## Sources

- [FoundryVTT Module Development Best Practices](https://foundryvtt.wiki/en/development/guides/package-best-practices)
- [FoundryVTT Socket Documentation](https://foundryvtt.wiki/en/development/api/sockets)
- [ApplicationV2 Conversion Guide](https://foundryvtt.wiki/en/development/guides/applicationV2-conversion-guide)
- [ApplicationV2 API Documentation](https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html)
- [FoundryVTT API Migration Guides](https://foundryvtt.com/article/migration/)
- [FoundryVTT v13 Release Notes](https://foundryvtt.com/releases/13.341)
- [FoundryVTT Hooks Documentation](https://foundryvtt.wiki/en/development/api/hooks)
- [Journal Permission Bug #7662](https://github.com/foundryvtt/foundryvtt/issues/7662)
- [Journal Permission Bug #7730](https://github.com/foundryvtt/foundryvtt/issues/7730)
- [Show Players Bug #13213](https://github.com/foundryvtt/foundryvtt/issues/13213)
- [Manifest Validation Issues](https://github.com/flamewave000/dragonflagon-arch/issues/172)
- [Version 10 Manifest Migration](https://foundryvtt.com/article/manifest-migration-guide/)
- [Users and Permissions](https://foundryvtt.com/article/users/)

---
*Pitfalls research for: StoryFrame FoundryVTT Module*
*Researched: 2026-01-29*
