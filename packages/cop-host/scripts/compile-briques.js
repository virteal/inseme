#!/usr/bin/env node
/**
 * Brique Compiler
 * Scanne le monorepo pour trouver les brique.config.js et génère les points d'entrée nécessaires.
 */

import { glob } from "glob";
import { resolve, dirname, join, relative } from "path";
import { fileURLToPath } from "url";
import { writeFileSync, mkdirSync, existsSync, rmSync, readFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../..");
const APPS_PATH = resolve(ROOT, "apps");

async function compile() {
  console.log("🏗️  Compilation des briques...");

  // 1. Trouver tous les manifestes
  const manifests = await glob("**/brique.config.js", {
    cwd: ROOT,
    ignore: ["**/node_modules/**", "**/dist/**"],
  });

  console.log(`🔍 ${manifests.length} briques trouvées.`);

  const briques = [];

  // Identifier les applications hôtes (celles qui ont un netlify.toml)
  const hostApps = (await glob("*/netlify.toml", { cwd: APPS_PATH })).map((p) =>
    dirname(p)
  );

  console.log(`🏠 Applications hôtes détectées : ${hostApps.join(", ")}`);

  // NETTOYAGE PRÉALABLE pour l'idempotence
  for (const appName of hostApps) {
    const appPath = join(APPS_PATH, appName);
    const dirsToClean = [
      join(appPath, "src/netlify/functions/gen"),
      join(appPath, "src/netlify/edge-functions/gen"),
    ];
    for (const dir of dirsToClean) {
      if (existsSync(dir)) {
        console.log(`🧹 Nettoyage de ${relative(ROOT, dir)}`);
        rmSync(dir, { recursive: true, force: true });
      }
    }
  }

  for (const manifestPath of manifests) {
    const fullPath = resolve(ROOT, manifestPath);
    const briqueDir = dirname(fullPath);

    // Import dynamique du manifeste
    const { default: config } = await import(
      `file://${fullPath}?t=${Date.now()}`
    );

    console.log(`📦 Traitement de la brique: ${config.id} (${config.name})`);

    briques.push({
      ...config,
      _manifestPath: manifestPath,
      _briqueDir: briqueDir,
    });

    // 2. Générer les wrappers pour chaque application hôte
    for (const appName of hostApps) {
      const appPath = join(APPS_PATH, appName);

      // Functions
      if (config.functions) {
        const genDir = join(appPath, "src/netlify/functions/gen");
        if (!existsSync(genDir)) mkdirSync(genDir, { recursive: true });

        for (const [funcName, funcConfig] of Object.entries(config.functions)) {
          const handlerPath = resolve(briqueDir, funcConfig.handler);
          const relHandlerPath = relative(genDir, handlerPath).replace(
            /\\/g,
            "/"
          );

          const wrapperContent = `// GÉNÉRÉ AUTOMATIQUEMENT PAR COP-HOST COMPILER
import { defineFunction } from "@inseme/cop-host/runtime/function";
import handler from "${relHandlerPath}";

export default defineFunction(handler);
`;
          writeFileSync(
            join(genDir, `${config.id}-${funcName}.js`),
            wrapperContent
          );
        }
      }

      // Edge Functions
      if (config.edgeFunctions) {
        const genDir = join(appPath, "src/netlify/edge-functions/gen");
        if (!existsSync(genDir)) mkdirSync(genDir, { recursive: true });

        for (const [funcName, funcConfig] of Object.entries(
          config.edgeFunctions
        )) {
          const handlerPath = resolve(briqueDir, funcConfig.handler);
          const relHandlerPath = relative(genDir, handlerPath).replace(
            /\\/g,
            "/"
          );

          const wrapperContent = `// GÉNÉRÉ AUTOMATIQUEMENT PAR COP-HOST COMPILER
import { defineEdgeFunction } from "@inseme/cop-host/runtime/edge";
import handler from "${relHandlerPath}";

export default defineEdgeFunction(handler);
`;
          writeFileSync(
            join(genDir, `${config.id}-${funcName}.js`),
            wrapperContent
          );
        }
      }
    }
  }

  // 4. Générer le registre frontend pour chaque application
  for (const appName of hostApps) {
    generateFrontendRegistry(appName, briques);
    updateNetlifyToml(appName, briques);
  }

  console.log("✅ Compilation terminée.");
}

function updateNetlifyToml(appName, briques) {
  const tomlPath = join(APPS_PATH, appName, "netlify.toml");
  if (!existsSync(tomlPath)) return;

  let content = readFileSync(tomlPath, "utf8");

  // Générer les redirections pour toutes les briques
  const redirects = [];
  const edgeConfigs = [];

  briques.forEach((b) => {
    // Functions standard
    if (b.functions) {
      Object.keys(b.functions).forEach((funcName) => {
        const apiPath = `/api/${b.id}-${funcName}`;
        const target = `/.netlify/functions/${b.id}-${funcName}`;
        redirects.push(
          `[[redirects]]\n  from = "${apiPath}"\n  to = "${target}"\n  status = 200`
        );
      });
    }

    // Edge Functions
    if (b.edgeFunctions) {
      Object.keys(b.edgeFunctions).forEach((funcName) => {
        const config = b.edgeFunctions[funcName];
        const functionName = `${b.id}-${funcName}`;
        // Si un path est défini dans la brique, on l'utilise, sinon on utilise /api/edge/[brique]-[func]
        const path = config.path || `/api/edge/${functionName}`;

        edgeConfigs.push(
          `[[edge_functions]]\n  function = "${functionName}"\n  path = "${path}"`
        );
      });
    }
  });

  // Mise à jour des Redirections
  const sectionStart = "# --- GENERATED BRIQUE REDIRECTS START ---";
  const sectionEnd = "# --- GENERATED BRIQUE REDIRECTS END ---";
  const newSection = `${sectionStart}\n${redirects.join("\n\n")}\n${sectionEnd}`;

  if (content.includes(sectionStart) && content.includes(sectionEnd)) {
    const re = new RegExp(`${sectionStart}[\\s\\S]*?${sectionEnd}`, "g");
    content = content.replace(re, newSection);
  } else if (redirects.length > 0) {
    if (content.includes("[[redirects]]")) {
      content = content.replace(
        "[[redirects]]",
        `${newSection}\n\n[[redirects]]`
      );
    } else {
      content += `\n\n${newSection}`;
    }
  }

  // Mise à jour des Edge Functions
  const edgeStart = "# --- GENERATED BRIQUE EDGE START ---";
  const edgeEnd = "# --- GENERATED BRIQUE EDGE END ---";
  const newEdgeSection = `${edgeStart}\n${edgeConfigs.join("\n\n")}\n${edgeEnd}`;

  if (content.includes(edgeStart) && content.includes(edgeEnd)) {
    const re = new RegExp(`${edgeStart}[\\s\\S]*?${edgeEnd}`, "g");
    content = content.replace(re, newEdgeSection);
  } else if (edgeConfigs.length > 0) {
    if (content.includes("[[edge_functions]]")) {
      content = content.replace(
        "[[edge_functions]]",
        `${newEdgeSection}\n\n[[edge_functions]]`
      );
    } else {
      content += `\n\n${newEdgeSection}`;
    }
  }

  writeFileSync(tomlPath, content);
  console.log(`📝 netlify.toml mis à jour pour ${appName}`);
}

function generateFrontendRegistry(appName, briques) {
  const appPath = join(APPS_PATH, appName);
  const registryPath = join(appPath, "src/brique-registry.gen.js");

  let content = `// GÉNÉRÉ AUTOMATIQUEMENT PAR COP-HOST COMPILER
// Ne pas modifier manuellement

/**
 * Registre des briques disponibles et leurs configurations
 */
export const BRIQUES = ${JSON.stringify(
    briques.map((b) => ({
      id: b.id,
      name: b.name,
      feature: b.feature,
      routes: b.routes,
      menuItems: b.menuItems,
      tools: b.tools,
      configSchema: b.configSchema,
    })),
    null,
    2
  )};

/**
 * Mappage des composants pour lazy-loading
 */
export const BRIQUE_COMPONENTS = {
`;

  briques.forEach((b) => {
    if (b.routes) {
      b.routes.forEach((route) => {
        const componentPath = resolve(b._briqueDir, route.component);
        const relPath = relative(join(appPath, "src"), componentPath).replace(
          /\\/g,
          "/"
        );
        content += `  "${b.id}:${route.path}": () => import("./${relPath}"),\n`;
      });
    }
  });

  content += `};\n`;

  writeFileSync(registryPath, content);
}

compile().catch((err) => {
  console.error("❌ Erreur lors de la compilation:", err);
  process.exit(1);
});
