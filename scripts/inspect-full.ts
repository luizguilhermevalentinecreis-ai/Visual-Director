import { vfx } from "./relay-client.js";

const result = await vfx("inspect", { maxResults: 400, detail: "full", pageSize: 25 });
process.stdout.write(JSON.stringify(result, null, 2));
process.stdout.write("\n");
