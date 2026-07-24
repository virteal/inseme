/**
 * Exact Quantity Arithmetic Utilities
 *
 * Implements exact decimal arithmetic without binary floating-point.
 * All quantities are represented as {coefficient: string, scale: number}.
 *
 * @module accounting/quantity
 */

/**
 * Compare two exact quantities.
 *
 * @param {Object} a - First quantity {coefficient, scale, unit}
 * @param {Object} b - Second quantity {coefficient, scale, unit}
 * @returns {number} -1 if a < b, 0 if a === b, 1 if a > b
 * @throws {Error} If units or scales don't match
 */
export function compareQuantities(a, b) {
  if (a.unit !== undefined && b.unit !== undefined && a.unit !== b.unit) {
    throw new Error(`Cannot compare quantities with different units: ${a.unit} vs ${b.unit}`);
  }
  if (a.scale !== b.scale) {
    throw new Error(`Cannot compare quantities with different scales: ${a.scale} vs ${b.scale}`);
  }

  const aVal = BigInt(a.coefficient);
  const bVal = BigInt(b.coefficient);

  if (aVal < bVal) return -1;
  if (aVal > bVal) return 1;
  return 0;
}

/**
 * Add two exact quantities.
 *
 * @param {Object} a - First quantity {coefficient, scale, unit}
 * @param {Object} b - Second quantity {coefficient, scale, unit}
 * @returns {Object} Sum {coefficient, scale, unit}
 * @throws {Error} If units or scales don't match
 */
export function addQuantities(a, b) {
  if (a.unit !== undefined && b.unit !== undefined && a.unit !== b.unit) {
    throw new Error(`Cannot add quantities with different units: ${a.unit} vs ${b.unit}`);
  }
  if (a.scale !== b.scale) {
    throw new Error(`Cannot add quantities with different scales: ${a.scale} vs ${b.scale}`);
  }

  const aVal = BigInt(a.coefficient);
  const bVal = BigInt(b.coefficient);
  const sum = aVal + bVal;

  return {
    coefficient: sum.toString(),
    scale: a.scale,
    unit: a.unit || b.unit,
  };
}

/**
 * Subtract two exact quantities.
 *
 * @param {Object} a - First quantity {coefficient, scale, unit}
 * @param {Object} b - Second quantity to subtract {coefficient, scale, unit}
 * @returns {Object} Difference {coefficient, scale, unit}
 * @throws {Error} If units or scales don't match
 */
export function subtractQuantities(a, b) {
  if (a.unit !== undefined && b.unit !== undefined && a.unit !== b.unit) {
    throw new Error(`Cannot subtract quantities with different units: ${a.unit} vs ${b.unit}`);
  }
  if (a.scale !== b.scale) {
    throw new Error(`Cannot subtract quantities with different scales: ${a.scale} vs ${b.scale}`);
  }

  const aVal = BigInt(a.coefficient);
  const bVal = BigInt(b.coefficient);
  const diff = aVal - bVal;

  return {
    coefficient: diff.toString(),
    scale: a.scale,
    unit: a.unit || b.unit,
  };
}

/**
 * Check if a quantity is zero.
 *
 * @param {Object} q - Quantity {coefficient, scale, unit}
 * @returns {boolean} True if quantity is zero
 */
export function isZero(q) {
  return q.coefficient === "0" || q.coefficient === "-0";
}

/**
 * Check if a quantity is negative.
 *
 * @param {Object} q - Quantity {coefficient, scale, unit}
 * @returns {boolean} True if quantity is negative
 */
export function isNegative(q) {
  return q.coefficient.startsWith("-");
}

/**
 * Create an exact quantity from a decimal string.
 *
 * @param {string} decimal - Decimal string like "1.23" or "-5.00"
 * @param {string} unit - Unit
 * @returns {Object} Exact quantity {coefficient, scale, unit}
 */
export function fromDecimal(decimal, unit) {
  const match = decimal.match(/^(-)?(\d+)(?:\.(\d+))?$/);
  if (!match) {
    throw new Error(`Invalid decimal string: ${decimal}`);
  }

  const [, sign, integer, fraction = ""] = match;
  const scale = fraction.length;
  const coefficient = (sign || "") + integer + fraction;

  // Remove leading zeros but keep at least one digit
  const normalizedCoefficient = BigInt(coefficient).toString();

  return {
    coefficient: normalizedCoefficient,
    scale,
    unit,
  };
}

/**
 * Convert an exact quantity to a decimal string.
 *
 * @param {Object} q - Quantity {coefficient, scale, unit}
 * @returns {string} Decimal string like "1.23" or "-5.00"
 */
export function toDecimal(q) {
  const coeff = q.coefficient;
  const scale = q.scale;

  if (scale === 0) {
    return coeff;
  }

  const isNeg = coeff.startsWith("-");
  const absCoeff = isNeg ? coeff.slice(1) : coeff;

  // Pad with leading zeros if needed
  const padded = absCoeff.padStart(scale + 1, "0");

  const integerPart = padded.slice(0, -scale) || "0";
  const fractionPart = padded.slice(-scale);

  return (isNeg ? "-" : "") + integerPart + "." + fractionPart;
}

/**
 * Validate an exact quantity.
 *
 * @param {Object} q - Quantity to validate
 * @returns {Object} Validation result {valid, errors}
 */
export function validateQuantity(q) {
  const errors = [];

  if (!q || typeof q !== "object") {
    return { valid: false, errors: ["Quantity must be an object"] };
  }

  if (typeof q.coefficient !== "string") {
    errors.push("coefficient must be a string");
  } else {
    // Validate coefficient is a valid integer string
    const coeffMatch = q.coefficient.match(/^(-)?\d+$/);
    if (!coeffMatch) {
      errors.push("coefficient must be an integer string");
    }
  }

  if (typeof q.scale !== "number") {
    errors.push("scale must be a number");
  } else if (q.scale < 0 || q.scale > 18) {
    errors.push("scale must be between 0 and 18");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Normalize two quantities to the same scale.
 *
 * @param {Object} a - First quantity
 * @param {Object} b - Second quantity
 * @returns {Array} [normalizedA, normalizedB] with matching scales
 */
export function normalizeToCommonScale(a, b) {
  if (a.scale === b.scale) {
    return [a, b];
  }

  const commonScale = Math.max(a.scale, b.scale);
  const multiplier = BigInt(10 ** (commonScale - a.scale));
  const bMultiplier = BigInt(10 ** (commonScale - b.scale));

  const normA = {
    coefficient: (BigInt(a.coefficient) * multiplier).toString(),
    scale: commonScale,
    unit: a.unit,
  };

  const normB = {
    coefficient: (BigInt(b.coefficient) * bMultiplier).toString(),
    scale: commonScale,
    unit: b.unit,
  };

  return [normA, normB];
}

/**
 * Convert exact quantity to BigInt coefficient micro-units.
 *
 * @param {Object} q - Quantity {coefficient, scale}
 * @returns {BigInt} BigInt coefficient
 */
export function toBigInt(q) {
  return BigInt(q.coefficient);
}

/**
 * Create exact quantity from BigInt coefficient.
 *
 * @param {BigInt|number} coefficientBigInt - Coefficient value
 * @param {number} scale - Decimal scale
 * @param {string} unit - Optional unit
 * @returns {Object} Exact quantity {coefficient, scale, unit}
 */
export function fromBigInt(coefficientBigInt, scale = 0, unit) {
  return {
    coefficient: coefficientBigInt.toString(),
    scale,
    unit,
  };
}
