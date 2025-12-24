import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// Pour obtenir le répertoire courant dans un module ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Répertoires de base à scanner
const baseDirs = [path.join(__dirname, "..", "src"), path.join(__dirname, "..", "packages")];

// --- REGEX MULTI-LIGNES ROBUSTE (avec modificateur 's' pour dotAll) ---
// Capture les formes : import { X } from 'path'; (Groupe 1) et import 'path'; (Groupe 2)
const IMPORT_REGEX_MULTILINE =
  /import(?:\s+(?:.*?from\s+)?["'](.*?)[""])?|import\s+["'](.*?)["']/gs;
// ----------------------------------------------------------------------

// Map global pour stocker les chemins de fichiers par nom de base (basename)
let allFilesIndex = new Map();
let nonExistentImportWarnings = []; // Fichiers VRAIMENT introuvables (ERREUR MAJEURE)
let duplicateFileNames = new Set();
let nonExistentReferencedFiles = new Set();
let importedFileNames = new Set();

/**
 * Vérifie si un chemin est un fichier .js ou .jsx existant.
 */
async function isFileJsOrJsx(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile() && (filePath.endsWith(".js") || filePath.endsWith(".jsx"));
  } catch (e) {
    // Le fichier n'existe pas ou le chemin est incorrect
    return false;
  }
}

/**
 * Parcourt récursivement un répertoire et collecte tous les fichiers .js et .jsx.
 * @param {string} dir - Le répertoire à parcourir.
 * @returns {Promise<string[]>} - Une liste de chemins de fichiers .js/.jsx.
 */
async function traverseDir(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Ignorer les répertoires node_modules
      if (entry.name === "node_modules") {
        continue;
      }
      files.push(...(await traverseDir(fullPath)));
    } else if (entry.isFile() && (entry.name.endsWith(".js") || entry.name.endsWith(".jsx"))) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Construit un index de tous les fichiers .js/.jsx dans les répertoires de base et signale les doublons.
 */
async function buildFileIndex() {
  console.log(`Construction de l'index des fichiers sous : ${baseDirs.join(", ")}`);
  let allJsFiles = [];
  for (const dir of baseDirs) {
    allJsFiles.push(...(await traverseDir(dir)));
  }

  for (const filePath of allJsFiles) {
    const basename = path.basename(filePath);
    if (!allFilesIndex.has(basename)) {
      allFilesIndex.set(basename, []);
    }
    allFilesIndex.get(basename).push(filePath);
  }

  // Rapport des fichiers avec des noms de base en double
  let hasDuplicates = false;
  for (const [basename, paths] of allFilesIndex.entries()) {
    if (paths.length > 1) {
      hasDuplicates = true;
      duplicateFileNames.add(basename);
      console.warn(
        `\n⚠️ Avertissement : Le fichier "${basename}" existe à plusieurs emplacements :`
      );
      paths.forEach((p) => console.warn(`  - ${p}`));
    }
  }
  if (hasDuplicates) {
    console.warn("\nCes doublons peuvent causer des ambiguïtés lors de la résolution des imports.");
  }
  console.log(`Indexation terminée. ${allJsFiles.length} fichiers .js/.jsx indexés.`);
}

/**
 * Trouve tous les chemins complets pour un nom de fichier cible donné en utilisant l'index.
 */
function findTargetFilesFromIndex(targetFileName) {
  return allFilesIndex.get(targetFileName) || [];
}

/**
 * Calcule le chemin relatif d'un fichier source vers un fichier cible.
 */
function getRelativePath(fromPath, toPath) {
  const fromDir = path.dirname(fromPath);
  let relPath = path.relative(fromDir, toPath);

  // S'assurer que le chemin relatif commence par ./ ou ../
  if (!relPath.startsWith(".") && !path.isAbsolute(relPath)) {
    relPath = "./" + relPath;
  }
  // Normaliser les séparateurs de chemin
  return relPath.replace(/\\/g, "/");
}

// --- FONCTION ROBUSTE DE VÉRIFICATION D'EXISTENCE (MODE PERMISSIF VITE) ---
/**
 * Tente de résoudre un chemin d'importation en vérifiant l'existence de différentes variations
 * (avec/sans extension, index.js/jsx pour les répertoires).
 * @param {string} baseResolvedPath - Le chemin absolu sans extension ni résolution de répertoire.
 * @returns {Promise<boolean>} - True si le fichier est trouvé, False sinon.
 */
async function checkPathExistence(baseResolvedPath) {
  const possiblePaths = [];
  const ext = path.extname(baseResolvedPath);

  // 1. Essayer le chemin tel quel (pour les imports de ressources, etc.)
  possiblePaths.push(baseResolvedPath);

  // Si aucune extension n'est spécifiée dans le chemin d'import (ou si l'extension n'est pas JS/JSX)
  if (ext === "" || !ext.match(/\.(js|jsx)$/i)) {
    // 2. Essayer d'ajouter .js / .jsx
    possiblePaths.push(baseResolvedPath + ".js");
    possiblePaths.push(baseResolvedPath + ".jsx");

    // 3. Essayer d'ajouter /index.js / /index.jsx (pour les imports de répertoires)
    const indexJsPath = path.join(baseResolvedPath, "index.js");
    const indexJsxPath = path.join(baseResolvedPath, "index.jsx");

    // Vérifier si le chemin de base est un répertoire valide avant d'ajouter index.*
    try {
      const stats = await fs.stat(baseResolvedPath);
      if (stats.isDirectory()) {
        possiblePaths.push(indexJsPath);
        possiblePaths.push(indexJsxPath);
      }
    } catch (e) {
      // Ce n'est pas un répertoire existant, on passe.
    }
  }

  // Parcourir toutes les combinaisons possibles
  for (const p of possiblePaths) {
    try {
      await fs.access(p);
      return true; // Trouvé !
    } catch (e) {
      // Continuer à essayer les autres chemins
    }
  }
  return false; // Rien trouvé
}
// ------------------------------------------------------------------------------------------

/**
 * Vérifie les importations dans un fichier donné et identifie les problèmes.
 * NOTE : Traite le fichier comme un bloc unique pour gérer les imports multi-lignes.
 */
async function checkImportsInFile(filePath) {
  const results = [];
  const fileContent = await fs.readFile(filePath, "utf8");

  let match;
  IMPORT_REGEX_MULTILINE.lastIndex = 0; // Réinitialiser l'index

  while ((match = IMPORT_REGEX_MULTILINE.exec(fileContent)) !== null) {
    // Le chemin capturé est soit dans le groupe 1 (avec from), soit dans le groupe 2 (side effect).
    const importPath = match[1] || match[2];

    if (!importPath) {
      continue; // Pas de chemin trouvé (devrait être rare)
    }

    // Trouver le numéro de ligne approximatif pour le rapport d'erreur
    // Compter les sauts de ligne jusqu'à la position du match.
    const lineIndex = fileContent.substring(0, match.index).split("\n").length;
    const lineNumber = lineIndex > 0 ? lineIndex : 1;

    // Ignorer les imports de modules Node.js ou de packages npm
    if (!importPath.startsWith(".") && !importPath.startsWith("/")) {
      continue;
    }

    // Ignorer les imports de ressources non-JS/JSX
    if (
      importPath.endsWith(".css") ||
      importPath.endsWith(".scss") ||
      importPath.endsWith(".less") ||
      importPath.endsWith(".png") ||
      importPath.endsWith(".svg")
    ) {
      continue;
    }

    const fileDir = path.dirname(filePath);
    let resolvedPath = path.resolve(fileDir, importPath);

    // --- Logique de vérification PERMISIVE (Vite) ---
    let exists = await checkPathExistence(resolvedPath);

    if (exists) {
      // Le fichier est trouvé, l'import est considéré comme valide par le bundler (Vite).
      continue;
    }

    // --- Si l'exécution arrive ici, le fichier est VRAIMENT introuvable (ERREUR). ---

    const targetFileName = path.basename(importPath).split("?")[0];
    let searchFileName = targetFileName;
    let potentialTargetFiles = [];

    // Si l'importation est incorrecte, chercher des corrections possibles via l'index
    if (path.extname(targetFileName) === "") {
      // Si aucune extension, essayer les deux (.js et .jsx)
      const jsSearchName = targetFileName + ".js";
      const jsxSearchName = targetFileName + ".jsx";
      importedFileNames.add(jsSearchName);
      importedFileNames.add(jsxSearchName);
      potentialTargetFiles.push(...findTargetFilesFromIndex(jsSearchName));
      potentialTargetFiles.push(...findTargetFilesFromIndex(jsxSearchName));
      searchFileName = `${targetFileName}.js ou ${targetFileName}.jsx`;
    } else {
      // Si une extension est présente, la rechercher directement
      importedFileNames.add(targetFileName);
      potentialTargetFiles.push(...findTargetFilesFromIndex(targetFileName));
    }

    if (potentialTargetFiles.length === 0) {
      // Cas 1 : VRAIMENT INTROUVABLE DANS TOUT LE PROJET (ERREUR MAJEURE)
      nonExistentImportWarnings.push({
        file: filePath,
        line: lineNumber,
        badImport: importPath,
        message: `Le fichier "${searchFileName}" importé ne semble exister nulle part dans les répertoires scannés.`,
      });
      nonExistentReferencedFiles.add(searchFileName);
    } else {
      // Cas 2 : Mauvais référencement, mais la cible existe ailleurs (AVERTISSEMENT/CORRECTION)
      const fixes = potentialTargetFiles.map((targetFile) => {
        const correctPath = getRelativePath(filePath, targetFile);
        return { targetFile, correctPath };
      });

      results.push({
        file: filePath,
        line: lineNumber,
        badImport: importPath,
        fixes: fixes,
      });
    }
  }
  return results;
}

/**
 * Fonction principale pour exécuter la vérification des imports.
 */
async function main() {
  let filterImportFileName = null; // Filtre d'import existant
  let targetFile = null; // Filtre pour un seul fichier
  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    // Gestion du filtre d'import existant
    if (args[i] === "--filter-import" && args[i + 1]) {
      filterImportFileName = args[i + 1];
      i++;
    }
    // Gestion du filtre de fichier
    if (args[i] === "--file" && args[i + 1]) {
      targetFile = path.resolve(args[i + 1]); // Convertir le chemin en absolu
      i++;
    }
  }

  await buildFileIndex();

  let allJsFilesToScan = [];
  // --- LOGIQUE DE FILTRAGE ---
  if (targetFile) {
    if (await isFileJsOrJsx(targetFile)) {
      allJsFilesToScan.push(targetFile);
      console.log(`\nMode Fichier Unique : Scan de ${path.basename(targetFile)} uniquement.`);
    } else {
      console.error(
        `\n🚨 Erreur : Le fichier spécifié (${targetFile}) n'existe pas ou n'est pas un fichier .js ou .jsx.`
      );
      return;
    }
  } else {
    // Logique existante : Parcourir tous les répertoires de base
    for (const dir of baseDirs) {
      allJsFilesToScan.push(...(await traverseDir(dir)));
    }
  }
  // --------------------------

  let allFixableImports = []; // Contient les AVERTISSEMENTS/Corrections

  console.log("\nDébut de la vérification des imports...");
  for (const file of allJsFilesToScan) {
    const fileResults = await checkImportsInFile(file);
    allFixableImports.push(...fileResults);
  }

  // Appliquer le filtre si spécifié
  let filteredFixableImports = allFixableImports;
  let filteredNonExistentImportWarnings = nonExistentImportWarnings;

  if (filterImportFileName) {
    console.log(`
Filtrage des résultats pour l'import : "${filterImportFileName}"`);
    filteredFixableImports = allFixableImports.filter(
      (result) =>
        result.badImport.includes(filterImportFileName) ||
        result.fixes.some((fix) => fix.targetFile.includes(filterImportFileName))
    );
    filteredNonExistentImportWarnings = nonExistentImportWarnings.filter((warning) =>
      warning.badImport.includes(filterImportFileName)
    );
  }

  console.log("\n--- Résumé des problèmes d'importation ---");

  // 1. AFFICHAGE DES ERREURS MAJEURES (Fichiers VRAIMENT Introuvables)
  if (filteredNonExistentImportWarnings.length > 0) {
    console.log("\n🚨 ERREUR MAJEURE : Imports pointant vers des fichiers introuvables :\n");
    filteredNonExistentImportWarnings.forEach((warning) => {
      // RENDU CLICABLE
      console.log(`--> ${warning.file}:${warning.line}`);
      console.log(`Import : "${warning.badImport}"`);
      console.log(`  Message : ${warning.message}\n`);
    });
  } else {
    console.log("\n✅ Aucun import pointant vers un fichier introuvable détecté.");
  }

  // 2. AFFICHAGE DES AVERTISSEMENTS (Chemin Invalide/Mal Référencé mais cible trouvée)
  if (filteredFixableImports.length > 0) {
    console.log("\n⚠️ AVERTISSEMENT : Imports avec un chemin invalide (correction requise) :\n");
    filteredFixableImports.forEach((result) => {
      // RENDU CLICABLE
      console.log(`--> ${result.file}:${result.line}`);
      console.log(`Chemin incorrect : "${result.badImport}"`);
      console.log("  Correction requise :");
      result.fixes.forEach((fix, index) => {
        console.log(`    ${index + 1}. Fichier cible trouvé : ${fix.targetFile}`);
        console.log(`       Ligne actuelle : import ... from "${result.badImport}"`);
        console.log(`       Ligne corrigée : import ... from "${fix.correctPath}"`);
      });
      console.log("\n");
    });
  } else {
    console.log("\n✅ Aucun import mal référencé ou sous-optimal trouvé.");
  }

  // --- Nouveaux récapitulatifs et compteurs ---
  console.log("\n--- Récapitulatif global ---");

  // 1) Récapitulatif des fichiers qui existent à plusieurs emplacements
  const relevantDuplicateFileNames = new Set(
    [...duplicateFileNames].filter((name) => importedFileNames.has(name))
  );

  if (relevantDuplicateFileNames.size > 0) {
    console.log("\n⚠️ Fichiers existant à plusieurs emplacements (doublons) :");
    relevantDuplicateFileNames.forEach((name) => console.log(`  - ${name}`));
  } else {
    console.log("\n✅ Aucun fichier en double détecté.");
  }

  // 2) Récapitulatif des fichiers référencés mais qui n'existent pas
  if (nonExistentReferencedFiles.size > 0) {
    console.log("\n❌ Fichiers référencés mais introuvables :");
    nonExistentReferencedFiles.forEach((name) => console.log(`  - ${name}`));
  } else {
    console.log("\n✅ Aucun fichier référencé introuvable détecté.");
  }

  // Compteurs
  const totalFixesNeeded = filteredFixableImports.length + filteredNonExistentImportWarnings.length;
  const fixesInvolvingDuplicates = filteredFixableImports.filter((imp) =>
    imp.fixes.some((fix) => duplicateFileNames.has(path.basename(fix.targetFile)))
  ).length;
  const fixesInvolvingNonExistent = filteredNonExistentImportWarnings.length;

  console.log("\n--- Statistiques des corrections ---\n");
  console.log(`Total des imports nécessitant une correction : ${totalFixesNeeded}`);
  console.log(
    `  - Imports avec chemin invalide (Correction Requise) : ${filteredFixableImports.length}`
  );
  console.log(
    `  - Imports vers fichiers introuvables (Erreur Majeure) : ${fixesInvolvingNonExistent}`
  );

  if (totalFixesNeeded === 0) {
    console.log("\n🎉 Tous les imports semblent corrects !");
  } else {
    console.log("\nObjectif : 0 correction restante !");
  }
}

main().catch((err) => console.error("Erreur du script :", err.message));
