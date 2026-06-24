import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SOVEREIGN_MODELS, EMBEDDING_MODELS } from "../registry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// On remonte de 3 niveaux depuis packages/models/scripts/ pour atteindre la racine du repo
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const ROOT_MODELS_DIR = path.join(REPO_ROOT, "models");

async function downloadModel(id) {
  // Check if it's an embedding model first
  const embeddingModel = EMBEDDING_MODELS[id];
  if (embeddingModel) {
    console.log(`--- Embedding Model : ${embeddingModel.name} ---`);
    console.log(`Provider: ${embeddingModel.provider}`);
    console.log(`Description: ${embeddingModel.description}`);
    console.log(`\nDimensions: ${embeddingModel.native_dimensions} → ${embeddingModel.output_dimensions} (${embeddingModel.dimension_method.toUpperCase()})`);
    console.log(`Policy: ${embeddingModel.policy_version}`);
    console.log(`\n📦 Installation:`);
    console.log(`  ${embeddingModel.install_command}`);
    console.log(`\n📖 Documentation: ${embeddingModel.url}`);
    console.log(`\n⚠️  Les embeddings nécessitent le provider '${embeddingModel.provider}' d'être installé et actif.`);
    return;
  }

  const model = SOVEREIGN_MODELS[id];
  if (!model) {
    console.error("Modèle inconnu :", id);
    console.error("\nModèles disponibles (LLM):");
    Object.keys(SOVEREIGN_MODELS).forEach(key => console.log(`  - ${key}`));
    console.error("\nModèles disponibles (Embeddings):");
    Object.keys(EMBEDDING_MODELS).forEach(key => console.log(`  - ${key}`));
    return;
  }

  if (!fs.existsSync(ROOT_MODELS_DIR)) {
    console.log("Création du dossier :", ROOT_MODELS_DIR);
    fs.mkdirSync(ROOT_MODELS_DIR, { recursive: true });
  }

  const targetPath = path.join(ROOT_MODELS_DIR, model.filename);
  if (fs.existsSync(targetPath)) {
    console.log(`Le modèle "${model.name}" est déjà présent dans ${ROOT_MODELS_DIR}`);
    return;
  }

  console.log(`--- Registre Kudocracy : ${model.name} ---`);
  console.log("Cible :", targetPath);

  console.log("\nPour télécharger automatiquement (nécessite Python + huggingface_hub) :");
  console.log(`pnpm run model:pull`);

  console.log("\nOu manuellement via curl :");
  console.log(`curl -L "${model.url}" -o "${targetPath}"`);
}

const modelId = process.argv[2] || "help";

if (modelId === "help" || modelId === "--help" || modelId === "-h") {
  console.log(`
🏛️ Kudocracy Model Downloader

Usage:
  node scripts/download.js [model-id]

Modèles LLM (GGUF):
${Object.keys(SOVEREIGN_MODELS).map(key => `  ${key.padEnd(25)} ${SOVEREIGN_MODELS[key].name}`).join('\n')}

Modèles d'Embeddings:
${Object.keys(EMBEDDING_MODELS).map(key => `  ${key.padEnd(25)} ${EMBEDDING_MODELS[key].name}`).join('\n')}

Exemples:
  node scripts/download.js qwen-2.5-coder-1.5b
  node scripts/download.js qwen3-embedding-4b
`);
} else {
  downloadModel(modelId);
}
