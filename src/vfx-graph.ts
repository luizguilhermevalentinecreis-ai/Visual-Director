import { z } from "zod";
import { colorSchema, vector3Schema, vfxDraftSchema, type VfxDraft } from "./domain.js";

const graphEmitterSchema = z.object({
  id: z.string().min(1).max(80), type: z.literal("emitter"),
  position: vector3Schema.default({ x: 0, y: 0, z: 0 }), extent: vector3Schema.default({ x: 2, y: 2, z: 2 }),
  samples: z.number().int().min(1).max(64).default(12), texture: z.string().max(300).default(""),
  burstCount: z.number().int().min(1).max(5000).default(80), lifetime: z.object({ min: z.number().positive(), max: z.number().positive() }).default({ min: 0.4, max: 0.9 }),
  speed: z.object({ min: z.number().finite(), max: z.number().finite() }).default({ min: 1, max: 4 }),
  size: z.number().positive().max(100).default(0.4), spread: z.number().min(0).max(180).default(35),
});
const graphFieldSchema = z.object({
  id: z.string().min(1).max(80), type: z.literal("field"),
  fieldType: z.enum(["directional", "attractor", "vortex", "turbulence", "drag"]),
  position: vector3Schema.default({ x: 0, y: 0, z: 0 }), direction: vector3Schema.default({ x: 0, y: 1, z: 0 }),
  axis: vector3Schema.default({ x: 0, y: 1, z: 0 }), strength: z.number().finite().min(-500).max(500).default(10),
  radius: z.number().positive().max(1000).default(8), falloff: z.number().min(0).max(4).default(1), frequency: z.number().min(0).max(100).default(2),
});
const graphOutputSchema = z.object({ id: z.string().min(1).max(80), type: z.literal("output") });
export const vfxNodeGraphSchema = z.object({
  name: z.string().min(1).max(120), duration: z.number().positive().max(120).default(1), targetPath: z.string().max(500).default("selection:1"),
  seed: z.number().int().min(0).max(2_147_483_647).default(1), looped: z.boolean().default(false),
  palette: z.array(colorSchema).min(2).max(8),
  nodes: z.array(z.discriminatedUnion("type", [graphEmitterSchema, graphFieldSchema, graphOutputSchema])).min(2).max(100),
  connections: z.array(z.object({ from: z.string().min(1), to: z.string().min(1) })).min(1).max(300),
  style: z.array(z.string().max(80)).max(20).default([]),
}).superRefine((graph, context) => {
  const ids = new Set(graph.nodes.map((node) => node.id));
  if (ids.size !== graph.nodes.length) context.addIssue({ code: "custom", path: ["nodes"], message: "Graph node IDs must be unique." });
  for (const [index, connection] of graph.connections.entries()) {
    if (!ids.has(connection.from) || !ids.has(connection.to)) context.addIssue({ code: "custom", path: ["connections", index], message: "Connection references an unknown node." });
  }
});

type V3 = { x: number; y: number; z: number };
const add = (a: V3, b: V3): V3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (a: V3, s: number): V3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const length = (a: V3) => Math.hypot(a.x, a.y, a.z);
const normalize = (a: V3): V3 => length(a) < 1e-8 ? { x: 0, y: 0, z: 0 } : scale(a, 1 / length(a));
const cross = (a: V3, b: V3): V3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
function randomFactory(seed: number) { let state = seed || 1; return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 0x1_0000_0000); }

function fieldVector(field: z.infer<typeof graphFieldSchema>, point: V3, random: () => number): { acceleration: V3; drag: number } {
  const radial = sub(point, field.position);
  const distance = length(radial);
  const influence = distance >= field.radius ? 0 : Math.pow(Math.max(0, 1 - distance / field.radius), field.falloff);
  if (field.fieldType === "drag") return { acceleration: { x: 0, y: 0, z: 0 }, drag: Math.max(0, field.strength) * influence };
  if (field.fieldType === "directional") return { acceleration: scale(normalize(field.direction), field.strength * influence), drag: 0 };
  if (field.fieldType === "attractor") return { acceleration: scale(normalize(scale(radial, -1)), field.strength * influence), drag: 0 };
  if (field.fieldType === "vortex") return { acceleration: scale(normalize(cross(normalize(field.axis), radial)), field.strength * influence), drag: 0 };
  const noise = normalize({ x: random() * 2 - 1, y: random() * 2 - 1, z: random() * 2 - 1 });
  return { acceleration: scale(noise, field.strength * influence), drag: 0 };
}

export function compileVfxNodeGraph(value: unknown): VfxDraft {
  const graph = vfxNodeGraphSchema.parse(value);
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const random = randomFactory(graph.seed);
  const output: any[] = [];
  for (const emitter of graph.nodes.filter((node): node is z.infer<typeof graphEmitterSchema> => node.type === "emitter")) {
    const fields = graph.connections
      .filter((connection) => connection.to === emitter.id)
      .map((connection) => byId.get(connection.from))
      .filter((node): node is z.infer<typeof graphFieldSchema> => node?.type === "field");
    if (!fields.length) throw new Error(`Emitter ${emitter.id} has no connected field nodes.`);
    for (let index = 0; index < emitter.samples; index += 1) {
      const position = add(emitter.position, { x: (random() * 2 - 1) * emitter.extent.x / 2, y: (random() * 2 - 1) * emitter.extent.y / 2, z: (random() * 2 - 1) * emitter.extent.z / 2 });
      let acceleration = { x: 0, y: 0, z: 0 }, drag = 0;
      for (const field of fields) {
        const sample = fieldVector(field, position, random);
        acceleration = add(acceleration, sample.acceleration); drag += sample.drag;
      }
      output.push({
        id: `${emitter.id}_Cell_${index + 1}`, name: `${emitter.id}_Cell_${index + 1}`, kind: "particle", startTime: 0, endTime: graph.duration,
        enabled: true, tags: ["node-graph", "vector-field", emitter.id], propertyCurves: [], position, rotation: { x: random() * 360, y: random() * 360, z: random() * 360 },
        texture: emitter.texture, color: [{ time: 0, color: graph.palette[0] }, { time: 1, color: graph.palette[1] }],
        transparency: [{ time: 0, value: 1 }, { time: 0.08, value: 0 }, { time: 0.8, value: 0.2 }, { time: 1, value: 1 }],
        size: [{ time: 0, value: emitter.size * 0.3 }, { time: 0.3, value: emitter.size }, { time: 1, value: 0 }], lifetime: emitter.lifetime, speed: emitter.speed,
        rate: 0, burstCount: Math.max(1, Math.round(emitter.burstCount / emitter.samples)), spread: { x: emitter.spread, y: emitter.spread }, acceleration, drag,
        rotationRange: { min: -180, max: 180 }, rotationSpeed: { min: -180, max: 180 }, orientation: "velocityParallel", squash: [{ time: 0, value: 0, envelope: 0 }, { time: 1, value: 0.4, envelope: 0 }],
        timeScale: 1, velocityInheritance: 0, windAffectsDrag: false, flipbookLayout: "none", flipbookMode: "oneShot", flipbookFramerate: { min: 1, max: 1 }, flipbookStartRandom: false,
        lightEmission: 0.75, lightInfluence: 0.2, lockedToPart: false, zOffset: 0, emitterShape: "point", shapeStyle: "volume", shapeInOut: "outward", shapePartial: 0,
        emitterSize: { x: 0.1, y: 0.1, z: 0.1 }, emissionDirection: "front",
      });
    }
  }
  return vfxDraftSchema.parse({
    schemaVersion: 1, name: graph.name, category: "custom", duration: graph.duration, framesPerSecond: 60, looped: graph.looped, targetPath: graph.targetPath,
    intent: "Studio-native spatial vector field compiled from a compact connected node graph.", style: [...graph.style, "node-graph", "baked-vector-field"], palette: graph.palette,
    markers: [{ id: "release", time: 0, type: "release", label: "Field release" }, { id: "dissipate", time: graph.duration * 0.8, type: "recovery", label: "Field dissipation" }],
    nodes: output, metadata: { graphSeed: graph.seed, graphNodeCount: graph.nodes.length, graphConnectionCount: graph.connections.length, fieldMode: "spatial-emitter-grid" },
  });
}
