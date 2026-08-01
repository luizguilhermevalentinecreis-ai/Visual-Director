import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "visual-director-probe", version: "0.1.0" });
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

const raw = async (tool: string, args: Record<string, unknown> = {}) =>
  payload((await client.callTool({ name: tool, arguments: args })) as { content?: unknown });

try {
  await client.connect(transport);
  process.stdout.write("Click Connect in the Visual Director plugin now...\n");

  let status = await raw("get_visual_director_status");
  for (let attempt = 0; attempt < 90 && !status.connected; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    status = await raw("get_visual_director_status");
  }
  if (!status.connected) throw new Error("never connected");

  // If lastSeenAt advances on its own, the plugin's poll loop is alive and the
  // problem is in a specific handler. If it is frozen, the plugin connected
  // once and then stopped polling entirely.
  const first = status.session.lastSeenAt;
  process.stdout.write(`connected. lastSeenAt=${first}\n`);
  await new Promise((resolve) => setTimeout(resolve, 4000));
  const second = (await raw("get_visual_director_status")).session?.lastSeenAt;
  process.stdout.write(
    `after 4s: lastSeenAt=${second} (advanced by ${second - first}ms) -> poll loop ${
      second > first ? "IS ALIVE" : "IS FROZEN"
    }\n`,
  );

  // system.capabilities is the simplest handler in the plugin: a static table,
  // no Selection, no instances. If this answers, polling and the result path
  // both work and only richer handlers are failing.
  process.stdout.write("\ncalling get_vfx_capabilities (static handler)...\n");
  const capabilities = await raw("get_vfx_capabilities");
  process.stdout.write(`capabilities: ${JSON.stringify(capabilities)}\n`);

  const after = await raw("get_visual_director_status");
  process.stdout.write(`\nqueuedCommands now: ${after.queuedCommands}\n`);
} finally {
  await client.close();
}
