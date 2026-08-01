import { z } from "zod";
import { colorSchema, numberRangeSchema, vfxDraftSchema, type VfxDraft } from "./domain.js";

const elementSchema = z.enum(["fire", "water", "electric", "shadow", "energy", "custom"]);

export const proceduralVfxModuleSchema = z.object({
  name: z.string().min(1).max(120),
  preset: z.enum(["impactBurst", "shockwave", "auraOrbit", "slashArc", "elementalTrail"]),
  element: elementSchema.default("energy"),
  duration: z.number().positive().min(0.08).max(20).default(0.8),
  targetPath: z.string().max(500).default("selection:1"),
  intensity: z.number().min(0.1).max(3).default(1),
  scale: z.number().min(0.1).max(20).default(1),
  complexity: z.number().int().min(1).max(5).default(3),
  seed: z.number().int().min(0).max(2_147_483_647).default(1),
  primary: colorSchema.optional(),
  secondary: colorSchema.optional(),
  accent: colorSchema.optional(),
  texture: z.string().max(300).default(""),
  flipbookLayout: z.enum(["none", "grid2x2", "grid4x4", "grid8x8"]).default("none"),
  flipbookMode: z.enum(["loop", "oneShot", "pingPong", "random"]).default("oneShot"),
  flipbookFramerate: numberRangeSchema.refine((range) => range.min > 0, "flipbook framerate must be positive").default({ min: 18, max: 24 }),
  flipbookStartRandom: z.boolean().default(false),
  style: z.array(z.string().max(80)).max(20).default([]),
});

type Color = z.infer<typeof colorSchema>;
type Element = z.infer<typeof elementSchema>;
type ElementProfile = {
  palette: [Color, Color, Color]; accelerationY: number; drag: number; dragEnd: number;
  lightEmission: number; lightInfluence: number; wind: boolean; foamAtEnd: boolean; peakTransparency: number;
};
const elementProfiles: Record<Element, ElementProfile> = {
  fire: { palette: [{ r: 1, g: 0.18, b: 0.015 }, { r: 1, g: 0.72, b: 0.08 }, { r: 1, g: 0.96, b: 0.65 }], accelerationY: 1.5, drag: 0.5, dragEnd: 1.5, lightEmission: 0.85, lightInfluence: 0.1, wind: true, foamAtEnd: false, peakTransparency: 0 },
  water: { palette: [{ r: 0.035, g: 0.23, b: 0.28 }, { r: 0.11, g: 0.52, b: 0.58 }, { r: 0.9, g: 0.98, b: 0.98 }], accelerationY: -42, drag: 2.5, dragEnd: 5, lightEmission: 0.05, lightInfluence: 0.8, wind: false, foamAtEnd: true, peakTransparency: 0.35 },
  electric: { palette: [{ r: 0.18, g: 0.42, b: 1 }, { r: 0.55, g: 0.78, b: 1 }, { r: 0.95, g: 1, b: 1 }], accelerationY: 0.3, drag: 0.15, dragEnd: 0.6, lightEmission: 1, lightInfluence: 0, wind: false, foamAtEnd: false, peakTransparency: 0 },
  shadow: { palette: [{ r: 0.08, g: 0.01, b: 0.14 }, { r: 0.38, g: 0.02, b: 0.58 }, { r: 0.95, g: 0.08, b: 0.4 }], accelerationY: -0.4, drag: 0.8, dragEnd: 2, lightEmission: 0.35, lightInfluence: 0.45, wind: true, foamAtEnd: false, peakTransparency: 0.08 },
  energy: { palette: [{ r: 0.12, g: 0.65, b: 1 }, { r: 0.48, g: 0.9, b: 1 }, { r: 1, g: 1, b: 1 }], accelerationY: 1.5, drag: 0.5, dragEnd: 1.5, lightEmission: 0.8, lightInfluence: 0.15, wind: false, foamAtEnd: false, peakTransparency: 0 },
  custom: { palette: [{ r: 0.2, g: 0.6, b: 1 }, { r: 0.6, g: 0.85, b: 1 }, { r: 1, g: 1, b: 1 }], accelerationY: 0, drag: 0.5, dragEnd: 1.5, lightEmission: 0.5, lightInfluence: 0.4, wind: false, foamAtEnd: false, peakTransparency: 0.1 },
};

function rng(seed: number) {
  let state = seed || 1;
  return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 0x1_0000_0000);
}
const colorStops = (a: Color, b: Color) => [{ time: 0, color: a }, { time: 1, color: b }];
const fadeFor = (peakTransparency: number) => [{ time: 0, value: 1 }, { time: 0.08, value: peakTransparency }, { time: 0.72, value: Math.min(1, peakTransparency + 0.18) }, { time: 1, value: 1 }];
const size = (start: number, middle: number, end = 0) => [{ time: 0, value: start }, { time: 0.35, value: middle }, { time: 1, value: end }];

export function compileProceduralVfxModule(value: unknown): VfxDraft {
  const input = proceduralVfxModuleSchema.parse(value);
  const random = rng(input.seed);
  const profile = elementProfiles[input.element];
  const base = profile.palette;
  const primary = input.primary ?? base[0], secondary = input.secondary ?? base[1], accent = input.accent ?? base[2];
  const d = input.duration, s = input.scale, power = input.intensity;
  const nodes: any[] = [];
  const addGeometry = (id: string, shape: "ball" | "ring", start: number, end: number, scale0: number, scale1: number, color: Color, transparency = 0.05) => nodes.push({
    id, name: id, kind: "geometry", startTime: start, endTime: end, enabled: true, tags: [input.preset, input.element], propertyCurves: [],
    shape, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, size: { x: s, y: s, z: s }, color, material: input.element === "water" ? "Glass" : "Neon",
    transparency, startScale: { x: scale0, y: scale0, z: scale0 }, endScale: { x: scale1, y: scale1, z: scale1 }, startTransparency: transparency, endTransparency: 1, easing: "expoOut",
  });
  const addParticles = (id: string, start: number, end: number, burst: number, speedMin: number, speedMax: number, spread = 180, options: { continuous?: boolean; mote?: boolean } = {}) => nodes.push({
    id, name: id, kind: "particle", startTime: start, endTime: end, enabled: true, tags: [input.preset, input.element],
    propertyCurves: [{ target: "particle", property: "Drag", interpolation: "smooth", keys: [{ time: 0, value: profile.drag }, { time: 1, value: profile.dragEnd }] }],
    position: { x: 0, y: 0, z: 0 }, rotation: { x: random() * 360, y: random() * 360, z: random() * 360 }, texture: input.texture,
    color: profile.foamAtEnd ? colorStops(primary, accent) : colorStops(accent, primary), transparency: fadeFor(profile.peakTransparency), size: size(0.08 * s, options.mote ? 0.22 * s : 0.42 * s), lifetime: { min: d * 0.28, max: d * 0.72 },
    speed: { min: speedMin * s, max: speedMax * s }, rate: options.continuous ? Math.round(burst * power / Math.max(0.1, d)) : 0, burstCount: options.continuous ? 0 : Math.round(burst * power), spread: { x: spread, y: spread },
    acceleration: { x: 0, y: profile.accelerationY * s, z: 0 }, drag: profile.drag,
    rotationRange: { min: -180, max: 180 }, rotationSpeed: { min: -220, max: 220 }, orientation: options.mote ? "facingCamera" : "velocityParallel", timeScale: 1, velocityInheritance: 0,
    windAffectsDrag: profile.wind, flipbookLayout: input.flipbookLayout, flipbookMode: input.flipbookMode, flipbookFramerate: input.flipbookFramerate, flipbookStartRandom: input.flipbookStartRandom,
    lightEmission: profile.lightEmission, lightInfluence: profile.lightInfluence, lockedToPart: false, zOffset: 0, emitterShape: "sphere", shapeStyle: "surface", shapeInOut: "outward", shapePartial: 0,
    emitterSize: { x: 0.25 * s, y: 0.25 * s, z: 0.25 * s }, emissionDirection: "front", squash: options.mote ? [{ time: 0, value: 0, envelope: 0 }, { time: 1, value: 0, envelope: 0 }] : [{ time: 0, value: 0, envelope: 0 }, { time: 1, value: 0.5, envelope: 0 }],
  });

  if (input.preset === "impactBurst") {
    addGeometry("CoreFlash", "ball", 0, d * 0.2, 0.15, 2.2 * power, accent, 0);
    addGeometry("ImpactRing", "ring", d * 0.03, d * 0.55, 0.35, 5.5 * power, secondary);
    addParticles("DirectionalDebris", 0, d * 0.72, 18 + input.complexity * 10, 5 * power, 14 * power, 65);
    const impactBrightness = (input.element === "water" ? 2.2 : 12) * power;
    nodes.push({ id: "ImpactLight", name: "ImpactLight", kind: "light", startTime: 0, endTime: d * 0.28, enabled: true, tags: ["impact"], propertyCurves: [{ target: "light", property: "Brightness", interpolation: "smooth", keys: [{ time: 0, value: impactBrightness }, { time: 1, value: 0 }] }], lightType: "point", position: { x: 0, y: 0, z: 0 }, color: secondary, brightness: impactBrightness, range: (input.element === "water" ? 9 : 16) * s, angle: 90, shadows: false });
    nodes.push({ id: "ImpactCamera", name: "ImpactCamera", kind: "camera", startTime: 0, endTime: d * 0.18, enabled: true, tags: ["impact"], propertyCurves: [], shakeAmplitude: { x: 0.18 * power, y: 0.12 * power, z: 0.08 * power }, shakeFrequency: 26, fovDelta: -4 * power, chromaticAberration: 0.08 * power, blur: 3 * power, colorTint: accent, contrast: 0.18, saturation: -0.08 });
  } else if (input.preset === "shockwave") {
    for (let index = 0; index < Math.min(4, input.complexity); index += 1) addGeometry(`Shockwave_${index + 1}`, "ring", index * d * 0.035, d * (0.52 + index * 0.06), 0.3 + index * 0.16, (4.5 + index * 1.25) * power, index % 2 ? primary : secondary, 0.08 + index * 0.08);
    addParticles("GroundBreakup", 0, d * 0.8, 12 + input.complexity * 8, 2, 8 * power, 35);
  } else if (input.preset === "auraOrbit") {
    const arcCount = Math.min(5, input.complexity + 1);
    for (let index = 0; index < arcCount; index += 1) {
      const angle = index / arcCount * Math.PI * 2;
      nodes.push({ id: `AuraArc_${index + 1}`, name: `AuraArc_${index + 1}`, kind: "beam", startTime: 0, endTime: d, enabled: true, tags: ["aura", input.element], propertyCurves: [{ target: "beam", property: "TextureSpeed", interpolation: "linear", keys: [{ time: 0, value: 0.8 + index * 0.2 }, { time: 1, value: 2.4 + index * 0.3 }] }], from: { x: Math.cos(angle) * s, y: -0.8 * s, z: Math.sin(angle) * s }, to: { x: Math.cos(angle + 1.8) * s, y: 1.2 * s, z: Math.sin(angle + 1.8) * s }, width0: 0.08 * s, width1: 0.22 * s, color: profile.foamAtEnd ? colorStops(primary, accent) : colorStops(accent, primary), transparency: fadeFor(profile.peakTransparency), texture: input.texture, textureSpeed: 1.5, textureLength: 1, curve0: 1.8 * s, curve1: -1.2 * s, faceCamera: true, segments: 20, lightEmission: profile.lightEmission, lightInfluence: profile.lightInfluence, textureMode: "wrap", brightness: (input.element === "water" ? 1.2 : 4) * power });
    }
    addParticles("AuraMotes", 0, d, 16 * input.complexity, 0.3, 1.8, 180, { continuous: true, mote: true });
  } else if (input.preset === "slashArc") {
    nodes.push({ id: "PrimarySlash", name: "PrimarySlash", kind: "beam", startTime: 0, endTime: d * 0.45, enabled: true, tags: ["slash", input.element], propertyCurves: [{ target: "beam", property: "Width0", interpolation: "smooth", keys: [{ time: 0, value: 0.05 * s }, { time: 0.25, value: 0.65 * s }, { time: 1, value: 0 }] }], from: { x: -2.2 * s, y: -0.7 * s, z: 0 }, to: { x: 2.4 * s, y: 1.1 * s, z: 0 }, width0: 0.65 * s, width1: 0.12 * s, color: profile.foamAtEnd ? colorStops(primary, accent) : colorStops(accent, primary), transparency: fadeFor(profile.peakTransparency), texture: input.texture, textureSpeed: 2.8, textureLength: 1.2, curve0: 2.4 * s, curve1: -1.6 * s, faceCamera: true, segments: 32, lightEmission: profile.lightEmission, lightInfluence: profile.lightInfluence, textureMode: "stretch", brightness: (input.element === "water" ? 1.4 : 6) * power });
    addParticles("SlashFragments", d * 0.02, d * 0.65, 10 + input.complexity * 7, 3, 9 * power, 38);
    addGeometry("SlashContact", "ball", d * 0.08, d * 0.25, 0.1, 0.8 * power, accent, 0);
  } else {
    nodes.push({ id: "ElementTrail", name: "ElementTrail", kind: "trail", startTime: 0, endTime: d, enabled: true, tags: ["trail", input.element], propertyCurves: [{ target: "trail", property: "Lifetime", interpolation: "smooth", keys: [{ time: 0, value: d * 0.2 }, { time: 1, value: d * 0.65 }] }], attachment0: { x: 0, y: 0.28 * s, z: 0 }, attachment1: { x: 0, y: -0.28 * s, z: 0 }, lifetime: d * 0.4, minLength: 0.03, color: profile.foamAtEnd ? colorStops(primary, accent) : colorStops(accent, primary), transparency: fadeFor(profile.peakTransparency), widthScale: size(0.3 * s, 1 * s), texture: input.texture, textureLength: 1, faceCamera: true, lightEmission: profile.lightEmission, lightInfluence: profile.lightInfluence, brightness: (input.element === "water" ? 1.2 : 4) * power });
    addParticles("TrailMotes", 0, d, 10 + input.complexity * 8, 0.2, 2.2, 55, { continuous: true, mote: true });
  }

  const markers = [
    { id: "release", time: 0, type: "release" as const, label: "Release" },
    ...(!["auraOrbit", "elementalTrail"].includes(input.preset) ? [{ id: "impact", time: Math.min(d * 0.12, d), type: "impact" as const, label: "Primary impact" }] : []),
    { id: "recovery", time: d * 0.72, type: "recovery" as const, label: "Dissipation" },
  ];
  return vfxDraftSchema.parse({
    schemaVersion: 1, name: input.name, category: input.preset === "auraOrbit" ? "characterAura" : input.preset === "elementalTrail" ? "custom" : "attack", duration: d, framesPerSecond: 60,
    looped: input.preset === "auraOrbit" || input.preset === "elementalTrail", targetPath: input.targetPath,
    intent: `Procedural ${input.element} ${input.preset} compiled locally from a compact module.`, style: [...input.style, input.element, input.preset, "procedural-module"],
    palette: [primary, secondary, accent], markers, nodes, metadata: { modulePreset: input.preset, moduleElement: input.element, seed: input.seed, complexity: input.complexity },
  });
}
