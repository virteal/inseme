// File: packages/cop-kernel/src/handler.js
// Description:
//   handler factories for COP v0.2.

import { createHandlerContext } from "./handlerContext.js";

/**
 * Define a COP handler with a standard run() entrypoint, including
 * automatic task/step lifecycle management if configured.
 *
 * @param {Object} config
 * @param {string} config.name
 *
 * @param {Object} [config.task]
 * @param {string} config.task.taskType
 * @param {string} config.task.workerHandlerName
 * @param {string} [config.task.stepName]
 * @param {boolean} [config.task.autoComplete=true]
 *
 * @param {Function} config.handle
 *   async function handle(ctx, { task, step })
 *
 * @param {Function} [config.onError]
 *   async function onError(err, ctx, { task, step })
 */
export function defineHandler(config) {
  const { name, task: taskConfig, handle, onError } = config || {};

  if (!name || typeof name !== "string") {
    throw new Error("defineHandler: 'name' (string) is required");
  }
  if (typeof handle !== "function") {
    throw new Error("defineHandler: 'handle' function is required");
  }

  const hasTask = !!taskConfig;
  if (hasTask) {
    if (!taskConfig.taskType) {
      throw new Error("defineHandler: task.taskType is required when 'task' is defined");
    }
    if (!taskConfig.workerHandlerName) {
      throw new Error("defineHandler: task.workerHandlerName is required when 'task' is defined");
    }
  }

  async function run(msg, runtimeOptions = {}) {
    const ctx = createHandlerContext({ msg, ...runtimeOptions });

    let task = null;
    let step = null;

    if (hasTask) {
      const stepName = taskConfig.stepName || msg.intent || "HANDLE_MESSAGE";

      task = await ctx.startTask({
        taskType: taskConfig.taskType,
        workerHandlerName: taskConfig.workerHandlerName,
        sourceEntityId: null,
        sourceEntityType: null,
        idempotencyHash: null,
        channel: msg.channel || null,
        rootCorrelationId: ctx.correlationId,
        priority: 0,
        markStarted: true,
      });

      step = await ctx.startStep(task, {
        name: stepName,
        indexInTask: 0,
        inputHash: null,
      });
    }

    const lifecycle = { task, step };

    try {
      await ctx.log("received", "in", { payload: msg.payload });

      const result = await handle(ctx, lifecycle);

      const autoComplete = hasTask ? taskConfig.autoComplete !== false : false;
      if (hasTask && autoComplete) {
        await ctx.completeTask(task, step);
      }

      return result;
    } catch (err) {
      if (hasTask) {
        await ctx.failTask(task, step, err);
      } else {
        await ctx.log("error", "internal", {
          error: err && err.message ? err.message : String(err),
        });
      }

      if (typeof onError === "function") {
        return await onError(err, ctx, lifecycle);
      }

      throw err;
    }
  }

  return { name, run };
}

/**
 * Define a simple service-like handler (no task/step orchestration).
 *
 * @param {Object} config
 * @param {string} config.name
 * @param {Function} config.handle
 *   async function handle(ctx)
 * @param {Function} [config.onError]
 */
export function defineServiceHandler(config) {
  const { name, handle, onError } = config || {};

  if (!name) {
    throw new Error("defineServiceHandler: 'name' is required");
  }
  if (typeof handle !== "function") {
    throw new Error("defineServiceHandler: 'handle' must be a function");
  }

  async function run(msg, runtimeOptions = {}) {
    const ctx = createHandlerContext({ msg, ...runtimeOptions });

    try {
      await ctx.log("received", "in", { payload: msg.payload });

      const result = await handle(ctx);
      return result;
    } catch (err) {
      await ctx.log("error", "internal", {
        error: err.message || String(err),
      });

      if (typeof onError === "function") {
        return await onError(err, ctx);
      }

      throw err;
    }
  }

  return { name, run };
}
