// Small helper for talking to the hosted Visual Director relay with a pairing
// code, mirroring the pattern used by Motion Director's relay scripts.
const relay = process.env.VISUAL_RELAY_URL ?? "https://visual-director-relay.onrender.com";
const pairingCode = process.env.VISUAL_PAIRING_CODE;
if (!pairingCode) throw new Error("VISUAL_PAIRING_CODE is required.");

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function post(path: string, body: unknown): Promise<any> {
  const response = await fetch(`${relay}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(`${path} -> ${response.status} ${JSON.stringify(json)}`);
  return json;
}

export async function action(name: string, input: Record<string, unknown> = {}): Promise<any> {
  const started = await post("/v1/actions/execute", { pairingCode, action: name, input });
  if (started.status === "succeeded") return started.result;
  if (started.status === "failed") throw new Error(`${name}: ${started.error}`);
  for (;;) {
    await sleep(started.pollAfterMs ?? 600);
    const job = await post("/v1/actions/job", { pairingCode, jobId: started.jobId });
    if (job.status === "succeeded") return job.result;
    if (job.status === "failed") throw new Error(`${name}: ${job.error}`);
  }
}

// The path-mapped VFX endpoints (/v1/vfx/*) enqueue the same way but do not
// need the action name repeated; they resolve it server-side from the path.
// Write actions (stage/commit/attach/...) require confirmWrite: true.
export async function vfx(path: string, input: Record<string, unknown> = {}, confirmWrite = false): Promise<any> {
  const started = await post(`/v1/vfx/${path}`, { pairingCode, ...input, ...(confirmWrite ? { confirmWrite: true } : {}) });
  if (started.status === "succeeded") return started.result;
  if (started.status === "failed") throw new Error(`${path}: ${started.error}`);
  for (;;) {
    await sleep(started.pollAfterMs ?? 600);
    const job = await post("/v1/actions/job", { pairingCode, jobId: started.jobId });
    if (job.status === "succeeded") return job.result;
    if (job.status === "failed") throw new Error(`${path}: ${job.error}`);
  }
}

// /v1/vfx/generate, /v1/vfx/validate and /v1/vfx/graph/compile answer
// synchronously (no plugin round-trip needed to compile or validate locally).
export async function generateModule(module: Record<string, unknown>): Promise<any> {
  return post("/v1/vfx/generate", { pairingCode, module });
}
export async function validateDraft(draft: unknown): Promise<any> {
  return post("/v1/vfx/validate", { draft });
}

export { pairingCode };
