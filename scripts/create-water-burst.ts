import assert from "node:assert/strict";
import { compileProceduralVfxModule } from "../src/procedural-modules.js";
import { vfxDraftSchema, type VfxDraft, type VfxNode } from "../src/domain.js";
import { vfx, validateDraft as relayValidate } from "./relay-client.js";

const dryRun = process.env.DRY === "1";
const name = "VD_WaterImpactBurst_V1";

// Textures captured from the reference fire burst (Workspace.vfx). Roblox
// particle textures are grayscale alpha masks multiplied by Color, so the
// same flipbook shapes read as water once retinted and re-timed: only the
// palette, gravity, light response and edge treatment need to change, not
// the sprite sheets themselves.
const textures = {
  boilA: "rbxassetid://18838818398", // New132: near-static volume flash
  boilB: "rbxassetid://17612097993", // New90: near-static volume flash
  boilC: "rbxassetid://15552205113", // New42: near-static volume flash
  ring: "rbxassetid://16877901430", // Circle10: Grid4x4 one-shot ring decal
  puffA: "rbxassetid://123447873199405", // "Fire Dispersing": Grid4x4 one-shot puff
  puffB: "rbxassetid://138454022090507", // "Glowing sharp flame": Grid4x4 one-shot puff
  streak: "rbxassetid://15418442509", // "Moving Forward Line": Grid4x4 one-shot ground streak
};

const foam = { r: 0.92, g: 0.99, b: 1 };
const surface = { r: 0.16, g: 0.62, b: 0.68 };
const deep = { r: 0.02, g: 0.16, b: 0.22 };

// 1. Base skeleton from the (now water-aware) procedural compiler: core
// flash, impact ring, directional debris, impact light, camera shake. This
// exercises the fixed element profile (gravity, light response, palette,
// Glass material) directly instead of re-deriving it by hand.
const base = compileProceduralVfxModule({
  name,
  preset: "impactBurst",
  element: "water",
  duration: 1.1,
  scale: 1.35,
  intensity: 1.05,
  complexity: 4,
  primary: deep,
  secondary: surface,
  accent: foam,
  style: ["reference-informed", "reused-flipbook-textures"],
});

const extraNodes: VfxNode[] = [
  // 2. Reference layer: three near-static, high-rotation "boil" flashes in a
  // volume. In the fire reference this reads as boiling embers; recoloured
  // cool and made translucent with real light response, it reads as a burst
  // of fine spray catching ambient light rather than glowing on its own.
  {
    id: "SprayBoilA",
    name: "SprayBoilA",
    kind: "particle",
    startTime: 0,
    endTime: 0.16,
    enabled: true,
    tags: ["water", "reference"],
    propertyCurves: [],
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    texture: textures.boilA,
    color: [
      { time: 0, color: foam },
      { time: 1, color: surface },
    ],
    transparency: [
      { time: 0, value: 0.35 },
      { time: 1, value: 1 },
    ],
    size: [
      { time: 0, value: 4.2 },
      { time: 1, value: 4.2 },
    ],
    lifetime: { min: 0.09, max: 0.09 },
    speed: { min: 0.004, max: 0.004 },
    rate: 18,
    burstCount: 0,
    spread: { x: 180, y: 180 },
    acceleration: { x: 0, y: 0, z: 0 },
    drag: 0,
    rotationRange: { min: -180, max: 180 },
    rotationSpeed: { min: 900, max: 900 },
    orientation: "velocityPerpendicular",
    squash: [
      { time: 0, value: 0, envelope: 0 },
      { time: 1, value: 0, envelope: 0 },
    ],
    timeScale: 1,
    velocityInheritance: 0,
    windAffectsDrag: false,
    flipbookLayout: "none",
    flipbookMode: "loop",
    flipbookFramerate: { min: 1, max: 1 },
    flipbookStartRandom: false,
    // Water reflects, it does not glow: near-zero emission, high influence.
    lightEmission: 0.03,
    lightInfluence: 0.85,
    lockedToPart: false,
    zOffset: 0,
    emitterShape: "box",
    shapeStyle: "volume",
    shapeInOut: "outward",
    shapePartial: 1,
    emitterSize: { x: 4.5, y: 4.5, z: 4.5 },
    emissionDirection: "top",
  },
  {
    id: "SprayBoilB",
    name: "SprayBoilB",
    kind: "particle",
    startTime: 0,
    endTime: 0.16,
    enabled: true,
    tags: ["water", "reference"],
    propertyCurves: [],
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    texture: textures.boilB,
    color: [
      { time: 0, color: foam },
      { time: 1, color: surface },
    ],
    transparency: [
      { time: 0, value: 0.3 },
      { time: 1, value: 1 },
    ],
    size: [
      { time: 0, value: 4.4 },
      { time: 1, value: 4.4 },
    ],
    lifetime: { min: 0.09, max: 0.09 },
    speed: { min: 0.004, max: 0.004 },
    rate: 25,
    burstCount: 0,
    spread: { x: 180, y: 180 },
    acceleration: { x: 0, y: 0, z: 0 },
    drag: 0,
    rotationRange: { min: -180, max: 180 },
    rotationSpeed: { min: -900, max: -900 },
    orientation: "velocityPerpendicular",
    squash: [
      { time: 0, value: 0, envelope: 0 },
      { time: 1, value: 0, envelope: 0 },
    ],
    timeScale: 1,
    velocityInheritance: 0,
    windAffectsDrag: false,
    flipbookLayout: "none",
    flipbookMode: "loop",
    flipbookFramerate: { min: 1, max: 1 },
    flipbookStartRandom: false,
    lightEmission: 0.03,
    lightInfluence: 0.85,
    lockedToPart: false,
    zOffset: 0,
    emitterShape: "box",
    shapeStyle: "volume",
    shapeInOut: "outward",
    shapePartial: 1,
    emitterSize: { x: 4.5, y: 4.5, z: 4.5 },
    emissionDirection: "top",
  },
  // 3. Reference layer: the flat Grid4x4 one-shot ring decal. This is the
  // clearest fire->water swap of the whole set: it is already a shockwave
  // ring shape, it only needs to read as a splash ripple instead of a heat
  // ring, which is a palette and brightness change, nothing structural.
  {
    id: "SplashRing",
    name: "SplashRing",
    kind: "particle",
    startTime: 0.01,
    endTime: 0.12,
    enabled: true,
    tags: ["water", "reference"],
    propertyCurves: [],
    position: { x: 0, y: -0.05, z: 0 },
    rotation: { x: 90, y: 0, z: 0 },
    texture: textures.ring,
    color: [
      { time: 0, color: foam },
      { time: 1, color: surface },
    ],
    transparency: [
      { time: 0, value: 0 },
      { time: 1, value: 0.15 },
    ],
    size: [
      { time: 0, value: 9.5 },
      { time: 1, value: 9.5 },
    ],
    lifetime: { min: 0.1, max: 0.1 },
    speed: { min: 0.007, max: 0.007 },
    rate: 9,
    burstCount: 0,
    spread: { x: 180, y: 180 },
    acceleration: { x: 0, y: 0, z: 0 },
    drag: 0,
    rotationRange: { min: -180, max: 180 },
    rotationSpeed: { min: 0, max: 0 },
    orientation: "facingCamera",
    squash: [
      { time: 0, value: 0, envelope: 0 },
      { time: 1, value: 0, envelope: 0 },
    ],
    timeScale: 1,
    velocityInheritance: 0,
    windAffectsDrag: false,
    flipbookLayout: "grid4x4",
    flipbookMode: "oneShot",
    flipbookFramerate: { min: 26, max: 26 },
    flipbookStartRandom: false,
    lightEmission: 0.05,
    lightInfluence: 0.7,
    lockedToPart: false,
    // Pushed slightly toward camera to avoid z-fighting with the water
    // surface, mirroring the reference decal's own zOffset use.
    zOffset: 1.2,
    emitterShape: "box",
    shapeStyle: "volume",
    shapeInOut: "outward",
    shapePartial: 1,
    emitterSize: { x: 0.1, y: 0.1, z: 0.1 },
    emissionDirection: "top",
  },
  // 4. Reference layer: the two Grid4x4 one-shot dispersal puffs, recoloured
  // and given a light downward pull so the mist visibly loses momentum and
  // sinks rather than dispersing upward the way fire smoke would.
  {
    id: "MistPuffA",
    name: "MistPuffA",
    kind: "particle",
    startTime: 0.02,
    endTime: 0.55,
    enabled: true,
    tags: ["water", "reference"],
    propertyCurves: [
      { target: "particle", property: "Drag", interpolation: "smooth", keys: [{ time: 0, value: 0.6 }, { time: 1, value: 3.5 }] },
    ],
    position: { x: 0, y: 0.4, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    texture: textures.puffA,
    color: [
      { time: 0, color: foam },
      { time: 1, color: surface },
    ],
    transparency: [
      { time: 0, value: 0.25 },
      { time: 1, value: 1 },
    ],
    size: [
      { time: 0, value: 2.6 },
      { time: 1, value: 4.1 },
    ],
    lifetime: { min: 0.4, max: 0.55 },
    speed: { min: 2.5, max: 5 },
    rate: 0,
    burstCount: 17,
    spread: { x: 60, y: 60 },
    acceleration: { x: 0, y: -14, z: 0 },
    drag: 0.6,
    rotationRange: { min: -180, max: 180 },
    rotationSpeed: { min: -40, max: 40 },
    orientation: "facingCamera",
    squash: [
      { time: 0, value: 0, envelope: 0 },
      { time: 1, value: 0, envelope: 0 },
    ],
    timeScale: 1,
    velocityInheritance: 0,
    windAffectsDrag: false,
    flipbookLayout: "grid4x4",
    flipbookMode: "oneShot",
    flipbookFramerate: { min: 16, max: 16 },
    flipbookStartRandom: true,
    lightEmission: 0.04,
    lightInfluence: 0.8,
    lockedToPart: false,
    zOffset: 0,
    emitterShape: "sphere",
    shapeStyle: "surface",
    shapeInOut: "outward",
    shapePartial: 1,
    emitterSize: { x: 1, y: 1, z: 1 },
    emissionDirection: "top",
  },
  {
    id: "MistPuffB",
    name: "MistPuffB",
    kind: "particle",
    startTime: 0.05,
    endTime: 0.65,
    enabled: true,
    tags: ["water", "reference"],
    propertyCurves: [
      { target: "particle", property: "Drag", interpolation: "smooth", keys: [{ time: 0, value: 0.6 }, { time: 1, value: 3.5 }] },
    ],
    position: { x: 0, y: 0.4, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    texture: textures.puffB,
    color: [
      { time: 0, color: surface },
      { time: 1, color: deep },
    ],
    transparency: [
      { time: 0, value: 0.4 },
      { time: 1, value: 1 },
    ],
    size: [
      { time: 0, value: 3.1 },
      { time: 1, value: 4.6 },
    ],
    lifetime: { min: 0.45, max: 0.6 },
    speed: { min: 2, max: 4 },
    rate: 0,
    burstCount: 14,
    spread: { x: 70, y: 70 },
    acceleration: { x: 0, y: -14, z: 0 },
    drag: 0.6,
    rotationRange: { min: -180, max: 180 },
    rotationSpeed: { min: -30, max: 30 },
    orientation: "facingCamera",
    squash: [
      { time: 0, value: 0, envelope: 0 },
      { time: 1, value: 0, envelope: 0 },
    ],
    timeScale: 1,
    velocityInheritance: 0,
    windAffectsDrag: false,
    flipbookLayout: "grid4x4",
    flipbookMode: "oneShot",
    flipbookFramerate: { min: 14, max: 14 },
    flipbookStartRandom: true,
    lightEmission: 0.02,
    lightInfluence: 0.85,
    lockedToPart: false,
    zOffset: 0,
    emitterShape: "sphere",
    shapeStyle: "surface",
    shapeInOut: "outward",
    shapePartial: 1,
    emitterSize: { x: 1, y: 1, z: 1 },
    emissionDirection: "top",
  },
  // 5. Reference layer: the two "Moving Forward Line" ground streaks. In the
  // reference these are thin, flat-volume, VelocityPerpendicular flipbook
  // streaks radiating from the base -- already the exact shape of a splash
  // radiating across a surface. Reused as-is structurally, recoloured foam
  // fading to clear water and biased outward from centre.
  {
    id: "SurfaceStreakA",
    name: "SurfaceStreakA",
    kind: "particle",
    startTime: 0,
    endTime: 0.32,
    enabled: true,
    tags: ["water", "reference"],
    propertyCurves: [],
    position: { x: 0, y: -0.1, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    texture: textures.streak,
    color: [
      { time: 0, color: foam },
      { time: 1, color: surface },
    ],
    transparency: [
      { time: 0, value: 0.1 },
      { time: 1, value: 0.6 },
    ],
    size: [
      { time: 0, value: 3.2 },
      { time: 1, value: 3.2 },
    ],
    lifetime: { min: 0.15, max: 0.15 },
    speed: { min: 4, max: 7 },
    rate: 27,
    burstCount: 0,
    spread: { x: 25, y: 25 },
    acceleration: { x: 0, y: 0, z: 0 },
    drag: 1.2,
    rotationRange: { min: -180, max: 180 },
    rotationSpeed: { min: 0, max: 0 },
    orientation: "velocityPerpendicular",
    squash: [
      { time: 0, value: 0, envelope: 0 },
      { time: 1, value: 0.3, envelope: 0 },
    ],
    timeScale: 1,
    velocityInheritance: 0,
    windAffectsDrag: false,
    flipbookLayout: "grid4x4",
    flipbookMode: "oneShot",
    flipbookFramerate: { min: 22, max: 22 },
    flipbookStartRandom: false,
    lightEmission: 0.05,
    lightInfluence: 0.75,
    lockedToPart: false,
    zOffset: 0,
    emitterShape: "disc",
    shapeStyle: "surface",
    shapeInOut: "outward",
    shapePartial: 1,
    emitterSize: { x: 6.5, y: 0.1, z: 6.5 },
    emissionDirection: "top",
  },
  {
    id: "SurfaceStreakB",
    name: "SurfaceStreakB",
    kind: "particle",
    startTime: 0.03,
    endTime: 0.38,
    enabled: true,
    tags: ["water", "reference"],
    propertyCurves: [],
    position: { x: 0, y: -0.1, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    texture: textures.streak,
    color: [
      { time: 0, color: surface },
      { time: 1, color: deep },
    ],
    transparency: [
      { time: 0, value: 0.2 },
      { time: 1, value: 0.7 },
    ],
    size: [
      { time: 0, value: 2.6 },
      { time: 1, value: 2.6 },
    ],
    lifetime: { min: 0.15, max: 0.15 },
    speed: { min: 3, max: 5.5 },
    rate: 27,
    burstCount: 0,
    spread: { x: 25, y: 25 },
    acceleration: { x: 0, y: 0, z: 0 },
    drag: 1.2,
    rotationRange: { min: -180, max: 180 },
    rotationSpeed: { min: 0, max: 0 },
    orientation: "velocityPerpendicular",
    squash: [
      { time: 0, value: 0, envelope: 0 },
      { time: 1, value: 0.3, envelope: 0 },
    ],
    timeScale: 1,
    velocityInheritance: 0,
    windAffectsDrag: false,
    flipbookLayout: "grid4x4",
    flipbookMode: "oneShot",
    flipbookFramerate: { min: 20, max: 20 },
    flipbookStartRandom: false,
    lightEmission: 0.05,
    lightInfluence: 0.75,
    lockedToPart: false,
    zOffset: 0,
    emitterShape: "disc",
    shapeStyle: "surface",
    shapeInOut: "outward",
    shapePartial: 1,
    emitterSize: { x: 6.5, y: 0.1, z: 6.5 },
    emissionDirection: "top",
  },
  // 6. Original addition, no fire analogue: ballistic droplets with real
  // gravity that peak, arc and land *after* every other layer has finished.
  // This delayed weight is what a burst without it reads as mist instead of
  // liquid -- it is the one layer the fire reference has no reason to need.
  {
    id: "BallisticDroplets",
    name: "BallisticDroplets",
    kind: "particle",
    startTime: 0,
    endTime: 1.1,
    enabled: true,
    tags: ["water", "original"],
    propertyCurves: [
      { target: "particle", property: "Drag", interpolation: "smooth", keys: [{ time: 0, value: 0.1 }, { time: 1, value: 0.4 }] },
    ],
    position: { x: 0, y: 0.3, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    texture: textures.boilC,
    color: [
      { time: 0, color: foam },
      { time: 1, color: surface },
    ],
    transparency: [
      { time: 0, value: 0.15 },
      { time: 1, value: 0.55 },
    ],
    size: [
      { time: 0, value: 0.55 },
      { time: 1, value: 0.3 },
    ],
    lifetime: { min: 0.45, max: 0.85 },
    speed: { min: 6, max: 15 },
    rate: 0,
    burstCount: 26,
    spread: { x: 55, y: 55 },
    // The real weight cue: a genuine downward pull, tuned so the longest-
    // lived droplets fall a few studs across their arc instead of drifting.
    acceleration: { x: 0, y: -42, z: 0 },
    drag: 0.15,
    rotationRange: { min: -180, max: 180 },
    rotationSpeed: { min: -180, max: 180 },
    orientation: "velocityParallel",
    squash: [
      { time: 0, value: 0, envelope: 0 },
      { time: 1, value: 0.65, envelope: 0 },
    ],
    timeScale: 1,
    velocityInheritance: 0,
    windAffectsDrag: false,
    flipbookLayout: "none",
    flipbookMode: "loop",
    flipbookFramerate: { min: 1, max: 1 },
    flipbookStartRandom: false,
    lightEmission: 0.02,
    lightInfluence: 0.9,
    lockedToPart: false,
    zOffset: 0,
    emitterShape: "sphere",
    shapeStyle: "surface",
    shapeInOut: "outward",
    shapePartial: 1,
    emitterSize: { x: 1.4, y: 1.4, z: 1.4 },
    emissionDirection: "top",
  },
];

const draft: VfxDraft = vfxDraftSchema.parse({
  ...base,
  intent:
    base.intent +
    " Layered with reference-derived nodes reusing the fire burst's own flipbook textures (boil flashes, ring decal, dispersal puffs, ground streaks), reworked for water: near-zero light emission, high light influence, downward acceleration, foam-to-deep colour direction, and an added ballistic droplet layer with real gravity for delayed weight that a burst without it would read as mist rather than liquid.",
  style: [...base.style, "impact-burst-reference"],
  nodes: [...base.nodes, ...extraNodes],
});

assert.equal(new Set(draft.nodes.map((n) => n.id)).size, draft.nodes.length, "node ids must be unique");
for (const node of draft.nodes) {
  assert.ok(node.endTime <= draft.duration + 1e-9, `${node.id} ends after the draft duration`);
}

const localReport = (await import("../src/quality.js")).reviewVfxDraft(draft);
process.stdout.write(
  `\nlocal score=${localReport.score}\nstats: ${JSON.stringify(localReport.stats)}\n` +
    `blocking: ${JSON.stringify(localReport.blockingIssues, null, 2)}\n` +
    `warnings: ${JSON.stringify(localReport.warnings, null, 2)}\n` +
    `notes: ${JSON.stringify(localReport.notes, null, 2)}\n`,
);

const relayReport = await relayValidate(draft);
process.stdout.write(`\nrelay validate: ${JSON.stringify(relayReport, null, 2)}\n`);

if (dryRun) {
  process.stdout.write("\nDRY run: nothing was sent to Studio.\n");
} else {
  const status = await vfx("capabilities");
  process.stdout.write(`\nstudio plugin: ${status.pluginVersion}\n`);

  const staged = await vfx("stage", { transactionName: "Water impact burst", draft }, true);
  process.stdout.write(`staged: ${JSON.stringify(staged)}\n`);

  const committed = await vfx("commit", { transactionId: staged.transactionId, destinationName: name }, true);
  process.stdout.write(`committed: ${JSON.stringify(committed)}\n`);
}
