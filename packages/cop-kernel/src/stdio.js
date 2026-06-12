/**
 * stdio.js - Simple, reusable helpers for emitting and parsing COP continuation / cognitive packets
 * over stdout/stderr (or any stream). Designed for "any tool" to participate in COP with minimal effort.
 *
 * Core concept: a **Cogitor** (created by createReadlineCogitor / createReadlineCopProcessor alias).
 * It cogitates rather than merely processing data.
 *
 * ## COP stdio Protocol (Data Plane / Control Plane)
 *
 * Compliant "COP CLI Nodes" (including the `cop` command itself when used as a node) MUST use
 * line-based I/O exactly like classic Unix tools:
 *
 * - **Input**: successive readline() units. One logical unit per LF (or CRLF) terminated line.
 *   Use your language's readline() loop, `while read line`, etc. No additional framing.
 *
 * - **Output**: LF-separated lines (`\n` terminated, single line per unit).
 *
 * **Data Plane** (payload / user data flow):
 *   - Plain text lines, or lines that are JSON but do **not** contain a top-level `"envelope"` key.
 *   - These are passed through by routers/pipes or delivered as raw data to processors.
 *   - Example: "hello world\n" or "{\"value\": 42}\n" (without envelope).
 *
 * **Control Plane** (routing, continuations, coordination, meta, lifecycle):
 *   - A line that is valid JSON **and contains a top-level `"envelope"` object**.
 *   - This is interpreted as a COP cognitive/continuation packet.
 *   - The router inspects **only the envelope** (using `cogentiaRoutePacket` + CapabilityRegistry)
 *     to decide routing, spawning, resumption, etc. Payload is for the target handler.
 *   - **Continuations as "input" data / closures (callbacks)**: A continuation packet can be
 *     delivered as *input* to a node (via its stdin/readline lines). It acts like a callback
 *     or closure (call/cc style): it captures "where to deliver my result" (`resumeTo` in the
 *     envelope, plus state/context). The receiving node (or the runner on its behalf) can
 *     "resume" it later by sending a packet containing the result value to the destination
 *     specified in the continuation. This allows results from one node to be dynamically
 *     wired to another without a pre-declared graph or shared state.
 *   - The *dual* (result delivery to destination): when a (downstream) node finishes a sub-computation,
 *     it (or a mediating runner) emits a control packet bearing `envelope.resultFor` / `deliverTo` /
 *     `inputFor` / `callWith` / `resumeWith` (the waiting node cap or original continuationId).
 *     The runner recognizes this and injects a `packetKind: 'continuation-input'` packet
 *     (via `createContinuationInputPacket`) as a readline unit on the waiting node's stdin.
 *     The receiver's onPacket sees it and treats `payload.value` (or .result) exactly like
 *     invoking the captured callback/closure with the value. This is "the result of some node
 *     delivered to some destination" — dynamic return addresses, no pre-wired graph.
 *   - **Lifecycle control commands** (Unix signal analogy on the control plane, l8 "should stop"):
 *     Use `packetKind: 'control'` (or 'stop-request'/'kill-request') with `command: 'stop'|'kill'`
 *     (and `graceful: true/false`).
 *       - `command: 'stop'` + graceful (or 'should-stop', 'shutdown'): cooperative graceful exit
 *         (SIGINT / SIGTERM equivalent). The target Cogitor (see `createReadlineCogitor` / `createReadlineCopProcessor` alias)
 *         sets its `.shouldStop` flag, fires `onStop(graceful, pkt)` if provided. User code should
 *         poll `proc.shouldStop` at safe points (end of a "Step", between units of work — exactly
 *         l8 task style), cleanup, emit any final result/continuation, then `proc.close()`.
 *       - `command: 'kill'` or graceful=false (or 'abort', 'terminate'): brutal immediate exit
 *         (SIGKILL equivalent). Fires `onKill`, forces close.
 *     The runner (`cop run`, DynamicNodeManager.stopNode / .killNode) sends these packets over
 *     the node's stdin. OS signals on the host are propagated as graceful stops to children.
 *     Helpers: `createStopRequestPacket({graceful, reason})`, `createKillRequestPacket()`,
 *     `createControlPacket(command, details)`.
 *   - Use shapes from `asCognitivePacket(...)` or `createContinuationDescriptor(...)`.
 *   - Recommended: emit control packets on **stderr** to keep stdout clean for data plane
 *     (or mix on stdout if you want everything in one pipe).
 *
 * **"json()" convention**:
 *   - For control: `emitPacket({ envelope: { ... }, payload: { ... } })` → normalized JSON line.
 *   - For quick data or raw: `emitJsonLine(obj)` → plain `JSON.stringify(obj) + '\n'`.
 *
 * **Envelope conventions for planes** (optional but recommended):
 *   - `envelope.plane`: "data" | "control"
 *   - `envelope.packetKind`: "data", "continuation", "log", "error", "spawn", "route", "complete", etc.
 *   - `envelope.control: true` for explicit control plane.
 *   - `envelope.requiredCapability` drives dynamic routing and graph construction.
 *
 * This protocol enables fully dynamic graphs via continuations (no pre-declared graph needed).
 * A process emits a continuation packet (control) to "capture the rest" (call/cc style);
 * the runner wires the next node (function x=f(y) or stream processor `in | proc | out`).
 *
 * ## Lightweight "stack" framing convention (optional but powerful)
 * In addition to raw data lines and full envelope packets, tools may emit a compact
 * stack-oriented frame on a single line. It is automatically normalized by
 * parsePacketFromLine / parseStackFrame into a first-class `packetKind: 'stack-call'`
 * COP packet (so cogentiaRoutePacket, the runner, etc. treat it uniformly).
 *
 * Forms (JSON, one line):
 *   ["stack", data1, data2, ..., optionalContinuation, "call" | "process"]
 *   {"stack": [data1, data2, ...], "continuation": {resumeTo: "...", ...}, "verb": "call"|"process"}
 *
 * Semantics (directly supports continuations as "input" / closures):
 *   - "stack" introduces an ordered collection of argument / data items (the "stack").
 *   - optionalContinuation (any object with envelope/resumeTo/continuationId) is the
 *     captured return address / closure. It will be attached by the runner so that when
 *     the target produces a result (one-shot) *or each result item* (for streaming),
 *     the runner delivers it by injecting a 'continuation-input' packet (the callback
 *     application) to the original issuer's stdin.
 *   - verb:
 *       "call"    — one-shot. The stack items are the args to the target capability/node.
 *                   A single result (or the 'complete'/'result' emission) causes delivery
 *                   via the attached continuation (exactly the callback/closure model).
 *       "process" — streaming processor mode. The target receives the initial stack (and
 *                   subsequent data lines can be fed as more items). Results produced by
 *                   the processor have the continuation attached (per-item or at end).
 *
 * The runner (cop run / DynamicNodeManager) recognizes stack-call packets:
 *   - Derives the target from requiredCapability or the continuation's resumeTo.
 *   - Stores the provided continuation under the target (so existing deliverResult +
 *     auto logic on 'result'/'complete' packets will fire the closure delivery).
 *   - Feeds the stack (as payload.stack) + verb to the target's stdin (spawning the
 *     node on demand if a spawn spec or command is known).
 *   - For "process", the same cont can be kept (or re-supplied per item) for streaming results.
 *
 * This is a natural fit for the concatenative lineage (l8 / future Inox) while staying
 * 100% compatible with the envelope-only routing and line-based Unix contract.
 * Tools that don't care can ignore it and use plain envelopes or raw lines.
 *
 * Tools stay simple: readline loop for input, print lines (data or envelope-JSON) for output.
 *
 * A participant created this way is called a **Cogitor** (see createReadlineCogitor).
 * It doesn't just "process" data — it *cogitates* on cognitive packets, continuations
 * (both for dynamic forward wiring and as input/closures for results), control commands
 * (stop/kill, etc.), and stack frames.
 */

import { asCognitivePacket } from "./Cop-kerneltasks.js";

// readline is Node-only. We lazy-import it inside createReadlineCogitor (aka createReadlineCopProcessor).
// so the rest of stdio.js (parse/emit) remains usable in browser / edge contexts.
let _readlinePromise;
async function getReadline() {
  if (!_readlinePromise) {
    _readlinePromise = import("readline");
  }
  return (await _readlinePromise).default || (await _readlinePromise);
}

/**
 * Try to parse a single line as a COP packet.
 * Returns the normalized packet (via asCognitivePacket for defaults) or null if not a packet.
 *
 * A "packet line" is a line that, when trimmed and JSON.parsed, has an `envelope` property
 * (object) and optionally a `payload`.
 */
export function parsePacketFromLine(line, options = {}) {
  if (!line || typeof line !== "string") return null;
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Allow optional prefix for robustness, e.g. "COP:" or "PACKET:"
  let candidate = trimmed;
  const prefixes = options.prefixes || ["COP:", "PACKET:", "CONTINUATION:", "cop:"];
  for (const p of prefixes) {
    if (trimmed.startsWith(p)) {
      candidate = trimmed.slice(p.length).trim();
      break;
    }
  }

  let obj;
  try {
    obj = JSON.parse(candidate);
  } catch {
    return null; // not JSON, treat as plain data
  }

  if (!obj || typeof obj !== "object") return null;

  // NEW: support the lightweight "stack" framing protocol as first-class packets.
  // A line like  ["stack", 1, "foo", {"resumeTo":"caller"}, "call"]
  // or         {"stack":[1,"foo"], "continuation":{...}, "verb":"call"}
  // becomes a normal COP packet (packetKind:'stack-call') with proper envelope.
  // This is recognized *before* the strict "must have envelope" check, so tools
  // can use the simple forms while routers/runners/handlers see full envelopes.
  if (!obj.envelope || typeof obj.envelope !== "object") {
    const asFrame = parseStackFrame(candidate, options);
    if (asFrame) return asFrame;
    return null; // not a packet and not a recognized stack frame
  }

  // Normalize using the kernel helper (adds id, createdAt, packetKind, trace, etc.)
  // We pass emit:false because the emitter is the external tool, not us.
  try {
    return asCognitivePacket({
      envelope: obj.envelope,
      payload: obj.payload || obj, // allow whole object as payload if no separate payload
      kind: obj.packetKind || obj.kind || "continuation",
      emit: false,
    });
  } catch (e) {
    console.warn("[cop-stdio] Failed to normalize packet:", e.message);
    return null;
  }
}

/**
 * Emit a continuation / cognitive packet as a single JSON line to the given stream.
 * Uses asCognitivePacket for proper envelope hygiene.
 *
 * By default writes to process.stdout with no prefix (clean for piping).
 * For control-plane preference, callers often use stderr.
 */
export function emitPacket(packetOrDescriptor, stream = process.stdout, options = {}) {
  const prefix = options.prefix || "";
  const normalized = asCognitivePacket({
    envelope: packetOrDescriptor.envelope || packetOrDescriptor,
    payload: packetOrDescriptor.payload || {},
    kind: packetOrDescriptor.packetKind || packetOrDescriptor.kind || "continuation",
    emit: false,
  });

  const line = prefix + JSON.stringify(normalized) + "\n";
  try {
    stream.write(line);
  } catch (e) {
    // Best effort
    if (stream === process.stdout || stream === process.stderr) {
      console.error("[cop-stdio] Failed to write packet:", e.message);
    }
  }
  return normalized;
}

/**
 * Convenience: emit a simple "log" / data packet (often used for control-plane logging).
 */
export function emitLog(message, level = "info", stream = process.stderr) {
  return emitPacket(
    {
      envelope: {
        packetKind: "log",
        requiredCapability: "log",
        riskLevel: "low",
        source: "stdio-tool",
      },
      payload: { message, level, ts: new Date().toISOString() },
    },
    stream
  );
}

/**
 * Create a simple collector for a stream (stdout or stderr of a child process).
 * Calls onPacket for every detected continuation packet.
 * Calls onData for every non-packet line (raw text).
 */
export function createStreamPacketCollector(stream, { onPacket, onData, onError } = {}) {
  let buffer = "";

  const handler = (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // keep last partial line

    for (const line of lines) {
      const pkt = parsePacketFromLine(line);
      if (pkt) {
        try {
          onPacket?.(pkt, line);
        } catch (e) {
          onError?.(e);
        }
      } else if (line.trim()) {
        try {
          onData?.(line);
        } catch (e) {
          onError?.(e);
        }
      }
    }
  };

  stream.on("data", handler);

  // Flush remaining on close
  const flush = () => {
    if (buffer.trim()) {
      const pkt = parsePacketFromLine(buffer);
      if (pkt) onPacket?.(pkt, buffer);
      else if (buffer.trim()) onData?.(buffer);
      buffer = "";
    }
  };
  stream.on("close", flush);
  stream.on("end", flush);

  return { flush };
}

/**
 * Helper to wrap a child_process (from node's child_process.spawn) and collect packets
 * from both stdout and stderr.
 */
export function attachPacketCollectorToChild(child, handlers = {}) {
  const stdoutCollector = createStreamPacketCollector(child.stdout, {
    onPacket: handlers.onPacket,
    onData: handlers.onStdoutData,
    onError: handlers.onError,
  });

  const stderrCollector = createStreamPacketCollector(child.stderr, {
    onPacket: handlers.onPacket, // packets on stderr are also valid (control plane)
    onData: handlers.onStderrData,
    onError: handlers.onError,
  });

  return { stdoutCollector, stderrCollector };
}

/**
 * Send a packet (or descriptor) to a writable stream, e.g. child.stdin.
 * This is how the runner "resumes" or feeds input to a stream processor node.
 * The receiving side can read lines from stdin and parse with parsePacketFromLine.
 */
export function sendPacketToStream(stream, packetOrDescriptor, options = {}) {
  if (!stream || !stream.writable) return;
  const prefix = options.prefix || "";
  const normalized = asCognitivePacket({
    envelope: packetOrDescriptor.envelope || packetOrDescriptor,
    payload: packetOrDescriptor.payload || {},
    kind: packetOrDescriptor.packetKind || packetOrDescriptor.kind || "continuation",
    emit: false,
  });
  const line = prefix + JSON.stringify(normalized) + "\n";
  try {
    stream.write(line);
  } catch (e) {
    // ignore for now
  }
  return normalized;
}

/**
 * Create a clean readline-based processor for a COP-compliant stream (stdin/stdout style).
 *
 * This is the *natural* way for a "COP compliant" executable to consume/produce:
 * - Input: successive lines (exactly like Unix `while read line; do ... done` or `readline()` in most languages).
 * - Output: LF-separated lines (plain text for data plane, or JSON for control/continuation packets).
 * - Packets are detected as lines that parse to objects containing an `envelope`.
 *
 * Usage in a Node tool (stream processor or function):
 *   const proc = await createReadlineCogitor(process.stdin, {
 *     onData(line) { console.log("data:", line); },
 *     onPacket(pkt) {
 *       // handle continuation / control
 *       if (pkt.envelope.packetKind === 'continuation-input' || pkt.envelope.deliverTo) {
 *         // This is the runner delivering a result via a captured continuation/closure (callback style)
 *         const value = pkt.payload?.value ?? pkt.payload?.result;
 *         // continue your stateful computation with the value, or transform it, etc.
 *         console.error('closure fired with:', value);
 *       } else if (pkt.envelope.requiredCapability === 'my-work') {
 *         const result = doWork(pkt.payload);
 *         emitPacket({ envelope: { requiredCapability: 'log' }, payload: result }, process.stdout);
 *       }
 *     },
 *     // l8-style cooperative "should stop" + Unix SIGINT/SIGKILL analog on control plane
 *     onStop(graceful, pkt) {
 *       console.error('stop requested, graceful=', graceful);
 *       // at a safe point (end of current "step"), cleanup and:
 *       if (proc.shouldStop) { proc.close(); }
 *     },
 *     onKill(pkt) { console.error('kill!'); }  // immediate
 *   });
 *
 * The tool can be long-running (stream processor: in | me | out) or exit after one shot (pure f(y)).
 *
 * Control packets (including stop/kill from the runner or other nodes) arrive as normal
 * packets in onPacket (or via the dedicated onStop/onKill/onControl callbacks).
 * The returned object has `.shouldStop` (poll this at safe points between work units / Steps,
 * exactly like l8 tasks receiving "should stop").
 */
/**
 * Creates a readline-based COP participant (a "Cogitor").
 *
 * Preferred conceptual name: **Cogitor**.
 * - A traditional "processor" processes/transforms data (and events).
 * - A **Cogitor** *cogitates*: it participates in the cognitive packet fabric.
 *   It receives and emits cognitive/continuation packets (including as call/cc for dynamic
 *   forward wiring, and as "input" closures/callbacks for result delivery), understands
 *   the control plane (stop/kill requests, stack-call frames, etc.), can be dynamically
 *   wired by runners, and cooperates on lifecycle (the l8-style .shouldStop flag).
 *
 * The implementation is a clean Unix-style readline loop + tolerant parsing of
 * data-plane lines vs. control-plane envelope packets (see the long header comment above).
 *
 * The old name `createReadlineCopProcessor` is kept as an alias for compatibility.
 */
export async function createReadlineCogitor(
  inputStream,
  { onData, onPacket, onError, onClose, onControl, onStop, onKill } = {}
) {
  const rlMod = await getReadline();
  const rl = rlMod.createInterface({
    input: inputStream,
    crlfDelay: Infinity, // handle \r\n too, like Unix tools
  });

  // Cooperative stop flag (l8 "should stop" for a task / Cogitor).
  // User code polls `proc.shouldStop` at safe points (end of a Step, between units of work)
  // exactly like l8 tasks. When a graceful stop control packet arrives on the input (control plane),
  // this is set and onStop(graceful, pkt) is called if provided.
  let _shouldStop = false;

  function isControlLike(pkt) {
    if (!pkt) return false;
    const k = pkt.envelope?.packetKind;
    const cmd = pkt.envelope?.command;
    return (
      k === "control" ||
      k === "stop-request" ||
      k === "kill-request" ||
      cmd === "stop" ||
      cmd === "kill" ||
      cmd === "should-stop" ||
      cmd === "shutdown" ||
      cmd === "pause" ||
      cmd === "resume"
    );
  }

  function handleControl(pkt) {
    const cmd = pkt.envelope?.command || pkt.envelope?.packetKind || "";
    const graceful = pkt.envelope?.graceful !== false; // default to graceful for 'stop'

    if (cmd === "stop" || cmd === "should-stop" || cmd === "shutdown" || cmd === "stop-request") {
      _shouldStop = true;
      try {
        onStop?.(graceful, pkt);
      } catch (e) {
        onError?.(e);
      }
      // Do not auto-close here: let user code (or onStop impl) decide when it is safe,
      // perform cleanup, emit final continuation/result, then call proc.close().
      // This mirrors l8 cooperative task stop.
    } else if (cmd === "kill" || cmd === "abort" || cmd === "terminate" || cmd === "kill-request") {
      _shouldStop = true;
      try {
        onKill?.(pkt);
      } catch (e) {
        onError?.(e);
      }
      // Brutal: close the readline immediately.
      try {
        rl.close();
      } catch {}
    } else {
      // other controls (pause, resume, custom) — user handles via onControl or onPacket
    }
  }

  rl.on("line", (line) => {
    const pkt = parsePacketFromLine(line);
    if (pkt) {
      if (isControlLike(pkt)) {
        handleControl(pkt);
        try {
          onControl?.(pkt, line);
        } catch (e) {
          onError?.(e);
        }
      }
      try {
        onPacket?.(pkt, line);
      } catch (e) {
        onError?.(e);
      }
    } else if (line.length > 0) {
      try {
        onData?.(line);
      } catch (e) {
        onError?.(e);
      }
    }
  });

  rl.on("close", () => {
    try {
      onClose?.();
    } catch (e) {
      onError?.(e);
    }
  });

  rl.on("error", (e) => onError?.(e));

  return {
    close: () => rl.close(),
    // Helper to emit a packet as a clean LF-terminated JSON line (the natural output)
    emit: (pkt, stream = process.stdout) => emitPacket(pkt, stream),
    // For plain data output (LF separated)
    writeLine: (text, stream = process.stdout) => {
      if (stream.writable) stream.write(String(text) + "\n");
    },

    // l8-inspired cooperative flag + control surface for Cogitors (the things that cogitate).
    // Set when a 'stop' (graceful) or 'kill' control packet arrives on the input (control plane).
    // Poll this inside onPacket / onData / your "step" code at safe points before blocking or
    // long work. When true, finish the unit, cleanup, emit any final continuation/result packet,
    // then call .close().
    get shouldStop() {
      return _shouldStop;
    },

    // Local trigger (for the hosting code). Also useful in tests.
    // For cross-node / runner control, prefer sending a control packet on the node's stdin
    // (see createStopRequestPacket / the cop runner's stopNode).
    stop(graceful = true) {
      _shouldStop = true;
      const pkt = createStopRequestPacket({ graceful });
      if (graceful) {
        try {
          onStop?.(true, pkt);
        } catch (e) {
          onError?.(e);
        }
      } else {
        try {
          onKill?.(pkt);
        } catch (e) {
          onError?.(e);
        }
        try {
          rl.close();
        } catch {}
      }
    },
  };
}

/**
 * Backward-compat alias.
 * The conceptual term is "Cogitor" — see `createReadlineCogitor` (and the long protocol header).
 * A Cogitor cogitates on cognitive packets, continuations (call/cc + closures), control plane, etc.
 */
export const createReadlineCopProcessor = createReadlineCogitor;

/**
 * Minimal "json()" helper for COP-compliant tools: emit any object as a single LF-terminated JSON line.
 * This is the "possibly json()" part of the natural protocol.
 * Use this for continuation packets (they will be recognized by parsePacketFromLine if they have "envelope").
 */
export function emitJsonLine(obj, stream = process.stdout) {
  if (!stream || !stream.writable) return;
  try {
    stream.write(JSON.stringify(obj) + "\n");
  } catch {}
}

/**
 * Create a "continuation input" packet (the form the runner injects into a waiting node's stdin
 * when delivering the result of some other node via a continuation-as-closure/callback).
 *
 * Receiving compliant nodes (in their readline onPacket handler) see:
 *   if (pkt.envelope?.packetKind === 'continuation-input' || pkt.envelope?.deliverTo) {
 *     const value = pkt.payload?.value;
 *     // treat as:  myCallback( value )  or  resume( myCapturedContinuation, value )
 *     // continue the computation (stateful stream processor) or transform
 *   }
 *
 * This is the dual of emitting a normal continuation (for "next step" wiring):
 * here the *result producer* (or the runner) uses it to "apply the closure" with the value
 * to the node that originally emitted the capturing continuation.
 */
export function createContinuationInputPacket(continuationIdOrTarget, value, meta = {}) {
  const target =
    typeof continuationIdOrTarget === "string"
      ? continuationIdOrTarget
      : continuationIdOrTarget?.resumeTo || continuationIdOrTarget?.capability || "unknown-target";
  return {
    envelope: {
      plane: "control",
      packetKind: "continuation-input",
      deliverTo: target,
      continuationId:
        typeof continuationIdOrTarget === "string"
          ? continuationIdOrTarget
          : continuationIdOrTarget?.continuationId || null,
      source: "cop-runner",
      ...meta,
    },
    payload: {
      value,
      // also expose under common names for ergonomics in receiving nodes
      result: value,
    },
  };
}

/**
 * Convenience to directly write a continuation-input (closure call) to a target's stdin.
 * Used by runners; also useful for tests or direct wiring.
 * If asPacket=false, writes a plain JSON value line (data plane style) instead.
 */
export function deliverContinuationInput(
  targetNode,
  value,
  { asPacket = true, continuationId = null } = {}
) {
  if (!targetNode || !targetNode.stdin || !targetNode.stdin.writable) return false;
  if (asPacket) {
    const pkt = createContinuationInputPacket(
      continuationId || targetNode.capability || targetNode.continuationId,
      value
    );
    sendPacketToStream(targetNode.stdin, pkt);
  } else {
    try {
      targetNode.stdin.write(JSON.stringify({ value }) + "\n");
    } catch {}
  }
  return true;
}

/**
 * Create a normalized "stack call" packet.
 *
 * This is a convenient framing (in the spirit of concatenative/stack machines + call/cc)
 * for: a collection of data items (the "stack" / arguments), an optional continuation
 * (the return address / closure that will receive the result(s)), and a verb.
 *
 * Verbs:
 *   - 'call'     : one-shot invocation. The stack items are the arguments. When the
 *                  target produces a result (or completes), the runner delivers it
 *                  by applying the attached continuation (see continuation-input).
 *   - 'process'  : streaming / long-running. The target (a Cogitor) is treated as a stream
 *                  processor. The initial stack can be initial args/state. Subsequent data items
 *                  fed to the Cogitor (or produced by it) can have the continuation attached so
 *                  that each result item (or the stream) is delivered via the continuation-as-closure.
 *
 * The produced packet is a first-class COP control packet (has envelope + payload).
 * requiredCapability is derived from the continuation (its resumeTo) or explicit target.
 * Tools can emit the lightweight forms below; parseStackFrame / parsePacketFromLine
 * will normalize them.
 *
 * Example usage from a tool:
 *   emitJsonLine( createStackCallPacket({ stack: [1, "foo"], continuation: myCont, verb: 'call' }) )
 */
export function createStackCallPacket({
  stack = [],
  continuation = null,
  verb = "call",
  targetCapability = null,
  meta = {},
} = {}) {
  const cap =
    targetCapability ||
    (continuation &&
      (continuation.resumeTo ||
        continuation.envelope?.resumeTo ||
        continuation.requiredCapability)) ||
    null;

  const envelope = {
    packetKind: "stack-call",
    plane: "control",
    requiredCapability: cap,
    verb,
    source: "stack-frame",
    ...meta,
  };

  // If the provided continuation is rich (has its own envelope), keep it; else wrap lightly.
  const cont =
    continuation && continuation.envelope
      ? continuation
      : continuation
        ? {
            resumeTo: continuation.resumeTo || continuation,
            state: continuation.state || continuation,
            ...continuation,
          }
        : null;

  return {
    envelope,
    payload: {
      stack: Array.isArray(stack) ? stack : stack == null ? [] : [stack],
      verb,
      continuation: cont,
    },
  };
}

/**
 * Tolerant parser for the lightweight "stack ... verb" framing (user-suggested protocol).
 *
 * Recognized forms (all produce a proper COP packet with packetKind 'stack-call'):
 *
 * 1. JSON array (very stack-machine like, easy from many languages or simple writers):
 *    ["stack", data1, data2, ..., optionalContinuation, "call" | "process" ]
 *    - Items after "stack" until the verb (or end) are collected into the stack.
 *    - Any item that looks like a continuation (has envelope, resumeTo, or continuationId)
 *      is taken as the optional_continuation.
 *    - Final string token that is 'call' or 'process' sets the verb (defaults to 'call').
 *
 * 2. JSON object (clearer for complex data):
 *    { "stack": [data1, data2, ...], "continuation": { ... }, "verb": "call"|"process", "target": "cap" }
 *
 * 3. Already-normal packet with packetKind 'stack-call' — passed through.
 *
 * After recognition, the result is normalized via asCognitivePacket so it has id/createdAt etc.
 * and can be routed by cogentiaRoutePacket (envelope-only) and handled by the runner
 * (which will store the continuation for result delivery and feed the stack to the target).
 *
 * This sits *on top of* the existing line + envelope protocol: a tool can still use raw
 * envelopes, or these convenient frames. The runner and stdio processor make them first-class.
 */
export function parseStackFrame(line, options = {}) {
  if (!line || typeof line !== "string") return null;
  const trimmed = line.trim();
  if (!trimmed) return null;

  let obj;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;

  let stack = null;
  let continuation = null;
  let verb = "call";
  let target = null;

  if (Array.isArray(obj) && obj[0] === "stack") {
    // Lightweight array form: ["stack", ...items..., optionalCont, "call"|"process"]
    const items = obj.slice(1);
    stack = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (typeof it === "string" && (it === "call" || it === "process")) {
        verb = it;
        continue;
      }
      if (
        it &&
        typeof it === "object" &&
        (it.envelope || it.resumeTo || it.continuationId || it.packetKind === "continuation")
      ) {
        continuation = it;
        continue;
      }
      stack.push(it);
    }
  } else if (obj && (Array.isArray(obj.stack) || obj.stack != null)) {
    // Object form
    stack = Array.isArray(obj.stack) ? obj.stack : [obj.stack];
    continuation = obj.continuation || obj.cont || null;
    verb = obj.verb === "process" ? "process" : "call";
    target = obj.target || obj.requiredCapability || null;
  } else if (
    obj.envelope &&
    (obj.envelope.packetKind === "stack-call" || obj.packetKind === "stack-call")
  ) {
    // Already a packet — normalize below
    return asCognitivePacket({
      envelope: obj.envelope,
      payload: obj.payload || obj,
      kind: "stack-call",
      emit: false,
    });
  } else {
    return null; // not a stack frame
  }

  // Build canonical form and normalize
  const built = createStackCallPacket({
    stack,
    continuation,
    verb,
    targetCapability: target,
  });

  try {
    return asCognitivePacket({
      envelope: built.envelope,
      payload: built.payload,
      kind: "stack-call",
      emit: false,
    });
  } catch (e) {
    console.warn("[cop-stdio] Failed to normalize stack frame:", e.message);
    return null;
  }
}

/**
 * Create a generic control packet for the control plane.
 * Used for lifecycle (stop/kill), pause/resume, etc.
 *
 * These are sent as normal envelope JSON lines (control plane).
 * A receiving Cogitor (via createReadlineCogitor) or the runner can act on them.
 */
export function createControlPacket(command, details = {}, meta = {}) {
  return {
    envelope: {
      packetKind: "control",
      plane: "control",
      command,
      ...meta,
    },
    payload: { ...details },
  };
}

/**
 * Request graceful or brutal stop on a Cogitor (created via createReadlineCogitor / createReadlineCopProcessor)
 * or any COP node (l8 "should stop" style + Unix signal analogy on the control plane).
 *
 * graceful=true  (default): cooperative. Equivalent to SIGINT / SIGTERM.
 *   The Cogitor sets its `shouldStop` flag (pollable at safe points, like between Steps),
 *   fires onStop(graceful, pkt) if provided. The node should finish current work,
 *   cleanup, emit final continuation/result/complete if needed, then close().
 *
 * graceful=false: brutal. Equivalent to SIGKILL. Immediate close, onKill if provided.
 *
 * The continuation/result delivery machinery can still fire on the way out if a
 * pending cont was registered for this node.
 */
export function createStopRequestPacket({
  graceful = true,
  reason = null,
  target = null,
  ...extra
} = {}) {
  const command = graceful ? "stop" : "kill";
  return createControlPacket(command, {
    graceful,
    reason: reason || (graceful ? "graceful shutdown requested" : "brutal kill requested"),
    target,
    ...extra,
  });
}

export function createKillRequestPacket(opts = {}) {
  return createStopRequestPacket({ ...opts, graceful: false });
}

export default {
  parsePacketFromLine,
  emitPacket,
  emitLog,
  createStreamPacketCollector,
  attachPacketCollectorToChild,
  sendPacketToStream,
  createReadlineCogitor, // preferred conceptual name ("cogitor" cogitates)
  createReadlineCopProcessor, // alias
  emitJsonLine,
  createContinuationInputPacket,
  deliverContinuationInput,
  createStackCallPacket,
  parseStackFrame,
  createControlPacket,
  createStopRequestPacket,
  createKillRequestPacket,
};
