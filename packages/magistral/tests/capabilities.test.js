import test from "node:test";
import assert from "node:assert/strict";
import {
  codexAcpCapabilityOffer,
  createCapabilityCatalog,
  openCodeMagistralCapabilityOffer,
} from "../src/capabilities.js";

test("Codex ACP is declared as a situated capability without leaking a local command", () => {
  const catalog = createCapabilityCatalog({
    offers: [
      codexAcpCapabilityOffer({ host_ref: "host:thinkpad-jhr", attraction: 80 }),
      {
        id: "capability:remote:coding",
        runtime_id: "runtime:remote:coding",
        host_ref: "host:remote",
        handler_instance_ref: "handler:remote:coding",
        capability: "coding.assist.read",
        execution_surface: "http",
        context_inheritance: "none",
        attraction: 20,
      },
    ],
  });

  const selected = catalog.resolve({ capability: "coding.assist.read", execution_surface: "acp" });
  assert.equal(selected.length, 1);
  assert.equal(selected[0].host_ref, "host:thinkpad-jhr");
  assert.equal(selected[0].context_inheritance, "ambient-host");
  assert.deepEqual(selected[0].dependencies, [
    "codex-acp",
    "principal-codex-account",
    "host-local-working-context",
  ]);
  assert.equal(selected[0].command, undefined);
});

test("portable requirements can reject situated offers while retaining an alternative", () => {
  const catalog = createCapabilityCatalog({
    offers: [
      codexAcpCapabilityOffer(),
      {
        id: "capability:remote:coding",
        runtime_id: "runtime:remote:coding",
        host_ref: "host:remote",
        handler_instance_ref: "handler:remote:coding",
        capability: "coding.assist.read",
        execution_surface: "http",
        context_inheritance: "none",
      },
    ],
  });
  assert.deepEqual(
    catalog
      .resolve({ capability: "coding.assist.read", allow_situated: false })
      .map((offer) => offer.id),
    ["capability:remote:coding"]
  );
});

test("coding handler selection supports policy preference and explicit runtime pinning", () => {
  const catalog = createCapabilityCatalog({
    offers: [
      codexAcpCapabilityOffer({ attraction: 80 }),
      openCodeMagistralCapabilityOffer({ attraction: 100 }),
    ],
  });

  assert.equal(
    catalog.resolve({ capability: "coding.assist.read" })[0].runtime_id,
    "runtime:local:opencode-magistral"
  );
  assert.equal(
    catalog.resolve({ capability: "coding.assist.read", execution_surface: "acp" })[0]
      .runtime_id,
    "runtime:local:codex-acp"
  );
  assert.equal(
    catalog.resolve({
      capability: "coding.assist.read",
      runtime_id: "runtime:local:codex-acp",
    })[0].runtime_id,
    "runtime:local:codex-acp"
  );
});
