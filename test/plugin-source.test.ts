import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Studio plugin exposes every relay action and never accepts arbitrary code", async () => {
  const source = await readFile(new URL("../studio-plugin/VisualDirectorPlugin.server.lua", import.meta.url), "utf8");
  for (const method of ["system.capabilities", "scene.getSelection", "timeline.listMarkers", "vfx.inspectSelected", "vfx.inspectSnapshotPage", "vfx.profileSelected", "vfx.captureSelection", "vfx.saveSelectionAsModule", "vfx.listModules", "vfx.instantiateModule", "vfx.applyOperations", "vfx.stageDraft", "vfx.commitDraft", "vfx.attachCommitted", "vfx.previewCommitted", "vfx.playCommittedTimeline", "vfx.stopTimelinePreview", "vfx.smokeRuntime"]) {
    assert.match(source, new RegExp(method.replaceAll(".", "\\.")));
  }
  assert.doesNotMatch(source, /loadstring|require\s*\(\s*params/);
  assert.match(source, /DirectorMarkerBus/);
  assert.match(source, /publishPackageMarkers\(package, destinationName\)/);
  assert.match(source, /VisualDirectorPairingCodeV1/);
  assert.match(source, /for _, item in ipairs\(nodeRoot:GetDescendants\(\)\)/, "static preview must apply anchor timing to nested native effects");
});
