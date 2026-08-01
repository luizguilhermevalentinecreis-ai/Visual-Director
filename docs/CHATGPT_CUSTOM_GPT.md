# Visual Director Custom GPT

Visual Director connects a Custom GPT to Roblox Studio through the deployed HTTPS relay. ChatGPT supplies the model; no OpenAI API key is required.

## Production URLs

- Relay: `https://visual-director-relay.onrender.com`
- Health: `https://visual-director-relay.onrender.com/health`
- OpenAPI: `https://visual-director-relay.onrender.com/openapi.json`
- Privacy: `https://visual-director-relay.onrender.com/privacy`

## GPT package files

- `gpt-custom/INSTRUCTIONS.md` — paste into Instructions.
- `gpt-custom/KNOWLEDGE.md` — upload under Knowledge.
- `gpt-custom/CONFIG.md` — field values, starters, capabilities, URLs, and tests.

Do not upload the repository, plugin source, place files, environment files, asset secrets, or pairing codes as GPT Knowledge.

## Create the GPT

1. Open `https://chatgpt.com/gpts` on the web and select **Create**.
2. Open the direct configuration view.
3. Set name and description from `gpt-custom/CONFIG.md`.
4. Paste `gpt-custom/INSTRUCTIONS.md` into **Instructions**.
5. Upload `gpt-custom/KNOWLEDGE.md` under **Knowledge**.
6. Add the conversation starters from `CONFIG.md`.
7. Under **Actions**, create a new action.
8. Select Authentication **None**. The Studio pairing code is supplied per conversation and must not be saved in the GPT.
9. Use **Import from URL**:
   `https://visual-director-relay.onrender.com/openapi.json`
10. Confirm the editor detects the action catalog, including capabilities, selection, inspection, profiling, procedural generation, node graphs, capture, modules, operations, validation, stage, commit, attach, preview, runtime smoke, and `getVisualDirectorJob`.
11. Set Privacy Policy URL:
    `https://visual-director-relay.onrender.com/privacy`
12. Do not enable GPT Apps; Apps and custom Actions are mutually exclusive. Other capabilities are optional.
13. Keep sharing set to **Only me** for initial tests.

## Connect Studio

1. Install/open the current `VisualDirectorPlugin.rbxmx`.
2. Enable **Game Settings > Security > Allow HTTP Requests**.
3. Open Visual Director.
4. Choose `CHATGPT WEB`; the relay defaults to `https://visual-director-relay.onrender.com`.
5. Copy the persistent personal pairing code and use it only in the current private conversation.

## Preview tests

1. Ask the GPT to read capabilities and selection. Those must be the first Studio calls.
2. Inspect a selected reference with bounded pagination.
3. Select a disposable Part and request a procedural one-shot impact.
4. Confirm: generate -> validate -> stage -> poll -> commit -> poll -> attach -> preview.
5. Confirm write calls require approval while reads do not.
6. Test an attached looped aura in Edit mode; it should remain visible for continuous art review.
7. Enter Play mode and run the authored timeline; node windows must start, stop, and clean up correctly.
8. Compile a small node graph and verify directional/field behavior.
9. Run `profileSelectedVfx` and `smokeVisualRuntime`.
10. Confirm the GPT never asks for arbitrary Luau or an OpenAI API key.

## Update the GPT

After changing instructions, Action endpoints, or schemas:

1. Open `https://chatgpt.com/gpts/mine` and edit Visual Director.
2. Replace Instructions with the current `gpt-custom/INSTRUCTIONS.md`.
3. Remove the old Knowledge file and upload the current `gpt-custom/KNOWLEDGE.md`.
4. Open the Action and re-import `https://visual-director-relay.onrender.com/openapi.json`.
5. If the operation list does not refresh, delete and recreate the Action with Authentication **None**.
6. Restore the privacy URL if necessary.
7. Run the Preview tests, particularly new operations and runtime behavior.
8. Select **Update**. Use GPT version history for rollback.

A successful Render deployment does not automatically refresh the schema cached by an existing GPT. Re-import after operation or request-schema changes.

## Deploy or update Render

The repository includes `render.yaml` and a Dockerfile. On the existing service, pushes to the connected main branch should trigger deployment if auto-deploy is enabled.

Required public setting:

```text
VISUAL_PUBLIC_BASE_URL=https://visual-director-relay.onrender.com
```

The platform normally provides `PORT`. Never commit secrets. After deploy, verify `/health`, `/openapi.json`, and `/privacy` before updating the GPT.

## Security and publishing

- Pairing codes are capability secrets while the plugin is connected.
- The relay exposes declarative VFX operations, not arbitrary Luau.
- Write operations require `confirmWrite=true`.
- Draft/job data is used to route requested work and should not be placed in public Knowledge.
- Public GPTs with Actions require a valid privacy policy URL.
- Verify domain allowlists in managed workspaces.
