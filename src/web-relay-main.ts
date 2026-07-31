import { VisualDirectorRelay } from "./web-relay.js";

const relay = new VisualDirectorRelay(
  process.env.VISUAL_RELAY_HOST ?? "0.0.0.0",
  Number(process.env.PORT ?? process.env.VISUAL_RELAY_PORT ?? 34729),
);
await relay.start();
console.log(`Visual Director relay listening on ${relay.host}:${relay.port}`);
const shutdown = async () => { await relay.stop(); process.exit(0); };
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
