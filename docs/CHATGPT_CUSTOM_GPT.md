# Custom GPT setup

1. Deploy this repository on Render using `render.yaml`.
2. Build/install `VisualDirectorPlugin.rbxmx` in Roblox Studio.
3. Enable **Game Settings > Security > Allow HTTP Requests**.
4. Paste the Render HTTPS URL into the plugin and connect.
5. Copy the permanent pairing code shown by the plugin.
6. In ChatGPT, create a GPT and add an Action.
7. Choose **Import from URL** and use `https://YOUR-SERVICE.onrender.com/openapi.json`.
8. Set the privacy policy to `https://YOUR-SERVICE.onrender.com/privacy`.
9. Paste `gpt-custom/INSTRUCTIONS.md` into the GPT instructions.

The OpenAPI document contains the full `VfxDraft` schema, so ChatGPT can author all required fields instead of claiming the interface cannot create a draft.

Queued write calls return a `jobId`. The GPT must call `getVisualDirectorJob` until the job becomes `succeeded` or `failed`.
