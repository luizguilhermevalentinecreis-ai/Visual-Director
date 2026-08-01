import assert from "node:assert/strict";
import test from "node:test";
import { parseVfxDraft } from "../src/domain.js";
import { reviewVfxDraft } from "../src/quality.js";

const impactDraft = {
  schemaVersion: 1 as const,
  name: "Crimson Break Impact",
  category: "impactFrame" as const,
  duration: 0.32,
  framesPerSecond: 60,
  looped: false,
  targetPath: "selection:1",
  intent: "A sharp red-black impact frame for a heavy melee finisher.",
  style: ["anime", "high-contrast", "hit-stop"],
  palette: [{ r: 1, g: 0.05, b: 0.08 }, { r: 0.02, g: 0.02, b: 0.03 }],
  markers: [{ id: "impact", time: 0.12, type: "impact" as const, label: "Contact" }],
  nodes: [
    { id: "flash", name: "White flash", kind: "screen" as const, startTime: 0.1, endTime: 0.15, enabled: true, tags: [], layerType: "frame" as const, anchor: { x: 0.5, y: 0.5 }, position: { x: 0.5, y: 0.5 }, size: { x: 1, y: 1 }, rotation: 0, color: { r: 1, g: 1, b: 1 }, transparency: 0, image: "", text: "", font: "GothamBold", zIndex: 20, blendMode: "normal" as const, startScale: 1, endScale: 1, startTransparency: 0, endTransparency: 1 },
    { id: "lines", name: "Impact lines", kind: "screen" as const, startTime: 0.105, endTime: 0.21, enabled: true, tags: [], layerType: "impactLines" as const, anchor: { x: 0.5, y: 0.5 }, position: { x: 0.5, y: 0.5 }, size: { x: 1.2, y: 1.2 }, rotation: -8, color: { r: 0.05, g: 0.01, b: 0.01 }, transparency: 0, image: "", text: "", font: "GothamBold", zIndex: 19, blendMode: "normal" as const, startScale: 0.8, endScale: 1.4, startTransparency: 0, endTransparency: 1 },
    { id: "shake", name: "Camera punch", kind: "camera" as const, startTime: 0.1, endTime: 0.22, enabled: true, tags: [], shakeAmplitude: { x: 0.22, y: 0.14, z: 0.08 }, shakeFrequency: 26, fovDelta: -7, chromaticAberration: 0.1, blur: 7, colorTint: { r: 1, g: 0.8, b: 0.8 }, contrast: 0.3, saturation: -0.2 },
    { id: "ring", name: "Expanding ring", kind: "geometry" as const, startTime: 0.11, endTime: 0.28, enabled: true, tags: [], shape: "ring" as const, position: { x: 0, y: 1.4, z: -2 }, rotation: { x: 0, y: 0, z: 90 }, size: { x: 0.12, y: 2, z: 2 }, color: { r: 1, g: 0.05, b: 0.08 }, material: "Neon" as const, transparency: 0, startScale: { x: 0.2, y: 0.2, z: 0.2 }, endScale: { x: 4, y: 4, z: 4 }, startTransparency: 0, endTransparency: 1, easing: "expoOut" as const },
  ],
  metadata: { author: "Visual Director test" },
};

test("parses and validates a layered impact draft", () => {
  const draft = parseVfxDraft(impactDraft);
  const report = reviewVfxDraft(draft);
  assert.equal(report.blockingIssues.length, 0);
  assert.equal(report.stats.nodes, 4);
  assert.ok(report.score >= 0.9);
});

test("rejects nodes outside the duration", () => {
  const draft = parseVfxDraft({ ...impactDraft, nodes: impactDraft.nodes.map((node, index) => index === 0 ? { ...node, endTime: 0.8 } : node) });
  assert.equal(reviewVfxDraft(draft).blockingIssues[0]?.code, "node_outside_duration");
});

test("accepts Studio-native property curves on a VFX node", () => {
  const curved: any = structuredClone(impactDraft);
  curved.nodes[3] = {
    ...curved.nodes[3]!,
    propertyCurves: [{
      target: "part" as const, property: "Transparency", interpolation: "smooth" as const,
      keys: [{ time: 0, value: 0 }, { time: 0.7, value: 0.15 }, { time: 1, value: 1 }],
    }],
  };
  const parsed = parseVfxDraft(curved);
  assert.equal(parsed.nodes[3]?.propertyCurves.length, 1);
});
