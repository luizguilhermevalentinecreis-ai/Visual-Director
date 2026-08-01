import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "visual-director-inspect", version: "0.1.0" });
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

async function call(tool: string, args: Record<string, unknown> = {}): Promise<any> {
  const result = await client.callTool({ name: tool, arguments: args });
  if (result.isError) throw new Error(`${tool}: ${JSON.stringify(result.content)}`);
  return payload(result as { content?: unknown });
}

try {
  await client.connect(transport);
  let status = await call("get_visual_director_status");
  for (let attempt = 0; attempt < 60 && !status.connected; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    status = await call("get_visual_director_status");
  }
  if (!status.connected) throw new Error("plugin not connected");

  const selection = await call("get_scene_selection", { includeDescendants: false, maxDepth: 1 });
  process.stdout.write(`SELECTION: ${JSON.stringify(selection, null, 2)}\n\n`);

  const vfx = await call("inspect_selected_vfx", { maxResults: Number(process.env.MAX ?? 400) });
  process.stdout.write(`VFX:\n${JSON.stringify(vfx, null, 2)}\n`);
} finally {
  await client.close();
}
