import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const dryRun = process.env.DRY === "1";
const name = "VD_FangRushCombo_VFX_V1";

// These are the impact times authored into MD_R6_FangRushCombo_60_V1. Every
// visual layer below hangs off one of them, so the effect and the animation
// stay locked together instead of drifting into a vaguely-timed light show.
const jab = 0.21;
const cross = 0.45;
const roundhouse = 0.72;
const finisher = 1.3;
const duration = 1.75;

const crimson = { r: 0.85, g: 0.08, b: 0.12 };
const ember = { r: 1, g: 0.42, b: 0.08 };
const whiteHot = { r: 1, g: 0.95, b: 0.85 };
const violet = { r: 0.55, g: 0.15, b: 0.85 };

// A light strike gets a flash and a small shake; the finisher gets the ring,
// the beam, the letterbox and the colour shift. Escalation is what makes the
// fourth hit read as the finisher rather than a fourth jab.
function strikeLayers(id: string, at: number, scale: number, accent: typeof crimson) {
  return [
    {
      kind: "particle" as const,
      id: `${id}-burst`,
      name: `${id} impact burst`,
      startTime: at,
      endTime: at + 0.13 + scale * 0.1,
      position: { x: 0, y: 1.2, z: -1.6 },
      color: [
        { time: 0, color: whiteHot },
        { time: 0.35, color: accent },
        { time: 1, color: crimson },
      ],
      transparency: [
        { time: 0, value: 0.05 },
        { time: 0.6, value: 0.35 },
        { time: 1, value: 1 },
      ],
      size: [
        { time: 0, value: 0.6 * scale },
        { time: 0.4, value: 1.5 * scale },
        { time: 1, value: 0.2 },
      ],
      lifetime: { min: 0.12, max: 0.26 },
      speed: { min: 14 * scale, max: 30 * scale },
      rate: 0,
      burstCount: Math.round(22 * scale),
      spread: { x: 34, y: 34 },
      acceleration: { x: 0, y: -22, z: 0 },
      drag: 4,
      rotationSpeed: { min: -220, max: 220 },
      lightEmission: 1,
      lightInfluence: 0,
      zOffset: 0.2,
    },
    {
      kind: "light" as const,
      id: `${id}-flash`,
      name: `${id} impact flash`,
      startTime: at,
      endTime: at + 0.08 + scale * 0.05,
      lightType: "point" as const,
      position: { x: 0, y: 1.2, z: -1.6 },
      color: accent,
      brightness: 4 * scale,
      range: 9 * scale,
      shadows: false,
    },
    {
      kind: "camera" as const,
      id: `${id}-shake`,
      name: `${id} camera shake`,
      startTime: at,
      endTime: at + 0.07 + scale * 0.09,
      shakeAmplitude: { x: 0.22 * scale, y: 0.3 * scale, z: 0.12 * scale },
      shakeFrequency: 26,
      fovDelta: -1.5 * scale,
      chromaticAberration: Math.min(1, 0.12 * scale),
      blur: 0,
      colorTint: { r: 1, g: 1, b: 1 },
      contrast: 0.04 * scale,
      saturation: 0,
    },
  ];
}

const nodes = [
  // Anticipation: ki gathers before the first hit, so the combo has a visible
  // wind-up rather than starting at full intensity.
  {
    kind: "particle" as const,
    id: "charge-aura",
    name: "Anticipation charge aura",
    startTime: 0,
    endTime: jab,
    position: { x: 0, y: 0.2, z: 0 },
    color: [
      { time: 0, color: crimson },
      { time: 1, color: ember },
    ],
    transparency: [
      { time: 0, value: 1 },
      { time: 0.4, value: 0.45 },
      { time: 1, value: 1 },
    ],
    size: [
      { time: 0, value: 0.5 },
      { time: 1, value: 0.05 },
    ],
    lifetime: { min: 0.25, max: 0.45 },
    speed: { min: 3, max: 7 },
    rate: 70,
    burstCount: 0,
    spread: { x: 12, y: 180 },
    acceleration: { x: 0, y: 14, z: 0 },
    drag: 2,
    rotationSpeed: { min: -60, max: 60 },
    lightEmission: 0.9,
    lightInfluence: 0,
    zOffset: 0,
  },
  {
    kind: "trail" as const,
    id: "jab-trail",
    name: "Lead hand trail",
    startTime: jab - 0.08,
    endTime: jab + 0.09,
    attachment0: { x: -0.35, y: 1.3, z: -0.4 },
    attachment1: { x: -0.35, y: 0.8, z: -0.4 },
    lifetime: 0.16,
    minLength: 0.05,
    color: [
      { time: 0, color: whiteHot },
      { time: 1, color: crimson },
    ],
    transparency: [
      { time: 0, value: 0.25 },
      { time: 1, value: 1 },
    ],
    widthScale: [
      { time: 0, value: 1 },
      { time: 1, value: 0 },
    ],
    textureLength: 1,
    faceCamera: true,
  },
  ...strikeLayers("jab", jab, 1, ember),
  {
    kind: "trail" as const,
    id: "cross-trail",
    name: "Rear hand trail",
    startTime: cross - 0.1,
    endTime: cross + 0.11,
    attachment0: { x: 0.35, y: 1.3, z: -0.5 },
    attachment1: { x: 0.35, y: 0.75, z: -0.5 },
    lifetime: 0.2,
    minLength: 0.05,
    color: [
      { time: 0, color: whiteHot },
      { time: 1, color: ember },
    ],
    transparency: [
      { time: 0, value: 0.18 },
      { time: 1, value: 1 },
    ],
    widthScale: [
      { time: 0, value: 1.2 },
      { time: 1, value: 0 },
    ],
    textureLength: 1,
    faceCamera: true,
  },
  ...strikeLayers("cross", cross, 1.35, ember),
  {
    kind: "geometry" as const,
    id: "cross-ring",
    name: "Cross shock ring",
    startTime: cross,
    endTime: cross + 0.2,
    shape: "ring" as const,
    position: { x: 0, y: 1.2, z: -1.9 },
    rotation: { x: 0, y: 0, z: 0 },
    size: { x: 1.6, y: 1.6, z: 0.2 },
    color: ember,
    material: "Neon" as const,
    transparency: 0.1,
    startScale: { x: 0.25, y: 0.25, z: 1 },
    endScale: { x: 3.4, y: 3.4, z: 1 },
    startTransparency: 0.1,
    endTransparency: 1,
    easing: "expoOut" as const,
  },
  {
    kind: "trail" as const,
    id: "roundhouse-trail",
    name: "Roundhouse leg arc",
    startTime: roundhouse - 0.14,
    endTime: roundhouse + 0.14,
    attachment0: { x: -0.5, y: -0.4, z: -0.5 },
    attachment1: { x: -0.5, y: -1.7, z: -0.5 },
    lifetime: 0.26,
    minLength: 0.05,
    color: [
      { time: 0, color: whiteHot },
      { time: 0.5, color: ember },
      { time: 1, color: crimson },
    ],
    transparency: [
      { time: 0, value: 0.12 },
      { time: 1, value: 1 },
    ],
    widthScale: [
      { time: 0, value: 1.6 },
      { time: 1, value: 0 },
    ],
    textureLength: 1,
    faceCamera: true,
  },
  ...strikeLayers("roundhouse", roundhouse, 1.6, ember),
  {
    kind: "geometry" as const,
    id: "roundhouse-ring",
    name: "Roundhouse shock ring",
    startTime: roundhouse,
    endTime: roundhouse + 0.24,
    shape: "ring" as const,
    position: { x: -0.4, y: 0.9, z: -1.9 },
    rotation: { x: 0, y: 0, z: 68 },
    size: { x: 1.8, y: 1.8, z: 0.22 },
    color: ember,
    material: "Neon" as const,
    transparency: 0.08,
    startScale: { x: 0.3, y: 0.3, z: 1 },
    endScale: { x: 4.2, y: 4.2, z: 1 },
    startTransparency: 0.08,
    endTransparency: 1,
    easing: "expoOut" as const,
  },
  // The windup for the finisher: the palette shifts to violet so the audience
  // knows the fourth hit is a different weight class before it lands.
  {
    kind: "particle" as const,
    id: "spin-charge",
    name: "Spin windup charge",
    startTime: 0.9,
    endTime: finisher,
    position: { x: 0, y: 0.2, z: 0 },
    color: [
      { time: 0, color: crimson },
      { time: 0.6, color: violet },
      { time: 1, color: whiteHot },
    ],
    transparency: [
      { time: 0, value: 0.85 },
      { time: 0.5, value: 0.3 },
      { time: 1, value: 1 },
    ],
    size: [
      { time: 0, value: 0.35 },
      { time: 0.5, value: 0.8 },
      { time: 1, value: 0.05 },
    ],
    lifetime: { min: 0.3, max: 0.5 },
    speed: { min: 6, max: 13 },
    rate: 150,
    burstCount: 0,
    spread: { x: 25, y: 180 },
    acceleration: { x: 0, y: 20, z: 0 },
    drag: 3,
    rotationSpeed: { min: -200, max: 200 },
    lightEmission: 1,
    lightInfluence: 0,
    zOffset: 0,
  },
  {
    kind: "trail" as const,
    id: "finisher-trail",
    name: "Finisher leg arc",
    startTime: finisher - 0.2,
    endTime: finisher + 0.16,
    attachment0: { x: 0.55, y: -0.3, z: -0.5 },
    attachment1: { x: 0.55, y: -1.8, z: -0.5 },
    lifetime: 0.34,
    minLength: 0.05,
    color: [
      { time: 0, color: whiteHot },
      { time: 0.4, color: violet },
      { time: 1, color: crimson },
    ],
    transparency: [
      { time: 0, value: 0.05 },
      { time: 1, value: 1 },
    ],
    widthScale: [
      { time: 0, value: 2.2 },
      { time: 1, value: 0 },
    ],
    textureLength: 1,
    faceCamera: true,
  },
  ...strikeLayers("finisher", finisher, 2.4, violet),
  {
    kind: "geometry" as const,
    id: "finisher-ring",
    name: "Finisher shock ring",
    startTime: finisher,
    endTime: finisher + 0.32,
    shape: "ring" as const,
    position: { x: 0, y: 1.1, z: -2.2 },
    rotation: { x: 0, y: 0, z: 0 },
    size: { x: 2.4, y: 2.4, z: 0.3 },
    color: violet,
    material: "Neon" as const,
    transparency: 0.02,
    startScale: { x: 0.2, y: 0.2, z: 1 },
    endScale: { x: 7.5, y: 7.5, z: 1 },
    startTransparency: 0.02,
    endTransparency: 1,
    easing: "expoOut" as const,
  },
  {
    kind: "geometry" as const,
    id: "finisher-core",
    name: "Finisher core flash",
    startTime: finisher,
    endTime: finisher + 0.16,
    shape: "ball" as const,
    position: { x: 0, y: 1.1, z: -2.1 },
    rotation: { x: 0, y: 0, z: 0 },
    size: { x: 1.4, y: 1.4, z: 1.4 },
    color: whiteHot,
    material: "Neon" as const,
    transparency: 0,
    startScale: { x: 0.3, y: 0.3, z: 0.3 },
    endScale: { x: 2.6, y: 2.6, z: 2.6 },
    startTransparency: 0,
    endTransparency: 1,
    easing: "expoOut" as const,
  },
  {
    kind: "beam" as const,
    id: "finisher-shock",
    name: "Finisher directional shock",
    startTime: finisher,
    endTime: finisher + 0.2,
    from: { x: 0, y: 1.1, z: -1.8 },
    to: { x: 0, y: 1.1, z: -9 },
    width0: 2.6,
    width1: 0.1,
    color: [
      { time: 0, color: whiteHot },
      { time: 0.5, color: violet },
      { time: 1, color: crimson },
    ],
    transparency: [
      { time: 0, value: 0.15 },
      { time: 1, value: 1 },
    ],
    textureSpeed: 3,
    textureLength: 1,
    curve0: 0,
    curve1: 0,
    faceCamera: true,
    segments: 12,
  },
  {
    kind: "screen" as const,
    id: "finisher-lines",
    name: "Finisher impact lines",
    startTime: finisher,
    endTime: finisher + 0.18,
    layerType: "impactLines" as const,
    anchor: { x: 0.5, y: 0.5 },
    position: { x: 0.5, y: 0.5 },
    size: { x: 1, y: 1 },
    rotation: 0,
    color: whiteHot,
    transparency: 0.25,
    zIndex: 60,
    blendMode: "additive" as const,
    startScale: 1.35,
    endScale: 1,
    startTransparency: 0.25,
    endTransparency: 1,
  },
  {
    kind: "screen" as const,
    id: "finisher-letterbox",
    name: "Finisher letterbox",
    startTime: 1.16,
    endTime: finisher + 0.3,
    layerType: "letterbox" as const,
    anchor: { x: 0.5, y: 0.5 },
    position: { x: 0.5, y: 0.5 },
    size: { x: 1, y: 1 },
    rotation: 0,
    color: { r: 0, g: 0, b: 0 },
    transparency: 0.05,
    zIndex: 50,
    blendMode: "normal" as const,
    startScale: 1,
    endScale: 1,
    startTransparency: 1,
    endTransparency: 0.05,
  },
];

const draft = {
  schemaVersion: 1 as const,
  name,
  category: "attack" as const,
  duration,
  framesPerSecond: 60,
  looped: false,
  targetPath: "selection:1",
  intent:
    "Combat VFX locked to the four impacts of MD_R6_FangRushCombo_60_V1. Each strike escalates: the jab gets a flash and a light shake, the cross and roundhouse add shock rings, and the spinning finisher shifts the palette to violet and adds a core flash, a directional shock beam, impact lines and letterbox so the fourth hit reads as a different weight class.",
  style: [
    "fighting-game",
    "anime-impact",
    "escalating-hits",
    "animation-locked",
    "ember-to-violet-shift",
    "human-review-required",
  ],
  palette: [crimson, ember, whiteHot, violet],
  markers: [
    { id: "wind-up", time: 0.05, type: "anticipation" as const, label: "Coil and gather" },
    { id: "jab-hit", time: jab, type: "impact" as const, label: "Jab connects" },
    { id: "cross-hit", time: cross, type: "impact" as const, label: "Cross connects" },
    { id: "roundhouse-hit", time: roundhouse, type: "impact" as const, label: "Roundhouse connects" },
    { id: "finisher-release", time: 1.18, type: "release" as const, label: "Spin releases" },
    { id: "finisher-hit", time: finisher, type: "impact" as const, label: "Spinning back kick connects" },
    { id: "finisher-hitstop", time: finisher + 0.04, type: "hitstop" as const, label: "Finisher hitstop" },
    { id: "settle", time: 1.46, type: "recovery" as const, label: "Recover to guard" },
  ],
  nodes,
  metadata: {
    pairedAnimation: "MD_R6_FangRushCombo_60_V1",
    impactCount: 4,
  },
};

for (const node of nodes) {
  assert.ok(node.endTime > node.startTime, `${node.id} must end after it starts`);
  assert.ok(node.endTime <= duration + 1e-9, `${node.id} ends after the draft duration`);
}
assert.equal(new Set(nodes.map((node) => node.id)).size, nodes.length, "node ids must be unique");

const client = new Client({ name: "visual-director-combo-vfx", version: "0.1.0" });
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
    `\nscore=${report.score}\n` +
      `stats: ${JSON.stringify(report.stats)}\n` +
      `blocking: ${JSON.stringify(report.blockingIssues, null, 2)}\n` +
      `warnings: ${JSON.stringify(report.warnings, null, 2)}\n` +
      `notes: ${JSON.stringify(report.notes, null, 2)}\n`,
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
      throw new Error(
        `Visual Director plugin is not connected to the bridge. Status: ${JSON.stringify(status)}`,
      );
    }
    process.stdout.write(`\nstudio: ${JSON.stringify(status)}\n`);

    const staged = await call("stage_vfx_draft", { transactionName: "Fang Rush combo VFX", draft });
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
