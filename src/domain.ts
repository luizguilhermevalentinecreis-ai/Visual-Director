import { z } from "zod";

export const vector2Schema = z.object({ x: z.number().finite(), y: z.number().finite() });
export const vector3Schema = z.object({ x: z.number().finite(), y: z.number().finite(), z: z.number().finite() });
export const colorSchema = z.object({
  r: z.number().min(0).max(1),
  g: z.number().min(0).max(1),
  b: z.number().min(0).max(1),
});
export const numberRangeSchema = z.object({ min: z.number().finite(), max: z.number().finite() }).refine(v => v.max >= v.min, "max must be >= min");
export const colorStopSchema = z.object({ time: z.number().min(0).max(1), color: colorSchema });
export const numberStopSchema = z.object({ time: z.number().min(0).max(1), value: z.number().finite() });
export const propertyCurveSchema = z.object({
  target: z.enum(["particle", "beam", "trail", "light", "part", "gui"]),
  property: z.string().min(1).max(100),
  interpolation: z.enum(["linear", "step", "smooth"]).default("smooth"),
  keys: z.array(numberStopSchema).min(2).max(64),
});

const baseNodeSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(120),
  startTime: z.number().nonnegative(),
  endTime: z.number().positive(),
  enabled: z.boolean().default(true),
  parentId: z.string().min(1).max(100).optional(),
  tags: z.array(z.string().max(60)).max(20).default([]),
  propertyCurves: z.array(propertyCurveSchema).max(64).default([]),
}).refine(v => v.endTime > v.startTime, "endTime must be greater than startTime");

export const particleNodeSchema = baseNodeSchema.extend({
  kind: z.literal("particle"),
  position: vector3Schema.default({ x: 0, y: 0, z: 0 }),
  rotation: vector3Schema.default({ x: 0, y: 0, z: 0 }),
  texture: z.string().max(300).default(""),
  color: z.array(colorStopSchema).min(1).max(12),
  transparency: z.array(numberStopSchema).min(1).max(12),
  size: z.array(numberStopSchema).min(1).max(12),
  lifetime: numberRangeSchema,
  speed: numberRangeSchema,
  rate: z.number().min(0).max(5000).default(0),
  burstCount: z.number().int().min(0).max(5000).default(0),
  spread: vector2Schema.default({ x: 0, y: 0 }),
  acceleration: vector3Schema.default({ x: 0, y: 0, z: 0 }),
  drag: z.number().min(0).max(100).default(0),
  rotationRange: numberRangeSchema.default({ min: 0, max: 0 }),
  rotationSpeed: numberRangeSchema.default({ min: 0, max: 0 }),
  orientation: z.enum(["facingCamera", "facingCameraWorldUp", "velocityParallel", "velocityPerpendicular"]).default("facingCamera"),
  squash: z.array(numberStopSchema.extend({ envelope: z.number().nonnegative().default(0) })).min(1).max(32).default([{ time: 0, value: 0, envelope: 0 }, { time: 1, value: 0, envelope: 0 }]),
  timeScale: z.number().min(0).max(1).default(1),
  velocityInheritance: z.number().min(0).max(1).default(0),
  windAffectsDrag: z.boolean().default(false),
  flipbookLayout: z.enum(["none", "grid2x2", "grid4x4", "grid8x8"]).default("none"),
  flipbookMode: z.enum(["loop", "oneShot", "pingPong", "random"]).default("loop"),
  flipbookFramerate: numberRangeSchema.default({ min: 1, max: 1 }),
  flipbookStartRandom: z.boolean().default(false),
  lightEmission: z.number().min(0).max(1).default(0),
  lightInfluence: z.number().min(0).max(1).default(1),
  lockedToPart: z.boolean().default(false),
  zOffset: z.number().min(-10).max(10).default(0),
  // Emission volume. A sphere surface emitting inward is the only way to get a
  // genuine convergence toward the centre: with a point emitter the particles
  // always radiate outward, and a negative speed just mirrors an already
  // uniform spread, which changes nothing.
  emitterShape: z.enum(["point", "box", "sphere", "cylinder", "disc"]).default("point"),
  shapeStyle: z.enum(["volume", "surface"]).default("volume"),
  shapeInOut: z.enum(["outward", "inward", "inAndOut"]).default("outward"),
  shapePartial: z.number().min(0).max(1).default(0),
  emitterSize: vector3Schema.default({ x: 0.1, y: 0.1, z: 0.1 }),
  emissionDirection: z.enum(["top", "bottom", "front", "back", "left", "right"]).default("top"),
});

export const beamNodeSchema = baseNodeSchema.extend({
  kind: z.literal("beam"),
  from: vector3Schema,
  to: vector3Schema,
  width0: z.number().min(0).max(100),
  width1: z.number().min(0).max(100),
  color: z.array(colorStopSchema).min(1).max(12),
  transparency: z.array(numberStopSchema).min(1).max(12),
  texture: z.string().max(300).default(""),
  textureSpeed: z.number().min(-100).max(100).default(0),
  textureLength: z.number().min(0.01).max(1000).default(1),
  curve0: z.number().min(-1000).max(1000).default(0),
  curve1: z.number().min(-1000).max(1000).default(0),
  faceCamera: z.boolean().default(true),
  segments: z.number().int().min(1).max(100).default(10),
  lightEmission: z.number().min(0).max(1).default(0),
  lightInfluence: z.number().min(0).max(1).default(1),
  textureMode: z.enum(["stretch", "wrap", "static"]).default("stretch"),
  brightness: z.number().min(0).max(10_000).default(1),
});

export const trailNodeSchema = baseNodeSchema.extend({
  kind: z.literal("trail"),
  attachment0: vector3Schema,
  attachment1: vector3Schema,
  lifetime: z.number().min(0.01).max(30),
  minLength: z.number().min(0).max(100),
  color: z.array(colorStopSchema).min(1).max(12),
  transparency: z.array(numberStopSchema).min(1).max(12),
  widthScale: z.array(numberStopSchema).min(1).max(12),
  texture: z.string().max(300).default(""),
  textureLength: z.number().min(0.01).max(1000).default(1),
  faceCamera: z.boolean().default(true),
  lightEmission: z.number().min(0).max(1).default(0),
  lightInfluence: z.number().min(0).max(1).default(1),
  brightness: z.number().min(0).max(10_000).default(1),
});

export const geometryNodeSchema = baseNodeSchema.extend({
  kind: z.literal("geometry"),
  shape: z.enum(["block", "ball", "cylinder", "wedge", "ring"]),
  position: vector3Schema,
  rotation: vector3Schema.default({ x: 0, y: 0, z: 0 }),
  size: vector3Schema,
  color: colorSchema,
  material: z.enum(["Neon", "ForceField", "Glass", "SmoothPlastic"]).default("Neon"),
  transparency: z.number().min(0).max(1).default(0),
  startScale: vector3Schema.default({ x: 1, y: 1, z: 1 }),
  endScale: vector3Schema.default({ x: 1, y: 1, z: 1 }),
  startTransparency: z.number().min(0).max(1).default(0),
  endTransparency: z.number().min(0).max(1).default(1),
  easing: z.enum(["linear", "quadIn", "quadOut", "quadInOut", "backOut", "expoOut"]).default("quadOut"),
});

export const lightNodeSchema = baseNodeSchema.extend({
  kind: z.literal("light"),
  lightType: z.enum(["point", "spot", "surface"]),
  position: vector3Schema.default({ x: 0, y: 0, z: 0 }),
  color: colorSchema,
  brightness: z.number().min(0).max(100),
  range: z.number().min(0).max(500),
  angle: z.number().min(0).max(180).default(90),
  shadows: z.boolean().default(false),
});

export const screenNodeSchema = baseNodeSchema.extend({
  kind: z.literal("screen"),
  layerType: z.enum(["frame", "image", "text", "impactLines", "letterbox"]),
  anchor: vector2Schema.default({ x: 0.5, y: 0.5 }),
  position: vector2Schema.default({ x: 0.5, y: 0.5 }),
  size: vector2Schema.default({ x: 1, y: 1 }),
  rotation: z.number().min(-360).max(360).default(0),
  color: colorSchema,
  transparency: z.number().min(0).max(1).default(0),
  image: z.string().max(300).default(""),
  text: z.string().max(500).default(""),
  font: z.string().max(100).default("GothamBold"),
  zIndex: z.number().int().min(0).max(10000).default(1),
  blendMode: z.enum(["normal", "additive"]).default("normal"),
  startScale: z.number().min(0).max(20).default(1),
  endScale: z.number().min(0).max(20).default(1),
  startTransparency: z.number().min(0).max(1).default(0),
  endTransparency: z.number().min(0).max(1).default(1),
});

export const cameraNodeSchema = baseNodeSchema.extend({
  kind: z.literal("camera"),
  shakeAmplitude: vector3Schema.default({ x: 0, y: 0, z: 0 }),
  shakeFrequency: z.number().min(0).max(120).default(18),
  fovDelta: z.number().min(-100).max(100).default(0),
  chromaticAberration: z.number().min(0).max(1).default(0),
  blur: z.number().min(0).max(56).default(0),
  colorTint: colorSchema.default({ r: 1, g: 1, b: 1 }),
  contrast: z.number().min(-1).max(1).default(0),
  saturation: z.number().min(-1).max(1).default(0),
});

export const soundNodeSchema = baseNodeSchema.extend({
  kind: z.literal("sound"),
  soundId: z.string().max(300),
  volume: z.number().min(0).max(10).default(1),
  playbackSpeed: z.number().min(0.05).max(4).default(1),
  rollOffMaxDistance: z.number().min(0).max(10000).default(100),
});

export const vfxNodeSchema = z.discriminatedUnion("kind", [
  particleNodeSchema, beamNodeSchema, trailNodeSchema, geometryNodeSchema,
  lightNodeSchema, screenNodeSchema, cameraNodeSchema, soundNodeSchema,
]);

export const markerSchema = z.object({
  id: z.string().min(1).max(100),
  time: z.number().nonnegative(),
  type: z.enum(["anticipation", "release", "impact", "hitstop", "recovery", "custom"]),
  label: z.string().min(1).max(120),
});

export const vfxDraftSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  name: z.string().min(1).max(120),
  category: z.enum(["attack", "impactFrame", "hud", "environment", "characterAura", "cinematic", "custom"]),
  duration: z.number().positive().max(120),
  framesPerSecond: z.number().int().min(12).max(120).default(60),
  looped: z.boolean().default(false),
  targetPath: z.string().max(500).default("selection:1"),
  intent: z.string().min(1).max(2000),
  style: z.array(z.string().max(80)).max(30).default([]),
  palette: z.array(colorSchema).min(1).max(16),
  markers: z.array(markerSchema).max(100).default([]),
  nodes: z.array(vfxNodeSchema).min(1).max(500),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
});

export type VfxDraft = z.infer<typeof vfxDraftSchema>;
export type VfxNode = z.infer<typeof vfxNodeSchema>;

export function parseVfxDraft(value: unknown): VfxDraft {
  return vfxDraftSchema.parse(value);
}
