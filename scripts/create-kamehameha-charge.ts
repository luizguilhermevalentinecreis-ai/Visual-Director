import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const dryRun = process.env.DRY === "1";
const name = "VD_KamehamehaCharge_V1";
const duration = 2.4;

// Charge phases. A long gather then a short compression: the anticipation
// principle says a slow build reads as looming inevitability, and the sudden
// collapse right before release is what makes the beam feel earned.
const spark = 0.0;
const gather = 0.45;
const throb = 1.5;
const compress = 2.0;

// The cupped hands sit at the caster's right hip in the Kamehameha stance, so
// every layer is anchored there rather than at the chest.
const hands = { x: 1, y: 0.5, z: 0.15 };

const whiteHot = { r: 1, g: 0.99, b: 0.95 };
const electric = { r: 0.55, g: 0.92, b: 1 };
const signature = { r: 0.16, g: 0.55, b: 1 };
const deepBlue = { r: 0.05, g: 0.18, b: 0.72 };

// The charge radius is a designed curve rather than a few straight ramps: an
// envelope that grows, overshoots, then compresses, multiplied by a throb whose
// amplitude and frequency both climb as the orb becomes less stable. It gets
// sampled into short segments the same way the animation curves were, because
// one geometry node can only express a single start-to-end scale.
function envelopeAt(t: number): number {
  if (t <= gather) return 0.05 + (0.07 * t) / gather;
  if (t <= throb) {
    const u = (t - gather) / (throb - gather);
    return 0.12 + 0.88 * (1 - (1 - u) ** 2);
  }
  if (t <= compress) {
    const u = (t - throb) / (compress - throb);
    return 1 + 0.2 * (1 - (1 - u) ** 3);
  }
  const u = (t - compress) / (duration - compress);
  return 1.2 - 0.58 * u * u;
}

const throbFrom = 2.2;
const throbTo = 4.6;
function throbAt(t: number): number {
  const ramp = Math.min(1, Math.max(0, (t - gather) / (compress - gather)));
  // Integrating a linear frequency ramp keeps the phase continuous while the
  // pulse accelerates; multiplying frequency by time directly would stutter.
  const phase = 2 * Math.PI * (throbFrom * t + ((throbTo - throbFrom) / (2 * duration)) * t * t);
  return 1 + 0.11 * ramp * Math.sin(phase);
}
const radiusAt = (t: number) => envelopeAt(t) * throbAt(t);
const uniform = (value: number) => ({ x: value, y: value, z: value });

type Rgb = { r: number; g: number; b: number };
const mix = (a: Rgb, b: Rgb, t: number): Rgb => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t,
});
// The orb climbs the palette as it charges, so colour carries intensity even
// in a still frame.
function chargeColor(t: number, bias: number): Rgb {
  const u = Math.min(1, t / duration);
  const ramp = u < 0.5 ? mix(deepBlue, signature, u / 0.5) : mix(signature, electric, (u - 0.5) / 0.5);
  return mix(ramp, whiteHot, bias);
}

// Three concentric shells on different materials: a blinding core, a coloured
// mid layer, and a soft ForceField halo that never fully resolves.
const shells = [
  { id: "core", base: 0.75, material: "Neon" as const, transparency: 0, bias: 0.75 },
  { id: "mid", base: 1.5, material: "Neon" as const, transparency: 0.3, bias: 0.35 },
  { id: "outer", base: 2.5, material: "ForceField" as const, transparency: 0.5, bias: 0 },
];

const shellSegments = 28;
const shellNodes = shells.flatMap((shell) =>
  Array.from({ length: shellSegments }, (_, index) => {
    const start = (duration * index) / shellSegments;
    const end = (duration * (index + 1)) / shellSegments;
    return {
      kind: "geometry" as const,
      id: `${shell.id}-seg-${index}`,
      name: `${shell.id} shell ${index}`,
      startTime: start,
      endTime: end,
      shape: "ball" as const,
      position: hands,
      rotation: { x: 0, y: 0, z: 0 },
      size: uniform(shell.base),
      color: chargeColor(start, shell.bias),
      material: shell.material,
      transparency: shell.transparency,
      startScale: uniform(radiusAt(start)),
      endScale: uniform(radiusAt(end)),
      startTransparency: shell.transparency,
      endTransparency: shell.transparency,
      // The curve is already sampled, so linear between samples preserves it
      // instead of re-easing every segment into a stutter.
      easing: "linear" as const,
    };
  }),
);

// A rotating sphere is invisible, so the churn comes from two counter-rotating
// bands. These are the elements that actually read as spin.
const bandSegments = 18;
const bandNodes = [
  { id: "band-a", tilt: 0, spin: 210, base: 2.9, thickness: 0.16 },
  { id: "band-b", tilt: 62, spin: -260, base: 3.3, thickness: 0.12 },
].flatMap((band) =>
  Array.from({ length: bandSegments }, (_, index) => {
    const start = gather + ((duration - gather) * index) / bandSegments;
    const end = gather + ((duration - gather) * (index + 1)) / bandSegments;
    return {
      kind: "geometry" as const,
      id: `${band.id}-seg-${index}`,
      name: `${band.id} ${index}`,
      startTime: start,
      endTime: end,
      shape: "ring" as const,
      position: hands,
      // Each segment hands off at a further rotation, so the band spins.
      rotation: { x: band.tilt, y: band.spin * start, z: 0 },
      size: { x: band.base, y: band.base, z: band.thickness },
      color: chargeColor(start, 0.2),
      material: "Neon" as const,
      transparency: 0.35,
      startScale: uniform(radiusAt(start) * 0.85),
      endScale: uniform(radiusAt(end) * 0.85),
      startTransparency: 0.35,
      endTransparency: 0.35,
      easing: "linear" as const,
    };
  }),
);

// The light follows the same curve in steps, so the glow pulses with the orb
// instead of sitting at three fixed levels.
const lightSteps = 8;
const lightNodes = Array.from({ length: lightSteps }, (_, index) => {
  const start = gather + ((duration - gather) * index) / lightSteps;
  const end = gather + ((duration - gather) * (index + 1)) / lightSteps;
  const intensity = radiusAt(start);
  return {
    kind: "light" as const,
    id: `charge-light-${index}`,
    name: `Charge light ${index}`,
    startTime: start,
    endTime: end,
    lightType: "point" as const,
    position: hands,
    color: chargeColor(start, 0.5),
    brightness: 0.7 + 2.1 * intensity,
    range: 8 + 7 * intensity,
    // Shadows sell a huge bright object in front of the caster: the body
    // throws a shadow away from the sphere instead of staying evenly lit.
    shadows: true,
  };
});

const nodes = [
  // First spark: a dim, small core before anything else, so the charge has a
  // beginning rather than appearing at full strength.
  {
    kind: "particle" as const,
    id: "first-spark",
    name: "First spark",
    startTime: spark,
    endTime: gather + 0.15,
    position: hands,
    color: [
      { time: 0, color: electric },
      { time: 1, color: signature },
    ],
    transparency: [
      { time: 0, value: 0.4 },
      { time: 1, value: 1 },
    ],
    size: [
      { time: 0, value: 0.28 },
      { time: 1, value: 0.02 },
    ],
    lifetime: { min: 0.2, max: 0.4 },
    speed: { min: 1, max: 3 },
    rate: 26,
    burstCount: 0,
    spread: { x: 180, y: 180 },
    acceleration: { x: 0, y: 1.5, z: 0 },
    drag: 3,
    rotationSpeed: { min: -90, max: 90 },
    lightEmission: 0.55,
    lightInfluence: 0,
    zOffset: 0,
  },
  // THE signature of a charge: negative speed pulls particles inward, so the
  // sphere reads as gathering energy rather than emitting it.
  {
    kind: "particle" as const,
    id: "convergence-stream",
    name: "Inward energy convergence",
    startTime: gather,
    endTime: duration,
    position: hands,
    color: [
      { time: 0, color: signature },
      { time: 0.6, color: electric },
      { time: 1, color: whiteHot },
    ],
    transparency: [
      { time: 0, value: 1 },
      { time: 0.25, value: 0.2 },
      { time: 1, value: 0.9 },
    ],
    size: [
      { time: 0, value: 0.16 },
      { time: 0.7, value: 0.3 },
      { time: 1, value: 0.04 },
    ],
    lifetime: { min: 0.35, max: 0.6 },
    // Negative speed is the whole trick: particles spawn out in the shell and
    // travel back toward the emitter.
    speed: { min: -26, max: -13 },
    rate: 120,
    burstCount: 0,
    spread: { x: 180, y: 180 },
    acceleration: { x: 0, y: 0, z: 0 },
    drag: 1.5,
    rotationSpeed: { min: -160, max: 160 },
    lightEmission: 0.6,
    lightInfluence: 0,
    zOffset: 0.1,
  },
  // A second, slower convergence layer at a different rate keeps the stream
  // from looking like one uniform sheet of particles.
  {
    kind: "particle" as const,
    id: "convergence-heavy",
    name: "Heavy convergence motes",
    startTime: gather + 0.25,
    endTime: duration,
    position: hands,
    color: [
      { time: 0, color: whiteHot },
      { time: 1, color: electric },
    ],
    transparency: [
      { time: 0, value: 0.9 },
      { time: 0.3, value: 0.35 },
      { time: 1, value: 1 },
    ],
    size: [
      { time: 0, value: 0.34 },
      { time: 1, value: 0.08 },
    ],
    lifetime: { min: 0.5, max: 0.85 },
    speed: { min: -14, max: -7 },
    rate: 55,
    burstCount: 0,
    spread: { x: 180, y: 180 },
    acceleration: { x: 0, y: -2, z: 0 },
    drag: 2.5,
    rotationSpeed: { min: -70, max: 70 },
    lightEmission: 0.45,
    lightInfluence: 0,
    zOffset: 0.05,
  },
  // Ki aura climbing the body: the charge is not only in the hands, the whole
  // character is under load.
  {
    kind: "particle" as const,
    id: "body-aura",
    name: "Body ki aura",
    startTime: gather + 0.1,
    endTime: duration,
    position: { x: 0, y: 0.1, z: 0 },
    color: [
      { time: 0, color: signature },
      { time: 0.5, color: electric },
      { time: 1, color: whiteHot },
    ],
    transparency: [
      { time: 0, value: 1 },
      { time: 0.3, value: 0.55 },
      { time: 1, value: 1 },
    ],
    size: [
      { time: 0, value: 0.7 },
      { time: 1, value: 0.1 },
    ],
    lifetime: { min: 0.4, max: 0.7 },
    speed: { min: 5, max: 11 },
    rate: 60,
    burstCount: 0,
    spread: { x: 14, y: 180 },
    acceleration: { x: 0, y: 26, z: 0 },
    drag: 1.5,
    rotationSpeed: { min: -50, max: 50 },
    lightEmission: 0.5,
    lightInfluence: 0,
    zOffset: 0,
  },
  // Debris torn off the ground and pulled upward by the pressure.
  {
    kind: "particle" as const,
    id: "rising-debris",
    name: "Rising ground debris",
    startTime: gather + 0.2,
    endTime: duration,
    position: { x: 0, y: -2.6, z: 0 },
    color: [
      { time: 0, color: deepBlue },
      { time: 1, color: signature },
    ],
    transparency: [
      { time: 0, value: 0.35 },
      { time: 1, value: 1 },
    ],
    size: [
      { time: 0, value: 0.22 },
      { time: 1, value: 0.1 },
    ],
    lifetime: { min: 0.7, max: 1.2 },
    speed: { min: 7, max: 16 },
    rate: 45,
    burstCount: 0,
    spread: { x: 30, y: 180 },
    acceleration: { x: 0, y: 12, z: 0 },
    drag: 0.6,
    rotationSpeed: { min: -300, max: 300 },
    lightEmission: 0.2,
    lightInfluence: 0.4,
    zOffset: 0,
  },
  ...shellNodes,
  ...bandNodes,
  ...lightNodes,
  // Two concentric ground rings offset in time: layering cheap rings is how
  // the reference gets a complex-looking shockwave out of simple geometry.
  {
    kind: "geometry" as const,
    id: "dust-ring-a",
    name: "Ground dust ring A",
    startTime: gather + 0.05,
    endTime: gather + 0.95,
    shape: "ring" as const,
    position: { x: 0, y: -2.85, z: 0 },
    rotation: { x: 90, y: 0, z: 0 },
    size: { x: 3.2, y: 3.2, z: 0.14 },
    color: electric,
    material: "Neon" as const,
    transparency: 0.45,
    startScale: { x: 0.35, y: 0.35, z: 1 },
    endScale: { x: 2.6, y: 2.6, z: 1 },
    startTransparency: 0.45,
    endTransparency: 1,
    easing: "quadOut" as const,
  },
  {
    kind: "geometry" as const,
    id: "dust-ring-b",
    name: "Ground dust ring B",
    startTime: throb,
    endTime: duration,
    shape: "ring" as const,
    position: { x: 0, y: -2.85, z: 0 },
    rotation: { x: 90, y: 0, z: 0 },
    size: { x: 3.6, y: 3.6, z: 0.16 },
    color: signature,
    material: "Neon" as const,
    transparency: 0.35,
    startScale: { x: 0.4, y: 0.4, z: 1 },
    endScale: { x: 3.4, y: 3.4, z: 1 },
    startTransparency: 0.35,
    endTransparency: 1,
    easing: "quadOut" as const,
  },
  // Crackle arcs during the throb. Short, staggered, and never symmetric, so
  // the sphere looks unstable rather than decorative.
  ...[
    { id: "arc-a", at: throb + 0.05, from: { x: 0.4, y: 0.9, z: -0.3 }, to: { x: 1.7, y: 0.1, z: 0.5 } },
    { id: "arc-b", at: throb + 0.24, from: { x: 1.6, y: 1, z: 0.4 }, to: { x: 0.5, y: -0.2, z: -0.4 } },
    { id: "arc-c", at: compress + 0.12, from: { x: 0.5, y: 0.2, z: 0.6 }, to: { x: 1.6, y: 1.1, z: -0.3 } },
  ].map((arc) => ({
    kind: "beam" as const,
    id: arc.id,
    name: `Charge crackle ${arc.id}`,
    startTime: arc.at,
    endTime: arc.at + 0.16,
    from: arc.from,
    to: arc.to,
    width0: 0.16,
    width1: 0.04,
    color: [
      { time: 0, color: whiteHot },
      { time: 1, color: electric },
    ],
    transparency: [
      { time: 0, value: 0.15 },
      { time: 0.6, value: 0.5 },
      { time: 1, value: 1 },
    ],
    textureSpeed: 6,
    textureLength: 1,
    curve0: 1.4,
    curve1: -1.1,
    faceCamera: true,
    segments: 8,
  })),
  // Camera pressure builds with the charge and never resolves, because the
  // release is a separate effect.
  ...[
    { id: "cam-gather", start: gather, end: throb, amp: 0.05, fov: -1, ab: 0.05 },
    { id: "cam-throb", start: throb, end: compress, amp: 0.11, fov: -2.5, ab: 0.12 },
    { id: "cam-load", start: compress, end: duration, amp: 0.2, fov: -5, ab: 0.24 },
  ].map((step) => ({
    kind: "camera" as const,
    id: step.id,
    name: `Charge camera ${step.id}`,
    startTime: step.start,
    endTime: step.end,
    shakeAmplitude: { x: step.amp, y: step.amp * 1.2, z: step.amp * 0.5 },
    shakeFrequency: 22,
    fovDelta: step.fov,
    chromaticAberration: step.ab,
    blur: 0,
    colorTint: { r: 0.92, g: 0.97, b: 1 },
    contrast: 0.05,
    saturation: 0.08,
  })),
  // A faint cool wash so the whole frame reads as lit by the sphere.
  {
    kind: "screen" as const,
    id: "charge-wash",
    name: "Charge screen wash",
    startTime: gather,
    endTime: duration,
    layerType: "frame" as const,
    anchor: { x: 0.5, y: 0.5 },
    position: { x: 0.5, y: 0.5 },
    size: { x: 1, y: 1 },
    rotation: 0,
    color: signature,
    transparency: 0.88,
    zIndex: 20,
    blendMode: "additive" as const,
    startScale: 1,
    endScale: 1,
    startTransparency: 1,
    endTransparency: 0.94,
  },
];

const draft = {
  schemaVersion: 1 as const,
  name,
  category: "characterAura" as const,
  duration,
  framesPerSecond: 60,
  looped: false,
  targetPath: "selection:1",
  intent:
    "The charging half of a Kamehameha, built on three concentric energy shells, inward-converging particles, and a gather-throb-load scale curve. The charge deliberately ends compressed and unreleased so the beam can be authored as a separate effect that starts from this loaded state.",
  style: [
    "dragon-ball",
    "kamehameha",
    "charge-only",
    "concentric-shells",
    "inward-convergence",
    "anticipation-buildup",
    "ki-aura",
    "human-review-required",
  ],
  palette: [whiteHot, electric, signature, deepBlue],
  markers: [
    { id: "spark", time: spark, type: "anticipation" as const, label: "First spark in the cupped hands" },
    { id: "gather", time: gather, type: "custom" as const, label: "Convergence begins" },
    { id: "throb", time: throb, type: "custom" as const, label: "Sphere throbs to full size" },
    { id: "load", time: compress, type: "custom" as const, label: "Compression loads the beam" },
    { id: "ready", time: duration, type: "release" as const, label: "Held at full charge, ready to fire" },
  ],
  nodes,
  metadata: {
    phase: "charge",
    pairedRelease: "not authored yet",
    shellLayers: shells.length,
  },
};

for (const node of nodes) {
  assert.ok(node.endTime > node.startTime, `${node.id} must end after it starts`);
  assert.ok(node.endTime <= duration + 1e-9, `${node.id} ends after the draft duration`);
}
assert.equal(new Set(nodes.map((node) => node.id)).size, nodes.length, "node ids must be unique");

const client = new Client({ name: "visual-director-kamehameha", version: "0.1.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/src/index.js"],
  cwd: process.cwd(),
  env: Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  ),
  stderr: "pipe",
});

function payload(result: { content?: unknown }): any {
  const first = (result.content as { type: string; text: string }[] | undefined)?.[0];
  if (!first) return undefined;
  try {
    return JSON.parse(first.text);
  } catch {
    return first.text;
  }
}

async function call(tool: string, args: Record<string, unknown>): Promise<any> {
  const result = await client.callTool({ name: tool, arguments: args });
  if (result.isError) throw new Error(`${tool}: ${JSON.stringify(result.content)}`);
  return payload(result as { content?: unknown });
}

try {
  await client.connect(transport);

  const report = await call("validate_vfx_draft", { draft });
  process.stdout.write(
    `\nscore=${report.score}\nstats: ${JSON.stringify(report.stats)}\n` +
      `blocking: ${JSON.stringify(report.blockingIssues)}\n` +
      `warnings: ${JSON.stringify(report.warnings)}\n` +
      `notes: ${JSON.stringify(report.notes)}\n`,
  );

  if (dryRun) {
    process.stdout.write("\nDRY run: nothing was sent to Studio.\n");
  } else {
    let status = await call("get_visual_director_status", {});
    for (let attempt = 0; attempt < 15 && !status.connected; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      status = await call("get_visual_director_status", {});
    }
    if (!status.connected) {
      throw new Error(`Visual Director plugin never connected. Status: ${JSON.stringify(status)}`);
    }
    process.stdout.write(`\nstudio: ${JSON.stringify(status)}\n`);

    const staged = await call("stage_vfx_draft", {
      transactionName: "Kamehameha charge",
      draft,
    });
    process.stdout.write(`staged: ${JSON.stringify(staged)}\n`);
    const committed = await call("commit_vfx_draft", {
      transactionId: staged.transactionId,
      destinationName: name,
    });
    process.stdout.write(`committed: ${JSON.stringify(committed)}\n`);
  }
} finally {
  await client.close();
}
