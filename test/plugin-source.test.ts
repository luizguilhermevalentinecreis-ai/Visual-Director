import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Studio plugin exposes every relay action and never accepts arbitrary code", async () => {
  const source = await readFile(new URL("../studio-plugin/VisualDirectorPlugin.server.lua", import.meta.url), "utf8");
  for (const method of ["system.capabilities", "scene.getSelection", "vfx.inspectSelected", "vfx.stageDraft", "vfx.commitDraft", "vfx.attachCommitted", "vfx.previewCommitted"]) {
    assert.match(source, new RegExp(method.replaceAll(".", "\\.")));
  }
  assert.doesNotMatch(source, /loadstring|require\s*\(\s*params/);
  assert.match(source, /VisualDirectorPairingCodeV1/);
});
