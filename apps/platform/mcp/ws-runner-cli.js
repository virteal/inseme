#!/usr/bin/env node
import { initRunner, init, opheliaAgent } from "./ws-runner.js";

if (process.argv[2] === "--quick-test") {
  (async () => {
    await init();
    await opheliaAgent?.onEvent?.(
      {
        id: "ev-quick",
        type: "user_message",
        topic_id: "t-topic",
        payload: { text: "test quick" },
      },
      { store: undefined, bus: undefined }
    );
    console.log("quick test: done");
    process.exit(0);
  })();
} else {
  initRunner().catch((e) => {
    console.error("initRunner failure", e);
    process.exit(1);
  });
}
