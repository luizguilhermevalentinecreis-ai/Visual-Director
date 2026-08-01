import assert from "node:assert/strict";
import test from "node:test";
import { compileProceduralVfxModule } from "../src/procedural-modules.js";

for (const preset of ["impactBurst", "shockwave", "auraOrbit", "slashArc", "elementalTrail"] as const) {
  test(`compiles deterministic ${preset} module`, () => {
    const input = { name: `Test ${preset}`, preset, element: "water" as const, seed: 42, complexity: 3, duration: 1 };
    const a = compileProceduralVfxModule(input);
    const b = compileProceduralVfxModule(input);
    assert.deepEqual(a, b);
    assert.ok(a.nodes.length >= 2);
    assert.equal(a.markers.some((marker) => marker.type === "impact"), !["auraOrbit", "elementalTrail"].includes(preset));
  });
}

test("water uses scene lighting, foam breakup and accessible flipbook controls", () => {
  const draft = compileProceduralVfxModule({
    name: "Water trail", preset: "elementalTrail", element: "water", duration: 1,
    texture: "rbxassetid://123", flipbookLayout: "grid4x4", flipbookMode: "loop", flipbookFramerate: { min: 20, max: 30 },
  });
  const particles = draft.nodes.filter((node): node is any => node.kind === "particle");
  assert.ok(particles.length > 0);
  assert.ok(particles.every((node) => node.lightEmission === 0.05 && node.lightInfluence === 0.8));
  assert.ok(particles.every((node) => node.flipbookLayout === "grid4x4"));
  assert.ok(particles.every((node) => node.acceleration.y <= -35), "water needs a readable ballistic fall");
  assert.ok(particles.every((node) => node.transparency[1].value === 0.35), "water keeps reflected scene light at peak opacity");
  assert.deepEqual(particles[0]!.color[0]!.color, draft.palette[0], "water starts as body color");
  assert.deepEqual(particles[0]!.color.at(-1)!.color, draft.palette[2], "water breaks into pale foam");
});

test("looping aura distributes unique arcs and emits continuously with camera-facing motes", () => {
  const draft = compileProceduralVfxModule({ name: "Loop aura", preset: "auraOrbit", element: "shadow", duration: 1, complexity: 1 });
  const beams = draft.nodes.filter((node): node is any => node.kind === "beam");
  assert.equal(beams.length, 2);
  assert.notDeepEqual(beams[0]!.from, beams[1]!.from);
  const motes = draft.nodes.find((node): node is any => node.id === "AuraMotes")!;
  assert.equal(motes.burstCount, 0);
  assert.ok(motes.rate > 0);
  assert.equal(motes.orientation, "facingCamera");
  assert.ok(motes.squash.every((key: any) => key.value === 0));
  assert.equal(draft.markers.some((marker) => marker.type === "impact"), false);
});

test("rejects an inverted flipbook framerate range", () => {
  assert.throws(() => compileProceduralVfxModule({
    name: "Invalid flipbook", preset: "slashArc", element: "water",
    flipbookFramerate: { min: 30, max: 5 },
  }), /max must be >= min/);
});
