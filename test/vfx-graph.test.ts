import assert from "node:assert/strict";
import test from "node:test";
import { compileVfxNodeGraph } from "../src/vfx-graph.js";

test("compiles a connected vortex and drag graph into native spatial emitter cells", () => {
  const graph = {
    name: "Vortex field", duration: 1, seed: 9,
    palette: [{ r: 0.1, g: 0.2, b: 0.8 }, { r: 0.7, g: 0.95, b: 1 }],
    nodes: [
      { id: "spawn", type: "emitter" as const, samples: 8, burstCount: 80 },
      { id: "vortex", type: "field" as const, fieldType: "vortex" as const, strength: 30, radius: 8 },
      { id: "drag", type: "field" as const, fieldType: "drag" as const, strength: 3, radius: 8 },
      { id: "out", type: "output" as const },
    ],
    connections: [{ from: "vortex", to: "spawn" }, { from: "drag", to: "spawn" }, { from: "spawn", to: "out" }],
  };
  const a = compileVfxNodeGraph(graph);
  const b = compileVfxNodeGraph(graph);
  assert.deepEqual(a, b);
  assert.equal(a.nodes.length, 8);
  assert.ok(a.nodes.every((node) => node.kind === "particle"));
  assert.ok(a.nodes.some((node: any) => Math.hypot(node.acceleration.x, node.acceleration.y, node.acceleration.z) > 0));
  assert.ok(a.nodes.every((node: any) => node.drag > 0));
});
