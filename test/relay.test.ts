import assert from "node:assert/strict";
import test from "node:test";
import { VisualDirectorRelay } from "../src/web-relay.js";

const port = 35729;
const base = `http://127.0.0.1:${port}`;
async function post(path: string, body: unknown) {
  const response = await fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: response.status, json: await response.json() as any };
}

test("routes an authorized action to the paired plugin without rotating the code", async () => {
  const relay = new VisualDirectorRelay("127.0.0.1", port);
  await relay.start();
  try {
    const auth = { installationId: "installation-a", launchId: "launch-a", pairingCode: "ABCDE-12345", token: "secret-token" };
    assert.equal((await post("/v1/plugin/register", { ...auth, pluginVersion: "0.1.0" })).status, 200);
    const queued = await post("/v1/vfx/capabilities", { pairingCode: auth.pairingCode });
    assert.equal(queued.status, 202);
    const polled = await post("/v1/plugin/poll", auth);
    assert.equal(polled.json.command.method, "system.capabilities");
    await post("/v1/plugin/result", { ...auth, id: polled.json.command.id, ok: true, result: { pluginVersion: "0.1.0" } });
    const job = await post("/v1/actions/job", { pairingCode: auth.pairingCode, jobId: queued.json.jobId });
    assert.equal(job.json.status, "succeeded");
    assert.equal(job.json.result.pluginVersion, "0.1.0");
    const secondRegistration = await post("/v1/plugin/register", { ...auth, launchId: "launch-b" });
    assert.equal(secondRegistration.json.pairingCode, "ABCDE-12345");
  } finally {
    await relay.stop();
  }
});

test("serves a GPT-importable OpenAPI document", async () => {
  const openApiPort = port + 1;
  const relay = new VisualDirectorRelay("127.0.0.1", openApiPort);
  await relay.start();
  try {
    const response = await fetch(`http://127.0.0.1:${openApiPort}/openapi.json`);
    const document = await response.json() as any;
    assert.equal(response.status, 200);
    assert.equal(document.openapi, "3.1.0");
    assert.ok(document.components.schemas.VfxDraft.properties.nodes);
    assert.ok(document.paths["/v1/vfx/stage"].post.operationId);
  } finally {
    await relay.stop();
  }
});
