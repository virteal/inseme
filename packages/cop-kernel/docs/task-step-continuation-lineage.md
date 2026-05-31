# Task / Step / Continuation Lineage in COP

**Date:** 2026-05-31 **Context:** Work toward first stable COP implementation before integration
into apps/platform and briques. **Related:** l8 (historical), Inox (future runtime), COP
Architecture.md, cop-kernel implementation, bac-à-sable validation, supabase schema.

## Historical Precedent: l8

l8 (https://github.com/JeanHuguesRobert/l8, ~2016 era) provided a JS-native model for asynchronous
control flow that feels very close to COP's ambitions:

- **Task**: An activity that a normal JS function cannot do because JS functions cannot block. A
  Task is composed of **Steps**.
- Functions are broken into steps executed by the l8 scheduler.
- Steps are closures. Execution moves step to step. If a step cannot proceed immediately, the task
  "blocks" (cooperatively) waiting for something (promise, callback, signal, etc.) before resuming.
- Tasks are also Promises.
- Rich control: .step, .task, .fork, .repeat, .spawn, .generate, .pause/.resume, synchronization
  primitives (semaphores, mutexes, queues, signals, timeouts, generators).
- Message-passing / actor flavor in later parts.
- Goal: Make async JS feel more like readable blocking/threaded code while staying in the JS event
  loop model.

l8 Tasks/Steps were a pragmatic solution to "callback hell" and complex async flows in real
applications (notably Kudocracy, liquid democracy).

## Current COP Model (from Architecture.md)

COP generalizes and distributes this idea across agents, time, and systems:

- **Event** is the only source of truth (immutable log).
- **Topic**: Long-lived scope of activity (a deliberation, a case, a project, a regulatory file...).
- **Task**: Unit of work within a Topic. Has status, attempts, leasing (for distributed workers),
  meta.
- **Step**: Finer-grained subunit inside a Task. Has name, input, output, status. Linked to
  Artifacts.
- **Artifact**: Immutable durable output (documents, decisions, models...). Continuations are a
  reserved subtype.
- **Continuation** (Artifact type "cop/continuation"):

## Broader Architectural Influences

The Task/Step/Continuation model in COP is not an isolated invention. It sits at the intersection of
several deep influences in the author's thinking, which consistently emphasize **resilience through
discretization, distribution, redundancy, and actor-like autonomy without a capturable center**.

### Actor-Oriented Programming and Erlang

- **Core idea**: Computation as independent actors that communicate exclusively via asynchronous
  message passing. No shared mutable state. Actors can be supervised; failure in one does not
  cascade if the supervisor can restart or reroute work.
- **Erlang realization**: Lightweight processes, "let it crash" philosophy, supervision trees, hot
  code loading, distribution transparency.
- **Mapping to COP**:
  - COP **Agents** (human or machine) are actors.
  - **COPBus** is the mailbox + transport (message passing).
  - **Tasks and Steps** are units of work assigned to actors.
  - **Continuations** are the portable, resumable "process state" that can be moved between
    actors/nodes.
  - **Scheduler / JobScheduler + obsolescence / retry** act as the supervision layer: they decide
    when to resume, retry with backoff, or declare a line of work obsolete (equivalent to
    terminating a misbehaving process and letting higher-level logic decide the next action).
  - The requirement that agents be stateless between invocations and idempotent w.r.t. Events
    directly echoes Erlang actor purity and at-least-once messaging.

This influence explains why COP treats failure and resumption as first-class, observable phenomena
rather than exceptions to be hidden.

### ARPANET, Packet Switching, and Mesh Networks

- **ARPANET insight** (Paul Baran et al.): Survivable communication does not require dedicated
  end-to-end circuits. Break information into discrete, addressed, routable packets that can take
  multiple paths and be reassembled. The network continues functioning even when individual links or
  nodes fail.
- **Mesh networks**: Decentralized, self-organizing connectivity with no privileged central routers.
  Routing happens locally; redundancy is structural.
- **Mapping to COP**:
  - **Events** are the packets (immutable, addressed, causally ordered via topicSeq /
    parentEventIds).
  - **Topics** are like flows or sessions.
  - **Tasks / Steps / Continuations** are the "payload work units" that can be routed,
    stored-and-forwarded, and resumed on whichever actor/node in the mesh is currently available and
    capable.
  - The Scheduler acts as a decentralized router + supervisor that chooses resumption paths based on
    events, time, and policy (including RAIX redundancy considerations).
  - Degraded-mode and partition tolerance (DTN influence) are explicit design conditions, not
    afterthoughts — see the "avian SD card" extreme case in the Inference Packet Networks paper.
  - No single point of control or failure for a Topic's ongoing work.

This is why COP insists that all state (Tasks, Steps, Continuations, Artifacts) must be
reconstructible from the Event log alone.

### RAID Generalized to RAIX

- **Classic RAID**: Redundancy across multiple inexpensive, independent disks so that failure of any
  one does not lose data. The array as a whole is more reliable than its parts.
- **RAIX generalization** (prominent in FractaVolta and related writings): Apply the same principle
  not just to storage but to any critical resource in the stack — compute nodes, energy sources
  (exergy packets), model versions, execution environments, human/AI agent capacity, network paths,
  legal jurisdictions, etc.
- **"X" can be anything whose failure would otherwise create a single point of capture or
  fragility.**
- **Mapping to COP**:
  - A **Task** or **Continuation** can be redundantly scheduled or resumed across multiple
    independent "X" elements in the RAIX array.
  - If one node/energy source/agent fails or is constrained, the Continuation (with its state +
    resumption conditions) can be picked up by another independent element without loss of progress
    or audit trail.
  - The **JobScheduler**'s exponential backoff + explicit obsolescence support, combined with the
    low-level Scheduler's time- and event-based resumption, provide the mechanisms for this
    redundancy at the cognitive layer.
  - This directly supports the goals in _Inference Packet Networks_ (IPN): bounded continuity of
    useful inference when hyperscale/central systems are unavailable, overloaded, legally blocked,
    or energetically constrained.
  - The entire point of strong causality, provenance, and replayability in COP is to make RAIX-style
    redundancy effective for _reasoning and decision processes_, not just data or energy.

The combination produces the characteristic COP posture:

- Discretize work into Events, Tasks, Steps, Continuations (packets).
- Route and resume them across a mesh of redundant, independent actors/nodes/energy sources (RAIX +
  ARPANET/mesh).
- Treat actors as autonomous and fallible (Actor model + Erlang supervision), with observable
  failure and explicit resumption/obsolescence paths.
- Make everything auditable and reconstructible from the log.

This is the same architectural answer the corpus gives at every scale: from language (Inox
control/data separation + actors), through network (patent + EPN/IPN), territory, individual
(Cogentia), governance (DHITL), to the cognitive orchestration layer (COP itself).

## Implications for Implementation and Validation

When working on Task/Step/Continuation in the kernel and bac-à-sable:

- Prioritize mechanisms that enable **routing + resumption across independent redundant elements**
  (not just single-node efficiency).
- Make failure, delay, partition, and obsolescence first-class and observable (Erlang "let it
  crash" + ARPANET degraded paths).
- Ensure the model composes cleanly with the packetized layers below it (EPN for energy, IPN for
  inference workloads).
- Design the surface so that future Inox-based edge nodes can act as first-class actors in the RAIX
  mesh without a central coordinator.

### Recent Enhancement (May 2026)

**Bus evolution toward Fractanet**

- `bus.js` now supports:
  - `bus.sub(namespace)` and the convenient `bus.forTopic(topicId)` → hierarchical per-Topic
    sub-buses (core request).
  - Federation primitives (`federate(peer)`, `declareInterest(pattern)`, `receiveFromFederation`).
  - `createFractanetBus(name)` factory.
- `COPScheduler` now has `getBusForTopic(topicId)` and automatically prefers per-topic sub-buses for
  registration and resumption events.
- Generalized SubBus subscription scheme (scoped listeners + clean type delivery on sub-buses).
- Task/Step helpers now route events through topic sub-buses when context is available.
- `COPJobScheduler` generalized to use per-topic sub-buses (via scheduler or direct `forTopic`).
- `SubBus` subscribe scheme significantly improved for proper scoping and clean event delivery.
- Added `propagateInterest()` for basic subscription propagation across federated buses.
- bac-à-sable pipeline now offers `busForCurrentTopic()` (auto-scoped when `context.currentTopicId`
  is set) + `propagateInterest`.
- The `research-review` scenario demonstrates the full generalized per-topic sub-bus + subscribe
  pattern.
- New dedicated `federation-demo` scenario added (and iteratively improved) to demonstrate real
  cross-bus continuation registration and event-triggered resumption using separate schedulers +
  federated topic sub-buses.
- Pipeline enriched with `createFederatedBusPair()`, `federateBuses()`, `propagateInterest()`, and
  improved `busForCurrentTopic()` helpers.

Combined with the Task/Step/Continuation generic helpers (`createTaskWithInitialContinuation`, event
emission on the bus, etc.), we now have the foundation for decentralized, observable, RAIX-resilient
orchestration at the kernel level — instead of duplicating it in every application.

These changes were exercised and validated in the bac-à-sable.

See also the updated comments in `continuation.js`, `jobScheduler.js`, and `index.js`.

See also the sibling documents in this directory and the canonical Fractanet paper in the
FractaVolta repository:

`https://github.com/JeanHuguesRobert/FractaVolta/blob/main/research/fractanet.md`

- Suspends reasoning/work.
- Payload includes: resumeTo (agent), resumeIntent, state, taskId/stepId references, conditions
  (waitForEvents, resumeAfter, resumeBefore), retry policy, causality (correlationId,
  parentEventIds).
- Original Continuation is never mutated; resumption produces new Events/Artifacts/Continuations.
- **Scheduler**: Reacts to Events and time (ticks, resumeAfter) to decide when to resume
  Continuations. Publishes resumption messages. Supports retries and obsolescence.
- All of Tasks/Steps/Artifacts/Continuations are **projections** reconstructible by replaying the
  Event log + Store.

Key invariants (from spec):

- At-least-once delivery + idempotency.
- Per-Topic ordering (topicSeq).
- Strong causality and auditability.
- Human and machine agents treated uniformly (DHITL).
- Obsolescence explicitly supported (especially useful for AI agents deciding a line of inquiry is
  no longer relevant).

## Future Substrate: Inox

Inox (https://github.com/virteal/Inox) is designed as the efficient, portable runtime for exactly
this kind of agentic, distributed, traceable computation:

- Concatenative stack VM (Forth lineage + Smalltalk messaging + Erlang actors).
- **Strict control plane / data plane separation** — data lives on stacks longer; state machines
  expressed natively. This maps beautifully to COP's "don't mutate the Continuation, emit new
  Events/Artifacts" rule.
- Named values on stacks (tag-based access instead of positional).
- Actors with multiple stacks/addresses (natural mailboxes for different concerns: data, control,
  resumption conditions).
- Reactive sets for dataflow.
- Will descend from JS/TS → WASM → C/C++ → bare metal (ESP32 etc.).
- Goal: uncapturable computational nodes that can host COP agents with the same semantics and
  traceability from cloud down to tiny edge devices.

Inox's control structures (loops, conditionals via verbs on stacks, actors) and actor model are
natural vehicles for implementing COP Schedulers, Task/Step executors, and Continuation resumption
with low overhead and excellent observability.

## Practical Usage Implications (for apps/platform and briques)

From schema, bac-à-sable scenarios, and stated priorities:

- Long-running civic, legal, research, and regulatory processes (months/years, multiple human + AI
  participants, many natural suspension points).
- Distributed work with leasing (platform as the engine scheduling work across
  instances/briques/agents).
- Rich resumption conditions mixing events, time, external signals, and agent decisions (including
  obsolescence).
- Strong requirement for replay/audit (every decision, every artifact, every resumption must be
  explainable and reconstructible).
- Briques participate by emitting Events, producing Artifacts (including Continuations), and
  handling Steps (via tools, Prolog, LLM agents, human UI flows).

## Current Gaps / Work Items in cop-kernel

- JobScheduler is a good start for higher-level scheduling with backoff + obsolescence but lacks
  persistence (the `store` param is declared but unused).
- Task/Step lifecycle is mostly implicit in the schema and continuation descriptors (taskId/stepId
  fields exist); we need clearer helpers for creating/updating Tasks and Steps as first-class
  projections driven by Events.
- Better integration between low-level Continuation resumption and higher-level Job/Task concepts.
- Observability: rich traces that include Task/Step/Continuation transitions (the bac-à-sable is
  already generating these; we can feed them back into the kernel).
- Alignment tests against the spec (especially §5.5 resumption semantics and the requirement that
  everything is replayable from Events).

## Recommended Next Steps

1. Flesh out explicit `createTask`, `createStep`, `updateTaskStatus` etc. helpers in the kernel,
   driven by Events.
2. Wire COPJobScheduler to use a real Store (start with inMemory, then one of the existing
   sqlite/supabase backends).
3. Enhance the bac-à-sable scenarios (especially machine-a-explorer-gabarit-abstrait and regulation
   workflow) to explicitly create and manage Tasks/Steps/Continuations using the kernel primitives.
4. Add conformance-style tests that replay event logs and verify Task/Step/Continuation projections.
5. Document the mapping in this file and cross-link from Architecture.md, l8 wiki/history, and Inox
   spec.
6. When stable, provide a clean integration surface for apps/platform (e.g., a "PlatformCOP" host
   that wires the kernel to the multi-instance Supabase setup and brique registry).

This lineage (l8 practicality → COP distributed auditability → Inox efficient execution) is one of
the strongest threads in the corpus. Getting Task/Step/Continuation right is central to making the
whole thing work without a capturable center.

_Generated during resumption of COP stabilization work, 2026-05-31._
