// src/index.ts
// Abstract interface for the COP core.

export type EventType = string & {};

// ----
// Event : tout ce qui "arrive" dans un Topic.
// Immuable, ordonné logiquement par topicSeq.
//

export interface Event {

  id: string;
  topicId: string;

  // Type sémantique (profil-dépendant).
  type: EventType;

  // Ordre logique strict à l'intérieur d'un Topic (pour replay/projections).
  topicSeq: number;

  // Version de schéma de l'event/payload.
  schemaVersion: string; // ex: "cop.event.v0.2"

  // Tracing / causalité (optionnel).
  correlationId?: string;
  parentEventIds?: string[];

  createdAt: string; // ISO 8601

  // Contenu profil-dépendant.
  payload: unknown;

  // Métadonnées opaques pour le core.
  metadata?: Record<string, unknown>;
}


// ----
// Topic : un flux d'événements sur un sujet (profil-dépendant).
//

export type TopicStatus = "open" | "in_progress" | "exhausted" | "closed";

export interface Topic {
  id: string;
  status: TopicStatus;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}


// ----
// Task : une tâche sur un sujet (profil-dépendant).
//

export type TaskStatus = "pending" | "running" | "needs_input" | "done" | "failed" | "cancelled";

export interface Task {
  id: string;
  topicId: string;
  type: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  lastEventAt?: string;
  metadata?: Record<string, unknown>;
}


// ----
// Step : une étape dans la vie d'une Task.
// Références vers des Artifacts, pas de données brutes.
//

export type StepStatus = "pending" | "running" | "done" | "skipped" | "failed";

export interface Step {
  id: string;
  taskId: string;
  name: string;
  status: StepStatus;
  inputArtifactIds?: string[];
  outputArtifactIds?: string[];
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

// ----
// Artifact : état durable, immuable.
//

export interface Artifact {
  id: string;
  topicId: string;
  sourceTaskId?: string;
  sourceStepId?: string;
  type: string; // sémantique
  format: string; // MIME-like
  schemaVersion: string; // ex: "cop.artifact.v0.2"
  payload: unknown; // valeur directe ou référence
  createdAt: string;
  metadata?: Record<string, unknown>;
}


// ----
// Minimal persistence interfaces for topics, tasks, steps, artifacts.
// This is a projection API over the immutable Event + Artifact log.
//

export interface COPStore {

  // Topics
  getTopic(id: string): Promise<Topic | null>;
  saveTopic(topic: Topic): Promise<void>;

  // Tasks

  /**
   * Get a single task by id.
   */
  getTask(id: string): Promise<Task | null>;

  /**
   * Save/update a task projection.
   */
  saveTask(task: Task): Promise<void>;

  /**
   * List tasks, optionally filtered by status.
   * NOTE: generic listing, not scoped by topic.
   */
  listTasks(params: { status?: TaskStatus[]; limit?: number }): Promise<Task[]>;

  /**
   * List tasks belonging to a given topic, optionally filtered by status.
   */
  listTasksByTopic(params: {
    topicId: string;
    status?: TaskStatus[];
    limit?: number;
  }): Promise<Task[]>;

  // Steps

  /**
   * List all steps for a given task.
   */
  getSteps(taskId: string): Promise<Step[]>;

  /**
   * Save/update a step projection.
   */
  saveStep(step: Step): Promise<void>;

  // Artifacts

  /**
   * Save a new artifact projection.
   * Artifacts are immutable; "update" means adding a new artifact, not mutating.
   */
  saveArtifact(artifact: Artifact): Promise<void>;

  /**
   * Get a single artifact by id.
   */
  getArtifact(id: string): Promise<Artifact | null>;

  /**
   * List artifacts for a topic, optionally filtered by type.
   */
  listArtifacts(params: { topicId: string; type?: string; limit?: number }): Promise<Artifact[]>;
}


// ----
// runtime/agent.ts

/** Context passed to agents with minimal utilities. */
export interface AgentContext {
  bus: COPBus;
  store: COPStore;
  now(): string; // ISO date

  /**
   * Convenience helper to publish an event through the bus.
   * The event MUST already respect COP core invariants (topicSeq, schemaVersion, etc.).
   *
   * Implementations of AgentContext are free to enrich this behaviour,
   * but MUST at least ensure that calling emit(event) results in that
   * event being published on the COPBus.
   */
  emit(event: Event): Promise<void>;
}

/** Minimal agent interface. */
export interface COPAgent {
  readonly name: string;

  /**
   * Core reaction to events.
   */
  onEvent(event: Event, ctx: AgentContext): Promise<void>;

  /**
   * Optional periodic supervision / background work.
   */
  onTick?(ctx: AgentContext): Promise<void>;
}


// -----
// runtime/bus.ts

/**
 * Abstraction of event bus used by COP core.
 *
 * Implementations MAY be backed by Kafka, NATS, Redis Streams,
 * a SQL table, or a simple in-memory queue.
 */

export interface COPBus {
  /**
   * Publish a new event to the bus.
   * The event MUST already respect COP core invariants (topicSeq, schemaVersion, etc.).
   */
  publish(event: Event): Promise<void>;

  /**
   * Fetch events for a topic since a given wall-clock time.
   * Convenience API, not guaranteed to be perfectly aligned with topicSeq.
   */
  fetchSince(params: {
    topicId: string;
    since?: string; // ISO 8601
    limit?: number;
  }): Promise<Event[]>;

  /**
   * Fetch events for a topic starting from a given topicSeq.
   *
   * Semantics:
   * - MUST return all events with event.topicId === topicId
   * - and event.topicSeq >= fromSeq
   * - ordered by topicSeq ascending
   * - up to `limit` events if provided.
   *
   * This is the canonical API for replay / projections.
   */
  fetchFromSeq(params: { topicId: string; fromSeq: number; limit?: number }): Promise<Event[]>;

  /**
   * Optional real-time subscription API.
   * Implementations MAY not support it.
   */
  subscribe?: (params: { topicId: string }, onEvent: (event: Event) => void) => () => void;
}


// src/cop/runtime/scheduler.ts

export interface SchedulerOptions {

  agents: COPAgent[];
  bus: COPBus;
  store: COPStore;

  /**
   * Minimal desired interval between two tick cycles, in milliseconds.
   * Implementations MAY choose how strictly they respect this.
   */
  pollIntervalMs?: number;
}

/**
 * COPScheduler is a pure interface describing how a scheduler
 * orchestrates ticks and event dispatch.
 *
 * Implementations MAY:
 * - use setInterval, cron, Temporal.io, etc. for ticks,
 * - poll the bus or use subscribe() for events,
 * but these details stay outside the spec.
 */

export interface COPScheduler {
  /**
   * Start periodic ticks (onTick) for all registered agents.
   */
  start(): void | Promise<void>;

  /**
   * Stop periodic ticks.
   */
  stop(): void | Promise<void>;

  /**
   * Dispatch a single event to all agents' onEvent handlers,
   * using a shared AgentContext.
   *
   * This is meant to be called by whatever component reads from the COPBus
   * (polling, subscribe, etc.).
   */
  dispatchEvent(event: Event): Promise<void>;

  /**
   * Optional: expose the AgentContext used internally by the scheduler,
   * for implementations that need to share it.
   *
   * Implementations MAY choose to return a new context on each call,
   * or a stable shared context.
   */
  getContext?(): AgentContext;
}
