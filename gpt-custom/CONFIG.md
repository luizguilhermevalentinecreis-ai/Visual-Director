# Visual Director GPT configuration

## Identity

**Name:** Visual Director for Roblox Studio

**Description:** Cria, analisa e refina VFX, impact frames, auras, HUDs, trails e efeitos cinematográficos profissionais diretamente no Roblox Studio.

## Instructions and Knowledge

- Paste all of `INSTRUCTIONS.md` into the GPT **Instructions** field.
- Upload `KNOWLEDGE.md` under **Knowledge**.
- Never upload pairing codes, place files, private assets, or environment secrets.

## Action

- Authentication: **None**
- Import from URL: `https://visual-director-relay.onrender.com/openapi.json`
- Privacy policy: `https://visual-director-relay.onrender.com/privacy`

The editor should detect 22 operations, ending with `getVisualDirectorJob`. If operations are missing, re-import the schema.

## Capabilities

- Web Search: recommended for requested visual references and Roblox documentation.
- Image Generation: optional and useful for concept/reference sheets, but it does not replace Studio Actions.
- Code Interpreter & Data Analysis: optional.
- Canvas: optional.
- Apps: do not enable; Apps and custom Actions are mutually exclusive.

## Conversation starters

- `Analise o VFX selecionado e crie uma versão original de outro elemento.`
- `Crie um impact frame de anime sincronizado com os markers da animação.`
- `Monte uma aura de vilão profissional e anexe ao objeto selecionado.`
- `Perfilhe este efeito para mobile e refine sem perder impacto visual.`

## Preview test

1. Open Studio, enable HTTP Requests, open Visual Director, connect to `CHATGPT WEB`, and copy the personal code.
2. Ask the GPT to read capabilities and selection.
3. Select a disposable Part and request a small procedural effect.
4. Confirm the GPT validates, stages, polls, commits, attaches, and previews.
5. Confirm edit-mode attached preview loops for art review when intended.
6. Enter Play mode and run timeline preview; confirm authored windows stop and clean up.
7. Test `inspectSelectedVfx` pagination on a nontrivial reference.
8. Test a node graph and run `smokeVisualRuntime` before public release.

## Publishing

Keep sharing private until all Preview tests pass. Public GPTs using Actions require a valid privacy URL. Verify the action domain and workspace policy before publishing.
