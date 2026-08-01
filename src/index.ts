import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { StudioBridge } from "./bridge.js";
import { vfxDraftSchema } from "./domain.js";
import { reviewVfxDraft } from "./quality.js";
import { vfxOperationProgramSchema } from "./operations.js";
import { compileProceduralVfxModule, proceduralVfxModuleSchema } from "./procedural-modules.js";
import { compileVfxNodeGraph, vfxNodeGraphSchema } from "./vfx-graph.js";

const bridge = new StudioBridge(process.env.VISUAL_BRIDGE_HOST ?? "127.0.0.1", Number(process.env.VISUAL_BRIDGE_PORT ?? 34728));
const server = new McpServer({ name: "roblox-visual-director", version: "0.4.0" });
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

server.registerTool("list_shared_director_markers", {
  title: "List shared Motion and Visual Director markers",
  description: "Reads the compact ReplicatedStorage DirectorMarkerBus so VFX releases, impacts, hit stops and recoveries can reuse animation timing instead of duplicating it.",
  inputSchema: {},
}, async () => { try { return output(await bridge.execute("timeline.listMarkers", {}, 15_000)); } catch (error) { return failure(error); } });

server.registerTool("inspect_selected_vfx", {
  title: "Inspect existing VFX on the selected object",
  description: "Analyzes ParticleEmitters, Beams, Trails, lights, UI and Visual Director metadata already present on the selection.",
  inputSchema: {
    maxResults: z.number().int().min(1).max(5000).default(3000),
    detail: z.enum(["summary", "structure", "full"]).default("summary"),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(25),
  },
}, async input => { try { return output(await bridge.execute("vfx.inspectSelected", input, 60_000)); } catch (error) { return failure(error); } });

server.registerTool("inspect_vfx_snapshot_page", {
  title: "Read one bounded page from a VFX inspection snapshot",
  description: "Reads only the exact hierarchy page needed from a previous inspection, avoiding repeated full-tree payloads and saving context tokens.",
  inputSchema: {
    snapshotId: z.string().min(1), page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(25), includeProperties: z.boolean().default(true),
  },
}, async input => { try { return output(await bridge.execute("vfx.inspectSnapshotPage", input, 60_000)); } catch (error) { return failure(error); } });

server.registerTool("profile_selected_vfx", {
  title: "Profile selected VFX complexity and overdraw risk",
  description: "Computes compact mobile/desktop budget proxies from live particle estimates, particle size, emitter lifetime, beam segments, trails, transparent geometry and shadowed lights.",
  inputSchema: {},
}, async () => { try { return output(await bridge.execute("vfx.profileSelected", {}, 60_000)); } catch (error) { return failure(error); } });

server.registerTool("capture_selected_vfx_exactly", {
  title: "Capture selected native VFX without losing properties",
  description: "Clones the selected native Roblox VFX hierarchy into a committed Visual Director package. Preserves unsupported assets, flipbooks, attachments, emitters and custom hierarchy exactly instead of approximating them as a draft.",
  inputSchema: { packageName: z.string().min(1).max(120), duration: z.number().positive().max(120).default(1) },
}, async input => { try { return output(await bridge.execute("vfx.captureSelection", input, 120_000)); } catch (error) { return failure(error); } });

server.registerTool("save_selected_vfx_as_module", {
  title: "Save selected native VFX as a reusable module",
  description: "Stores a sanitized exact clone in ServerStorage.VisualDirectorModules with tags and documentation. Executable scripts are removed; native VFX hierarchy and assets are preserved.",
  inputSchema: { moduleName: z.string().min(1).max(120), description: z.string().max(1000).default(""), tags: z.array(z.string().max(60)).max(20).default([]) },
}, async input => { try { return output(await bridge.execute("vfx.saveSelectionAsModule", input, 120_000)); } catch (error) { return failure(error); } });

server.registerTool("list_reusable_vfx_modules", {
  title: "List reusable native VFX modules",
  description: "Returns a compact inventory of saved module names, tags and hierarchy sizes without transmitting their descendants.",
  inputSchema: {},
}, async () => { try { return output(await bridge.execute("vfx.listModules", {}, 30_000)); } catch (error) { return failure(error); } });

server.registerTool("instantiate_reusable_vfx_module", {
  title: "Instantiate a reusable VFX module on the selection",
  description: "Clones a saved module under the currently selected destination without rebuilding or retransmitting its hierarchy.",
  inputSchema: { moduleName: z.string().min(1).max(120), instanceName: z.string().min(1).max(120).optional() },
}, async input => { try { return output(await bridge.execute("vfx.instantiateModule", input, 120_000)); } catch (error) { return failure(error); } });

server.registerTool("apply_vfx_operation_program", {
  title: "Apply precise partial edits to native VFX",
  description: "Applies bounded property-complete operations inside the selected, committed, or attached VFX subtree. Supports native Roblox sequences, ranges, enums, transforms, cloning, attributes, bursts and deletion with Studio undo; never executes code.",
  inputSchema: { program: vfxOperationProgramSchema },
}, async input => { try { return output(await bridge.execute("vfx.applyOperations", input, 120_000)); } catch (error) { return failure(error); } });

server.registerTool("validate_vfx_draft", {
  title: "Validate a complete VFX draft",
  description: "Validates structure, timing, hierarchy, layering and performance hints before writing to Studio.",
  inputSchema: { draft: vfxDraftSchema },
}, async ({ draft }) => output(reviewVfxDraft(draft)));

server.registerTool("compile_procedural_vfx_module", {
  title: "Compile a compact professional VFX module",
  description: "Generates a complete layered VFX draft locally from a compact impact, shockwave, aura, slash or trail module. Uses deterministic seeds, element-aware physics, curves, markers and performance-bounded complexity to avoid spending tokens on repetitive node arrays.",
  inputSchema: { module: proceduralVfxModuleSchema },
}, async ({ module }) => {
  try {
    const draft = compileProceduralVfxModule(module);
    return output({ draft, summary: { name: draft.name, nodes: draft.nodes.length, markers: draft.markers.length, seed: module.seed }, report: reviewVfxDraft(draft) });
  } catch (error) { return failure(error); }
});

server.registerTool("compile_vfx_node_graph", {
  title: "Compile a connected VFX force-field graph",
  description: "Compiles directional, attractor, vortex, turbulence and drag field nodes into a deterministic spatial grid of native ParticleEmitters. Acceleration and Drag affect already-active Roblox particles; the grid provides local field variation without pretending the engine exposes individual particles.",
  inputSchema: { graph: vfxNodeGraphSchema },
}, async ({ graph }) => {
  try {
    const draft = compileVfxNodeGraph(graph);
    return output({ draft, summary: { name: draft.name, emittedCells: draft.nodes.length, graphNodes: graph.nodes.length, connections: graph.connections.length }, report: reviewVfxDraft(draft) });
  } catch (error) { return failure(error); }
});

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

server.registerTool("play_committed_vfx_timeline", {
  title: "Play a committed VFX timeline in Edit mode",
  description: "Runs the real Visual Director timeline with activation, bursts, geometry/UI progress, lights and deterministic cleanup instead of showing one frozen normalized frame.",
  inputSchema: {
    packageName: z.string().min(1).max(120), looped: z.boolean().default(false),
    playbackSpeed: z.number().min(0.05).max(4).default(1), applyCameraEffects: z.boolean().default(false),
  },
}, async input => { try { return output(await bridge.execute("vfx.playCommittedTimeline", input, 120_000)); } catch (error) { return failure(error); } });

server.registerTool("stop_vfx_timeline_preview", {
  title: "Stop and clean the active VFX timeline preview",
  description: "Stops the reversible Edit-mode timeline and removes its preview hierarchy.",
  inputSchema: {},
}, async () => { try { return output(await bridge.execute("vfx.stopTimelinePreview", {}, 30_000)); } catch (error) { return failure(error); } });

server.registerTool("smoke_test_visual_runtime", {
  title: "Execute the Visual Director runtime smoke test in Studio",
  description: "Creates a temporary native geometry and ParticleEmitter fixture, evaluates the bundled edit-mode runtime at mid-time, verifies curves and restoration, then removes the fixture.",
  inputSchema: {},
}, async () => { try { return output(await bridge.execute("vfx.smokeRuntime", {}, 30_000)); } catch (error) { return failure(error); } });

await bridge.start();
await server.connect(new StdioServerTransport());
const shutdown = async () => { await bridge.stop(); process.exit(0); };
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
