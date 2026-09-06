import test from "node:test";
import assert from "node:assert/strict";

import { routePacketResiliently } from "../src/cogentiaRouter.js";
import { CapabilityRegistry } from "../src/capabilityRegistry.js";
import { asCognitivePacket } from "../src/Cop-kerneltasks.js";
import {
  invokeGovernedCapability,
  recordExecutionBudgetGrant,
  recordMandateControl,
  createEventSourcedExecutionBudgetLedger,
  createCopEventEnvelope,
} from "@inseme/cop-core";

function createInMemoryStore() {
  const events = [];
  return {
    events,
    append(envelope) {
      const e = envelope.schema ? envelope : createCopEventEnvelope(envelope);
      events.push(e);
      return { ok: true, event: e, event_id: e.event_id, version: events.length };
    },
    getEvents(topicId) {
      return events.filter((e) => !topicId || e.topic?.id === topicId);
    },
    listTopic(topicId) {
      return events.filter((e) => !topicId || e.topic?.id === topicId);
    },
    replay() {
      return structuredClone(events);
    },
  };
}

test("COP Security Regression Family: reachable != admissible != authorized (Issue #66)", async (t) => {
  // ----------------------------------------------------------------------
  // Case A — Reachable but inadmissible at start
  // ----------------------------------------------------------------------
  await t.test(
    "Case A: reachable but inadmissible node is rejected in favor of spooling",
    async () => {
      const spoolQueue = [];
      const registry = new CapabilityRegistry();
      registry.register("civic.vote", {
        providers: ["node:secure-enclave", "node:public-cloud"],
      });

      const packet = asCognitivePacket({
        kind: "vote-ballot",
        envelope: {
          id: "pkt-sec-case-a",
          intent: "Cast certified vote",
          routeTo: "node:secure-enclave",
          requiredCapability: "civic.vote",
          closure: {
            admissible_handlers: ["node:secure-enclave"], // public-cloud is inadmissible
          },
        },
      });

      const probeNode = async (id) => {
        if (id === "node:secure-enclave") return false; // offline
        if (id === "node:public-cloud") return true; // online & reachable
        return false;
      };

      const result = await routePacketResiliently(packet, {
        registry,
        probeNode,
        spoolQueue,
      });

      assert.equal(result.status, "spooled_store_and_forward");
      assert.notEqual(result.targetNode, "node:public-cloud");
      assert.equal(spoolQueue.length, 1);

      // Diagnostics inspectability
      assert.equal(result.diagnostics["node:public-cloud"]?.reachable, true);
      assert.equal(result.diagnostics["node:public-cloud"]?.admissible, false);
      assert.equal(result.diagnostics["node:public-cloud"]?.selected_or_funded, false);
    }
  );

  // ----------------------------------------------------------------------
  // Case B — Capability / provider appears after packet start
  // ----------------------------------------------------------------------
  await t.test(
    "Case B: dynamically discovered/reachable endpoint after packet start is NOT invokable without authority",
    async () => {
      const spoolQueue = [];
      const registry = new CapabilityRegistry();
      registry.register("compute.heavy", {
        providers: ["node:sanctioned-worker"],
      });

      // Packet begins with explicit admissible lineage
      const packet = asCognitivePacket({
        kind: "compute-task",
        envelope: {
          id: "pkt-sec-case-b",
          routeTo: "node:sanctioned-worker",
          requiredCapability: "compute.heavy",
          closure: {
            admissible_handlers: ["node:sanctioned-worker"],
          },
        },
      });

      // During execution, sanctioned worker is offline
      // AND a newly discovered shadow node registers itself in the registry dynamically!
      registry.register("compute.heavy", {
        providers: ["node:sanctioned-worker", "node:shadow-worker-dynamic"],
      });

      const probeNode = async (id) => {
        if (id === "node:sanctioned-worker") return false;
        if (id === "node:shadow-worker-dynamic") return true; // technically reachable!
        return false;
      };

      const result = await routePacketResiliently(packet, {
        registry,
        probeNode,
        spoolQueue,
      });

      // Invariant: The dynamically discovered node cannot be routed to merely because it is reachable
      assert.notEqual(result.targetNode, "node:shadow-worker-dynamic");
      assert.equal(result.status, "spooled_store_and_forward");

      // Diagnostics prove discovery != admissibility
      assert.equal(result.diagnostics["node:shadow-worker-dynamic"]?.discovered, true);
      assert.equal(result.diagnostics["node:shadow-worker-dynamic"]?.reachable, true);
      assert.equal(result.diagnostics["node:shadow-worker-dynamic"]?.admissible, false);
    }
  );

  // ----------------------------------------------------------------------
  // Case C — Admissible but not authorized for this Principal/mandate
  // ----------------------------------------------------------------------
  await t.test(
    "Case C: admissible capability outside Principal mandate fails closed with explicit trace",
    async () => {
      const store = createInMemoryStore();
      const mandateRef = "mandate:read-only-auditor";

      // Grant active mandate
      store.append({
        event_type: "MandateGranted",
        topic: { id: "topic:auth", seq: 1 },
        payload: { mandate_ref: mandateRef, status: "active" },
      });

      let handlerCalled = false;
      const adminHandler = {
        id: "handler:admin-db",
        invoke: async () => {
          handlerCalled = true;
          return { deleted_records: 100 };
        },
      };

      // Principal's mandate authorizes only "query.read", NOT "admin.delete"
      const invocationResult = await invokeGovernedCapability({
        store,
        handler: adminHandler,
        identity: {
          principal_ref: "principal:auditor-bob",
          mandate_ref: mandateRef,
          logical_agent_ref: "agent:auditor",
          authorized_capabilities: ["query.read"], // admin.delete is NOT authorized!
        },
        capability: "admin.delete",
      });

      assert.equal(invocationResult.ok, false);
      assert.equal(invocationResult.error, "capability_unauthorized");
      assert.equal(invocationResult.called_provider, false);
      assert.equal(handlerCalled, false);

      // Explicit diagnostic separation
      assert.equal(invocationResult.diagnostic.reachable, true);
      assert.equal(invocationResult.diagnostic.admissible, true);
      assert.equal(invocationResult.diagnostic.authorized, false);
      assert.equal(invocationResult.diagnostic.invoked, false);
      assert.equal(invocationResult.diagnostic.committed, false);
    }
  );

  // ----------------------------------------------------------------------
  // Case D — Authority revoked between planning and commit (TOCTOU re-check)
  // ----------------------------------------------------------------------
  await t.test(
    "Case D: mandate revoked between reservation and provider effect blocks execution",
    async () => {
      const store = createInMemoryStore();
      const mandateRef = "mandate:ops-worker";

      // Active mandate
      store.append({
        event_type: "MandateGranted",
        topic: { id: "topic:auth", seq: 1 },
        payload: { mandate_ref: mandateRef, status: "active" },
      });

      recordExecutionBudgetGrant(store, {
        budget_id: "bgt:ops-worker",
        mandate_ref: mandateRef,
        principal_ref: "principal:alice",
        limits: {
          max_steps: 10,
          max_tool_calls: 0,
          max_subagents: 0,
          max_elapsed_ms: 10000,
          max_external_effects: 5,
        },
      });

      const ledger = createEventSourcedExecutionBudgetLedger({
        store,
        budget_id: "bgt:ops-worker",
        require_authority_grant: true,
      });

      let providerCalled = false;
      const flakyHandler = {
        id: "handler:external-api",
        invoke: async () => {
          providerCalled = true;
          return { result: "committed" };
        },
      };

      // Simulate adversarial race condition:
      // Intercept ledger reservation to revoke mandate immediately before handler invocation!
      const originalReserve = ledger.reserve.bind(ledger);
      ledger.reserve = function (params) {
        const res = originalReserve(params);
        // Revoke mandate in store right after budget reservation!
        recordMandateControl(store, {
          principal_ref: "principal:alice",
          mandate_ref: mandateRef,
          action: "revoke",
          reason: "emergency_stop",
        });
        return res;
      };

      const invocationResult = await invokeGovernedCapability({
        store,
        ledger,
        handler: flakyHandler,
        identity: {
          principal_ref: "principal:alice",
          mandate_ref: mandateRef,
          logical_agent_ref: "agent:ops",
          topic_id: "topic:ops-task",
        },
        capability: "cloud.provision",
      });

      // Invariant: Provider MUST NEVER be reached!
      assert.equal(invocationResult.ok, false);
      assert.equal(invocationResult.error, "mandate_revoked_before_effect");
      assert.equal(invocationResult.called_provider, false);
      assert.equal(providerCalled, false);

      // Reservation was automatically released
      assert.equal(ledger.snapshot().reserved.max_external_effects, 0);

      // Diagnostic inspectability
      assert.equal(invocationResult.diagnostic.authorized, false);
      assert.equal(invocationResult.diagnostic.invoked, false);
      assert.equal(invocationResult.diagnostic.committed, false);
    }
  );

  // ----------------------------------------------------------------------
  // Case E — Transitive / Redirected Reachability (Anti-ambient authority)
  // ----------------------------------------------------------------------
  await t.test("Case E: transitive capability exposure grants no ambient authority", async () => {
    const store = createInMemoryStore();
    const mandateRef = "mandate:crawler-only";

    store.append({
      event_type: "MandateGranted",
      topic: { id: "topic:auth", seq: 1 },
      payload: { mandate_ref: mandateRef, status: "active" },
    });

    // Step 1: Authorized crawler runs
    const crawlerHandler = {
      id: "handler:web-crawler",
      invoke: async () => {
        return {
          crawled_url: "https://intranet.local",
          // Returns a pointer/token to an internal DB endpoint
          discovered_resource: "capability:internal-db.write",
        };
      },
    };

    const crawlResult = await invokeGovernedCapability({
      store,
      handler: crawlerHandler,
      identity: {
        principal_ref: "principal:alice",
        mandate_ref: mandateRef,
        logical_agent_ref: "agent:crawler",
        authorized_capabilities: ["web.crawl"], // Only crawl is authorized
      },
      capability: "web.crawl",
    });

    assert.equal(crawlResult.ok, true);
    assert.equal(crawlResult.effect.discovered_resource, "capability:internal-db.write");

    // Step 2: Agent attempts to invoke the newly exposed internal capability
    let dbCalled = false;
    const internalDbHandler = {
      id: "handler:internal-db",
      invoke: async () => {
        dbCalled = true;
        return { written: true };
      },
    };

    const dbResult = await invokeGovernedCapability({
      store,
      handler: internalDbHandler,
      identity: {
        principal_ref: "principal:alice",
        mandate_ref: mandateRef,
        logical_agent_ref: "agent:crawler",
        authorized_capabilities: ["web.crawl"], // DB write is NOT in authorized set!
      },
      capability: "internal-db.write",
    });

    // Invariant: Mere technical discovery via payload cannot grant transitive authority!
    assert.equal(dbResult.ok, false);
    assert.equal(dbResult.error, "capability_unauthorized");
    assert.equal(dbResult.called_provider, false);
    assert.equal(dbCalled, false);
    assert.equal(dbResult.diagnostic.authorized, false);
  });
});
