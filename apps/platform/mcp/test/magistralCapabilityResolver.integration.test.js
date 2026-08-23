import assert from "node:assert/strict";
import test from "node:test";
import { createCapabilityCatalog, codexAcpCapabilityOffer } from "@inseme/magistral/capabilities";
import { createHostRuntimeClient, codexAcpRuntime } from "../cop/hostRuntimeClient.js";
import { createMagistralAcpContinuationHandler } from "../cop/magistralCapabilityResolver.js";

const enabled = process.env.RUN_CODEX_ACP_INTEGRATION === "1";

test(
  "JHN continuation handler reaches local Codex ACP in read-only mode",
  {
    skip:
      !enabled && "set RUN_CODEX_ACP_INTEGRATION=1 to invoke the authenticated local Codex adapter",
  },
  async () => {
    const runtime = codexAcpRuntime();
    const client = createHostRuntimeClient({ runtimes: [runtime] });
    const handler = createMagistralAcpContinuationHandler({
      capabilityCatalog: createCapabilityCatalog({ offers: [codexAcpCapabilityOffer()] }),
      hostRuntimeClient: client,
      working_directory: process.cwd(),
    });

    const result = await handler.invoke({
      message:
        "Reply with exactly ACP_JHN_CONTINUATION_OK. Do not read files, run tools, or make changes.",
    });

    assert.equal(result.text, "ACP_JHN_CONTINUATION_OK");
    assert.equal(result.context_inheritance, "ambient-host");
    assert.equal(result.capability_resolution.runtime_id, "runtime:local:codex-acp");
  }
);
