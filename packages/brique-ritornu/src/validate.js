import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { SCHEMA_VERSIONS } from "./constants.js";
import { RitornuError } from "./errors.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMAS_DIR = join(__dirname, "..", "schemas");

const SCHEMA_FILES = Object.freeze({
  source_capture: "source-capture.schema.json",
  normalized_transcription: "normalized-transcription.schema.json",
  import_candidate: "import-candidate.schema.json",
  handoff: "handoff.schema.json",
});

/**
 * Load a versioned JSON Schema document shipped with the package.
 * @param {keyof typeof SCHEMA_FILES} kind
 */
export function loadSchema(kind) {
  const file = SCHEMA_FILES[kind];
  if (!file) {
    throw new RitornuError("unknown-schema", `Unknown schema kind: ${kind}`);
  }
  const raw = readFileSync(join(SCHEMAS_DIR, file), "utf8");
  return JSON.parse(raw);
}

/**
 * Lightweight required-field / const / enum / type checks against the package schemas.
 * Not a full JSON Schema engine — enough for M0 offline guarantees without deps.
 *
 * @param {keyof typeof SCHEMA_FILES} kind
 * @param {object} value
 * @returns {{ ok: true } | { ok: false, errors: string[] }}
 */
export function validatePackage(kind, value) {
  const schema = loadSchema(kind);
  const errors = [];
  checkNode(value, schema, "", errors, schema);
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/**
 * @param {keyof typeof SCHEMA_FILES} kind
 * @param {object} value
 */
export function assertValidPackage(kind, value) {
  const result = validatePackage(kind, value);
  if (!result.ok) {
    throw new RitornuError("schema-validation-failed", `Invalid ${kind}`, {
      errors: result.errors,
    });
  }
  const expectedVersion = SCHEMA_VERSIONS[kind];
  if (value.schema_version !== expectedVersion) {
    throw new RitornuError(
      "schema-version-mismatch",
      `Expected ${expectedVersion}, got ${value.schema_version}`
    );
  }
  return value;
}

/**
 * @param {unknown} value
 * @param {object} schema
 * @param {string} path
 * @param {string[]} errors
 * @param {object} rootSchema
 */
function checkNode(value, schema, path, errors, rootSchema) {
  if (!schema || typeof schema !== "object") return;

  if (Object.prototype.hasOwnProperty.call(schema, "const")) {
    if (value !== schema.const) {
      errors.push(`${path || "$"}: expected const ${JSON.stringify(schema.const)}`);
    }
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path || "$"}: value not in enum`);
  }

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(value, t))) {
      errors.push(`${path || "$"}: expected type ${types.join("|")}`);
      return;
    }
  }

  if (schema.pattern && typeof value === "string") {
    const re = new RegExp(schema.pattern);
    if (!re.test(value)) {
      errors.push(`${path || "$"}: failed pattern ${schema.pattern}`);
    }
  }

  if (typeof value === "string" && schema.minLength != null && value.length < schema.minLength) {
    errors.push(`${path || "$"}: shorter than minLength ${schema.minLength}`);
  }

  if (typeof value === "number" && schema.minimum != null && value < schema.minimum) {
    errors.push(`${path || "$"}: below minimum ${schema.minimum}`);
  }

  if (schema.type === "object" || (!schema.type && schema.properties)) {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
      if (schema.type === "object") errors.push(`${path || "$"}: expected object`);
      return;
    }
    for (const key of schema.required || []) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        errors.push(`${path || "$"}: missing required property "${key}"`);
      }
    }
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          checkNode(value[key], propSchema, path ? `${path}.${key}` : key, errors, rootSchema);
        }
      }
    }
    if (schema.additionalProperties === false && schema.properties) {
      for (const key of Object.keys(value)) {
        if (!Object.prototype.hasOwnProperty.call(schema.properties, key)) {
          errors.push(`${path || "$"}: unexpected property "${key}"`);
        }
      }
    }
  }

  if (schema.type === "array" && Array.isArray(value) && schema.items) {
    value.forEach((item, index) => {
      checkNode(item, schema.items, `${path || "$"}[${index}]`, errors, rootSchema);
    });
  }
}

/**
 * @param {unknown} value
 * @param {string} type
 */
function matchesType(value, type) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && !Number.isNaN(value);
  if (type === "object") {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  return typeof value === type;
}
