import { vfx } from "./relay-client.js";

const packageName = process.env.VD_PACKAGE ?? "VD_WaterImpactBurst_V1";

const selection = await vfx("selection", {});
const target = selection.items?.[0];
if (!target) throw new Error("Select a target in Studio before attaching.");
if (String(target.path).startsWith("ReplicatedStorage")) {
  throw new Error(`Refusing to attach onto ${target.path}.`);
}
process.stdout.write(`target: ${target.path} (${target.className})\n`);

const attached = await vfx("attach", { packageName }, true);
process.stdout.write(`attached: ${JSON.stringify(attached)}\n`);
