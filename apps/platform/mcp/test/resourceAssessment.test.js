import test from "node:test";
import assert from "node:assert/strict";
import {
  createValuation,
  normalizeResourceAssessment,
} from "../../../../packages/cop-core/src/resource-assessment.js";

test("resource assessment records unknown subscription use without inventing USD", () => {
  const assessment = normalizeResourceAssessment({
    status: "not_estimated",
    resource_type: "provider.subscription.quota",
    reason: "OpenAI subscription exposes no reliable per-invocation monetary price",
    method: "provider-plan-observation",
  });
  assert.deepEqual(assessment, {
    status: "not_estimated",
    resource_type: "provider.subscription.quota",
    reason: "OpenAI subscription exposes no reliable per-invocation monetary price",
    evidence_ref: null,
    method: "provider-plan-observation",
  });
  assert.equal("quantity" in assessment, false);
  assert.equal(JSON.stringify(assessment).includes("USD"), false);
});

test("resource assessment preserves exact native measurements and forbids implicit valuation", () => {
  const attention = normalizeResourceAssessment({
    status: "measured",
    resource_type: "human.attention",
    quantity: { coefficient: "15", scale: 0, unit: "minute" },
    method: "human-confirmed-duration",
  });
  assert.equal(attention.quantity.unit, "minute");
  assert.throws(() => createValuation({ source_assessment: attention }), /quantity is required/);
  const valuation = createValuation({
    source_assessment: attention,
    valuation: { coefficient: "2", scale: 0, unit: "attention-point" },
    source: "example-approved-method-v1",
    effective_at: "2026-08-20T00:00:00.000Z",
  });
  assert.equal(valuation.valuation.unit, "attention-point");
  assert.equal(valuation.source_assessment.quantity.unit, "minute");
});

test("estimated resource assessment carries its interval and confidence", () => {
  const assessment = normalizeResourceAssessment({
    status: "estimated",
    resource_type: "human.attention",
    estimate: { coefficient: "12", scale: 0, unit: "minute" },
    interval: {
      lower: { coefficient: "8", scale: 0, unit: "minute" },
      upper: { coefficient: "20", scale: 0, unit: "minute" },
    },
    confidence: { level: 0.7, basis: "historical median of comparable reviews" },
    method: "attention-estimate-v1",
    evidence_refs: ["artifact:review-sample"],
  });
  assert.equal(assessment.status, "estimated");
  assert.equal(assessment.confidence.level, 0.7);
  assert.equal(assessment.interval.upper.coefficient, "20");
});
