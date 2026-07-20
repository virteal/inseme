import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const schemaPath = path.join(root, "schema", "cop-packet-kernel.schema.json");
const outputPath = path.join(root, "generated", "cop-packet-kernel.generated.ts");

function literal(value) {
  return JSON.stringify(value);
}

function referencedName(reference) {
  const prefix = "#/$defs/";
  if (!reference.startsWith(prefix)) {
    throw new Error(`Only local $defs references are supported: ${reference}`);
  }
  return reference.slice(prefix.length);
}

function union(items) {
  return [...new Set(items)].join(" | ");
}

function inlineType(node) {
  if (node.$ref) return referencedName(node.$ref);
  if (Object.hasOwn(node, "const")) return literal(node.const);
  if (node.enum) return union(node.enum.map(literal));
  if (node.oneOf) return union(node.oneOf.map(inlineType));
  if (node.anyOf) return union(node.anyOf.map(inlineType));

  if (node.type === "string") return "string";
  if (node.type === "integer" || node.type === "number") return "number";
  if (node.type === "boolean") return "boolean";
  if (node.type === "null") return "null";
  if (node.type === "array") {
    const item = inlineType(node.items ?? {});
    return item.includes(" | ") ? `Array<${item}>` : `${item}[]`;
  }
  if (node.type === "object") {
    const properties = node.properties ?? {};
    if (Object.keys(properties).length === 0) return "Record<string, unknown>";
    const required = new Set(node.required ?? []);
    const fields = Object.entries(properties).map(
      ([name, property]) => `  ${JSON.stringify(name)}${required.has(name) ? "" : "?"}: ${inlineType(property)};`,
    );
    return `{\n${fields.join("\n")}\n}`;
  }
  return "unknown";
}

function renderDefinition(name, node) {
  if (node.type === "object" && !node.oneOf && !node.anyOf) {
    const properties = node.properties ?? {};
    const required = new Set(node.required ?? []);
    const fields = Object.entries(properties).map(
      ([propertyName, property]) =>
        `  ${JSON.stringify(propertyName)}${required.has(propertyName) ? "" : "?"}: ${inlineType(property)};`,
    );
    if (fields.length === 0) return `export type ${name} = Record<string, unknown>;`;
    return `export interface ${name} {\n${fields.join("\n")}\n}`;
  }
  return `export type ${name} = ${inlineType(node)};`;
}

export function generateTypes(schema) {
  const header = [
    "// Generated from ../schema/cop-packet-kernel.schema.json.",
    "// Experimental and non-normative. Do not edit by hand.",
    "",
  ];
  const definitions = Object.entries(schema.$defs ?? {}).map(([name, node]) =>
    renderDefinition(name, node),
  );
  return `${header.join("\n")}${definitions.join("\n\n")}\n`;
}

async function main() {
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  const generated = generateTypes(schema);
  if (process.argv.includes("--check")) {
    const current = await readFile(outputPath, "utf8");
    if (current !== generated) {
      throw new Error(`Generated projection is stale: ${path.relative(process.cwd(), outputPath)}`);
    }
    process.stdout.write("generated projection is reproducible\n");
    return;
  }
  await writeFile(outputPath, generated, "utf8");
  process.stdout.write(`wrote ${path.relative(process.cwd(), outputPath)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
