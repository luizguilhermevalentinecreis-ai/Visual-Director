import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const packageName = process.env.VD_PACKAGE ?? "VD_KamehamehaCharge_V1";
// 2.0s of 2.4s is the end of the throb phase, where all three shells are at
// their 120% peak. It is the most informative single frame to review.
const normalizedTime = Number(process.env.VD_TIME ?? 2.0 / 2.4);

const client = new Client({ name: "visual-director-preview", version: "0.1.0" });
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

async function call(tool: string, args: Record<string, unknown>): Promise<any> {
  const result = await client.callTool({ name: tool, arguments: args });
  if (result.isError) throw new Error(`${tool}: ${JSON.stringify(result.content)}`);
  return payload(result as { content?: unknown });
}

try {
  await client.connect(transport);

  // This process owns a fresh bridge, and the plugin's poll loop does not
  // auto-reconnect once its session is dropped, so it needs a manual Connect
  // click against this server. Wait long enough for that to happen.
  process.stdout.write("Waiting for the Visual Director plugin. Click Connect in Studio now...\n");
  let status = await call("get_visual_director_status", {});
  for (let attempt = 0; attempt < 90 && !status.connected; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    status = await call("get_visual_director_status", {});
  }
  if (!status.connected) throw new Error("Visual Director plugin is not connected.");
  process.stdout.write(`connected: ${status.session.placeName}\n\n`);

  // attachCommitted destroys `old` before cloning `source`, and when the
  // selection is ReplicatedStorage those are the same instance: attaching
  // there deletes the committed package. Refuse instead of discovering it
  // afterwards.
  const selection = await call("get_scene_selection", { includeDescendants: false, maxDepth: 1 });
  const target = selection.items?.[0];
  if (!target) throw new Error("Select the rig in Studio before attaching.");
  if (target.className === "ReplicatedStorage" || String(target.path).startsWith("ReplicatedStorage")) {
    throw new Error(`Refusing to attach onto ${target.path}: that would destroy the committed package.`);
  }
  process.stdout.write(`target: ${target.path} (${target.className})\n`);

  const attached = await call("attach_committed_vfx", { packageName });
  process.stdout.write(`attached: ${JSON.stringify(attached)}\n`);

  // The plugin's previewCommitted only poses a single frame, which is exactly
  // the static behaviour we replaced. Ask for it explicitly if you want it.
  if (process.env.VD_STATIC_PREVIEW === "1") {
    const preview = await call("preview_committed_vfx", { packageName, normalizedTime });
    process.stdout.write(`static pose at t=${(normalizedTime * 2.4).toFixed(2)}s: ${JSON.stringify(preview)}\n`);
  }
} finally {
  await client.close();
}
