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
    assert.equal(document.paths["/v1/vfx/generate"].post.operationId, "generateProceduralVfxModule");
    assert.equal(document.paths["/v1/vfx/modules/instantiate"].post.operationId, "instantiateVfxModule");
    assert.equal(document.paths["/v1/vfx/graph/compile"].post.operationId, "compileVfxNodeGraph");
    assert.equal(document.paths["/v1/vfx/runtime-smoke"].post.operationId, "smokeVisualRuntime");
  } finally {
    await relay.stop();
  }
});

test("stores a compact procedural draft and stages it by draftId", async () => {
  const draftPort = port + 2;
  const relay = new VisualDirectorRelay("127.0.0.1", draftPort);
  await relay.start();
  try {
    const auth = { installationId: "installation-module", launchId: "launch-module", pairingCode: "MODUL-12345", token: "module-token" };
    await fetch(`http://127.0.0.1:${draftPort}/v1/plugin/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(auth) });
    const generatedResponse = await fetch(`http://127.0.0.1:${draftPort}/v1/vfx/generate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pairingCode: auth.pairingCode, module: { name: "Stored impact", preset: "impactBurst", element: "electric", seed: 7 } }) });
    const generated = await generatedResponse.json() as any;
    assert.equal(generated.status, "succeeded");
    assert.ok(generated.draftId);
    assert.equal(generated.draft, undefined, "large node arrays stay in the relay");
    const stagedResponse = await fetch(`http://127.0.0.1:${draftPort}/v1/vfx/stage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pairingCode: auth.pairingCode, transactionName: "Stored", draftId: generated.draftId, confirmWrite: true }) });
    assert.equal(stagedResponse.status, 202);
    const pollResponse = await fetch(`http://127.0.0.1:${draftPort}/v1/plugin/poll`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(auth) });
    const poll = await pollResponse.json() as any;
    assert.equal(poll.command.method, "vfx.stageDraft");
    assert.ok(poll.command.params.draft.nodes.length >= 3);
  } finally {
    await relay.stop();
  }
});
