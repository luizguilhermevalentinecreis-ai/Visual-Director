import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { StudioBridge } from "./bridge.js";
import { vfxDraftSchema } from "./domain.js";
import { reviewVfxDraft } from "./quality.js";

const bridge = new StudioBridge(process.env.VISUAL_BRIDGE_HOST ?? "127.0.0.1", Number(process.env.VISUAL_BRIDGE_PORT ?? 34728));
const server = new McpServer({ name: "roblox-visual-director", version: "0.1.0" });
const output = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });
const failure = (error: unknown) => ({ isError: true, content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }] });

server.registerTool("get_visual_director_status", {
  title: "Get Visual Director status",
  description: "Checks whether Roblox Studio and the Visual Director plugin are connected.",
  inputSchema: {},
}, async () => output(bridge.status()));

server.registerTool("get_vfx_capabilities", {
  title: "Get VFX authoring capabilities",
  description: "Returns supported VFX node types, limits and plugin runtime capabilities.",
  inputSchema: {},
}, async () => { try { return output(await bridge.execute("system.capabilities", {}, 15_000)); } catch (error) { return failure(error); } });

server.registerTool("get_scene_selection", {
  title: "Inspect the current Studio selection",
  description: "Returns selected instances and the best target for attaching VFX.",
  inputSchema: { includeDescendants: z.boolean().default(false), maxDepth: z.number().int().min(0).max(8).default(2) },
}, async input => { try { return output(await bridge.execute("scene.getSelection", input, 30_000)); } catch (error) { return failure(error); } });

server.registerTool("inspect_selected_vfx", {
  title: "Inspect existing VFX on the selected object",
  description: "Analyzes ParticleEmitters, Beams, Trails, lights, UI and Visual Director metadata already present on the selection.",
  inputSchema: { maxResults: z.number().int().min(1).max(1000).default(300) },
}, async input => { try { return output(await bridge.execute("vfx.inspectSelected", input, 60_000)); } catch (error) { return failure(error); } });

server.registerTool("validate_vfx_draft", {
  title: "Validate a complete VFX draft",
  description: "Validates structure, timing, hierarchy, layering and performance hints before writing to Studio.",
  inputSchema: { draft: vfxDraftSchema },
}, async ({ draft }) => output(reviewVfxDraft(draft)));

server.registerTool("stage_vfx_draft", {
  title: "Stage a VFX draft in Studio",
  description: "Stages a validated declarative VFX draft. This is a write operation but does not publish assets.",
  inputSchema: { transactionName: z.string().min(1).max(160), draft: vfxDraftSchema },
}, async input => { try {
  const report = reviewVfxDraft(input.draft);
  if (report.blockingIssues.length) return failure(new Error(report.blockingIssues.map(issue => issue.message).join("; ")));
  return output(await bridge.execute("vfx.stageDraft", input, 120_000));
} catch (error) { return failure(error); } });

server.registerTool("commit_vfx_draft", {
  title: "Commit a staged VFX draft",
  description: "Builds real Roblox instances from a previously staged VFX transaction.",
  inputSchema: { transactionId: z.string().min(1), destinationName: z.string().min(1).max(120) },
}, async input => { try { return output(await bridge.execute("vfx.commitDraft", input, 120_000)); } catch (error) { return failure(error); } });

server.registerTool("attach_committed_vfx", {
  title: "Attach committed VFX to the selection",
  description: "Clones a committed VFX package under the currently selected target as a VisualDirectorVFX child.",
  inputSchema: { packageName: z.string().min(1).max(120) },
}, async input => { try { return output(await bridge.execute("vfx.attachCommitted", input, 120_000)); } catch (error) { return failure(error); } });

server.registerTool("preview_committed_vfx", {
  title: "Preview committed VFX",
  description: "Creates a reversible edit-time preview of a committed package at the selected target.",
  inputSchema: { packageName: z.string().min(1).max(120), normalizedTime: z.number().min(0).max(1).default(0.5) },
}, async input => { try { return output(await bridge.execute("vfx.previewCommitted", input, 120_000)); } catch (error) { return failure(error); } });

await bridge.start();
await server.connect(new StdioServerTransport());
const shutdown = async () => { await bridge.stop(); process.exit(0); };
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
