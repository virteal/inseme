/**
 * COP Core - Cognitive Orchestration Protocol
 * Reference TypeScript Definitions
 *
 * Based on Architecture.md and Invariants.md
 */

// ----------------------------------------------------------------------
// 1. Primitive Types & Enums
// ----------------------------------------------------------------------

/**
 * Globally unique identifier (UUID v4 recommended).
 */
export type UUID = string;

/**
 * ISO-8601 Timestamp (UTC).
 * Example: "2025-12-31T23:59:59Z"
 */
export type ISODateTime = string;

/**
 * Opaque string for Event/Artifact types.
 * Often namespaced, e.g. "cop/continuation", "chat/message".
 */
export type TypeString = string;

/**
 * Strict JSON Value model.
 * Implementations MUST NOT rely on non-JSON types.
 */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue | undefined };

/**
 * Standard status lifecycle for Topics.
 */
export type TopicStatus = "open" | "in_progress" | "exhausted" | "closed";

/**
 * Standard status lifecycle for Tasks.
 */
export type TaskStatus = "pending" | "running" | "needs_input" | "done" | "failed" | "cancelled";

/**
 * Standard status lifecycle for Steps.
 */
export type StepStatus = "pending" | "running" | "done" | "skipped" | "failed";

// ----------------------------------------------------------------------
// 2. Core Data Model (Immutable)
// ----------------------------------------------------------------------

/**
 * Event: The fundamental unit of change in COP.
 * Events are the only mutable input to the system (append-only).
 * All other structures are derived from Events.
 */
export interface COPEvent {
  /** Globally unique identifier. */
  id: UUID;

  /** Topic this event belongs to. */
  topicId: UUID;

  /**
   * Strict monotonic sequence number within the Topic.
   * Defines the total order of Events in that Topic.
   */
  topicSeq: number;

  /** Semantic type of the event. */
  type: TypeString;

  /** Version identifier for the payload schema (e.g. "1.0"). */
  schemaVersion: string;

  /** When the event became durable. */
  createdAt: ISODateTime;

  /** domain-specific data. */
  payload: JsonValue;

  /** Auxiliary metadata (tracing, user-agent, etc). */
  metadata?: Record<string, JsonValue>;

  /** Optional correlation ID to link events across topics. */
  correlationId?: string;

  /** Explicit causal dependencies (parent event IDs). */
  parentEventIds?: UUID[];
}

/**
 * Artifact: Immutable data produced or consumed within a Topic.
 * e.g. messages, documents, tool results, continuations.
 */
export interface COPArtifact<P extends JsonValue = JsonValue> {
  id: UUID;
  topicId: UUID;

  /** Semantic type (e.g. "text/markdown", "cop/continuation"). */
  type: TypeString;

  /** Optional MIME-like descriptor. */
  format?: string;

  /** Immutable content. */
  payload: P;

  /** Auxiliary metadata. */
  metadata?: Record<string, JsonValue>;

  createdAt: ISODateTime; // Timestamp is useful for derived ordering
}

// ----------------------------------------------------------------------
// 3. Projections (Derived State)
// ----------------------------------------------------------------------

/**
 * Topic: Groups a sequence of Events into a coherent process.
 * Derived from the Event log.
 */
export interface COPTopic {
  id: UUID;
  status: TopicStatus;

  /** Computed from aggregation of events. */
  title?: string;

  created_at: ISODateTime; // Often derived from the first event
  updated_at: ISODateTime; // derived from last event

  metadata?: Record<string, JsonValue>;
}

/**
 * Task: A unit of work within a Topic.
 * Derived from Events.
 */
export interface COPTask {
  id: UUID;
  topicId: UUID;

  /** Hierarchical relationship. */
  parentTaskId?: UUID;

  /** Optional durable mandate-bearing continuity responsible for the work. */
  assignedLogicalAgentRef?: string;

  /** Optional handler profile expected to execute the work. */
  assignedHandlerProfile?: string;

  status: TaskStatus;
  title?: string;

  created_at: ISODateTime;
  updated_at: ISODateTime;

  metadata?: Record<string, JsonValue>;
}

/**
 * Step: A finer-grained subunit inside a Task.
 * Derived from Events.
 */
export interface COPStep {
  id: UUID;
  topicId: UUID;
  taskId: UUID;

  status: StepStatus;

  /** Artifacts produced or consumed by this step. */
  artifactIds?: UUID[];

  created_at: ISODateTime;
  updated_at: ISODateTime;

  metadata?: Record<string, JsonValue>;
}

// ----------------------------------------------------------------------
// 4. Continuations
// ----------------------------------------------------------------------

/**
 * Reserved type for Continuation artifacts.
 */
export const ARTIFACT_TYPE_CONTINUATION = "cop/continuation";

/**
 * Reserved wildcard value for a capability-bound Continuation.
 * Means "any compliant Handler whose offered capabilities match may resume".
 */
export const CONTINUATION_HANDLER_PROFILE_ANY = "*";

/**
 * Standard payload for a Continuation Artifact.
 * Represents suspended or deferred work.
 *
 * A Continuation is capability-bound by default. A logical-agent reference is
 * optional and records an explicit identity-bound return or resumption policy;
 * it does not identify the concrete HandlerInstance that will execute work.
 */
export type ContinuationPayload = {
  /**
   * Optional stable handler profile requested for resumption.
   * The reserved "*" value means any compatible Handler profile.
   */
  handlerProfile?: string;

  /** Capabilities required to resume the work. */
  requiredCapabilities?: string[];

  /**
   * Optional durable mandate-bearing identity for identity-bound resumption.
   * This MUST NOT be used as a substitute for a HandlerInstance record.
   */
  logicalAgentRef?: string;

  /** Context identifiers. */
  topicId: UUID;
  taskId?: UUID;
  stepId?: UUID;

  /** Opaque, externally durable state needed for correct resumption. */
  state: JsonValue;

  /** Resume conditions. */
  waitForEvents?: string[]; // Event types or IDs
  resumeAfter?: ISODateTime;
  resumeBefore?: ISODateTime;

  /** Retry policy. */
  retry?: {
    maxAttempts: number;
    attempt: number;
    retryDelayMs: number;
  };

  /** Causal Trace reference (Trace-centric COP 2.x, Issue #61). */
  traceRef?: string | string[];

  /** Authority / Mandate reference under which this continuation operates (Issue #68). */
  mandateRef?: string;

  label?: string;
  meta?: Record<string, JsonValue>;

  /** Allow arbitrary extra fields for specific profiles. */
  [key: string]: JsonValue | undefined;
};

/**
 * Type guard for Continuation Artifacts.
 */
export interface COPContinuation extends COPArtifact<ContinuationPayload> {
  type: "cop/continuation";
}

/**
 * Reserved Artifact type for packet forks (Issue #68, R2).
 */
export const ARTIFACT_TYPE_FORK = "cop/fork";

/**
 * Standard payload for a Fork Artifact.
 * Represents a branched exploration or split execution under a shared authority envelope.
 */
export type ForkPayload = {
  /** Parent packet or continuation being forked. */
  forkSourcePacketId: UUID;

  /** Stable branch identifier. */
  branchId: string;

  /** Causal trace reference leading to this fork point (COP 2.x). */
  traceRef?: string | string[];

  /**
   * Authority / Mandate reference.
   * Under the Consequential Rossignol invariant (Issue #68, R2), forking a packet
   * cannot recreate consumed budget or escape authority limits.
   */
  mandateRef: string;

  /** Context identifiers. */
  topicId: UUID;
  taskId?: UUID;
  stepId?: UUID;

  /** Target handler profile or requested capabilities for this branch. */
  handlerProfile?: string;
  requiredCapabilities?: string[];

  /** State partitioned or specialized for this branch. */
  state: JsonValue;

  label?: string;
  meta?: Record<string, JsonValue>;

  /** Allow arbitrary extra fields for specific profiles. */
  [key: string]: JsonValue | undefined;
};

/**
 * Type guard for Fork Artifacts.
 */
export interface COPFork extends COPArtifact<ForkPayload> {
  type: "cop/fork";
}

// ----------------------------------------------------------------------
// 5. Runtime Interfaces
// ----------------------------------------------------------------------

/**
 * Minimal Handler interface.
 * A Handler is a stateless, idempotent executor; it does not itself establish
 * mandate authority. Concrete executions are recorded as HandlerInstances by
 * profiles or runtimes when accountability requires it.
 */
export interface COPHandler {
  readonly profile: string;

  /** Core reaction to events. */
  onEvent(event: COPEvent, ctx: HandlerContext): Promise<void>;

  /** Optional periodic supervision. */
  onTick?(ctx: HandlerContext): Promise<void>;
}

/**
 * Context passed to handlers during execution.
 */
export interface HandlerContext {
  bus: COPBus;
  store: COPStore;

  /** Current wall-clock time (ISO). */
  now(): ISODateTime;

  /**
   * Publish an event.
   * The implementation MUST ensure strict topicSeq ordering constraints.
   */
  emit(event: COPEvent): Promise<void>;
}

/**
 * Abstraction of the Event Bus.
 */
export interface COPBus {
  publish(event: COPEvent): Promise<void>;

  /** Fetch events for replay. */
  fetchFromSeq(params: { topicId: UUID; fromSeq: number; limit?: number }): Promise<COPEvent[]>;
}

/**
 * Projection Store interface.
 */
export interface COPStore {
  // Topics
  getTopic(id: UUID): Promise<COPTopic | null>;
  saveTopic(topic: COPTopic): Promise<void>;

  // Tasks
  getTask(id: UUID): Promise<COPTask | null>;
  saveTask(task: COPTask): Promise<void>;
  listTasksByTopic(params: { topicId: UUID; status?: TaskStatus[] }): Promise<COPTask[]>;

  // Steps
  getSteps(taskId: UUID): Promise<COPStep[]>;
  saveStep(step: COPStep): Promise<void>;

  // Artifacts
  getArtifact(id: UUID): Promise<COPArtifact | null>;
  saveArtifact(artifact: COPArtifact): Promise<void>;
  listArtifacts(params: { topicId: UUID; type?: string }): Promise<COPArtifact[]>;
}
