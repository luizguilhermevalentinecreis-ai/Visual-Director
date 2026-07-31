import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "zod";
import { vfxDraftSchema } from "./domain.js";
import { reviewVfxDraft } from "./quality.js";

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

const writeActions = new Set(["stageVfxDraft", "commitVfxDraft", "attachCommittedVfx", "previewCommittedVfx"]);
const actions: Record<string, { method: string; timeoutMs: number }> = {
  getVfxCapabilities: { method: "system.capabilities", timeoutMs: 20_000 },
  getSceneSelection: { method: "scene.getSelection", timeoutMs: 30_000 },
  inspectSelectedVfx: { method: "vfx.inspectSelected", timeoutMs: 60_000 },
  stageVfxDraft: { method: "vfx.stageDraft", timeoutMs: 120_000 },
  commitVfxDraft: { method: "vfx.commitDraft", timeoutMs: 120_000 },
  attachCommittedVfx: { method: "vfx.attachCommitted", timeoutMs: 120_000 },
  previewCommittedVfx: { method: "vfx.previewCommitted", timeoutMs: 120_000 },
};

export class VisualDirectorRelay {
  private server?: ReturnType<typeof createServer>;
  private sessions = new Map<string, Session>();
  private jobs = new Map<string, Job>();
  private commandJobs = new Map<string, string>();
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
      if (req.method === "GET" && url.pathname === "/health") return this.json(res, 200, { ok: true, service: "visual-director-relay", version: "0.1.0" });
      if (req.method === "GET" && url.pathname === "/privacy") return this.text(res, 200, privacyPolicy());
      if (req.method === "GET" && url.pathname === "/openapi.json") return this.json(res, 200, openApiDocument(this.publicBase(req)));
      if (req.method === "POST" && url.pathname === "/v1/plugin/register") return this.registerPlugin(res, await this.body(req));
      if (req.method === "POST" && url.pathname === "/v1/plugin/poll") return this.pollPlugin(res, await this.body(req));
      if (req.method === "POST" && url.pathname === "/v1/plugin/result") return this.pluginResult(res, await this.body(req));
      if (req.method === "POST" && url.pathname === "/v1/actions/execute") return this.executeAction(res, await this.body(req));
      if (req.method === "POST" && url.pathname === "/v1/actions/job") return this.readJob(res, await this.body(req));
      if (req.method === "POST" && url.pathname === "/v1/vfx/validate") return this.validateDraft(res, await this.body(req));
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
      "/v1/vfx/inspect": "inspectSelectedVfx",
      "/v1/vfx/stage": "stageVfxDraft",
      "/v1/vfx/commit": "commitVfxDraft",
      "/v1/vfx/attach": "attachCommittedVfx",
      "/v1/vfx/preview": "previewCommittedVfx",
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
      const draft = vfxDraftSchema.parse(input.draft);
      const report = reviewVfxDraft(draft);
      if (report.blockingIssues.length) return this.json(res, 422, { error: "Draft has blocking issues.", report });
      input = { ...input, draft };
    }
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
    const draft = vfxDraftSchema.parse(body.draft);
    return this.json(res, 200, { status: "validated", draft: { name: draft.name, duration: draft.duration, nodeCount: draft.nodes.length }, report: reviewVfxDraft(draft) });
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
  return `Visual Director Privacy Policy\n\nVisual Director relays declarative VFX drafts between an authorized AI client and the Roblox Studio plugin identified by a pairing code. It does not request Roblox passwords or API keys. Drafts and command results are kept in memory for active jobs and are not sold. The service may process Roblox user ID, place ID, place name, plugin version and installation identifiers solely to route authorized commands. Remove the plugin or stop the relay to end the connection.`;
}

function openApiDocument(baseUrl: string) {
  const draftSchema = z.toJSONSchema(vfxDraftSchema, { target: "draft-2020-12" }) as Json;
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
    info: { title: "Visual Director Relay", version: "0.1.0", description: "Author professional Roblox VFX, impact frames and HUD packages through a paired Studio plugin." },
    servers: [{ url: baseUrl }],
    paths: {
      "/v1/vfx/capabilities": { post: post("getVfxCapabilities", "Read current plugin capabilities before authoring.", {}, []) },
      "/v1/vfx/selection": { post: post("getSceneSelection", "Read the selected Studio target.", { includeDescendants: { type: "boolean", default: false }, maxDepth: { type: "integer", minimum: 0, maximum: 8, default: 2 } }, []) },
      "/v1/vfx/inspect": { post: post("inspectSelectedVfx", "Inspect VFX already present on the selected target.", { maxResults: { type: "integer", minimum: 1, maximum: 1000, default: 300 } }, []) },
      "/v1/vfx/validate": { post: { operationId: "validateVfxDraft", description: "Validate a complete draft without changing Studio.", requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { draft: { $ref: "#/components/schemas/VfxDraft" } }, required: ["draft"] } } } }, responses: { "200": { description: "Quality report" }, "422": { description: "Invalid draft" } } } },
      "/v1/vfx/stage": { post: post("stageVfxDraft", "Stage a validated complete VFX draft.", { transactionName: { type: "string" }, draft: { $ref: "#/components/schemas/VfxDraft" } }, ["transactionName", "draft"], true) },
      "/v1/vfx/commit": { post: post("commitVfxDraft", "Commit a staged transaction into real Roblox templates.", { transactionId: { type: "string" }, destinationName: { type: "string" } }, ["transactionId", "destinationName"], true) },
      "/v1/vfx/attach": { post: post("attachCommittedVfx", "Attach a committed package to the selected target.", { packageName: { type: "string" } }, ["packageName"], true) },
      "/v1/vfx/preview": { post: post("previewCommittedVfx", "Preview a committed package at a normalized time.", { packageName: { type: "string" }, normalizedTime: { type: "number", minimum: 0, maximum: 1, default: 0.5 } }, ["packageName"], true) },
      "/v1/actions/job": { post: { operationId: "getVisualDirectorJob", description: "Poll a queued Visual Director job until it succeeds or fails.", requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { pairingCode: pairing, jobId: { type: "string" } }, required: ["pairingCode", "jobId"] } } } }, responses: { "200": { description: "Current job state" } } } },
    },
    components: { schemas: { VfxDraft: draftSchema } },
  };
}
