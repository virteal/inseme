#!/usr/bin/env node
/**
 * Script pour vérifier et synchroniser les versions de schéma
 * sur toutes les instances Ophélia
 *
 * Usage:
 *   node scripts/check-schema-versions.js           # Affiche l'état de toutes les instances
 *   node scripts/check-schema-versions.js --sync    # Propose les migrations à appliquer
 *   node scripts/check-schema-versions.js --update corte  # Met à jour une instance spécifique
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// ============================================
// Configuration
// ============================================

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

// Charger les instances depuis le registry ou les fichiers locaux
async function loadInstances() {
  const instancesDir = path.join(process.cwd(), "instances");
  const instances = [];

  // Charger depuis les fichiers JSON locaux
  if (fs.existsSync(instancesDir)) {
    const files = fs
      .readdirSync(instancesDir)
      .filter((f) => f.endsWith(".json") && !f.includes("schema") && !f.includes("example"));

    for (const file of files) {
      try {
        const config = JSON.parse(fs.readFileSync(path.join(instancesDir, file), "utf-8"));
        if (config.supabase_url) {
          instances.push({
            subdomain: config.subdomain || file.replace(".json", ""),
            name: config.community_name || config.subdomain,
            supabase_url: config.supabase_url,
            supabase_anon_key: config.supabase_anon_key,
          });
        }
      } catch (e) {
        console.warn(`⚠️  Impossible de charger ${file}: ${e.message}`);
      }
    }
  }

  // Ajouter l'instance principale depuis .env si pas déjà présente
  if (process.env.VITE_SUPABASE_URL) {
    const mainExists = instances.some((i) => i.supabase_url === process.env.VITE_SUPABASE_URL);
    if (!mainExists) {
      instances.unshift({
        subdomain: "main",
        name: "Instance principale",
        supabase_url: process.env.VITE_SUPABASE_URL,
        supabase_anon_key: process.env.VITE_SUPABASE_ANON_KEY,
      });
    }
  }

  return instances;
}

// ============================================
// Gestion des migrations
// ============================================

function getAllMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && !f.includes("old_unused"))
    .sort()
    .map((filename) => {
      const filePath = path.join(MIGRATIONS_DIR, filename);
      const content = fs.readFileSync(filePath, "utf-8");
      const checksum = crypto.createHash("sha256").update(content).digest("hex").substring(0, 16);

      // Extraire la version du nom de fichier (ex: 20251205_xxx.sql -> 20251205)
      const versionMatch = filename.match(/^(\d{8})/);
      const version = versionMatch ? versionMatch[1] : filename.replace(".sql", "");

      return {
        filename,
        version,
        name: filename.replace(".sql", ""),
        checksum,
        filePath,
      };
    });
}

// ============================================
// Vérification d'une instance
// ============================================

async function checkInstance(instance) {
  const result = {
    subdomain: instance.subdomain,
    name: instance.name,
    url: instance.supabase_url,
    status: "unknown",
    currentVersion: null,
    migrationsCount: 0,
    pendingMigrations: [],
    error: null,
  };

  try {
    const supabase = createClient(instance.supabase_url, instance.supabase_anon_key);

    // Vérifier si la table schema_version existe
    const { data: versionData, error: versionError } = await supabase.rpc("get_schema_version");

    if (versionError) {
      // Table n'existe pas encore
      if (
        versionError.message.includes("does not exist") ||
        versionError.message.includes("function") ||
        versionError.code === "42883"
      ) {
        result.status = "no-versioning";
        result.currentVersion = "N/A";
        result.pendingMigrations = getAllMigrations().map((m) => m.version);
      } else {
        throw versionError;
      }
    } else if (versionData && versionData.length > 0) {
      result.status = "ok";
      result.currentVersion = versionData[0].current_version;
      result.migrationsCount = versionData[0].migrations_count;

      // Récupérer les migrations appliquées
      const { data: appliedMigrations } = await supabase
        .from("schema_migrations")
        .select("version")
        .order("version");

      const appliedVersions = new Set((appliedMigrations || []).map((m) => m.version));
      const allMigrations = getAllMigrations();

      result.pendingMigrations = allMigrations
        .filter((m) => !appliedVersions.has(m.version))
        .map((m) => m.version);
    }

    // Déterminer le status final
    if (result.pendingMigrations.length > 0) {
      result.status = result.status === "no-versioning" ? "no-versioning" : "outdated";
    } else if (result.status === "ok") {
      result.status = "up-to-date";
    }
  } catch (error) {
    result.status = "error";
    result.error = error.message;
  }

  return result;
}

// ============================================
// Affichage
// ============================================

function printStatus(results) {
  console.log("\n╔════════════════════════════════════════════════════════════════════════════╗");
  console.log("║                    📊 État des schémas Supabase                            ║");
  console.log("╚════════════════════════════════════════════════════════════════════════════╝\n");

  const allMigrations = getAllMigrations();
  console.log(`📦 Migrations disponibles: ${allMigrations.length}`);
  console.log(
    `   Dernière version: ${allMigrations[allMigrations.length - 1]?.version || "N/A"}\n`
  );

  console.log("┌─────────────────┬────────────────┬──────────────┬─────────────────────────┐");
  console.log("│ Instance        │ Version        │ Status       │ Migrations en attente   │");
  console.log("├─────────────────┼────────────────┼──────────────┼─────────────────────────┤");

  for (const r of results) {
    const subdomain = r.subdomain.padEnd(15).substring(0, 15);
    const version = (r.currentVersion || "N/A").padEnd(14).substring(0, 14);

    let statusIcon;
    switch (r.status) {
      case "up-to-date":
        statusIcon = "✅ OK        ";
        break;
      case "outdated":
        statusIcon = "⚠️  Outdated ";
        break;
      case "no-versioning":
        statusIcon = "🆕 New       ";
        break;
      case "error":
        statusIcon = "❌ Error     ";
        break;
      default:
        statusIcon = "❓ Unknown   ";
    }

    const pending = r.pendingMigrations.length > 0 ? `${r.pendingMigrations.length} pending` : "—";

    console.log(`│ ${subdomain} │ ${version} │ ${statusIcon} │ ${pending.padEnd(23)} │`);
  }

  console.log("└─────────────────┴────────────────┴──────────────┴─────────────────────────┘\n");

  // Résumé
  const outdated = results.filter((r) => r.status === "outdated" || r.status === "no-versioning");
  const errors = results.filter((r) => r.status === "error");

  if (outdated.length > 0) {
    console.log(`⚠️  ${outdated.length} instance(s) nécessitent une mise à jour:`);
    for (const r of outdated) {
      console.log(`   - ${r.subdomain}: ${r.pendingMigrations.join(", ")}`);
    }
    console.log("\n   Pour mettre à jour, exécutez:");
    console.log(`   node scripts/check-schema-versions.js --update <subdomain>\n`);
  }

  if (errors.length > 0) {
    console.log(`❌ ${errors.length} instance(s) en erreur:`);
    for (const r of errors) {
      console.log(`   - ${r.subdomain}: ${r.error}`);
    }
    console.log("");
  }

  if (outdated.length === 0 && errors.length === 0) {
    console.log("✅ Toutes les instances sont à jour!\n");
  }
}

// ============================================
// Génération du SQL de mise à jour
// ============================================

function generateUpdateSQL(pendingMigrations) {
  const migrations = getAllMigrations();
  const pending = migrations.filter((m) => pendingMigrations.includes(m.version));

  let sql = `-- ============================================
-- Script de mise à jour généré le ${new Date().toISOString()}
-- Migrations à appliquer: ${pending.length}
-- ============================================

`;

  for (const migration of pending) {
    const content = fs.readFileSync(migration.filePath, "utf-8");
    sql += `-- ============================================
-- Migration: ${migration.filename}
-- Version: ${migration.version}
-- Checksum: ${migration.checksum}
-- ============================================

${content}

-- Enregistrer la migration
SELECT register_migration('${migration.version}', '${migration.name}', '${migration.checksum}', NULL);

`;
  }

  return sql;
}

// ============================================
// Main
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const showSync = args.includes("--sync");
  const updateTarget = args.includes("--update") ? args[args.indexOf("--update") + 1] : null;

  // Charger le .env si disponible
  try {
    const dotenv = await import("dotenv");
    dotenv.config();
  } catch (e) {
    // dotenv pas installé, pas grave
  }

  // Charger les instances
  const instances = await loadInstances();

  if (instances.length === 0) {
    console.log("❌ Aucune instance trouvée.");
    console.log("   Ajoutez des fichiers de config dans instances/ ou configurez .env");
    process.exit(1);
  }

  // Vérifier chaque instance
  console.log(`\n🔍 Vérification de ${instances.length} instance(s)...`);

  const results = [];
  for (const instance of instances) {
    process.stdout.write(`   ${instance.subdomain}... `);
    const result = await checkInstance(instance);
    console.log(result.status === "error" ? "❌" : "✓");
    results.push(result);
  }

  // Afficher le status
  printStatus(results);

  // Mode --update
  if (updateTarget) {
    const target = results.find((r) => r.subdomain === updateTarget);
    if (!target) {
      console.log(`❌ Instance '${updateTarget}' non trouvée.`);
      process.exit(1);
    }

    if (target.pendingMigrations.length === 0) {
      console.log(`✅ Instance '${updateTarget}' déjà à jour.`);
      process.exit(0);
    }

    console.log(`\n📝 Génération du SQL de mise à jour pour '${updateTarget}'...\n`);
    const sql = generateUpdateSQL(target.pendingMigrations);

    // Sauvegarder le SQL
    const outputPath = path.join(process.cwd(), "instances", "sql", `${updateTarget}-update.sql`);
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, sql);

    console.log(`✅ SQL généré: ${outputPath}`);
    console.log(
      `\n   Exécutez ce SQL dans le SQL Editor de Supabase pour l'instance '${updateTarget}'.`
    );
  }

  // Mode --sync : afficher les SQL pour toutes les instances outdated
  if (showSync) {
    const outdated = results.filter((r) => r.status === "outdated" || r.status === "no-versioning");

    if (outdated.length === 0) {
      console.log("✅ Toutes les instances sont synchronisées.");
      process.exit(0);
    }

    for (const instance of outdated) {
      console.log(`\n📝 SQL pour '${instance.subdomain}':`);
      console.log("─".repeat(60));
      const sql = generateUpdateSQL(instance.pendingMigrations);
      console.log(sql.substring(0, 500) + "...\n");

      const outputPath = path.join(
        process.cwd(),
        "instances",
        "sql",
        `${instance.subdomain}-update.sql`
      );
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.writeFileSync(outputPath, sql);
      console.log(`   → Fichier complet: ${outputPath}`);
    }
  }
}

main().catch(console.error);
