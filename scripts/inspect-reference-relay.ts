import { vfx } from "./relay-client.js";

const selection = await vfx("selection", {});
process.stdout.write(`SELECTION:\n${JSON.stringify(selection, null, 2)}\n\n`);

const inspected = await vfx("inspect", { maxResults: Number(process.env.MAX ?? 400) });
process.stdout.write(`VFX (${inspected.count} items):\n${JSON.stringify(inspected, null, 2)}\n`);
