import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const dryRun = process.env.DRY === "1";
const name = "VD_KamehamehaChargeLoop_V2";
// Every node spans the whole clip and nothing is sequenced, so this is a
// seamless held-charge state: emitters loop forever on their own with no
// runtime driving them. Duration only exists to satisfy the schema.
const duration = 1.5;

const hands = { x: 1, y: 0.5, z: 0.15 };

const whiteHot = { r: 1, g: 0.99, b: 0.95 };
const electric = { r: 0.55, g: 0.92, b: 1 };
const signature = { r: 0.16, g: 0.55, b: 1 };
const deepBlue = { r: 0.05, g: 0.18, b: 0.72 };

type Rgb = { r: number; g: number; b: number };
type Stop = { time: number; value: number };

// Fading in at birth and out at death is what keeps a looping emitter from
// popping: particles never appear or vanish at full opacity.
const fade = (peak: number): Stop[] => [
  { time: 0, value: 1 },
  { time: 0.18, value: peak },
  { time: 0.75, value: peak + (1 - peak) * 0.35 },
  { time: 1, value: 1 },
];

type ParticleSpec = {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  color: { time: number; color: Rgb }[];
  transparency: Stop[];
  size: Stop[];
  lifetime: { min: number; max: number };
  speed: { min: number; max: number };
  rate: number;
  spread?: { x: number; y: number };
  acceleration?: { x: number; y: number; z: number };
  drag?: number;
  rotationSpeed?: { min: number; max: number };
  lightEmission?: number;
  emitterShape?: "point" | "box" | "sphere" | "cylinder" | "disc";
  shapeStyle?: "volume" | "surface";
  shapeInOut?: "outward" | "inward" | "inAndOut";
  emitterSize?: { x: number; y: number; z: number };
  emissionDirection?: "top" | "bottom" | "front" | "back" | "left" | "right";
  lockedToPart?: boolean;
  zOffset?: number;
};

const particle = (spec: ParticleSpec) => ({
  kind: "particle" as const,
  id: spec.id,
  name: spec.name,
  startTime: 0,
  endTime: duration,
  position: spec.position,
  rotation: { x: 0, y: 0, z: 0 },
  color: spec.color,
  transparency: spec.transparency,
  size: spec.size,
  lifetime: spec.lifetime,
  speed: spec.speed,
  rate: spec.rate,
  burstCount: 0,
  spread: spec.spread ?? { x: 0, y: 0 },
  acceleration: spec.acceleration ?? { x: 0, y: 0, z: 0 },
  drag: spec.drag ?? 0,
  rotationSpeed: spec.rotationSpeed ?? { min: 0, max: 0 },
  lightEmission: spec.lightEmission ?? 0.5,
  lightInfluence: 0,
  lockedToPart: spec.lockedToPart ?? false,
  zOffset: spec.zOffset ?? 0,
  emitterShape: spec.emitterShape ?? "point",
  shapeStyle: spec.shapeStyle ?? "volume",
  shapeInOut: spec.shapeInOut ?? "outward",
  shapePartial: 0,
  emitterSize: spec.emitterSize ?? { x: 0.1, y: 0.1, z: 0.1 },
  emissionDirection: spec.emissionDirection ?? "top",
});

const nodes = [
  // The gather. Particles are born on a 4.5 stud sphere surface and fly inward,
  // which is the actual mechanism for convergence. Speed stays positive here:
  // ShapeInOut supplies the direction, and lifetime is tuned so they die just
  // as they reach the middle rather than shooting out the far side.
  particle({
    id: "convergence-outer",
    name: "Outer convergence",
    position: hands,
    emitterShape: "sphere",
    shapeStyle: "surface",
    shapeInOut: "inward",
    emitterSize: { x: 9, y: 9, z: 9 },
    color: [
      { time: 0, color: signature },
      { time: 0.6, color: electric },
      { time: 1, color: whiteHot },
    ],
    transparency: fade(0.2),
    size: [
      { time: 0, value: 0.3 },
      { time: 0.7, value: 0.14 },
      { time: 1, value: 0.02 },
    ],
    lifetime: { min: 0.42, max: 0.6 },
    speed: { min: 8, max: 13 },
    rate: 130,
    spread: { x: 7, y: 7 },
    rotationSpeed: { min: -120, max: 120 },
    lightEmission: 0.55,
  }),
  // A tighter, quicker second gather layer so the stream has depth instead of
  // reading as one uniform shell of dots.
  particle({
    id: "convergence-inner",
    name: "Inner convergence",
    position: hands,
    emitterShape: "sphere",
    shapeStyle: "surface",
    shapeInOut: "inward",
    emitterSize: { x: 5, y: 5, z: 5 },
    color: [
      { time: 0, color: electric },
      { time: 1, color: whiteHot },
    ],
    transparency: fade(0.15),
    size: [
      { time: 0, value: 0.19 },
      { time: 1, value: 0.03 },
    ],
    lifetime: { min: 0.26, max: 0.4 },
    speed: { min: 7, max: 11 },
    rate: 85,
    spread: { x: 10, y: 10 },
    lightEmission: 0.5,
  }),
  // The core. High rate, almost no speed and heavy drag pack the particles into
  // a dense volume that reads as solid plasma while still churning.
  particle({
    id: "core-plasma",
    name: "Core plasma",
    position: hands,
    emitterShape: "sphere",
    shapeStyle: "volume",
    emitterSize: { x: 1.3, y: 1.3, z: 1.3 },
    color: [
      { time: 0, color: whiteHot },
      { time: 1, color: electric },
    ],
    transparency: [
      { time: 0, value: 0.6 },
      { time: 0.2, value: 0.08 },
      { time: 0.8, value: 0.2 },
      { time: 1, value: 1 },
    ],
    size: [
      { time: 0, value: 0.62 },
      { time: 0.45, value: 0.86 },
      { time: 1, value: 0.24 },
    ],
    lifetime: { min: 0.22, max: 0.36 },
    speed: { min: 0.2, max: 0.9 },
    rate: 190,
    drag: 13,
    rotationSpeed: { min: -70, max: 70 },
    lightEmission: 0.7,
    lockedToPart: true,
  }),
  // Mid shell: carries the colour between the white core and the blue halo.
  particle({
    id: "mid-shell",
    name: "Mid shell",
    position: hands,
    emitterShape: "sphere",
    shapeStyle: "surface",
    emitterSize: { x: 2.6, y: 2.6, z: 2.6 },
    color: [
      { time: 0, color: electric },
      { time: 1, color: signature },
    ],
    transparency: fade(0.3),
    size: [
      { time: 0, value: 0.42 },
      { time: 0.5, value: 0.6 },
      { time: 1, value: 0.1 },
    ],
    lifetime: { min: 0.34, max: 0.52 },
    speed: { min: 0.3, max: 1.2 },
    rate: 120,
    drag: 9,
    rotationSpeed: { min: -140, max: 140 },
    lightEmission: 0.45,
  }),
  // Outer halo: slow, soft and mostly transparent, so the orb has a boundary
  // that never quite resolves.
  particle({
    id: "outer-halo",
    name: "Outer halo",
    position: hands,
    emitterShape: "sphere",
    shapeStyle: "volume",
    emitterSize: { x: 4, y: 4, z: 4 },
    color: [
      { time: 0, color: signature },
      { time: 1, color: deepBlue },
    ],
    transparency: fade(0.62),
    size: [
      { time: 0, value: 0.7 },
      { time: 0.5, value: 1 },
      { time: 1, value: 0.2 },
    ],
    lifetime: { min: 0.55, max: 0.85 },
    speed: { min: 0.2, max: 0.9 },
    rate: 60,
    drag: 7,
    lightEmission: 0.3,
  }),
  // A flat equatorial disc of energy, the classic charge silhouette read.
  particle({
    id: "equator-disc",
    name: "Equatorial disc",
    position: hands,
    emitterShape: "disc",
    shapeStyle: "surface",
    emitterSize: { x: 5.6, y: 0.3, z: 5.6 },
    color: [
      { time: 0, color: electric },
      { time: 1, color: signature },
    ],
    transparency: fade(0.45),
    size: [
      { time: 0, value: 0.26 },
      { time: 1, value: 0.05 },
    ],
    lifetime: { min: 0.4, max: 0.6 },
    speed: { min: 0.4, max: 1.6 },
    rate: 70,
    drag: 8,
    rotationSpeed: { min: -320, max: 320 },
    lightEmission: 0.5,
  }),
  // Sparks flicking off the surface: short, fast and rare enough to read as
  // instability rather than a second halo.
  particle({
    id: "crackle",
    name: "Surface crackle",
    position: hands,
    emitterShape: "sphere",
    shapeStyle: "surface",
    emitterSize: { x: 2.2, y: 2.2, z: 2.2 },
    color: [
      { time: 0, color: whiteHot },
      { time: 1, color: electric },
    ],
    transparency: fade(0.1),
    size: [
      { time: 0, value: 0.15 },
      { time: 1, value: 0.02 },
    ],
    lifetime: { min: 0.12, max: 0.26 },
    speed: { min: 13, max: 24 },
    rate: 40,
    drag: 4,
    rotationSpeed: { min: -600, max: 600 },
    lightEmission: 0.6,
  }),
  // Ki climbing the caster, so the charge is not only in the hands.
  particle({
    id: "body-updraft",
    name: "Body ki updraft",
    position: { x: 0, y: 0, z: 0 },
    emitterShape: "cylinder",
    shapeStyle: "volume",
    emitterSize: { x: 3.2, y: 5.2, z: 3.2 },
    emissionDirection: "top",
    color: [
      { time: 0, color: signature },
      { time: 1, color: electric },
    ],
    transparency: fade(0.5),
    size: [
      { time: 0, value: 0.5 },
      { time: 1, value: 0.08 },
    ],
    lifetime: { min: 0.45, max: 0.75 },
    speed: { min: 5, max: 10 },
    rate: 50,
    acceleration: { x: 0, y: 16, z: 0 },
    drag: 1.5,
    lightEmission: 0.4,
  }),
  // Debris torn off the floor by the pressure.
  particle({
    id: "ground-debris",
    name: "Rising ground debris",
    position: { x: 0, y: -2.7, z: 0 },
    emitterShape: "box",
    shapeStyle: "volume",
    emitterSize: { x: 7, y: 0.4, z: 7 },
    emissionDirection: "top",
    color: [
      { time: 0, color: deepBlue },
      { time: 1, color: signature },
    ],
    transparency: fade(0.35),
    size: [
      { time: 0, value: 0.2 },
      { time: 1, value: 0.07 },
    ],
    lifetime: { min: 0.75, max: 1.2 },
    speed: { min: 5, max: 11 },
    rate: 35,
    acceleration: { x: 0, y: 11, z: 0 },
    drag: 0.6,
    rotationSpeed: { min: -280, max: 280 },
    lightEmission: 0.15,
  }),
  // One steady light. A held charge has no ramp to follow, and stacking lights
  // is what caused the blowout in the sequenced version.
  {
    kind: "light" as const,
    id: "charge-light",
    name: "Charge light",
    startTime: 0,
    endTime: duration,
    lightType: "point" as const,
    position: hands,
    color: electric,
    brightness: 2.2,
    range: 14,
    shadows: true,
  },
];

const draft = {
  schemaVersion: 1 as const,
  name,
  category: "characterAura" as const,
  duration,
  framesPerSecond: 60,
  looped: true,
  targetPath: "selection:1",
  intent:
    "A held Kamehameha charge built entirely from particle emitters so it loops forever with no runtime driver. Convergence is real: particles are born on a sphere surface and emitted inward. Layered core, mid shell, halo, equatorial disc, crackle, body updraft and ground debris give depth, and a single steady light replaces the stacked sequence that was blowing out the exposure.",
  style: [
    "dragon-ball",
    "kamehameha",
    "charge-loop",
    "pure-particles",
    "no-runtime-required",
    "true-inward-convergence",
    "layered-shells",
    "human-review-required",
  ],
  palette: [whiteHot, electric, signature, deepBlue],
  markers: [
    { id: "loop", time: 0, type: "custom" as const, label: "Held charge loop start" },
    { id: "ready", time: duration, type: "release" as const, label: "Loop seam, ready to release" },
  ],
  nodes,
  metadata: {
    phase: "charge",
    playback: "self-looping emitters",
    pairedRelease: "not authored yet",
  },
};

assert.equal(new Set(nodes.map((node) => node.id)).size, nodes.length, "node ids must be unique");
for (const node of nodes) {
  assert.ok(node.endTime > node.startTime, `${node.id} must end after it starts`);
}

const client = new Client({ name: "visual-director-kamehameha-loop", version: "0.1.0" });
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
    for (let attempt = 0; attempt < 60 && !status.connected; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      status = await call("get_visual_director_status", {});
    }
    if (!status.connected) throw new Error("Visual Director plugin never connected.");
    process.stdout.write(`\nstudio: ${status.session.placeName} (plugin ${status.session.pluginVersion})\n`);
    // Emitter shapes arrived in 0.1.2. An older plugin would accept this draft
    // and quietly build point emitters, producing an outward puff instead of a
    // convergence, so refuse rather than commit something subtly wrong.
    if ((status.session.pluginVersion ?? "0.0.0") < "0.1.2") {
      throw new Error(
        `Plugin ${status.session.pluginVersion} predates emitter shape support. Restart Studio to load 0.1.2.`,
      );
    }

    const staged = await call("stage_vfx_draft", { transactionName: "Kamehameha charge loop", draft });
    process.stdout.write(`staged: ${JSON.stringify(staged)}\n`);
    const committed = await call("commit_vfx_draft", {
      transactionId: staged.transactionId,
      destinationName: name,
    });
    process.stdout.write(`committed: ${JSON.stringify(committed)}\n`);

    // Attaching in the same process as the commit removes the window where the
    // package can disappear between two separate runs (an undo, a different
    // Studio session answering, a restart without saving).
    if (process.env.VD_ATTACH === "1") {
      const selection = await call("get_scene_selection", { includeDescendants: false, maxDepth: 1 });
      const target = selection.items?.[0];
      if (!target) throw new Error("Select the rig in Studio before attaching.");
      // attachCommitted destroys `old` before cloning `source`, and under
      // ReplicatedStorage those are the same instance.
      if (String(target.path).startsWith("ReplicatedStorage")) {
        throw new Error(`Refusing to attach onto ${target.path}: it would destroy the committed package.`);
      }
      process.stdout.write(`target: ${target.path} (${target.className})\n`);
      const attached = await call("attach_committed_vfx", { packageName: name });
      process.stdout.write(`attached: ${JSON.stringify(attached)}\n`);
    }
  }
} finally {
  await client.close();
}
