import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";

export type StudioCommand = { id: string; method: string; params: unknown; createdAt: number };
export type StudioSession = {
  id: string;
  studioUserId?: number;
  placeId?: number;
  placeName?: string;
  pluginVersion?: string;
  connectedAt: number;
  lastSeenAt: number;
};
type Pending = {
  sessionId: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

export class StudioBridge {
  private server?: ReturnType<typeof createServer>;
  private sessions = new Map<string, StudioSession>();
  private queues = new Map<string, StudioCommand[]>();
  private pending = new Map<string, Pending>();

  constructor(readonly host = "127.0.0.1", readonly port = 34728) {}

  async start() {
    if (this.server) return;
    this.server = createServer((req, res) => void this.route(req, res));
    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(this.port, this.host, resolve);
    });
  }

  async stop() {
    for (const item of this.pending.values()) {
      clearTimeout(item.timeout);
      item.reject(new Error("Visual Director bridge stopped."));
    }
    this.pending.clear();
    if (!this.server) return;
    await new Promise<void>((resolve, reject) => this.server!.close(error => error ? reject(error) : resolve()));
    this.server = undefined;
  }

  status() {
    const sessions = this.activeSessions();
    return { connected: sessions.length > 0, session: sessions[0], sessions, queuedCommands: [...this.queues.values()].reduce((n, q) => n + q.length, 0) };
  }

  execute(method: string, params: unknown, timeoutMs = 60_000): Promise<unknown> {
    const session = this.activeSessions()[0];
    if (!session) return Promise.reject(new Error("Roblox Studio is not connected. Open Studio and enable Visual Director."));
    const command: StudioCommand = { id: randomUUID(), method, params, createdAt: Date.now() };
    const queue = this.queues.get(session.id) ?? [];
    queue.push(command);
    this.queues.set(session.id, queue);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(command.id);
        reject(new Error(`Studio command ${method} timed out after ${timeoutMs}ms.`));
      }, timeoutMs);
      this.pending.set(command.id, { sessionId: session.id, resolve, reject, timeout });
    });
  }

  private activeSessions() {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastSeenAt > 15_000) {
        this.sessions.delete(id);
        this.queues.delete(id);
      }
    }
    return [...this.sessions.values()].sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  }

  private async route(req: IncomingMessage, res: ServerResponse) {
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    if (!this.isLoopback(req)) return this.json(res, 403, { error: "Local plugin requests only." });
    try {
      if (req.method === "GET" && req.url === "/health") return this.json(res, 200, { ok: true, service: "visual-director-bridge" });
      if (req.method === "GET" && req.url === "/status") return this.json(res, 200, this.status());
      if (req.method === "POST" && req.url === "/plugin/connect") {
        const body = await this.readJson(req);
        const session: StudioSession = {
          id: randomUUID(), connectedAt: Date.now(), lastSeenAt: Date.now(),
          ...(typeof body.studioUserId === "number" ? { studioUserId: body.studioUserId } : {}),
          ...(typeof body.placeId === "number" ? { placeId: body.placeId } : {}),
          ...(typeof body.placeName === "string" ? { placeName: body.placeName } : {}),
          ...(typeof body.pluginVersion === "string" ? { pluginVersion: body.pluginVersion } : {}),
        };
        this.sessions.set(session.id, session);
        this.queues.set(session.id, []);
        return this.json(res, 200, { sessionId: session.id, pollIntervalMs: 300 });
      }
      if (req.method === "POST" && req.url === "/plugin/poll") {
        const body = await this.readJson(req);
        const session = typeof body.sessionId === "string" ? this.sessions.get(body.sessionId) : undefined;
        if (!session) return this.json(res, 409, { reconnect: true });
        session.lastSeenAt = Date.now();
        return this.json(res, 200, { command: (this.queues.get(session.id) ?? []).shift() ?? null });
      }
      if (req.method === "POST" && req.url === "/plugin/result") {
        const body = await this.readJson(req);
        const session = typeof body.sessionId === "string" ? this.sessions.get(body.sessionId) : undefined;
        if (!session) return this.json(res, 409, { reconnect: true });
        session.lastSeenAt = Date.now();
        const pending = typeof body.id === "string" ? this.pending.get(body.id) : undefined;
        if (!pending || pending.sessionId !== session.id) return this.json(res, 404, { error: "Unknown command." });
        clearTimeout(pending.timeout);
        this.pending.delete(body.id as string);
        if (body.ok === true) pending.resolve(body.result);
        else pending.reject(new Error(typeof body.error?.message === "string" ? body.error.message : "Studio command failed."));
        return this.json(res, 200, { accepted: true });
      }
      this.json(res, 404, { error: "Not found." });
    } catch (error) {
      this.json(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  private isLoopback(req: IncomingMessage) {
    const address = req.socket.remoteAddress ?? "";
    return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
  }

  private readJson(req: IncomingMessage): Promise<Record<string, any>> {
    return new Promise((resolve, reject) => {
      let body = "";
      req.setEncoding("utf8");
      req.on("data", chunk => {
        body += chunk;
        if (body.length > 10_000_000) reject(new Error("Request body too large."));
      });
      req.on("end", () => {
        try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error("Invalid JSON.")); }
      });
      req.on("error", reject);
    });
  }

  private json(res: ServerResponse, status: number, value: unknown) {
    res.statusCode = status;
    res.end(JSON.stringify(value));
  }
}
