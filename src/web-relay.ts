import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "zod";
import { vfxDraftSchema } from "./domain.js";
import { reviewVfxDraft } from "./quality.js";
import { vfxOperationProgramSchema } from "./operations.js";
import { compileProceduralVfxModule, proceduralVfxModuleSchema } from "./procedural-modules.js";
import { compileVfxNodeGraph, vfxNodeGraphSchema } from "./vfx-graph.js";

type Json = Record<string, any>;
type Command = { id: string; method: string; params: Json; createdAt: number };
type Session = {
  installationId: string;
  launchId: string;
  pairingCode: string;
  tokenHash: string;
  studioUserId?: number;
  placeId?: number;
  placeName?: string;
  pluginVersion?: string;
  lastSeenAt: number;
  queue: Command[];
};
type Job = {
  id: string;
  pairingCode: string;
  action: string;
  status: "queued" | "running" | "succeeded" | "failed";
  createdAt: number;
  updatedAt: number;
  result?: unknown;
  error?: string;
};
type StoredDraft = { id: string; pairingCode: string; draft: z.infer<typeof vfxDraftSchema>; createdAt: number; updatedAt: number };

const writeActions = new Set(["stageVfxDraft", "commitVfxDraft", "attachCommittedVfx", "previewCommittedVfx", "captureSelectedVfx", "saveSelectedVfxAsModule", "instantiateVfxModule", "applyVfxOperations", "playCommittedVfxTimeline", "stopVfxTimelinePreview", "smokeVisualRuntime"]);
const actions: Record<string, { method: string; timeoutMs: number }> = {
  getVfxCapabilities: { method: "system.capabilities", timeoutMs: 20_000 },
  getSceneSelection: { method: "scene.getSelection", timeoutMs: 30_000 },
  listDirectorMarkers: { method: "timeline.listMarkers", timeoutMs: 15_000 },
  inspectSelectedVfx: { method: "vfx.inspectSelected", timeoutMs: 60_000 },
  inspectVfxSnapshotPage: { method: "vfx.inspectSnapshotPage", timeoutMs: 60_000 },
  profileSelectedVfx: { method: "vfx.profileSelected", timeoutMs: 60_000 },
  captureSelectedVfx: { method: "vfx.captureSelection", timeoutMs: 120_000 },
  saveSelectedVfxAsModule: { method: "vfx.saveSelectionAsModule", timeoutMs: 120_000 },
  listVfxModules: { method: "vfx.listModules", timeoutMs: 30_000 },
  instantiateVfxModule: { method: "vfx.instantiateModule", timeoutMs: 120_000 },
  applyVfxOperations: { method: "vfx.applyOperations", timeoutMs: 120_000 },
  stageVfxDraft: { method: "vfx.stageDraft", timeoutMs: 120_000 },
  commitVfxDraft: { method: "vfx.commitDraft", timeoutMs: 120_000 },
  attachCommittedVfx: { method: "vfx.attachCommitted", timeoutMs: 120_000 },
  previewCommittedVfx: { method: "vfx.previewCommitted", timeoutMs: 120_000 },
  playCommittedVfxTimeline: { method: "vfx.playCommittedTimeline", timeoutMs: 120_000 },
  stopVfxTimelinePreview: { method: "vfx.stopTimelinePreview", timeoutMs: 30_000 },
  smokeVisualRuntime: { method: "vfx.smokeRuntime", timeoutMs: 30_000 },
};

export class VisualDirectorRelay {
  private server?: ReturnType<typeof createServer>;
  private sessions = new Map<string, Session>();
  private jobs = new Map<string, Job>();
  private commandJobs = new Map<string, string>();
  private drafts = new Map<string, StoredDraft>();
  private rate = new Map<string, { at: number; count: number }>();

  constructor(readonly host = "0.0.0.0", readonly port = 34729) {}

  async start() {
    if (this.server) return;
    this.server = createServer((req, res) => void this.route(req, res));
    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(this.port, this.host, resolve);
    });
  }

  async stop() {
    if (!this.server) return;
    await new Promise<void>((resolve, reject) => this.server!.close(error => error ? reject(error) : resolve()));
    this.server = undefined;
  }

  private async route(req: IncomingMessage, res: ServerResponse) {
    this.headers(res);
    if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
    const ip = req.socket.remoteAddress ?? "unknown";
    if (!this.allow(ip)) return this.json(res, 429, { error: "Rate limit exceeded." });
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    try {
      if (req.method === "GET" && url.pathname === "/health") return this.json(res, 200, { ok: true, service: "visual-director-relay", version: "0.4.0" });
      if (req.method === "GET" && url.pathname === "/privacy") return this.text(res, 200, privacyPolicy());
      if (req.method === "GET" && url.pathname === "/openapi.json") return this.json(res, 200, openApiDocument(this.publicBase(req)));
      if (req.method === "POST" && url.pathname === "/v1/plugin/register") return this.registerPlugin(res, await this.body(req));
      if (req.method === "POST" && url.pathname === "/v1/plugin/poll") return this.pollPlugin(res, await this.body(req));
      if (req.method === "POST" && url.pathname === "/v1/plugin/result") return this.pluginResult(res, await this.body(req));
      if (req.method === "POST" && url.pathname === "/v1/actions/execute") return this.executeAction(res, await this.body(req));
      if (req.method === "POST" && url.pathname === "/v1/actions/job") return this.readJob(res, await this.body(req));
      if (req.method === "POST" && url.pathname === "/v1/vfx/validate") return this.validateDraft(res, await this.body(req));
      if (req.method === "POST" && url.pathname === "/v1/vfx/generate") return this.generateDraft(res, await this.body(req));
      if (req.method === "POST" && url.pathname === "/v1/vfx/graph/compile") return this.compileGraph(res, await this.body(req));
      if (req.method === "POST" && url.pathname.startsWith("/v1/vfx/")) return this.executeVfxPath(res, url.pathname, await this.body(req));
      this.json(res, 404, { error: "Not found." });
    } catch (error) {
      this.json(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  private registerPlugin(res: ServerResponse, body: Json) {
    const installationId = requiredString(body.installationId, "installationId");
    const launchId = requiredString(body.launchId, "launchId");
    const pairingCode = normalizeCode(requiredString(body.pairingCode, "pairingCode"));
    const token = requiredString(body.token, "token");
    const current = this.sessions.get(pairingCode);
    if (current && current.installationId !== installationId) return this.json(res, 409, { error: "Pairing code already belongs to another installation." });
    const session: Session = {
      installationId, launchId, pairingCode, tokenHash: hash(token), lastSeenAt: Date.now(), queue: current?.queue ?? [],
      ...(typeof body.studioUserId === "number" ? { studioUserId: body.studioUserId } : {}),
      ...(typeof body.placeId === "number" ? { placeId: body.placeId } : {}),
      ...(typeof body.placeName === "string" ? { placeName: body.placeName } : {}),
      ...(typeof body.pluginVersion === "string" ? { pluginVersion: body.pluginVersion } : {}),
    };
    this.sessions.set(pairingCode, session);
    return this.json(res, 200, { status: "registered", pairingCode, pollIntervalMs: 500 });
  }

  private pollPlugin(res: ServerResponse, body: Json) {
    const session = this.authenticatePlugin(body);
    if (!session) return this.json(res, 401, { reconnect: true });
    session.lastSeenAt = Date.now();
    const command = session.queue.shift() ?? null;
    if (command) {
      const jobId = this.commandJobs.get(command.id);
      const job = jobId ? this.jobs.get(jobId) : undefined;
      if (job) { job.status = "running"; job.updatedAt = Date.now(); }
    }
    return this.json(res, 200, { command });
  }

  private pluginResult(res: ServerResponse, body: Json) {
    const session = this.authenticatePlugin(body);
    if (!session) return this.json(res, 401, { reconnect: true });
    session.lastSeenAt = Date.now();
    const commandId = requiredString(body.id, "id");
    const jobId = this.commandJobs.get(commandId);
    const job = jobId ? this.jobs.get(jobId) : undefined;
    if (!job) return this.json(res, 404, { error: "Unknown or expired command." });
    job.updatedAt = Date.now();
    if (body.ok === true) { job.status = "succeeded"; job.result = body.result; }
    else { job.status = "failed"; job.error = typeof body.error?.message === "string" ? body.error.message : "Studio command failed."; }
    this.commandJobs.delete(commandId);
    return this.json(res, 200, { accepted: true });
  }

  private executeAction(res: ServerResponse, body: Json) {
    const pairingCode = normalizeCode(requiredString(body.pairingCode, "pairingCode"));
    const action = requiredString(body.action, "action");
    if (action === "validateVfxDraft") return this.validateDraft(res, { draft: body.input?.draft });
    const definition = actions[action];
    if (!definition) return this.json(res, 400, { error: `Unsupported action: ${action}` });
    if (writeActions.has(action) && body.confirmWrite !== true) return this.json(res, 409, { error: "This action changes Studio. Set confirmWrite to true." });
    return this.enqueue(res, pairingCode, action, definition, isObject(body.input) ? body.input : {});
  }

  private executeVfxPath(res: ServerResponse, path: string, body: Json) {
    const map: Record<string, string> = {
      "/v1/vfx/capabilities": "getVfxCapabilities",
      "/v1/vfx/selection": "getSceneSelection",
      "/v1/vfx/markers": "listDirectorMarkers",
      "/v1/vfx/inspect": "inspectSelectedVfx",
      "/v1/vfx/inspect-page": "inspectVfxSnapshotPage",
      "/v1/vfx/profile": "profileSelectedVfx",
      "/v1/vfx/capture": "captureSelectedVfx",
      "/v1/vfx/modules/save": "saveSelectedVfxAsModule",
      "/v1/vfx/modules/list": "listVfxModules",
      "/v1/vfx/modules/instantiate": "instantiateVfxModule",
      "/v1/vfx/operations": "applyVfxOperations",
      "/v1/vfx/stage": "stageVfxDraft",
      "/v1/vfx/commit": "commitVfxDraft",
      "/v1/vfx/attach": "attachCommittedVfx",
      "/v1/vfx/preview": "previewCommittedVfx",
      "/v1/vfx/play": "playCommittedVfxTimeline",
      "/v1/vfx/stop": "stopVfxTimelinePreview",
      "/v1/vfx/runtime-smoke": "smokeVisualRuntime",
    };
    const action = map[path];
    if (!action) return this.json(res, 404, { error: "Unknown VFX action." });
    const pairingCode = normalizeCode(requiredString(body.pairingCode, "pairingCode"));
    if (writeActions.has(action) && body.confirmWrite !== true) return this.json(res, 409, { error: "Set confirmWrite to true." });
    const input = { ...body };
    delete input.pairingCode;
    delete input.confirmWrite;
    return this.enqueue(res, pairingCode, action, actions[action]!, input);
  }

  private enqueue(res: ServerResponse, pairingCode: string, action: string, definition: { method: string; timeoutMs: number }, input: Json) {
    const session = this.liveSession(pairingCode);
    if (!session) return this.json(res, 409, { error: "No live Studio plugin is registered for this pairing code." });
    if (action === "stageVfxDraft") {
      let draftValue = input.draft;
      if (draftValue === undefined && typeof input.draftId === "string") {
        const stored = this.drafts.get(input.draftId);
        if (!stored || stored.pairingCode !== pairingCode) return this.json(res, 404, { error: "Unknown or unauthorized draftId." });
        stored.updatedAt = Date.now();
        draftValue = stored.draft;
      }
      const draft = vfxDraftSchema.parse(draftValue);
      const report = reviewVfxDraft(draft);
      if (report.blockingIssues.length) return this.json(res, 422, { error: "Draft has blocking issues.", report });
      input = { ...input, draft };
      delete input.draftId;
    }
    if (action === "applyVfxOperations") input = { ...input, program: vfxOperationProgramSchema.parse(input.program) };
    const command: Command = { id: randomUUID(), method: definition.method, params: input, createdAt: Date.now() };
    const job: Job = { id: randomUUID(), pairingCode, action, status: "queued", createdAt: Date.now(), updatedAt: Date.now() };
    session.queue.push(command);
    this.jobs.set(job.id, job);
    this.commandJobs.set(command.id, job.id);
    setTimeout(() => {
      const current = this.jobs.get(job.id);
      if (current && (current.status === "queued" || current.status === "running")) {
        current.status = "failed";
        current.error = `${action} timed out after ${definition.timeoutMs}ms.`;
        current.updatedAt = Date.now();
      }
    }, definition.timeoutMs).unref();
    return this.json(res, 202, { status: job.status, jobId: job.id, pollAfterMs: 700 });
  }

  private validateDraft(res: ServerResponse, body: Json) {
    let value = body.draft;
    if (value === undefined && typeof body.draftId === "string" && typeof body.pairingCode === "string") {
      const stored = this.drafts.get(body.draftId);
      if (!stored || stored.pairingCode !== normalizeCode(body.pairingCode)) return this.json(res, 404, { error: "Unknown or unauthorized draftId." });
      value = stored.draft;
    }
    const draft = vfxDraftSchema.parse(value);
    return this.json(res, 200, { status: "validated", draft: { name: draft.name, duration: draft.duration, nodeCount: draft.nodes.length }, report: reviewVfxDraft(draft) });
  }

  private generateDraft(res: ServerResponse, body: Json) {
    const pairingCode = normalizeCode(requiredString(body.pairingCode, "pairingCode"));
    if (!this.liveSession(pairingCode)) return this.json(res, 409, { error: "No live Studio plugin is registered for this pairing code." });
    const draft = compileProceduralVfxModule(body.module);
    const report = reviewVfxDraft(draft);
    if (report.blockingIssues.length) return this.json(res, 422, { error: "Generated draft has blocking issues.", report });
    const record: StoredDraft = { id: randomUUID(), pairingCode, draft, createdAt: Date.now(), updatedAt: Date.now() };
    this.drafts.set(record.id, record);
    return this.json(res, 200, {
      status: "succeeded", draftId: record.id,
      summary: { name: draft.name, preset: draft.metadata.modulePreset, duration: draft.duration, nodes: draft.nodes.length, markers: draft.markers.length, seed: draft.metadata.seed },
      report,
      next: "Stage with draftId; the complete node array remains in the relay and does not need to be retransmitted.",
    });
  }

  private compileGraph(res: ServerResponse, body: Json) {
    const pairingCode = normalizeCode(requiredString(body.pairingCode, "pairingCode"));
    if (!this.liveSession(pairingCode)) return this.json(res, 409, { error: "No live Studio plugin is registered for this pairing code." });
    const draft = compileVfxNodeGraph(body.graph);
    const report = reviewVfxDraft(draft);
    if (report.blockingIssues.length) return this.json(res, 422, { error: "Compiled graph has blocking issues.", report });
    const record: StoredDraft = { id: randomUUID(), pairingCode, draft, createdAt: Date.now(), updatedAt: Date.now() };
    this.drafts.set(record.id, record);
    return this.json(res, 200, {
      status: "succeeded", draftId: record.id,
      summary: { name: draft.name, fieldMode: draft.metadata.fieldMode, emitterCells: draft.nodes.length, graphNodes: draft.metadata.graphNodeCount, connections: draft.metadata.graphConnectionCount },
      report, next: "Validate and stage this draftId; the expanded emitter grid remains server-side.",
    });
  }

  private readJob(res: ServerResponse, body: Json) {
    const pairingCode = normalizeCode(requiredString(body.pairingCode, "pairingCode"));
    const job = this.jobs.get(requiredString(body.jobId, "jobId"));
    if (!job || job.pairingCode !== pairingCode) return this.json(res, 404, { error: "Unknown job." });
    return this.json(res, 200, job);
  }

  private liveSession(code: string) {
    const session = this.sessions.get(code);
    return session && Date.now() - session.lastSeenAt < 20_000 ? session : undefined;
  }

  private authenticatePlugin(body: Json) {
    const code = typeof body.pairingCode === "string" ? normalizeCode(body.pairingCode) : "";
    const session = this.sessions.get(code);
    if (!session || body.installationId !== session.installationId || body.launchId !== session.launchId || typeof body.token !== "string") return undefined;
    return safeEqual(session.tokenHash, hash(body.token)) ? session : undefined;
  }

  private allow(ip: string) {
    const now = Date.now();
    const bucket = this.rate.get(ip);
    if (!bucket || now - bucket.at > 60_000) { this.rate.set(ip, { at: now, count: 1 }); return true; }
    bucket.count += 1;
    return bucket.count <= 300;
  }

  private body(req: IncomingMessage): Promise<Json> {
    return new Promise((resolve, reject) => {
      let raw = "";
      req.setEncoding("utf8");
      req.on("data", chunk => { raw += chunk; if (raw.length > 15_000_000) reject(new Error("Request body too large.")); });
      req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error("Invalid JSON.")); } });
      req.on("error", reject);
    });
  }

  private publicBase(req: IncomingMessage) {
    const protocol = req.headers["x-forwarded-proto"] ?? "http";
    return `${protocol}://${req.headers.host ?? `localhost:${this.port}`}`;
  }

  private headers(res: ServerResponse) {
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-headers", "content-type");
    res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
    res.setHeader("cache-control", "no-store");
    res.setHeader("x-content-type-options", "nosniff");
  }
  private json(res: ServerResponse, status: number, value: unknown) { res.statusCode = status; res.setHeader("content-type", "application/json; charset=utf-8"); res.end(JSON.stringify(value)); }
  private text(res: ServerResponse, status: number, value: string) { res.statusCode = status; res.setHeader("content-type", "text/plain; charset=utf-8"); res.end(value); }
}

function requiredString(value: unknown, name: string) { if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`); return value.trim(); }
function isObject(value: unknown): value is Json { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function normalizeCode(value: string) { return value.trim().toUpperCase(); }
function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function safeEqual(a: string, b: string) { const aa = Buffer.from(a); const bb = Buffer.from(b); return aa.length === bb.length && timingSafeEqual(aa, bb); }
export function createPairingCode(seed?: string) {
  const raw = createHash("sha256").update(seed ?? randomBytes(32)).digest("base64url").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
}

function privacyPolicy() {
  return `Visual Director Privacy Policy

Visual Director relays declarative VFX requests between an authorized AI client and the Roblox Studio plugin identified by a personal pairing code.

Data processed: pairing codes, Roblox user ID, place ID and name, plugin and installation identifiers, selected-scene metadata, VFX drafts, command results, and operational timestamps.

Purpose: route requested VFX operations, return results, prevent abuse, diagnose failures, and maintain the active Studio connection.

Retention: pairing sessions, drafts, and command jobs are temporary runtime data and expire or are removed when no longer required by the running service. Reusable modules intentionally saved by a user remain in that user's Studio/plugin environment until removed there.

Sharing: Visual Director does not sell personal data and does not intentionally publish pairing codes, place data, private drafts, or command results.

User control: closing Studio, disabling remote mode, or removing the plugin ends availability of that Studio session. Users can discard staged work and remove attached packages in Studio.

Security: the relay exposes a fixed allowlist of declarative VFX operations and does not accept arbitrary Luau or Roblox passwords. Pairing codes should be treated as secrets while the plugin is online.

Contact and deletion requests: https://github.com/luizguilhermevalentinecreis-ai/Visual-Director/issues`;
}

function openApiDocument(baseUrl: string) {
  const draftSchema = z.toJSONSchema(vfxDraftSchema, { target: "draft-2020-12" }) as Json;
  const operationProgramSchema = z.toJSONSchema(vfxOperationProgramSchema, { target: "draft-2020-12" }) as Json;
  const proceduralModuleOpenApiSchema = z.toJSONSchema(proceduralVfxModuleSchema, { target: "draft-2020-12" }) as Json;
  const nodeGraphOpenApiSchema = z.toJSONSchema(vfxNodeGraphSchema, { target: "draft-2020-12" }) as Json;
  const pairing = { type: "string", description: "Stable pairing code shown by the Visual Director Studio plugin." };
  const confirm = { type: "boolean", const: true, description: "Explicit confirmation for a Studio write." };
  const jobResponse = { description: "Queued Studio job", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" }, jobId: { type: "string" }, pollAfterMs: { type: "number" } } } } } };
  const post = (operationId: string, description: string, properties: Json, required: string[], write = false) => ({
    operationId, description,
    requestBody: { required: true, content: { "application/json": { schema: { type: "object", additionalProperties: false, properties: { pairingCode: pairing, ...properties, ...(write ? { confirmWrite: confirm } : {}) }, required: [...required, "pairingCode", ...(write ? ["confirmWrite"] : [])] } } } },
    responses: { "200": jobResponse, "202": jobResponse, "400": { description: "Invalid request" }, "409": { description: "Studio not connected or confirmation missing" } },
  });
  return {
    openapi: "3.1.0",
    info: { title: "Visual Director Relay", version: "0.4.0", description: "Author professional Roblox VFX, impact frames and HUD packages through a paired Studio plugin." },
    servers: [{ url: baseUrl }],
    paths: {
      "/v1/vfx/capabilities": { post: post("getVfxCapabilities", "Read current plugin capabilities before authoring.", {}, []) },
      "/v1/vfx/selection": { post: post("getSceneSelection", "Read the selected Studio target.", { includeDescendants: { type: "boolean", default: false }, maxDepth: { type: "integer", minimum: 0, maximum: 8, default: 2 } }, []) },
      "/v1/vfx/markers": { post: post("listDirectorMarkers", "Read shared Motion and Visual timing channels from the DirectorMarkerBus.", {}, []) },
      "/v1/vfx/inspect": { post: post("inspectSelectedVfx", "Create a compact paginated snapshot of VFX on the selected target.", { maxResults: { type: "integer", minimum: 1, maximum: 5000, default: 3000 }, detail: { type: "string", enum: ["summary", "structure", "full"], default: "summary" }, page: { type: "integer", minimum: 1, default: 1 }, pageSize: { type: "integer", minimum: 1, maximum: 100, default: 25 } }, []) },
      "/v1/vfx/inspect-page": { post: post("inspectVfxSnapshotPage", "Read one bounded page of an existing VFX inspection snapshot.", { snapshotId: { type: "string" }, page: { type: "integer", minimum: 1, default: 1 }, pageSize: { type: "integer", minimum: 1, maximum: 100, default: 25 }, includeProperties: { type: "boolean", default: true } }, ["snapshotId"]) },
      "/v1/vfx/profile": { post: post("profileSelectedVfx", "Measure compact mobile and desktop VFX complexity/overdraw proxies.", {}, []) },
      "/v1/vfx/generate": { post: post("generateProceduralVfxModule", "Compile and store a deterministic professional VFX module locally. Returns only draftId and compact review data, not repetitive node arrays.", { module: proceduralModuleOpenApiSchema }, ["module"]) },
      "/v1/vfx/graph/compile": { post: post("compileVfxNodeGraph", "Compile and store a connected directional/attractor/vortex/turbulence/drag graph as a spatial grid of native force-affected emitters.", { graph: nodeGraphOpenApiSchema }, ["graph"]) },
      "/v1/vfx/capture": { post: post("captureSelectedVfx", "Capture the selected native VFX hierarchy exactly, preserving every Roblox property and asset.", { packageName: { type: "string" }, duration: { type: "number", minimum: 0.001, maximum: 120, default: 1 } }, ["packageName"], true) },
      "/v1/vfx/modules/save": { post: post("saveSelectedVfxAsModule", "Save a sanitized exact clone of the selected VFX as a reusable native module.", { moduleName: { type: "string" }, description: { type: "string" }, tags: { type: "array", items: { type: "string" } } }, ["moduleName"], true) },
      "/v1/vfx/modules/list": { post: post("listVfxModules", "List saved module names and metadata without transmitting their hierarchies.", {}, []) },
      "/v1/vfx/modules/instantiate": { post: post("instantiateVfxModule", "Instantiate a saved module under the selected destination.", { moduleName: { type: "string" }, instanceName: { type: "string" } }, ["moduleName"], true) },
      "/v1/vfx/operations": { post: post("applyVfxOperations", "Apply safe property-complete partial operations to selected or committed VFX.", { program: { $ref: "#/components/schemas/VfxOperationProgram" } }, ["program"], true) },
      "/v1/vfx/validate": {
        post: {
          operationId: "validateVfxDraft",
          description: "Validate either a complete draft or a stored draftId without changing Studio.",
          requestBody: {
            required: true,
            content: { "application/json": { schema: {
              type: "object",
              properties: { pairingCode: pairing, draftId: { type: "string" }, draft: { $ref: "#/components/schemas/VfxDraft" } },
            } } },
          },
          responses: { "200": { description: "Quality report" }, "422": { description: "Invalid draft" } },
        },
      },
      "/v1/vfx/stage": { post: post("stageVfxDraft", "Stage a validated complete VFX draft or a compact stored draftId.", { transactionName: { type: "string" }, draftId: { type: "string" }, draft: { $ref: "#/components/schemas/VfxDraft" } }, ["transactionName"], true) },
      "/v1/vfx/commit": { post: post("commitVfxDraft", "Commit a staged transaction into real Roblox templates.", { transactionId: { type: "string" }, destinationName: { type: "string" } }, ["transactionId", "destinationName"], true) },
      "/v1/vfx/attach": { post: post("attachCommittedVfx", "Attach a committed package to the selected target.", { packageName: { type: "string" } }, ["packageName"], true) },
      "/v1/vfx/preview": { post: post("previewCommittedVfx", "Preview a committed package at a normalized time.", { packageName: { type: "string" }, normalizedTime: { type: "number", minimum: 0, maximum: 1, default: 0.5 } }, ["packageName"], true) },
      "/v1/vfx/play": { post: post("playCommittedVfxTimeline", "Play the real committed VFX timeline in Edit mode.", { packageName: { type: "string" }, looped: { type: "boolean", default: false }, playbackSpeed: { type: "number", minimum: 0.05, maximum: 4, default: 1 }, applyCameraEffects: { type: "boolean", default: false } }, ["packageName"], true) },
      "/v1/vfx/stop": { post: post("stopVfxTimelinePreview", "Stop and remove the active VFX timeline preview.", {}, [], true) },
      "/v1/vfx/runtime-smoke": { post: post("smokeVisualRuntime", "Execute a self-cleaning native Studio runtime smoke test and report measured curve and restoration values.", {}, [], true) },
      "/v1/actions/job": { post: { operationId: "getVisualDirectorJob", description: "Poll a queued Visual Director job until it succeeds or fails.", requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { pairingCode: pairing, jobId: { type: "string" } }, required: ["pairingCode", "jobId"] } } } }, responses: { "200": { description: "Current job state" } } } },
    },
    components: { schemas: { VfxDraft: draftSchema, VfxOperationProgram: operationProgramSchema } },
  };
}
