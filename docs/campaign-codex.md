# Campaign Codex integration

Enable Campaign Codex alongside StoryFrame. Integration activates automatically when both modules are active. Requires GM access; Campaign Codex remains optional.

## Run from Codex sheets

Codex sheets gain the StoryFrame sidebar toggle and **Stage** / **Recap** controls. NPC sheets also gain **Add speaker** and **Speak**. The sidebar reads checks from the active Codex tab, including enriched inline checks.

**Stage** opens a private cast/background preview. Locations include directly linked NPCs and NPCs from linked shops. Shops, groups and other entries use their directly linked NPCs/associates. NPC entries include themselves. Duplicate actors are combined; missing actors fall back to journal portraits. Hidden relationships start unchecked; explicitly selected hidden NPCs retain hidden names.

Background defaults to the Codex image, then linked Foundry scene background. Edit the path or clear it before launching. **Launch** replaces the current StoryFrame cast/background and clears active/secondary speakers. It follows StoryFrame's existing cinematic preparation/player visibility setting. It does not activate the linked Foundry scene or alter Codex relationships, prose or permissions.

**Add speaker** immediately adds the NPC to the current StoryFrame cast. **Speak** adds them if needed, then makes them active. These operate on the current live presentation.

## Save and refresh

**Save scene** stores the selected cast/background in StoryFrame's existing speaker scene library, associated with the Codex journal UUID. Saving does not publish the cast. Reopening **Stage** restores that saved preparation. **Refresh links** rebuilds the private preview from current Codex relationships; saving is explicit. Ordinary StoryFrame scene editing and loading remain available.

Loading an associated scene from StoryFrame's cinematic scene list starts recap capture too. Disabling Codex leaves saved StoryFrame scenes usable.

## Export recap

Launching a Codex stage starts a capture session for the current Foundry scene. Captures subsequently sent StoryFrame dialogue, completed tracked checks, and presented challenges, including challenges later removed. It does not infer unrecorded challenge victory points or include older rolls.

Choose **Recap**, select a destination Codex journal, review/edit the generated HTML, then **Append to Notes**. Secret checks are excluded unless explicitly selected; selecting them reveals their additional preview. Existing notes remain intact. Codex's content API handles both legacy flag storage and newer journal pages. The integration never changes note permissions.

Capture is local to the GM browser session: reload loses capture; launching/loading another Codex stage starts a new capture for that scene. Export before moving to another stage when preserving its recap matters. Repeated exports append repeated recaps by design.

## Validation

Run `node --test tests/*.test.mjs` for regressions. For isolated rendered checks, run `node tests/fixtures/serve-campaign-codex.mjs` and open the printed localhost URL. The fixture simulates Foundry APIs and changes no world documents; it is not a substitute for a live multi-client Foundry check.
