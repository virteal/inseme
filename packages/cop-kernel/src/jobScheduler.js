/**
 * jobScheduler.js
 *
 * Higher-level "Job Scheduler" for COP, inspired by cron (Unix) / Task Scheduler (Windows)
 * and building on the Task/Step model.
 *
 * Lineage:
 * - Draws from l8's Task/Step scheduler (cooperating steps, resumption, synchronization).
 * - Designed to be implementable efficiently in Inox (concatenative actors with control/data separation).
 *
 * Purpose:
 * - Provide reliable, persistent scheduling of continuations and tasks.
 * - Native support for exponential backoff on retries.
 * - First-class support for obsolescence (decided by agents, especially AI agents).
 * - Survives restarts when backed by persistent storage.
 *
 * This sits on top of COPScheduler (low-level event/time reactor) and the Store.
 * It bridges the low-level Continuation primitives to higher-level "jobs" that applications
 * (starting with apps/platform) and briques will use for long-running, resumable work.
 *
 * This is still early / operational prototype — feedback welcome.
 *
 * See COP Architecture.md §2.4 (Task), §2.5 (Step), §2.7 (Continuation), §5.5 (Execution Semantics).
 */

export class COPJobScheduler {
  constructor({ scheduler, store, bus } = {}) {
    this.scheduler = scheduler;
    this.store = store;
    this.bus = bus;
    this.jobs = new Map(); // jobId -> job definition
  }

  /**
   * Schedule a continuation (or generic job) with rich scheduling options.
   *
   * @param {Object} job
   * @param {string} job.jobId
   * @param {string} [job.type = 'continuation']
   * @param {Object} [job.continuation] - the continuation descriptor
   * @param {Object} [job.schedule]
   * @param {string} [job.schedule.type] - 'once' | 'delay' | 'cron' | 'exponentialBackoff'
   * @param {number} [job.schedule.delayMs]
   * @param {number} [job.schedule.baseDelayMs] - for exponential backoff
   * @param {number} [job.schedule.maxRetries]
   * @param {string} [job.schedule.cron] - future: cron expression
   * @param {Object} [job.obsolescence]
   * @param {boolean} [job.obsolescence.enabled = false]
   * @param {string} [job.obsolescence.policy = 'agent-decided'] - 'agent-decided' | 'maxAge' | ...
   */
  async schedule(job) {
    if (!job.jobId) throw new Error("jobId is required");

    const now = new Date().toISOString();

    const scheduledJob = {
      ...job,
      status: "scheduled",
      createdAt: now,
      nextRunAt: this._computeNextRun(job, now),
    };

    this.jobs.set(job.jobId, scheduledJob);

    // Determine topic context for per-topic sub-bus (Fractanet generalization)
    const topicId =
      job.topicId ||
      (job.continuation && (job.continuation.topicId || job.continuation.meta?.topicId)) ||
      job.meta?.topicId;

    // Use scheduler's topic-aware bus when possible (preferred for genericity)
    let effectiveBus = this.bus;
    if (this.scheduler && typeof this.scheduler.getBusForTopic === "function" && topicId) {
      effectiveBus = this.scheduler.getBusForTopic(topicId);
    } else if (this.bus && typeof this.bus.forTopic === "function" && topicId) {
      effectiveBus = this.bus.forTopic(topicId);
    }

    // If there's a nextRunAt, register with the low-level scheduler using resumeAfter
    if (scheduledJob.nextRunAt && this.scheduler) {
      const continuationLike = {
        continuationId: `job-${job.jobId}`,
        resumeTo: job.resumeTo || "*",
        topicId: topicId || undefined,
        conditions: {
          resumeAfter: scheduledJob.nextRunAt,
        },
        retry:
          job.schedule?.type === "exponentialBackoff"
            ? {
                maxAttempts: job.schedule.maxRetries || 5,
                attempt: 0,
                retryDelayMs: job.schedule.baseDelayMs || 1000,
              }
            : undefined,
        meta: { jobId: job.jobId, type: "scheduled-job", topicId },
      };

      this.scheduler.register(continuationLike);
    }

    // Emit observable event on the (possibly topic-scoped) bus
    if (effectiveBus) {
      await effectiveBus.publish({
        type: "cop.job.scheduled",
        source: "cop-job-scheduler",
        data: {
          jobId: job.jobId,
          nextRunAt: scheduledJob.nextRunAt,
          topicId: topicId || null,
        },
      });
    }

    return scheduledJob;
  }

  /**
   * Mark a scheduled job / continuation as obsolete.
   * This is the "clause d'obsolescence" — typically decided by an AI agent.
   */
  async markObsolete(jobId, reason, decidedBy = "ai-agent") {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    job.status = "obsolete";
    job.obsolescence = {
      reason,
      decidedBy,
      decidedAt: new Date().toISOString(),
    };

    if (this.scheduler) {
      // Try to cancel any pending registration
      // (in real impl we would remove from pending + cancel timeout)
    }

    if (this.bus) {
      await this.bus.publish({
        type: "cop.job.obsoleted",
        source: "cop-job-scheduler",
        data: { jobId, reason, decidedBy },
      });
    }

    return job;
  }

  _computeNextRun(job, nowIso) {
    const schedule = job.schedule || {};
    const now = new Date(nowIso);

    if (schedule.type === "delay" || schedule.type === "exponentialBackoff") {
      const base = schedule.baseDelayMs || schedule.delayMs || 1000;
      const attempt = job.attempt || 0;
      const delay = schedule.type === "exponentialBackoff" ? base * Math.pow(2, attempt) : base;

      return new Date(now.getTime() + delay).toISOString();
    }

    if (schedule.resumeAfter) {
      return schedule.resumeAfter;
    }

    // Default: immediate
    return nowIso;
  }

  // Future: support cron expressions, recurring jobs, etc.
}
