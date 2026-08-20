/**
 * Provider-neutral accounting assessment for a CapabilityInvocation.
 *
 * A measured resource uses an exact quantity. A resource whose consumption is
 * unknown (common for a flat-rate provider subscription) is still recorded,
 * but never silently converted into fiat or any other invented quantity.
 */

function fail(message) {
  throw new TypeError(`resource_assessment: ${message}`);
}

function text(value, name) {
  if (typeof value !== "string" || value.trim() === "") fail(`${name} is required`);
  return value;
}

function exactQuantity(value) {
  if (!value || typeof value !== "object") fail("quantity is required for measured assessment");
  if (!/^-?\d+$/.test(String(value.coefficient || "")))
    fail("quantity.coefficient must be a decimal integer string");
  if (!Number.isInteger(value.scale) || value.scale < 0 || value.scale > 18) {
    fail("quantity.scale must be an integer between 0 and 18");
  }
  return {
    coefficient: String(value.coefficient),
    scale: value.scale,
    unit: text(value.unit, "quantity.unit"),
  };
}

function confidence(value) {
  if (!value || typeof value !== "object") fail("confidence is required for estimated assessment");
  if (
    typeof value.level !== "number" ||
    !Number.isFinite(value.level) ||
    value.level < 0 ||
    value.level > 1
  ) {
    fail("confidence.level must be a number between 0 and 1");
  }
  return { level: value.level, basis: text(value.basis, "confidence.basis") };
}

/**
 * Normalize an assessment without creating a valuation.
 *
 * status=measured means an exact quantity is known in its native unit.
 * status=not_estimated means a resource was consumed or may have been
 * consumed, but the evidence cannot support a numerical amount.
 */
export function normalizeResourceAssessment(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("must be an object");
  const status = text(value.status, "status");
  const resource_type = text(value.resource_type, "resource_type");
  if (status === "measured") {
    return {
      status,
      resource_type,
      quantity: exactQuantity(value.quantity),
      evidence_ref: value.evidence_ref || null,
      method: value.method || null,
    };
  }
  if (status === "not_estimated") {
    return {
      status,
      resource_type,
      reason: text(value.reason, "reason"),
      evidence_ref: value.evidence_ref || null,
      method: value.method || null,
    };
  }
  if (status === "estimated") {
    const estimate = exactQuantity(value.estimate);
    const lower = exactQuantity(value.interval?.lower);
    const upper = exactQuantity(value.interval?.upper);
    if (estimate.unit !== lower.unit || estimate.unit !== upper.unit) {
      fail("estimate and interval quantities must use the same unit");
    }
    return {
      status,
      resource_type,
      estimate,
      interval: { lower, upper },
      confidence: confidence(value.confidence),
      evidence_refs: Array.isArray(value.evidence_refs) ? [...value.evidence_refs] : [],
      method: text(value.method, "method"),
    };
  }
  fail("status must be measured, estimated, or not_estimated");
}

export function normalizeResourceAssessments(values = []) {
  if (!Array.isArray(values)) fail("must be an array");
  return values.map(normalizeResourceAssessment);
}

/** A valuation must be explicit and separate from the original measurement. */
export function createValuation({ source_assessment, valuation, source, effective_at } = {}) {
  const measured = normalizeResourceAssessment(source_assessment);
  if (measured.status !== "measured") fail("only a measured assessment can be valued");
  return {
    schema: "cop.accounting.valuation.v1",
    source_assessment: measured,
    valuation: exactQuantity(valuation),
    source: text(source, "source"),
    effective_at: text(effective_at, "effective_at"),
  };
}
