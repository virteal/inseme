import declarePresence from "./tool-declare-presence.js";

export default async function handler(runtime, args = {}) {
  return declarePresence(runtime, {
    ...args,
    modality: "intended",
    source: args.source || "john_tool_future",
  });
}
