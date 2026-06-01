/**
 * Scenario: topic-isolation-test
 *
 * Validates that per-topic sub-buses provide real isolation.
 * Events and continuations on one topic must not leak to another.
 *
 * This is critical for Fractanet genericity (different Topics must be able
 * to evolve independently even when running on the same COP runtime).
 */

export default {
  name: "topic-isolation-test",
  description:
    "Proves that topic-scoped sub-buses are properly isolated (events/continuations on one topic do not affect another).",

  steps: [
    {
      name: "setup-two-topics",
      description: "Create two different topic sub-buses from the same root bus.",
      async run(ctx) {
        const rootBus = ctx.bus;

        const topicBus1 = rootBus.forTopic("topic-alpha");
        const topicBus2 = rootBus.forTopic("topic-beta");

        ctx.isolation = { topicBus1, topicBus2 };

        const events1 = [];
        const events2 = [];

        topicBus1.subscribe("test.event", (e) => events1.push(e));
        topicBus2.subscribe("test.event", (e) => events2.push(e));

        ctx.isolation.events1 = events1;
        ctx.isolation.events2 = events2;

        ctx.emit({ type: "isolation.setup", data: { topics: ["topic-alpha", "topic-beta"] } });
        console.log("[ISOLATION-TEST] Two topic sub-buses created with separate listeners.");
      },
    },

    {
      name: "publish-only-to-topic1",
      description: "Publish an event only on topic-alpha's sub-bus.",
      async run(ctx) {
        const { topicBus1 } = ctx.isolation;

        await topicBus1.publish({
          type: "test.event",
          data: { message: "only for alpha" },
        });

        ctx.emit({ type: "event.published.to.alpha" });
      },
    },

    {
      name: "verify-isolation",
      description: "Check that only the correct topic received the event.",
      async run(ctx) {
        const { events1, events2 } = ctx.isolation;

        const alphaGotIt = events1.length === 1;
        const betaGotIt = events2.length > 0;

        if (alphaGotIt && !betaGotIt) {
          console.log(
            "[ISOLATION-TEST] PASS: Event only reached topic-alpha, topic-beta remained isolated."
          );
          ctx.emit({ type: "isolation.verified", data: { result: "pass" } });
        } else {
          console.log(
            `[ISOLATION-TEST] FAIL: Isolation broken (alpha=${events1.length}, beta=${events2.length})`
          );
          ctx.emit({
            type: "isolation.verified",
            data: { result: "fail", alpha: events1.length, beta: events2.length },
          });
        }
      },
    },

    {
      name: "test-continuation-isolation",
      description: "Register continuations on different topics and ensure they don't interfere.",
      async run(ctx) {
        const { topicBus1, topicBus2 } = ctx.isolation;

        const scheduler1 = new (
          await import("../../../packages/cop-kernel/src/scheduler.js")
        ).COPScheduler(topicBus1);
        const scheduler2 = new (
          await import("../../../packages/cop-kernel/src/scheduler.js")
        ).COPScheduler(topicBus2);

        scheduler1.start();
        scheduler2.start();

        const cont1 = {
          continuationId: "cont-alpha",
          resumeTo: "agent1",
          topicId: "topic-alpha",
          conditions: { waitForEvents: ["alpha.trigger"] },
        };

        const cont2 = {
          continuationId: "cont-beta",
          resumeTo: "agent2",
          topicId: "topic-beta",
          conditions: { waitForEvents: ["beta.trigger"] },
        };

        scheduler1.register(cont1);
        scheduler2.register(cont2);

        // Publish trigger only on topic alpha
        await topicBus1.publish({ type: "alpha.trigger" });

        const pending1 = scheduler1.getPendingContinuations().length;
        const pending2 = scheduler2.getPendingContinuations().length;

        if (pending1 === 0 && pending2 === 1) {
          console.log("[ISOLATION-TEST] PASS: Continuation on alpha was resumed, beta untouched.");
        } else {
          console.log(
            `[ISOLATION-TEST] Partial: alpha pending=${pending1}, beta pending=${pending2}`
          );
        }

        scheduler1.stop();
        scheduler2.stop();
      },
    },
  ],
};
