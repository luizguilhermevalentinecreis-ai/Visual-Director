# Visual Director

Visual Director is a local-first AI authoring system for Roblox VFX. It follows the same bridge/plugin/relay model as Motion Director, but its domain is visual effects:

- 3D attack effects: particles, beams, trails, lights and animated Neon geometry;
- 2D attack layers and impact frames;
- HUD and cinematic screen templates;
- camera-shake, FOV, blur and color-treatment cues;
- sound cues synchronized to visual markers;
- safe staging, validation, commit, attach and edit-time preview.

The AI never sends executable Luau. It sends a complete declarative `VfxDraft`; the plugin validates the supported fields and creates Roblox instances itself.

## Current version

`v0.1.0` is an MVP for development and controlled testing. It is not a public Marketplace release yet. The data contract and transactional Studio flow are implemented; runtime playback helpers, asset upload workflows and visual human review still need iteration.

## Repository layout

- `src/domain.ts` — complete VFX draft schema.
- `src/quality.ts` — structural, timing and layering review.
- `src/bridge.ts` — local MCP-to-Studio bridge on port `34728`.
- `src/web-relay.ts` — HTTPS relay used by a Custom GPT.
- `src/index.ts` — local MCP server.
- `studio-plugin/VisualDirectorPlugin.server.lua` — Roblox Studio plugin.
- `gpt-custom/INSTRUCTIONS.md` — Custom GPT behavior.
- `docs/CHATGPT_CUSTOM_GPT.md` — setup guide.

## Local development

Requirements: Node.js 22+, Roblox Studio with HTTP Requests enabled, and optionally Rojo 7.

```powershell
npm ci
npm run check
npm test
npm run build
rojo build plugin.project.json -o VisualDirectorPlugin.rbxmx
```

Run the local MCP server:

```powershell
npm run dev
```

In the plugin, use `http://127.0.0.1:34728` when connecting directly to the local MCP bridge. Use the deployed HTTPS relay URL for a Custom GPT.

## Deploy the relay

The included `render.yaml` and `Dockerfile` are ready for Render. After deployment:

1. Open `https://YOUR-SERVICE.onrender.com/health`.
2. Set that URL in the Visual Director plugin and click Connect.
3. Copy the permanent pairing code.
4. Import `https://YOUR-SERVICE.onrender.com/openapi.json` into a Custom GPT Action.
5. Use `https://YOUR-SERVICE.onrender.com/privacy` as the privacy-policy URL.

No OpenAI or Roblox API key is required for pairing. The random plugin token authenticates the current Studio launch; the visible pairing code remains stable for that Studio user until plugin settings are cleared.

## Draft lifecycle

1. Read capabilities and current selection.
2. Inspect existing VFX when using references.
3. Author one complete `VfxDraft` with explicit palette, timing markers and nodes.
4. Validate it.
5. Stage it with a transaction name.
6. Commit the transaction into `ReplicatedStorage.VisualDirectorVFX`.
7. Attach it to the selected target when requested.
8. Preview important times and ask for human visual review.

Committed packages retain the complete source draft in attributes, so later tools can reconstruct and refine the effect rather than treating it as an opaque folder.

## Security boundary

- No arbitrary Lua/Luau received from an AI is evaluated.
- Write actions require explicit `confirmWrite: true` through the web relay.
- Plugin launch tokens are not the visible pairing code.
- Pairing sessions expire when the Studio plugin stops polling.
- Draft limits cap duration, node counts, sequence sizes and common performance-heavy properties.

## Roadmap

- runtime playback module with pooling and deterministic cleanup;
- CurveAnimation-style property timelines and a visual graph editor;
- automatic texture/sprite-sheet import and attribution metadata;
- viewport thumbnails and before/after comparison;
- GPU/particle-budget profiles for mobile, console and desktop;
- multi-character combat VFX synchronization with Motion Director markers;
- shared, review-gated global VFX knowledge.
