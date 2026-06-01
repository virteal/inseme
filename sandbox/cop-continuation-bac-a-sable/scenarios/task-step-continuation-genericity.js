/**
 * Scenario: task-step-continuation-genericity
 *
 * Validates the high-level generic helpers we added in Cop-kerneltasks.js
 * (`createTaskWithInitialContinuation`, etc.) work correctly together with
 * the scheduler and topic-scoped buses.
 *
 * Goal: ensure we have real genericity at the kernel level instead of
 * forcing every application to reinvent Task + Step + Continuation coordination.
 */

export default {
  name: "task-step-continuation-genericity",
  description:
    "Exercises the generic Task/Step + Continuation orchestration helpers with topic scoping and the scheduler.",

  defaultTopicId: "genericity-test-topic",

  steps: [
    {
      name: "create-task-with-linked-continuation",
      description:
        "Use the high-level generic helper to create a Task + linked Continuation in one call.",
      async run(ctx) {
        const { createTaskWithInitialContinuation } =
          await import("../../../packages/cop-kernel/src/Cop-kerneltasks.js");

        const result = await createTaskWithInitialContinuation({
          taskType: "test-genericity",
          workerAgentName: "test-agent",
          resumeTo: "reviewer",
          resumeIntent: "continue-work",
          state: { draft: "initial state for genericity test" },
          waitForEvents: ["genericity.trigger"],
          retry: { maxAttempts: 3, baseDelayMs: 200 },
        });

        ctx.genericity = { task: result.task, continuation: result.continuation };

        ctx.emit({
          type: "generic.task.created",
          data: {
            taskId: result.task.id,
            continuationId: result.continuation.continuationId,
            synthetic: !!result.task.synthetic,
          },
        });

        console.log(
          `[GENERICITY-TEST] Created Task ${result.task.id} with linked Continuation via kernel helper.`
        );
      },
    },

    {
      name: "register-with-scheduler-on-topic-bus",
      description: "Register the continuation using the topic-aware scheduler.",
      async run(ctx) {
        const { continuation } = ctx.genericity;
        const topicBus = ctx.busForCurrentTopic();

        const scheduler = new (
          await import("../../../packages/cop-kernel/src/scheduler.js")
        ).COPScheduler(topicBus);
        scheduler.start();

        scheduler.register(continuation);

        ctx.genericity.scheduler = scheduler;

        console.log("[GENERICITY-TEST] Continuation registered on topic-scoped scheduler.");
      },
    },

    {
      name: "trigger-resumption",
      description: "Publish the waiting event on the topic bus and observe resumption.",
      async run(ctx) {
        const { scheduler } = ctx.genericity;
        const topicBus = ctx.busForCurrentTopic();

        await topicBus.publish({
          type: "genericity.trigger",
          data: { note: "resuming generic task" },
        });

        // Give the scheduler a moment
        await new Promise((r) => setTimeout(r, 50));

        const stillPending = scheduler.getPendingContinuations().length;

        if (stillPending === 0) {
          console.log(
            "[GENERICITY-TEST] PASS: Continuation was resumed after event on the same topic bus."
          );
        } else {
          console.log(`[GENERICITY-TEST] Still ${stillPending} continuation(s) pending.`);
        }
      },
    },
  ],
};
