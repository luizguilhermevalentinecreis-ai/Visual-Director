import assert from "node:assert/strict";
import test from "node:test";
import { vfxOperationProgramSchema } from "../src/operations.js";

test("accepts a property-complete particle refinement program", () => {
  const program = vfxOperationProgramSchema.parse({
    name: "Turn captured fire into heavy water",
    scope: "committedPackage",
    packageName: "WaterReference",
    operations: [
      { op: "setProperty", selector: { className: "ParticleEmitter", name: "MainArc" }, property: "Color", value: { type: "colorSequence", value: [{ time: 0, color: { r: 0.7, g: 0.95, b: 1 } }, { time: 1, color: { r: 0.02, g: 0.2, b: 0.8 } }] } },
      { op: "setProperty", selector: { className: "ParticleEmitter" }, property: "Drag", value: { type: "number", value: 4 }, requireMatch: true },
      { op: "emit", selector: { className: "ParticleEmitter", name: "Droplets" }, count: 80 },
    ],
  });
  assert.equal(program.operations.length, 3);
  assert.equal(program.scope, "committedPackage");
});

test("requires a package name for committed scope", () => {
  assert.throws(() => vfxOperationProgramSchema.parse({
    name: "Invalid",
    scope: "committedPackage",
    operations: [{ op: "rename", selector: { name: "A" }, name: "B" }],
  }));
});
