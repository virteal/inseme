import assert from "assert";
import wsBus from "../cop/wsBus.js";

(async () => {
  const bus = wsBus();
  try {
    await bus.initBus();

    const topic = "topic-test-1";
    const evt = { id: "evt-1", type: "test_event", topic_id: topic, payload: { foo: "bar" } };

    let called = false;
    let received = null;
    const unsubscribe = bus.subscribe(topic, (payload) => {
      called = true;
      received = payload;
    });

    await bus.publish(evt);

    // wait for handler to be called with a short timeout
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout waiting for wsBus handler")), 200);
      const iv = setInterval(() => {
        if (called) {
          clearTimeout(timeout);
          clearInterval(iv);
          resolve();
        }
      }, 5);
    });

    assert.strictEqual(received && received.payload && received.payload.foo, "bar");
    unsubscribe();
    bus.close();

    console.log("wsBus publish/subscribe test passed");
  } catch (e) {
    console.error("test failed", e);
    process.exit(1);
  }
})();
