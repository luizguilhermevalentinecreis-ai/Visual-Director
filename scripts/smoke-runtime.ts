import { StudioBridge } from "../src/bridge.js";

const bridge = new StudioBridge(process.env.VISUAL_BRIDGE_HOST ?? "127.0.0.1", Number(process.env.VISUAL_BRIDGE_PORT ?? 34728));

try {
  await bridge.start();
  const deadline = Date.now() + 10_000;
  while (!bridge.status().connected && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!bridge.status().connected) throw new Error("Studio did not connect to the local Visual Director bridge within 10 seconds.");
  const result = await bridge.execute("vfx.smokeRuntime", {}, 30_000);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!(result as { passed?: boolean }).passed) process.exitCode = 1;
} finally {
  await bridge.stop();
}
