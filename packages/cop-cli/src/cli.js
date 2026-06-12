#!/usr/bin/env node
// File: packages/cop-cli/src/cli.js
// Simple CLI for COP over HTTP (Netlify Edge functions).
// Requires Node >= 18 (for global fetch).
//
// Extended with continuation-packet stdio runner ("Inversion of Control").
// Tools emit packets (JSON with "envelope") on stdout/stderr.
// cop run / cop route act as a very simple generic router/runner using
// the reusable cogentiaRoutePacket + CapabilityRegistry from cop-kernel.
// Supports data plane (normal output) vs control plane (envelope routing),
// stateless or stateful (via kernel tasks), and pipe-like directed graphs.

import {
  parsePacketFromLine,
  emitPacket,
  createStreamPacketCollector,
  attachPacketCollectorToChild,
  sendPacketToStream,
  createReadlineCogitor,
  createReadlineCopProcessor, // alias
  createContinuationInputPacket,
  createStopRequestPacket,
  createKillRequestPacket,
  createControlPacket,
  // Cogitor cooperation helpers (l8-inspired parent/child + join at Cogitor level)
  createForkedCogitorContinuation,
  createCogitorJoin,
  createForkJoinFlow,
} from "@inseme/cop-kernel";

import {
  cogentiaRoutePacket,
  CapabilityRegistry,
  createContinuationDescriptor,
} from "@inseme/cop-kernel";

const args = process.argv.slice(2);

async function main() {
  if (args.length === 0 || args[0] === "help" || args[0] === "--help") {
    printHelp();
    return;
  }

  const cmd = args[0];
  const rest = args.slice(1);

  // If no subcommand and stdin is piped (not a tty), default to acting as a compliant COP node.
  // This makes `cat packets.txt | cop` or `tool | cop | other` natural.
  if (!cmd && process.stdin && !process.stdin.isTTY) {
    await cmdNode([]);
    return;
  }

  try {
    if (cmd === "nodes") {
      await cmdNodes(rest);
    } else if (cmd === "agents") {
      await cmdAgents(rest);
    } else if (cmd === "identities") {
      await cmdIdentities(rest);
    } else if (cmd === "trace") {
      await cmdTrace(rest);
    } else if (cmd === "send-message") {
      await cmdSendMessage(rest);
    } else if (cmd === "tasks") {
      await cmdTasks(rest);
    } else if (cmd === "task") {
      await cmdTask(rest);
    } else if (cmd === "run") {
      await cmdRun(rest);
    } else if (cmd === "route") {
      await cmdRoute(rest);
    } else if (cmd === "node") {
      // "cop node" is the explicit way to run the cop CLI itself as a compliant COP node
      // (enhanced route that participates fully in data/control planes and emits its own continuations)
      await cmdNode(rest);
    } else if (cmd === "help") {
      printHelp();
    } else {
      console.error(`Commande inconnue: ${cmd}`);
      printHelp();
    }
    process.exit(0);
  } catch (err) {
    console.error("Error:", err && err.message ? err.message : String(err));
    process.exit(1);
  }
}

function printHelp() {
  const help = `
cop - COP command line interface

Usage:
  cop help
  cop nodes [--base-url URL]
  cop agents [--base-url URL]
  cop identities [--base-url URL] [--status STATUS]
  cop trace <correlation_id> [--base-url URL]
  cop send-message --from ADDR --to ADDR --intent INTENT [--payload JSON] [--channel CH] [--base-url URL]
  cop tasks [--base-url URL] [--status STATUS] [--type TYPE] [--worker NAME]
  cop task <id> [--base-url URL]

  # New: continuation-based runner (Inversion of Control over stdio)
  cop run <command> [args...] [--capability CAP] [--base-url URL]
  cop route [--capability CAP] [--stateful]
  cop node   # explicit: run *this* \`cop\` process as a compliant "COP CLI Node"
             # (data plane / control plane, emits own continuations, can be wired in graphs)
             # Also auto-activated when \`cop\` is used in a pipe with no subcommand (stdin not tty).

Base URL:
  --base-url URL       Override base URL (default: env COP_BASE_URL or http://localhost:8888)

Runner (dynamic continuation-driven, no static graph required):
  Continuations are like call/cc: a process emits a continuation packet to "capture the rest of the computation".
  The runner uses that to dynamically wire the next processor (function-style x=f(y) or stream in|proc|out).
  Graph is built on the fly from the continuations themselves.

  cop run <command> [args...] [--capability CAP]
    Launches the initial stream processor / function. Subsequent nodes are spawned on-demand
    when continuations specify resumeTo / nextCapability (optionally with spawn spec in the packet).

  cop route
    Simple filter for pipes. Still routes using the same engine.

  Protocol (data plane / control plane, natural Unix line-based):
    - Input: readline() units (LF lines) -- exactly as you described.
    - Output: LF-separated lines.
      - Non-envelope = data plane.
      - JSON with "envelope" = control plane (continuations for dynamic wiring, like call/cc).
    - Continuations also flow as *input data* (closures/callbacks): a node emits a pkt with
      envelope.resultFor / deliverTo / ... ; runner injects packetKind:'continuation-input'
      (with payload.value) into the waiting node's stdin. Receiving node treats it as
      callback(value) in its onPacket. See createContinuationInputPacket + stdio header.
    - Optional lightweight "stack" framing (normalized to stack-call packets):
      ["stack", arg1, arg2, optionalContinuation, "call"|"process"] or object form.
      The runner stores the cont (for result delivery) and feeds the stack to the target.
      Perfect for one-shot f(y) with return cont or streaming processors with per-result closures.
      See stdio.js "stack" section + createStackCallPacket / parseStackFrame.
    - \`cop\` (as node) fully participates and emits control packets for its own actions.
    - See stdio.js header for the full defined protocol (plane, packetKind, etc.).
    - Tools: createReadlineCogitor (a "Cogitor" cogitates) + emitPacket/emitJsonLine + createContinuationInputPacket + createStackCallPacket.
      (createReadlineCopProcessor is the alias.)

See the cop-kernel stdio helpers (especially createReadlineCogitor) and continuation.js.
`;
  console.log(help.trim());
}

function parseFlags(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

function getBaseUrl(flags) {
  return flags["base-url"] || process.env.COP_BASE_URL || "http://localhost:8888";
}

async function cmdNodes(argv) {
  const { flags } = parseFlags(argv);
  const baseUrl = getBaseUrl(flags);
  const url = new URL("/cop-admin-registry", baseUrl);
  url.searchParams.set("resource", "nodes");

  const res = await fetch(url.toString());
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} – ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

async function cmdAgents(argv) {
  const { flags } = parseFlags(argv);
  const baseUrl = getBaseUrl(flags);
  const url = new URL("/cop-admin-registry", baseUrl);
  url.searchParams.set("resource", "agents");

  const res = await fetch(url.toString());
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} – ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

async function cmdIdentities(argv) {
  const { flags } = parseFlags(argv);
  const baseUrl = getBaseUrl(flags);
  const status = flags["status"];

  const url = new URL("/cop-agent-identity", baseUrl);
  if (status) {
    url.searchParams.set("status", status);
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} – ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

async function cmdTrace(argv) {
  const { flags, positional } = parseFlags(argv);
  const baseUrl = getBaseUrl(flags);
  const correlationId = positional[0];
  if (!correlationId) {
    throw new Error("trace: missing correlation_id argument");
  }

  const url = new URL("/cop-admin-registry", baseUrl);
  url.searchParams.set("resource", "trace");
  url.searchParams.set("correlation_id", correlationId);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} – ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

async function cmdSendMessage(argv) {
  const { flags } = parseFlags(argv);
  const baseUrl = getBaseUrl(flags);

  const from = flags["from"];
  const to = flags["to"];
  const intent = flags["intent"];
  const payloadRaw = flags["payload"] || "{}";
  const channel = flags["channel"] || null;

  if (!from || !to || !intent) {
    throw new Error(
      "send-message: --from, --to and --intent are required (and optional --payload JSON, --channel CH)"
    );
  }

  let payload;
  try {
    payload = JSON.parse(payloadRaw);
  } catch (err) {
    throw new Error("send-message: invalid JSON for --payload: " + (err && err.message));
  }

  const url = new URL("/cop", baseUrl);
  const message = {
    cop_version: "0.2",
    message_id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    correlation_id: null,
    from,
    to,
    intent,
    payload,
    channel,
    metadata: {},
    auth: null,
  };

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} – ${txt.slice(0, 200)}`);
  }

  const data = await res.json().catch(() => null);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log("Message sent successfully (no JSON body).");
  }
}

async function cmdTasks(argv) {
  const { flags } = parseFlags(argv);
  const baseUrl = getBaseUrl(flags);
  const status = flags["status"];
  const type = flags["type"];
  const worker = flags["worker"];

  const url = new URL("/cop-admin-tasks", baseUrl);
  if (status) url.searchParams.set("status", status);
  if (type) url.searchParams.set("task_type", type);
  if (worker) url.searchParams.set("worker_agent_name", worker);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} – ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

async function cmdTask(argv) {
  const { flags, positional } = parseFlags(argv);
  const baseUrl = getBaseUrl(flags);
  const taskId = positional[0];
  if (!taskId) {
    throw new Error("task: missing <id>");
  }

  const url = new URL("/cop-admin-tasks", baseUrl);
  url.searchParams.set("id", taskId);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} – ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

// ============================================================
// NEW: Continuation-based stdio runner / router (Inversion of Control)
// ============================================================

/**
 * Local registry + handlers for the dynamic continuation runner.
 * Supports dynamic graph construction: continuations can introduce new nodes/processors on the fly.
 * No static graph needed upfront.
 */
function createLocalRunnerRegistry() {
  const registry = new CapabilityRegistry();
  const handlers = new Map();

  // Built-in handlers (control plane)
  registry.register("log", { providers: ["cop-cli"] });
  handlers.set("log", (pkt) => {
    const { message, level = "info" } = pkt.payload || {};
    const prefix = level === "error" ? "❌" : level === "warn" ? "⚠️" : "ℹ️";
    console.error(
      `${prefix} [${pkt.envelope?.source || "tool"}] ${message || JSON.stringify(pkt.payload)}`
    );
  });

  registry.register("error", { providers: ["cop-cli"] });
  handlers.set("error", (pkt) => {
    console.error("❌ [tool error]", pkt.payload || pkt);
  });

  // Self-registration as a COP CLI Node
  registry.register("cop-cli-node", { providers: ["cop"] });

  // Example transform-style handler (x = f(y) style)
  registry.register("echo", { providers: ["cop-cli"] });
  handlers.set("echo", (pkt) => {
    console.log("[echo handler] received:", pkt.payload);
    emitPacket(
      {
        envelope: { requiredCapability: "log", source: "cop-runner" },
        payload: { message: "echoed back", original: pkt },
      },
      process.stdout
    );
  });

  return { registry, handlers };
}

/**
 * Dynamic node manager: maps capabilities to running child processes (Cogitors / stream processors or function invokers).
 * Nodes are spawned on-demand when a continuation requires a resumeTo / next capability that isn't active.
 * This enables fully dynamic graph construction via emitted continuations (like call/cc wiring the "rest").
 */
class DynamicNodeManager {
  constructor(registry, handlers, baseSpawnOptions = {}, emitControl = null) {
    this.registry = registry;
    this.handlers = handlers;
    this.nodes = new Map(); // capability -> { child, capability, cmd, args }
    this.baseSpawnOptions = baseSpawnOptions;
    this.emitControl = emitControl || ((pkt) => emitPacket(pkt, process.stderr));
    // Continuations received as "input" (closures/callbacks) for result delivery.
    // Keyed by capability (or could be by correlationId for finer grain).
    // When a node produces a result, we can deliver it by resuming the continuation.
    this.pendingContinuations = new Map(); // capability -> contDesc

    // For Cogitor-level parent/child + join (l8-inspired, using the cooperation helpers)
    this.parentToChildren = new Map(); // parentCap -> Set<subCaps>
    this.joinCollectors = new Map(); // joinId -> { expected, collected: {}, finalCont, strategy }
  }

  has(capability) {
    return this.nodes.has(capability);
  }

  get(capability) {
    return this.nodes.get(capability);
  }

  /**
   * Spawn a new node for a capability if not present.
   * The continuation packet can carry spawn instructions in envelope.meta or payload.spawn
   * for fully dynamic construction (no pre-declared graph).
   */
  async spawnIfNeeded(capability, spawnSpec = null) {
    if (this.has(capability)) return this.get(capability);

    let cmd, args;
    if (spawnSpec) {
      cmd = spawnSpec.cmd || spawnSpec.command;
      args = spawnSpec.args || [];
    } else {
      // Fallback: treat capability as command name for simplicity (common in such runners)
      cmd = capability;
      args = [];
    }

    if (!cmd) {
      console.error(
        `[cop runner] Cannot spawn for capability ${capability}: no spawn spec or command`
      );
      return null;
    }

    console.error(
      `[cop runner] dynamically spawning node for ${capability}: ${cmd} ${args.join(" ")}`
    );

    // Emit control plane as a compliant COP CLI Node
    this.emitControl({
      envelope: {
        packetKind: "continuation",
        requiredCapability: "log",
        plane: "control",
        source: "cop-cli-node",
      },
      payload: {
        action: "spawn-node",
        capability,
        cmd,
        args,
      },
    });

    const { spawn } = await import("child_process");
    const child = spawn(cmd, args, {
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
      ...this.baseSpawnOptions,
    });

    const node = { child, capability, cmd, args, stdin: child.stdin };
    this.nodes.set(capability, node);

    // Register in the capability registry so the router knows about it
    this.registry.register(capability, { providers: [cmd] });

    // Attach collector to the new node so its emitted continuations are also routed
    // Packets go through the main handle (which includes explicit deliverTo/resultFor detection
    // + auto deliverResult for any node that has a pending continuation stored under its cap).
    attachPacketCollectorToChild(child, {
      onPacket: (pkt) => {
        // Re-route packets from dynamically spawned nodes back into the main router
        // This allows chains and dynamic wiring + result delivery for continuations-as-input.
        if (this.routePacket) this.routePacket(pkt);
        // Defensive direct deliver check (in case routePacket not yet wired at spawn time):
        // if this dynamic node is completing and we have a pending for it, deliver now.
        const looksComplete =
          pkt &&
          ((pkt.payload && pkt.payload.result !== undefined) ||
            pkt.packetKind === "complete" ||
            pkt.envelope?.packetKind === "complete");
        if (
          looksComplete &&
          this.pendingContinuations &&
          this.pendingContinuations.has(capability)
        ) {
          const rv = pkt.payload?.result !== undefined ? pkt.payload.result : pkt.payload;
          // fire-and-forget; the deliverResult will do the resume into the captured dest
          Promise.resolve(this.deliverResult(capability, rv)).catch(() => {});
        }
      },
      onStdoutData: (line) => process.stdout.write(line + "\n"),
      onStderrData: (line) => console.error(`[${capability} stderr] ${line}`),
    });

    child.on("exit", (code) => {
      console.error(`[cop runner] dynamic node ${capability} exited ${code}`);
      this.nodes.delete(capability);
    });

    return node;
  }

  /**
   * "Resume" or feed a continuation into a node (stream processor style: in | node | out).
   * This is the "call" part of call/cc: the continuation tells us where to continue the computation.
   * We send the packet (containing state / input / the continuation itself) to the node's stdin.
   */
  async resume(continuationPkt, targetCapability) {
    const spawnSpec = continuationPkt.envelope?.meta?.spawn || continuationPkt.payload?.spawn;
    const node =
      this.get(targetCapability) || (await this.spawnIfNeeded(targetCapability, spawnSpec));
    if (!node || !node.stdin) {
      console.error(`[cop runner] No node to resume for ${targetCapability}`);
      return;
    }

    // Store the continuation as "input" closure for later result delivery.
    // This supports the case where the continuation tells "deliver my (future) result to this destination".
    this.pendingContinuations.set(targetCapability, continuationPkt);

    // Send the continuation packet (or the input value) to the processor's "in"
    // The processor (if designed for it) can read it as next input or as a resume(cc, value)
    sendPacketToStream(node.stdin, continuationPkt);
    console.error(
      `[cop runner] resumed continuation (stored for result delivery) into ${targetCapability}`
    );
  }

  /**
   * Deliver a result from a node (sourceCapability) to the destination captured in a previously
   * stored pending continuation (the one that was fed *as input* to that node, acting as a closure).
   * This + deliverResultToTarget together implement "result of some node delivered to some destination"
   * (callback / closure application style) without pre-declared wiring.
   */
  async deliverResult(sourceCapability, result) {
    const cont = this.pendingContinuations.get(sourceCapability);
    if (!cont) return;

    console.error(
      `[cop runner] delivering result from ${sourceCapability} via pending continuation`
    );

    const joinId =
      cont.meta?.joinId || cont.envelope?.meta?.joinId || (cont.payload && cont.payload.joinId);
    if (joinId && this.joinCollectors.has(joinId)) {
      // Cogitor-level join collection (l8 parent collecting fork results)
      const coll = this.joinCollectors.get(joinId);
      coll.collected[sourceCapability] = result;
      console.error(
        `[cop runner] join collect for ${joinId}: ${Object.keys(coll.collected).length}/${coll.expected} (from ${sourceCapability})`
      );

      if (Object.keys(coll.collected).length >= coll.expected) {
        const bundle =
          coll.strategy === "all" || !coll.strategy
            ? { results: coll.collected, joinId, from: sourceCapability /* last */ }
            : coll.collected; // or first for 'any' etc.

        const dest =
          coll.finalCont?.resumeTo || coll.finalCont?.envelope?.resumeTo || sourceCapability;
        const delivery = {
          envelope: {
            ...(coll.finalCont?.envelope || {}),
            packetKind: "continuation",
            plane: "control",
            source: "cop-cli-node",
          },
          payload: {
            ...(coll.finalCont?.payload || {}),
            result: bundle,
            value: bundle,
            joinId,
            from: "cogitor-join",
          },
        };
        await this.resume(delivery, dest);
        this.joinCollectors.delete(joinId);
        // also clean parent children if tracked
        if (coll.parent && this.parentToChildren.has(coll.parent)) {
          this.parentToChildren.delete(coll.parent);
        }
      }
      this.pendingContinuations.delete(sourceCapability);
      return; // handled by join collector
    }

    // normal (single) result delivery
    const deliveryPkt = {
      envelope: {
        ...(cont.envelope || {}),
        packetKind: "continuation",
        plane: "control",
        source: "cop-cli-node",
      },
      payload: {
        ...(cont.payload || {}),
        result,
        value: result,
        from: sourceCapability,
      },
    };

    const dest = cont.envelope?.resumeTo || cont.resumeTo || sourceCapability;
    await this.resume(deliveryPkt, dest);

    this.pendingContinuations.delete(sourceCapability);

    this.emitControl({
      envelope: {
        packetKind: "continuation",
        requiredCapability: "log",
        plane: "control",
        source: "cop-cli-node",
      },
      payload: {
        action: "result-delivered-via-continuation",
        sourceCapability,
        dest,
        result,
      },
    });
  }

  // Placeholder, will be wired to the main onPacket logic
  routePacket(pkt) {
    // To be overridden or closed over in cmdRun
    console.error(
      "[cop runner] node emitted packet (routed back):",
      pkt.envelope?.requiredCapability
    );
  }

  /**
   * Core support for "continuations as input data": given a packet that carries a result
   * intended for a destination (via deliverTo / resultFor / etc.), inject a clean
   * 'continuation-input' packet (the closure call) into the target node's stdin.
   * This is how the result of some node is delivered to some (waiting) destination,
   * exactly like invoking a callback( value ) captured in the original continuation.
   */
  async deliverResultToTarget(resultPkt, explicitTarget = null) {
    const env = resultPkt.envelope || resultPkt;
    const target =
      explicitTarget ||
      env.deliverTo ||
      env.inputFor ||
      env.callWith ||
      env.resultFor ||
      env.resumeWith ||
      env.resumeTo; // fallback if the pkt itself is shaped as a cont descriptor
    if (!target) return false;

    const value = resultPkt.payload?.value ?? resultPkt.payload?.result ?? resultPkt.payload;

    // Try to find a live node for the target (by cap). If not live, we may still have a pending
    // entry that tells us the node (or we will spawn via resume later).
    let targetNode = this.get(target);
    if (!targetNode && this.pendingContinuations.has(target)) {
      // The pending was stored under the source that received the original cont; the 'resumeTo' on it may be the real waiter
      const pending = this.pendingContinuations.get(target);
      const realWaiter = pending?.envelope?.resumeTo || pending?.resumeTo;
      if (realWaiter) targetNode = this.get(realWaiter);
    }

    const inputPkt = createContinuationInputPacket(target, value, {
      correlationId: env.correlationId || resultPkt.correlationId,
      from: env.source || resultPkt.envelope?.source,
    });

    if (targetNode && targetNode.stdin) {
      sendPacketToStream(targetNode.stdin, inputPkt);
      console.error(
        `[cop runner] delivered continuation-input (closure) to ${target} (value keys: ${Object.keys(resultPkt.payload || {}).join(",") || "plain"})`
      );
      this.emitControl({
        envelope: {
          packetKind: "continuation",
          requiredCapability: "log",
          plane: "control",
          source: "cop-cli-node",
        },
        payload: {
          action: "continuation-input-delivered",
          target,
          via: "result-pkt",
          hasValue: value !== undefined,
        },
      });
      return true;
    }

    // No live node yet for the waiter: fall back to treating the inputPkt itself as the thing to "resume" into the target.
    // This will spawn if needed (using any spawn meta) and feed it.
    console.error(
      `[cop runner] no live node for target ${target} of result delivery; using resume path (may spawn)`
    );
    await this.resume(inputPkt, target);
    return true;
  }

  /**
   * Send a lifecycle control command (stop / kill) to a managed node (Cogitor).
   * This is the control-plane equivalent of Unix SIGINT (graceful) vs SIGKILL (brutal).
   *
   * - graceful: sends a 'stop' control packet (l8 "should stop" style). The receiving
   *   processor should see it (via onStop or onPacket), set its shouldStop flag,
   *   finish current work at a safe point, cleanup, and exit.
   * - !graceful: sends 'kill' + also does OS child.kill('SIGKILL') as escalation.
   *
   * The control packet is sent via the same stdin (sendPacketToStream) so it participates
   * in the normal readline / control plane of the target Cogitor.
   */
  async stopNode(capability, { graceful = true, reason = null, timeoutMs = 3000 } = {}) {
    const node = this.get(capability);
    if (!node) {
      console.error(`[cop runner] stopNode: no such node ${capability}`);
      return;
    }

    const pkt = graceful
      ? createStopRequestPacket({
          graceful: true,
          reason: reason || "runner requested graceful stop",
          target: capability,
        })
      : createKillRequestPacket({
          reason: reason || "runner requested brutal kill",
          target: capability,
        });

    console.error(`[cop runner] sending ${graceful ? "graceful stop" : "kill"} to ${capability}`);
    sendPacketToStream(node.stdin, pkt);

    // Also emit a control trace (as a compliant COP CLI Node)
    this.emitControl({
      envelope: { packetKind: "control", plane: "control", source: "cop-cli-node" },
      payload: { action: graceful ? "stop-requested" : "kill-requested", capability, reason },
    });

    if (!graceful && node.child && typeof node.child.kill === "function") {
      // Brutal escalation: also hit the OS process
      try {
        node.child.kill("SIGKILL");
      } catch {}
    }

    // For graceful, the node is expected to exit on its own after reacting to the packet.
    // Caller (or cmdRun) can wait on 'exit' if needed.
  }

  async killNode(capability, opts = {}) {
    return this.stopNode(capability, { ...opts, graceful: false });
  }

  /** List currently managed node capabilities (for shutdown, introspection, etc). */
  listNodes() {
    return Array.from(this.nodes.keys());
  }

  /**
   * Cogitor-level fork (l8 parent/child + fork style, using cooperation helpers).
   * Creates a forked cont (with parent link + optional joinId), spawns/resumes the sub Cogitor,
   * tracks the child under parent for later join.
   * Results from the sub will be auto-delivered (via existing mechanism), and if joinId present
   * will be collected.
   */
  async forkCogitor(parentCapability, subSpec = {}) {
    if (!this.get(parentCapability) && !this.nodes.has(parentCapability)) {
      console.error(`[cop runner] forkCogitor: parent ${parentCapability} not (yet) active`);
    }

    const forkCont = createForkedCogitorContinuation(parentCapability, subSpec);
    const subCap = subSpec.cap || subSpec.targetCapability || forkCont.resumeTo;

    // Track parent -> children (l8 subtasks)
    if (!this.parentToChildren.has(parentCapability)) {
      this.parentToChildren.set(parentCapability, new Set());
    }
    this.parentToChildren.get(parentCapability).add(subCap);

    // If a joinId was provided in spec, prepare collector (user can pre-create via createCogitorJoin)
    if (subSpec.joinId && !this.joinCollectors.has(subSpec.joinId)) {
      // lightweight collector; full expected comes from join spec usually
      this.joinCollectors.set(subSpec.joinId, {
        expected: subSpec.expected || 1,
        collected: {},
        finalCont: subSpec.finalCont || null,
        strategy: subSpec.strategy || "all",
      });
    }

    console.error(
      `[cop runner] forkCogitor: parent=${parentCapability} -> sub=${subCap} (joinId=${subSpec.joinId || "none"})`
    );
    await this.resume(forkCont, subCap);

    return { forkCont, subCap };
  }

  /**
   * Cogitor-level join for children of a parent (l8-style wait for forked subtasks + collect results).
   * If a pre-created joinCont from createCogitorJoin is provided, use it.
   * Otherwise creates one on the fly for the currently tracked children.
   * The join will collect results (via the enhanced deliver path) and deliver the bundle
   * to finalResumeTo (or the joinCont's resumeTo).
   */
  async joinCogitors(parentCapability, finalResumeToOrCont = null, options = {}) {
    const children = this.parentToChildren.get(parentCapability) || new Set();
    if (children.size === 0) {
      console.error(`[cop runner] joinCogitors: no tracked children for ${parentCapability}`);
      return null;
    }

    const join = createCogitorJoin(Array.from(children), finalResumeToOrCont || parentCapability, {
      strategy: options.strategy || "all",
      parent: parentCapability,
      ...options,
    });

    this.joinCollectors.set(join.joinId, {
      expected: join.expectedCount,
      collected: {},
      finalCont: join.cont,
      strategy: options.strategy || "all",
      parent: parentCapability,
    });

    console.error(
      `[cop runner] joinCogitors for parent=${parentCapability}: tracking ${join.expectedCount} children, joinId=${join.joinId}`
    );

    // Optionally send a control "prepare-join" or just rely on results flowing in.
    // When subs complete their result delivery, the deliverResult path (enhanced below) will collect.

    return join;
  }

  /**
   * High-level: fork several subs then immediately set up their join (l8 fork + join in one).
   * Uses createForkJoinFlow helper.
   */
  async forkJoinCogitors(parentCapability, subSpecs, finalResumeTo, options = {}) {
    const flow = createForkJoinFlow(parentCapability, subSpecs, finalResumeTo, options);
    this.joinCollectors.set(flow.joinId, {
      expected: flow.expectedCount,
      collected: {},
      finalCont: flow.joinCont,
      strategy: options.strategy || "all",
      parent: parentCapability,
    });

    for (const fc of flow.forkConts) {
      const subCap = fc.resumeTo || fc.envelope?.requiredCapability;
      if (subCap) {
        if (!this.parentToChildren.has(parentCapability))
          this.parentToChildren.set(parentCapability, new Set());
        this.parentToChildren.get(parentCapability).add(subCap);
        await this.resume(fc, subCap);
      }
    }
    console.error(
      `[cop runner] forkJoinCogitors: parent=${parentCapability}, ${flow.expectedCount} subs, joinId=${flow.joinId}`
    );
    return flow;
  }
}

async function cmdRun(argv) {
  const { flags, positional } = parseFlags(argv);
  if (positional.length === 0) {
    throw new Error("run: missing <command> [args...]");
  }

  const [cmd, ...cmdArgs] = positional;
  const initialCapability = flags.capability || "initial-node";
  const baseUrl = getBaseUrl(flags);

  console.error(
    `[cop run] starting dynamic continuation runner with initial node: ${cmd} ${cmdArgs.join(" ")} (capability=${initialCapability})`
  );
  console.error(
    `[cop run] graph will be built dynamically from emitted continuations (call/cc style). No upfront graph needed.`
  );

  const { registry, handlers } = createLocalRunnerRegistry();
  const nodeManager = new DynamicNodeManager(registry, handlers, {}, (pkt) =>
    emitPacket(pkt, process.stderr)
  );

  // Register and launch the initial node (stream processor or function)
  registry.register(initialCapability, { providers: [cmd] });
  const initialNode = await nodeManager.spawnIfNeeded(initialCapability, { cmd, args: cmdArgs });
  if (!initialNode) {
    throw new Error("Failed to launch initial node");
  }

  // Main packet handler - this is where the dynamic magic + routing happens
  async function handleIncomingPacket(pkt, reg, hnds, nm) {
    console.error(
      `[cop run] packet: ${pkt.envelope?.requiredCapability || pkt.packetKind} from ${pkt.envelope?.source || "unknown"}`
    );

    // As a compliant COP CLI Node, emit control plane packet for observability
    emitPacket(
      {
        envelope: {
          packetKind: "continuation",
          requiredCapability: "log",
          plane: "control",
          source: "cop-cli-node",
          correlationId: pkt.envelope?.correlationId,
        },
        payload: {
          action: "received-packet",
          from: pkt.envelope?.source,
          capability: pkt.envelope?.requiredCapability,
        },
      },
      process.stderr
    );

    // 1. Route using the reusable envelope-only policy (cogentiaRoutePacket)
    const decision = await cogentiaRoutePacket(pkt, { registry: reg });

    if (decision.action === "forwarded-to-handler" && decision.chosenCapability) {
      const localHandler = hnds.get(decision.chosenCapability);
      if (localHandler) {
        try {
          await localHandler(pkt);
        } catch (e) {
          console.error("[cop run] local handler error:", e.message);
        }
      } else {
        console.error(
          "[cop run] routed to capability with no local handler:",
          decision.chosenCapability
        );
      }
    }

    // *** Continuations as "input" data (result delivery / closures / callbacks) ***
    // If this packet carries an explicit "deliver my result to this destination",
    // the runner injects a 'continuation-input' packet into the waiting node's stdin.
    // This is the exact mechanism requested: result of some node delivered to destination
    // (like callback(value) or applying the captured closure).
    const deliverTarget =
      pkt?.envelope?.deliverTo ||
      pkt?.envelope?.inputFor ||
      pkt?.envelope?.callWith ||
      pkt?.envelope?.resultFor ||
      pkt?.envelope?.resumeWith;
    if (deliverTarget) {
      console.error(`[cop run] explicit continuation result delivery for target=${deliverTarget}`);
      const delivered = await nm.deliverResultToTarget(pkt, deliverTarget);
      // Still emit for observers / downstream in a pipe, but we have performed the input injection.
      emitPacket(pkt, process.stdout);
      return; // handled as a delivery action; further isContinuation wiring not needed for this pkt
    }

    // Support for the lightweight "stack ... [cont] verb" framing protocol.
    // After parsePacketFromLine this arrives as a normal packet with packetKind 'stack-call'.
    // The optional continuation in the frame is stored so results from the target are
    // delivered back as continuation-input (closure/callback) — exactly "continuations as input data".
    // The stack items become the arguments fed to the target (one-shot or streaming).
    const pktKind = pkt.packetKind || pkt.envelope?.packetKind;
    const isStackCall =
      pktKind === "stack-call" || pkt.envelope?.verb === "call" || pkt.envelope?.verb === "process";
    if (isStackCall) {
      const { stack = [], continuation, verb = pkt.envelope?.verb || "call" } = pkt.payload || {};
      const targetCap =
        pkt.envelope?.requiredCapability ||
        (continuation && (continuation.resumeTo || continuation.envelope?.resumeTo)) ||
        initialCapability;

      console.error(
        `[cop run] stack-call verb=${verb} target=${targetCap} stackLen=${Array.isArray(stack) ? stack.length : 1} hasCont=${!!continuation}`
      );

      if (continuation) {
        // Store the provided continuation under the target capability.
        // When the target later emits a result / complete packet, the auto logic in
        // handleIncomingPacket + deliverResult will use it to deliver the value(s)
        // via a 'continuation-input' packet to the destination indicated by resumeTo.
        // This directly implements "the optional continuation attached to the result".
        const contToStore =
          continuation && continuation.envelope
            ? continuation
            : {
                envelope: {
                  resumeTo: continuation?.resumeTo || targetCap,
                  packetKind: "continuation",
                },
                payload: continuation || {},
              };
        nm.pendingContinuations.set(targetCap, contToStore);
      }

      // Feed the stack (arguments) + verb to the target as its input.
      // The target node (or a local handler) receives this as a normal packet on its readline.
      // If the node understands stack/process it can use the stack; otherwise it just sees data.
      const inputPkt = {
        envelope: {
          requiredCapability: targetCap,
          packetKind: verb === "process" ? "process" : "call",
          plane: "control",
          source: "stack-runner",
        },
        payload: {
          stack,
          verb,
          stackCall: true,
          // The original cont is available here too if the node wants to do its own result delivery
          continuation,
        },
      };

      const spawnSpec = pkt.envelope?.meta?.spawn || pkt.payload?.spawn;
      const node = nm.get(targetCap) || (await nm.spawnIfNeeded(targetCap, spawnSpec));
      if (node && node.stdin) {
        sendPacketToStream(node.stdin, inputPkt);
      } else {
        await nm.resume(inputPkt, targetCap);
      }

      // Surface the stack-call for any downstream observers or cop route in a pipe
      emitPacket(pkt, process.stdout);

      // We handled the invocation + cont registration; skip generic continuation wiring for this pkt
      return;
    }

    // 2. Dynamic continuation handling (the core of "no pre-provided graph")
    // If this packet is (or contains) a continuation, use it to dynamically wire the next step.
    // This is the call/cc analogy: the emitted continuation captures "what to do next".
    const isContinuation =
      pkt.packetKind === "continuation" ||
      pkt.envelope?.packetKind === "continuation" ||
      !!pkt.envelope?.resumeTo ||
      !!pkt.payload?.resumeTo ||
      pkt.type === "cop/continuation";

    if (isContinuation) {
      // Normalize to a proper descriptor using the kernel
      let contDesc;
      try {
        contDesc = createContinuationDescriptor({
          resumeTo: pkt.envelope?.resumeTo || pkt.payload?.resumeTo || pkt.resumeTo,
          resumeIntent: pkt.envelope?.resumeIntent || pkt.payload?.resumeIntent,
          correlationId: pkt.envelope?.correlationId || pkt.correlationId,
          state: pkt.payload?.state || pkt.state || pkt.payload,
          // Allow the continuation itself to specify how to spawn the next processor (fully dynamic)
          meta: pkt.envelope?.meta || pkt.meta,
        });
      } catch (e) {
        // Not a full descriptor, treat the whole pkt as the continuation carrier
        contDesc = pkt;
      }

      const targetCap = contDesc.resumeTo || pkt.envelope?.requiredCapability || initialCapability;

      console.error(
        `[cop run] continuation received for resumeTo="${targetCap}". Dynamically wiring...`
      );

      // Emit control plane for the dynamic wiring (part of being a compliant node)
      emitPacket(
        {
          envelope: {
            packetKind: "continuation",
            requiredCapability: "log",
            plane: "control",
            source: "cop-cli-node",
          },
          payload: {
            action: "dynamic-wiring",
            resumeTo: targetCap,
            spawnSpec: contDesc.meta?.spawn || contDesc.payload?.spawn,
          },
        },
        process.stderr
      );

      // The "call" to the continuation: feed it (the state / value / the continuation itself) into the target processor's "in"
      // If the target isn't running yet, it will be spawned on demand (using spawn spec from the continuation if provided).
      await nm.resume(contDesc, targetCap);

      // Also re-emit the continuation packet itself downstream (for observation or further routers in a pipe)
      emitPacket(contDesc, process.stdout);
    } else {
      // Regular packet: if it has a "next" or wants to be treated as input to another capability, wire it
      const nextCap = pkt.envelope?.nextCapability || pkt.payload?.nextCapability;
      if (nextCap && nextCap !== pkt.envelope?.requiredCapability) {
        console.error(`[cop run] wiring packet to next capability "${nextCap}" (dynamic)`);
        const target =
          nm.get(nextCap) ||
          nm.spawnIfNeeded(nextCap, pkt.envelope?.meta?.spawn || pkt.payload?.spawn);
        if (target) {
          sendPacketToStream(target.stdin, pkt);
        }
      } else {
        // Default data plane: pass interesting payloads through
        if (pkt.payload && typeof pkt.payload === "object" && Object.keys(pkt.payload).length > 0) {
          // For stream processor style, you might want to always pass data, or only when no specific routing
          // Here we log it; in real use the processors themselves produce the out
        }
      }
    }

    // Auto result delivery for any node that was previously resumed with a pending continuation-as-input.
    // If the emitting node (by requiredCapability or a 'source' hint) has a stored pending cont,
    // and this pkt looks like a completion/result, deliver the value back via the closure path.
    // This makes the "store on resume + deliver on complete" work uniformly for initial + all dynamic nodes.
    const emittingCap = pkt.envelope?.requiredCapability || pkt.envelope?.source || null;
    const looksLikeResult =
      pkt.payload &&
      (pkt.payload.result !== undefined ||
        pkt.packetKind === "complete" ||
        pkt.envelope?.packetKind === "complete" ||
        pkt.envelope?.packetKind === "result");
    if (
      emittingCap &&
      looksLikeResult &&
      nm.pendingContinuations &&
      nm.pendingContinuations.has(emittingCap)
    ) {
      const resultVal = pkt.payload.result !== undefined ? pkt.payload.result : pkt.payload;
      // Fire the deliver (it will lookup the stored cont, build delivery, and resume it into the dest)
      await nm.deliverResult(emittingCap, resultVal);
    }
  }

  // Attach collector to the *initial* node. Its packets will be handled (and may cause dynamic spawns)
  // Result delivery for pending continuations (the "input data / closure" case) is handled
  // generically inside handleIncomingPacket + DynamicNodeManager (for initial and all dynamic nodes).
  attachPacketCollectorToChild(initialNode.child, {
    onPacket: async (pkt) => {
      await handleIncomingPacket(pkt, registry, handlers, nodeManager);
    },
    onStdoutData: (line) => process.stdout.write(line + "\n"),
    onStderrData: (line) => console.error(`[${initialCapability} stderr] ${line}`),
    onError: (e) => console.error("[cop run] collector error:", e),
  });

  initialNode.child.on("exit", (code) => {
    console.error(`[cop run] initial node ${initialCapability} exited with code ${code}`);
    emitPacket(
      {
        envelope: { requiredCapability: "log", source: "cop-runner" },
        payload: { message: `${initialCapability} finished`, exitCode: code },
      },
      process.stderr
    );
  });

  // Wire the route back from any dynamically spawned nodes (they will call this when they emit packets)
  nodeManager.routePacket = async (pkt) => {
    await handleIncomingPacket(pkt, registry, handlers, nodeManager);
  };

  // Propagate host signals to managed Cogitors (graceful stop on SIGINT/SIGTERM).
  // Brutal (SIGKILL) is left to the OS / user.
  const gracefulShutdown = async (signal) => {
    console.error(`[cop run] received ${signal}, requesting graceful stop on all nodes...`);
    const caps = nodeManager.listNodes ? nodeManager.listNodes() : [initialCapability];
    for (const cap of caps) {
      if (cap) {
        await nodeManager
          .stopNode(cap, { graceful: true, reason: `host ${signal}` })
          .catch(() => {});
      }
    }
    // Give them a moment, then let natural exit happen
    setTimeout(() => process.exit(0), 500).unref();
  };
  process.once("SIGINT", () => gracefulShutdown("SIGINT"));
  process.once("SIGTERM", () => gracefulShutdown("SIGTERM"));

  // Wait for the root of the (dynamically growing) computation to finish
  await new Promise((resolve) => initialNode.child.on("close", resolve));
}

async function cmdRoute(argv) {
  const { flags } = parseFlags(argv);
  const capability = flags.capability || "router";
  const stateful = !!flags.stateful;

  console.error(
    `[cop route] reading packets from stdin (capability=${capability}, stateful=${stateful})`
  );
  console.error(
    `[cop route] Using natural Unix line-based protocol: readline() units for input, LF-separated lines for output.`
  );
  console.error(
    `[cop route] Plain lines = data plane. JSON lines with "envelope" = control/continuation packets (routed by cop-kernel).`
  );

  const { registry, handlers } = createLocalRunnerRegistry();
  registry.register(capability, { providers: ["cop-route"] });

  // Use the clean readline-based Cogitor (COP processor) — the natural Unix-style I/O for compliant tools
  const proc = await createReadlineCogitor(process.stdin, {
    onData: (line) => {
      // Data plane: pass through as-is (LF will be added by the tool or here if needed)
      process.stdout.write(line + "\n");
    },
    onPacket: async (pkt) => {
      console.error(`[cop route] packet: ${pkt.envelope?.requiredCapability || pkt.packetKind}`);

      // Observe (but do not orchestrate) explicit continuation result deliveries in pure route mode.
      // Full delivery injection (continuation-input to target stdin) is performed by `cop run` as the
      // primary orchestrator/runner. Route just surfaces it for pipes and higher observers.
      const deliverTarget =
        pkt?.envelope?.deliverTo ||
        pkt?.envelope?.inputFor ||
        pkt?.envelope?.callWith ||
        pkt?.envelope?.resultFor ||
        pkt?.envelope?.resumeWith;
      if (deliverTarget) {
        console.error(
          `[cop route] observed continuation result delivery packet for target=${deliverTarget} (passing through)`
        );
      }

      const isStack =
        (pkt.packetKind || pkt.envelope?.packetKind) === "stack-call" || pkt.envelope?.verb;
      if (isStack) {
        console.error(
          `[cop route] observed stack-call (verb=${pkt.envelope?.verb || pkt.payload?.verb || "call"}) (passing through)`
        );
      }

      const decision = await cogentiaRoutePacket(pkt, { registry });

      // As a compliant COP CLI Node, emit a control-plane continuation packet
      // describing our routing action. This allows higher graphs to observe/track us.
      const routeCont = {
        envelope: {
          packetKind: "continuation",
          requiredCapability: "log", // or a dedicated "cop-route" cap
          plane: "control",
          source: "cop-cli-node",
          correlationId: pkt.envelope?.correlationId,
          // provenance could include our node id etc.
        },
        payload: {
          action: "routed",
          decision,
          originalPacketKind: pkt.packetKind,
          originalCapability: pkt.envelope?.requiredCapability,
        },
      };
      proc.emit(routeCont, process.stderr); // control on stderr

      if (decision.action === "forwarded-to-handler" && decision.chosenCapability) {
        const h = handlers.get(decision.chosenCapability);
        if (h) {
          await h(pkt);
        }
      }
      // Always re-emit the (possibly transformed) packet as a JSON line for downstream (pipe composition)
      // This keeps the control plane flowing as LF-separated JSON
      proc.emit(pkt, process.stdout);
    },
    onError: (e) => console.error("[cop route] error:", e),
    onClose: () => console.error("[cop route] stdin closed"),
  });
}

async function cmdNode(argv) {
  // Explicit "cop node" makes the cop CLI run as a first-class compliant COP node.
  // It participates in the protocol, emits its own control-plane continuations for all actions,
  // and can be wired into larger dynamic graphs (e.g. via `cop run cop node` or pipes).
  // Internally it behaves like an enhanced `cop route` with full node self-description.
  console.error(
    "[cop node] starting as compliant COP CLI Node (data plane / control plane protocol)"
  );
  // Delegate to route logic but with node capability for self-registration
  const nodeArgs = ["--capability", "cop-cli-node", ...argv];
  await cmdRoute(nodeArgs);
}

main().catch((err) => {
  console.error("Fatal:", err && err.message ? err.message : String(err));
  process.exit(1);
});
