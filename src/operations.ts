import { z } from "zod";
import { colorSchema, colorStopSchema, numberRangeSchema, numberStopSchema, vector2Schema, vector3Schema } from "./domain.js";

export const instanceSelectorSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  className: z.string().min(1).max(80).optional(),
  nodeId: z.string().min(1).max(100).optional(),
  pathContains: z.string().min(1).max(300).optional(),
  includeRoot: z.boolean().default(false),
}).refine((value) => value.name || value.className || value.nodeId || value.pathContains, "selector needs at least one filter");

export const propertyValueSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("number"), value: z.number().finite() }),
  z.object({ type: z.literal("boolean"), value: z.boolean() }),
  z.object({ type: z.literal("string"), value: z.string().max(2_000) }),
  z.object({ type: z.literal("color3"), value: colorSchema }),
  z.object({ type: z.literal("vector2"), value: vector2Schema }),
  z.object({ type: z.literal("vector3"), value: vector3Schema }),
  z.object({ type: z.literal("numberRange"), value: numberRangeSchema }),
  z.object({ type: z.literal("numberSequence"), value: z.array(numberStopSchema.extend({ envelope: z.number().nonnegative().default(0) })).min(1).max(32) }),
  z.object({ type: z.literal("colorSequence"), value: z.array(colorStopSchema).min(1).max(32) }),
  z.object({ type: z.literal("enum"), enumType: z.string().min(1).max(80), value: z.string().min(1).max(80) }),
  z.object({
    type: z.literal("cframe"),
    position: vector3Schema.default({ x: 0, y: 0, z: 0 }),
    rotationDegrees: vector3Schema.default({ x: 0, y: 0, z: 0 }),
  }),
]);

const setPropertySchema = z.object({
  op: z.literal("setProperty"),
  selector: instanceSelectorSchema,
  property: z.string().min(1).max(100),
  value: propertyValueSchema,
  requireMatch: z.boolean().default(true),
});

const setAttributeSchema = z.object({
  op: z.literal("setAttribute"),
  selector: instanceSelectorSchema,
  attribute: z.string().min(1).max(100),
  value: z.union([z.string().max(2_000), z.number().finite(), z.boolean(), vector2Schema, vector3Schema, colorSchema]),
  requireMatch: z.boolean().default(true),
});

const cloneSchema = z.object({
  op: z.literal("clone"),
  selector: instanceSelectorSchema,
  name: z.string().min(1).max(120).optional(),
  parentSelector: instanceSelectorSchema.optional(),
  requireMatch: z.boolean().default(true),
});

const destroySchema = z.object({
  op: z.literal("destroy"),
  selector: instanceSelectorSchema,
  requireMatch: z.boolean().default(true),
});

const renameSchema = z.object({
  op: z.literal("rename"),
  selector: instanceSelectorSchema,
  name: z.string().min(1).max(120),
  requireMatch: z.boolean().default(true),
});

const emitSchema = z.object({
  op: z.literal("emit"),
  selector: instanceSelectorSchema,
  count: z.number().int().min(1).max(10_000),
  requireMatch: z.boolean().default(true),
});

export const vfxOperationSchema = z.discriminatedUnion("op", [
  setPropertySchema, setAttributeSchema, cloneSchema, destroySchema, renameSchema, emitSchema,
]);

export const vfxOperationProgramSchema = z.object({
  name: z.string().min(1).max(160),
  scope: z.enum(["selection", "committedPackage", "attachedPackage"]).default("selection"),
  packageName: z.string().min(1).max(120).optional(),
  operations: z.array(vfxOperationSchema).min(1).max(1_000),
}).superRefine((value, context) => {
  if (value.scope !== "selection" && !value.packageName) {
    context.addIssue({ code: "custom", path: ["packageName"], message: "packageName is required outside selection scope" });
  }
});

export type VfxOperationProgram = z.infer<typeof vfxOperationProgramSchema>;
