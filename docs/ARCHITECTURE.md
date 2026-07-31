# Architecture

Visual Director separates intent, transport and Studio mutation.

```text
AI client / Custom GPT
        |
        | complete declarative VfxDraft
        v
Local MCP bridge or HTTPS relay
        |
        | authenticated queued command
        v
Roblox Studio plugin
        |
        +-- validate supported node properties
        +-- stage immutable draft JSON
        +-- commit Roblox templates
        +-- attach/preview with ChangeHistory waypoints
```

## VFX package

Committed effects live under `ReplicatedStorage.VisualDirectorVFX/<PackageName>` and contain:

- package metadata and the original source draft;
- `Nodes` with physical, particle, beam, trail, light, UI, camera and sound templates;
- `Markers` with anticipation, release, impact, hit-stop and recovery times.

Attached effects are cloned into `<SelectedTarget>/VisualDirectorVFX`. Parts retain a local CFrame attribute and are transformed relative to the selected target pivot.

## Node model

All nodes have an ID, timing interval, optional parent relationship, tags and an enabled flag. Specialized node types expose only allowlisted Roblox properties. Timeline playback is data-driven; no user-provided source code is accepted.

## Transaction model

`stageVfxDraft` stores the complete draft in `ServerStorage.VisualDirectorStaging` under a generated transaction ID. `commitVfxDraft` consumes that transaction and replaces a same-named committed package as one Undo-recorded operation.

## Pairing model

The pairing code is generated once and stored in plugin settings. A separate random token authenticates each plugin launch. Sending an AI request does not rotate the visible code. The relay routes only to a live polling session with matching installation, launch and token credentials.
