# Feature Research

**Domain:** FoundryVTT Journal/Dialogue Enhancement Modules
**Researched:** 2026-01-29
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Display speaker portraits | Every dialogue module shows who's talking | LOW | Core visual element. Theatre Inserts, ConversationHUD, Chat Portrait all do this |
| Show active speaker | Users need visual indicator of who's speaking | LOW | ConversationHUD highlights, Theatre Inserts centers character |
| Multiple speaker support | Conversations involve 2+ characters | LOW | Core requirement for any dialogue tool |
| Actor integration | Use existing actor data/images | MEDIUM | Must work with Foundry's actor system |
| GM control of speaker changes | GM drives the narrative flow | LOW | GM clicks to switch active speaker |
| Real-time player sync | Players see what GM shows instantly | MEDIUM | Built on Foundry's socket system |
| Portrait thumbnails/gallery | Quick visual scan of all participants | LOW | ConversationHUD does this, Theatre Inserts has staging bar |
| Works without tokens on scene | Not all conversations happen on active maps | MEDIUM | Character Chat Selector solves this, critical for improvised dialogue |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Journal text integration | Read prepared dialogue without switching windows | MEDIUM | **KEY DIFFERENTIATOR**: Theatre Inserts uses chat, ConversationHUD is portrait-only. Journal reading = StoryFrame's core value |
| Add speakers on-the-fly | Improvised scenes don't break flow | MEDIUM | Character Chat Selector has /as command, but StoryFrame should make this visual/instant |
| Minimal setup overhead | Just open journal and go | LOW | Theatre Inserts requires emote config, staging setup. Simplicity = competitive advantage |
| Non-actor image support | Use any image as speaker | LOW | Not tied to actor system for improvised NPCs |
| Persistent speaker gallery | Gallery stays visible during reading | LOW | Theatre Inserts hides portraits when not active, ConversationHUD is separate window |
| Single-window experience | Everything in one UI | HIGH | Theatre Inserts splits portrait + chat. ConversationHUD + journal = 2+ windows. Unified = advantage |
| Conversation state save/restore | Save speaker lineup for recurring scenes | MEDIUM | ConversationHUD saves conversations to journals. Useful but not MVP |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Animated text effects | Theatre Inserts does visual-novel style text | Adds complexity, slows reading pace, hard to maintain across Foundry versions | Simple readable text. Speed > flash for dialogue-heavy games |
| Emote system with expression variants | Theatre Inserts offers this, feels cinematic | Requires extensive per-actor setup, breaks "just open and go" flow | Single portrait per speaker. Let actor art convey emotion |
| Full visual novel staging | Position characters left/right/center with layers | Complex UI, significant setup time, scope creep | Simple gallery view. Focus on reading + speaker clarity |
| Chat integration | Theatre Inserts renders to chat | Chat becomes cluttered, doesn't work for pre-written journal text | Dedicated reading UI separate from chat |
| Voice synthesis/AI dialogue | Talking Actors, AI Actors do this | External API dependencies, cost, latency, breaks immersion when imperfect | Human GM reading. Keep it simple |
| Complex animation system | Theatre Inserts emote animations | Version compatibility issues, performance concerns | Static portraits or simple highlight/scale |

## Feature Dependencies

```
[Journal Text Display]
    └──requires──> [Speaker Gallery]
                       └──requires──> [Active Speaker Indicator]

[Add Speaker On-the-Fly]
    └──requires──> [Non-Actor Image Support]

[Real-time Player Sync]
    └──requires──> [Socket Communication]
                       └──requires──> [Speaker State Management]

[Conversation Save/Restore] ──enhances──> [Speaker Gallery]

[Emote System] ──conflicts──> [Minimal Setup]
[Chat Integration] ──conflicts──> [Journal Text Display]
[Animated Text] ──conflicts──> [Simple Reading Experience]
```

### Dependency Notes

- **Journal Text Display requires Speaker Gallery:** Can't show who's talking without visual speaker reference
- **Speaker Gallery requires Active Speaker Indicator:** Gallery is useless if players don't know who's currently speaking
- **Add Speaker On-the-Fly requires Non-Actor Image Support:** Can't improvise if forced to create actors first
- **Real-time Player Sync requires Socket Communication:** Foundry's socket system is foundation for multiplayer
- **Emote System conflicts with Minimal Setup:** Per-actor emote configuration destroys "just open and go" UX
- **Chat Integration conflicts with Journal Text Display:** Can't read journal in chat, text goes to wrong place
- **Animated Text conflicts with Simple Reading:** Complexity increases maintenance burden, provides marginal UX value

## MVP Definition

### Launch With (v1)

Minimum viable product - what's needed to validate the concept.

- [ ] **Display speaker gallery (thumbnails)** — Core visual element. Without this, module has no UI
- [ ] **Show active speaker indicator** — Must know who's talking. Highlighting, border, or scale
- [ ] **GM click to change active speaker** — Basic interaction. Click thumbnail = set active
- [ ] **Real-time broadcast to players** — Table stakes for multiplayer. Use Foundry sockets
- [ ] **Read journal text** — Core value prop. Display journal page content alongside speakers
- [ ] **Add speaker from actor** — Basic speaker source. Drag actor to gallery
- [ ] **Add speaker from image path** — Improvisation support. Paste URL/path to add speaker
- [ ] **Works without tokens on scene** — Critical for dialogue-heavy games with scene transitions

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] **Remove speaker from gallery** — Cleanup. Right-click to remove. Add after basic gallery works
- [ ] **Reorder speakers in gallery** — Polish. Drag to reorder. Add when users request it
- [ ] **Speaker labels/names** — Quality of life. Show name under thumbnail. Add if user feedback shows confusion
- [ ] **Save conversation to journal** — Persistence. Store speaker lineup for reuse. Add when users have recurring scenes
- [ ] **Hotkeys for speaker switching** — Power user feature. Number keys 1-9 for speakers. Add when users master clicking

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Multiple conversation slots** — Manage several scenes simultaneously. Wait for user demand
- [ ] **Integration with Monk's Enhanced Journal** — Compatibility with popular journal module. Wait until MVP proves demand
- [ ] **Speaker position persistence** — Remember where in gallery each actor goes. Add if users complain about reordering
- [ ] **Narrator mode** — No active speaker, pure scene text. Niche feature, defer
- [ ] **Export conversation log** — Save transcript of dialogue session. Unclear demand, defer

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Speaker gallery display | HIGH | MEDIUM | P1 |
| Active speaker indicator | HIGH | LOW | P1 |
| GM click to change speaker | HIGH | LOW | P1 |
| Real-time broadcast | HIGH | MEDIUM | P1 |
| Journal text display | HIGH | HIGH | P1 |
| Add speaker from actor | HIGH | MEDIUM | P1 |
| Add speaker from image | HIGH | LOW | P1 |
| Works without tokens | HIGH | LOW | P1 |
| Remove speaker | MEDIUM | LOW | P2 |
| Reorder speakers | MEDIUM | MEDIUM | P2 |
| Speaker labels | MEDIUM | LOW | P2 |
| Save conversation | MEDIUM | HIGH | P2 |
| Hotkeys | LOW | MEDIUM | P3 |
| Multiple conversation slots | LOW | HIGH | P3 |
| Narrator mode | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch (MVP)
- P2: Should have, add when possible (v1.x)
- P3: Nice to have, future consideration (v2+)

## Competitor Feature Analysis

| Feature | Theatre Inserts | ConversationHUD | Our Approach (StoryFrame) |
|---------|-----------------|-----------------|---------------------------|
| Speaker portraits | Full-screen standin graphics | Thumbnail gallery in HUD window | Thumbnail gallery in reading UI |
| Text display | Chat messages with animation | None (portrait-only) | Journal text directly in reading UI |
| Active speaker | Centers portrait on screen | Highlights thumbnail border | Highlight/scale in gallery |
| Add speakers | Right-click actor in sidebar | Add to conversation via UI | Drag actor or paste image |
| Multiplayer sync | Full sync via sockets | Full sync via sockets | Full sync via sockets |
| Setup overhead | Emote configuration required | Save conversation first | Zero - just open journal |
| Integration point | Chat system | Standalone HUD | Journal system |
| Improvisation | Requires actor/token | Requires adding to conversation | Image path = instant speaker |

**Key differentiators:**
- **Theatre Inserts:** Visual novel style, heavy setup, chat-based, complex but cinematic
- **ConversationHUD:** Portrait gallery only, no text, requires separate journal reading
- **StoryFrame:** Journal + gallery in one UI, minimal setup, improvisation-friendly

## Sources

### Module Documentation
- [Theatre Inserts Package](https://foundryvtt.com/packages/theatre)
- [Theatre Inserts GitHub](https://github.com/League-of-Foundry-Developers/fvtt-module-theatre)
- [ConversationHUD Package](https://foundryvtt.com/packages/conversation-hud)
- [ConversationHUD GitHub](https://github.com/CristianVasile23/conversation-hud)
- [Monk's Enhanced Journal](https://foundryvtt.com/packages/monks-enhanced-journal)
- [Chat Portrait](https://foundryvtt.com/packages/chat-portrait)
- [Character Chat Selector](https://foundryvtt.com/packages/character-chat-selector)
- [Narrative Portrait Spotlight](https://foundryvtt.com/packages/narrative-portrait-spotlight)

### Community Resources
- [DM Lair: 6 Must-Have Foundry VTT Modules](https://thedmlair.com/blogs/news/6-must-have-foundry-vtt-modules)
- [Bryan's Preferred Modules for FoundryVTT](https://bryancasler.github.io/Bryans-Preferred-Modules-for-FoundryVTT/)
- [Todori's Tips: Modules for Text-based Games](https://www.foundryvtt-hub.com/news/modules/todoris-tips-modules-for-text-based-games/)

### Technical Documentation
- [Foundry VTT Journal Entries](https://foundryvtt.com/article/journal/)
- [Foundry VTT Audio/Video Chat Integration](https://foundryvtt.com/article/audio-video/)
- [Foundry VTT Sockets API](https://foundryvtt.wiki/en/development/api/sockets)

### Known Issues
- [Theatre Inserts Issues](https://github.com/League-of-Foundry-Developers/fvtt-module-theatre/issues)
- [ConversationHUD Changelog](https://github.com/CristianVasile23/conversation-hud/blob/main/CHANGELOG.md)

---
*Feature research for: StoryFrame (FoundryVTT Journal/Dialogue Enhancement)*
*Researched: 2026-01-29*
