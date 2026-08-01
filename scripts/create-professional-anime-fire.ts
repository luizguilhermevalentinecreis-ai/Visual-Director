import type { VfxDraft } from "../src/domain.js";

const relayUrl = (process.env.VISUAL_RELAY_URL ?? "https://visual-director-relay.onrender.com").replace(/\/$/, "");
const pairingCode = process.env.VISUAL_PAIRING_CODE ?? "D987C-0F415";
const packageName = "VD_AnimeFire_Aura_v1";

const fireTexture = "rbxasset://textures/particles/fire_main.dds";
const sparksTexture = "rbxasset://textures/particles/fire_sparks_main.dds";
// The compact triple is intentionally valid as both a Color3-like and Vector3-like
// JSON value. Zod strips the unused keys for each destination schema.
const c = (r: number, g: number, b: number) => ({ r, g, b, x: r, y: g, z: b });
const cs = (...stops: Array<[number, ReturnType<typeof c>]>) => stops.map(([time, color]) => ({ time, color }));
const ns = (...stops: Array<[number, number]>) => stops.map(([time, value]) => ({ time, value }));

const draft: VfxDraft = {
  schemaVersion: 1,
  name: packageName,
  category: "characterAura",
  duration: 1.2,
  framesPerSecond: 60,
  looped: true,
  targetPath: "selection:1",
  intent: "Professional stylized anime fire aura centered on the selected Part, with a readable white-hot core, asymmetric flame silhouette, upward flow, secondary ribbons, sparse embers and restrained warm lighting.",
  style: ["anime", "stylized fire", "layered silhouette", "white-hot core", "asymmetric", "game-ready", "performance-conscious"],
  palette: [c(1, 0.98, 0.72), c(1, 0.68, 0.04), c(1, 0.24, 0.01), c(0.58, 0.02, 0.005)],
  markers: [
    { id: "fire_pulse_a", time: 0.28, type: "custom", label: "Primary flame pulse" },
    { id: "fire_pulse_b", time: 0.84, type: "custom", label: "Secondary flame pulse" },
  ],
  nodes: [
    {
      id: "core_flame", name: "White Hot Core", kind: "particle", startTime: 0, endTime: 1.2, enabled: true, tags: ["core", "flame"],
      position: c(0, 0.08, 0), rotation: c(-90, 0, 0), texture: fireTexture,
      color: cs([0, c(1, 1, 0.88)], [0.38, c(1, 0.82, 0.18)], [1, c(1, 0.28, 0.01)]),
      transparency: ns([0, 0.32], [0.12, 0.04], [0.7, 0.18], [1, 1]),
      size: ns([0, 0.14], [0.28, 0.48], [0.72, 0.68], [1, 0.08]),
      lifetime: { min: 0.28, max: 0.44 }, speed: { min: 1.2, max: 2.2 }, rate: 22, burstCount: 5,
      spread: { x: 13, y: 9 }, acceleration: c(0, 4.2, 0), drag: 0.9,
      rotationSpeed: { min: -75, max: 75 }, lightEmission: 1, lightInfluence: 0, lockedToPart: false, zOffset: 0.2,
    },
    {
      id: "outer_flame", name: "Orange Outer Flame", kind: "particle", startTime: 0, endTime: 1.2, enabled: true, tags: ["outer", "flame"],
      position: c(0, 0.02, 0), rotation: c(-90, 0, 0), texture: fireTexture,
      color: cs([0, c(1, 0.76, 0.08)], [0.48, c(1, 0.25, 0.01)], [1, c(0.58, 0.02, 0.005)]),
      transparency: ns([0, 0.5], [0.16, 0.12], [0.65, 0.28], [1, 1]),
      size: ns([0, 0.26], [0.32, 0.82], [0.7, 1.08], [1, 0.05]),
      lifetime: { min: 0.4, max: 0.68 }, speed: { min: 0.75, max: 1.75 }, rate: 15, burstCount: 4,
      spread: { x: 24, y: 18 }, acceleration: c(0, 4.8, 0), drag: 1.15,
      rotationSpeed: { min: -55, max: 55 }, lightEmission: 0.92, lightInfluence: 0, lockedToPart: false, zOffset: 0.05,
    },
    {
      id: "embers", name: "Rising Embers", kind: "particle", startTime: 0, endTime: 1.2, enabled: true, tags: ["secondary", "embers"],
      position: c(0, 0.22, 0), rotation: c(-90, 0, 0), texture: sparksTexture,
      color: cs([0, c(1, 0.96, 0.45)], [0.42, c(1, 0.45, 0.02)], [1, c(0.62, 0.04, 0.005)]),
      transparency: ns([0, 0.05], [0.65, 0.14], [1, 1]), size: ns([0, 0.09], [0.6, 0.055], [1, 0.01]),
      lifetime: { min: 0.7, max: 1.15 }, speed: { min: 2.2, max: 4.8 }, rate: 8, burstCount: 8,
      spread: { x: 38, y: 28 }, acceleration: c(0, 3.2, 0), drag: 0.22,
      rotationSpeed: { min: -120, max: 120 }, lightEmission: 1, lightInfluence: 0, lockedToPart: false, zOffset: 0.35,
    },
    {
      id: "heat_motes", name: "Heat Motes", kind: "particle", startTime: 0, endTime: 1.2, enabled: true, tags: ["accent"],
      position: c(0, 0.18, 0), rotation: c(-90, 0, 0), texture: sparksTexture,
      color: cs([0, c(1, 1, 0.82)], [1, c(1, 0.58, 0.04)]), transparency: ns([0, 0.15], [0.7, 0.32], [1, 1]),
      size: ns([0, 0.045], [0.5, 0.07], [1, 0]), lifetime: { min: 0.38, max: 0.62 }, speed: { min: 0.4, max: 1.1 },
      rate: 4, burstCount: 3, spread: { x: 50, y: 35 }, acceleration: c(0, 2.1, 0), drag: 0.4,
      rotationSpeed: { min: 0, max: 0 }, lightEmission: 1, lightInfluence: 0, lockedToPart: false, zOffset: 0.4,
    },
    {
      id: "ribbon_left", name: "Left Flame Ribbon", kind: "beam", startTime: 0, endTime: 1.2, enabled: true, tags: ["silhouette", "ribbon"],
      from: c(-0.34, -0.08, -0.12), to: c(0.08, 1.22, 0.06), width0: 0.22, width1: 0.025,
      color: cs([0, c(1, 0.92, 0.35)], [0.55, c(1, 0.34, 0.01)], [1, c(0.7, 0.03, 0.005)]),
      transparency: ns([0, 0.08], [0.72, 0.16], [1, 1]), texture: fireTexture, textureSpeed: 1.8, textureLength: 0.72,
      curve0: 0.58, curve1: -0.22, faceCamera: true, segments: 18,
    },
    {
      id: "ribbon_right", name: "Right Flame Ribbon", kind: "beam", startTime: 0, endTime: 1.2, enabled: true, tags: ["silhouette", "ribbon"],
      from: c(0.32, -0.02, 0.13), to: c(-0.16, 0.98, -0.04), width0: 0.18, width1: 0.018,
      color: cs([0, c(1, 0.78, 0.12)], [0.62, c(1, 0.2, 0.01)], [1, c(0.5, 0.01, 0.002)]),
      transparency: ns([0, 0.12], [0.7, 0.2], [1, 1]), texture: fireTexture, textureSpeed: 1.35, textureLength: 0.64,
      curve0: -0.46, curve1: 0.2, faceCamera: true, segments: 16,
    },
    {
      id: "ribbon_back", name: "Back Flame Tongue", kind: "beam", startTime: 0, endTime: 1.2, enabled: true, tags: ["depth", "ribbon"],
      from: c(0.03, -0.12, 0.3), to: c(0.27, 0.76, -0.1), width0: 0.13, width1: 0.012,
      color: cs([0, c(1, 0.6, 0.04)], [1, c(0.65, 0.02, 0.004)]), transparency: ns([0, 0.22], [0.72, 0.28], [1, 1]),
      texture: fireTexture, textureSpeed: 1.55, textureLength: 0.55, curve0: 0.32, curve1: -0.12, faceCamera: true, segments: 14,
    },
    {
      id: "core_glow", name: "Core Glow", kind: "geometry", startTime: 0, endTime: 1.2, enabled: true, tags: ["core", "glow"],
      shape: "ball", position: c(0, 0.08, 0), rotation: c(0, 0, 0), size: c(0.58, 0.42, 0.58), color: c(1, 0.77, 0.12),
      material: "Neon", transparency: 0.2, startScale: c(0.88, 0.88, 0.88), endScale: c(1.12, 1.12, 1.12), startTransparency: 0.2, endTransparency: 0.38, easing: "quadInOut",
    },
    {
      id: "tongue_a", name: "Flame Silhouette A", kind: "geometry", startTime: 0, endTime: 1.2, enabled: true, tags: ["silhouette"],
      shape: "wedge", position: c(-0.22, 0.5, -0.08), rotation: c(-8, 24, -14), size: c(0.3, 0.76, 0.26), color: c(1, 0.3, 0.01),
      material: "Neon", transparency: 0.34, startScale: c(0.8, 0.86, 0.8), endScale: c(1.05, 1.12, 1.05), startTransparency: 0.34, endTransparency: 0.55, easing: "quadInOut",
    },
    {
      id: "tongue_b", name: "Flame Silhouette B", kind: "geometry", startTime: 0, endTime: 1.2, enabled: true, tags: ["silhouette"],
      shape: "wedge", position: c(0.25, 0.38, 0.1), rotation: c(12, -28, 18), size: c(0.24, 0.58, 0.22), color: c(1, 0.62, 0.03),
      material: "Neon", transparency: 0.38, startScale: c(0.86, 0.82, 0.86), endScale: c(1.08, 1.14, 1.08), startTransparency: 0.38, endTransparency: 0.58, easing: "quadInOut",
    },
    {
      id: "fire_light", name: "Warm Fire Light", kind: "light", startTime: 0, endTime: 1.2, enabled: true, tags: ["lighting"],
      lightType: "point", position: c(0, 0.14, 0), color: c(1, 0.48, 0.08), brightness: 2.4, range: 9, angle: 90, shadows: false,
    },
  ],
  metadata: {
    authoringMethod: "layered anime fire study",
    particleRateTotal: 49,
    referencePrinciple: "buildup peak release layering",
    targetReview: "human viewport review required",
  },
};

async function post(path: string, body: unknown) {
  const response = await fetch(`${relayUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!response.ok) throw new Error(`${path} failed (${response.status}): ${JSON.stringify(json)}`);
  return json;
}

async function waitForJob(jobId: string) {
  const deadline = Date.now() + 125_000;
  while (Date.now() < deadline) {
    const job = await post("/v1/actions/job", { pairingCode, jobId });
    if (job.status === "succeeded") return job.result;
    if (job.status === "failed") throw new Error(`${job.action} failed in Studio: ${job.error}`);
    await new Promise(resolve => setTimeout(resolve, 700));
  }
  throw new Error(`Timed out waiting for job ${jobId}`);
}

async function action(path: string, input: Record<string, unknown> = {}, confirmWrite = false) {
  const queued = await post(path, { pairingCode, ...input, ...(confirmWrite ? { confirmWrite: true } : {}) });
  if (typeof queued.jobId !== "string") throw new Error(`${path} did not return a jobId: ${JSON.stringify(queued)}`);
  return waitForJob(queued.jobId);
}

async function main() {
  const capabilities = await action("/v1/vfx/capabilities");
  const selection = await action("/v1/vfx/selection");
  if (!selection || selection.count < 1) throw new Error("Select one Part in Roblox Studio before running this script.");
  const target = selection.items?.[0];
  if (!target || !["Part", "MeshPart", "UnionOperation", "WedgePart", "CornerWedgePart", "TrussPart"].includes(target.className)) {
    throw new Error(`The first selected object must be a BasePart; received ${target?.className ?? "unknown"} at ${target?.path ?? "unknown"}.`);
  }

  const validation = await post("/v1/vfx/validate", { draft });
  if (validation.report?.blockingIssues?.length) throw new Error(`Draft validation blocked: ${JSON.stringify(validation.report.blockingIssues)}`);

  const staged = await action("/v1/vfx/stage", { transactionName: `Create ${packageName}`, draft }, true);
  const committed = await action("/v1/vfx/commit", { transactionId: staged.transactionId, destinationName: packageName }, true);
  const attached = await action("/v1/vfx/attach", { packageName }, true);
  const previewed = await action("/v1/vfx/preview", { packageName, normalizedTime: 0.5 }, true);

  console.log(JSON.stringify({
    ok: true,
    relayUrl,
    pluginVersion: capabilities.pluginVersion,
    target,
    validation: validation.report,
    committed,
    attached,
    previewed,
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
