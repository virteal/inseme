#!/usr/bin/env node
/**
 * Script de provisioning d'une nouvelle instance Ophélia
 *
 * Usage:
 *   node scripts/provision-instance.js --interactive
 *   node scripts/provision-instance.js --config instances/universita.json
 *
 * Ce script :
 * 1. Crée le projet Supabase (via API ou guide manuel)
 * 2. Applique les migrations
 * 3. Provisionne le vault (instance_config)
 * 4. Enregistre l'instance dans le registry (hub)
 * 5. Génère la documentation de l'instance
 */

import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import readline from "readline";

// ============================================
// Configuration des templates par type de communauté
// ============================================

const COMMUNITY_TEMPLATES = {
  municipality: {
    name_template: "Ville de {city}",
    governance: "conseil municipal",
    meeting: "séance du conseil",
    decision: "délibération",
    citizens: "citoyens",
    hashtag_template: "#{city}Transparente",
    movement_template: "Transparence {city}",
  },
  intercommunality: {
    name_template: "Communauté de communes {name}",
    governance: "conseil communautaire",
    meeting: "séance du conseil",
    decision: "délibération",
    citizens: "habitants",
    hashtag_template: "#{code}Transparente",
    movement_template: "Transparence {name}",
  },
  university: {
    name_template: "{name}",
    governance: "conseil d'administration",
    meeting: "séance du CA",
    decision: "délibération",
    citizens: "communauté universitaire",
    hashtag_template: "#{code}Transparente",
    movement_template: "Transparenza Universitaria",
  },
  association: {
    name_template: "{name}",
    governance: "conseil d'administration",
    meeting: "assemblée générale",
    decision: "résolution",
    citizens: "membres",
    hashtag_template: "#{code}",
    movement_template: "{name}",
  },
  region: {
    name_template: "Région {name}",
    governance: "conseil régional",
    meeting: "session plénière",
    decision: "délibération",
    citizens: "habitants",
    hashtag_template: "#{code}Transparente",
    movement_template: "Transparence {name}",
  },
};

// ============================================
// Utilitaires
// ============================================

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question, defaultValue = "") {
  return new Promise((resolve) => {
    const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
    rl.question(prompt, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

function askChoice(question, choices) {
  return new Promise((resolve) => {
    console.log(`\n${question}`);
    choices.forEach((choice, i) => {
      console.log(`  ${i + 1}. ${choice}`);
    });
    rl.question("Choix (numéro): ", (answer) => {
      const index = parseInt(answer) - 1;
      resolve(choices[index] || choices[0]);
    });
  });
}

function generateSubdomain(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 20);
}

// ============================================
// Collecte des informations
// ============================================

async function collectInstanceInfo() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║     🚀 Provisioning d'une nouvelle instance Ophélia        ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const info = {};

  // Type de communauté
  const communityTypes = Object.keys(COMMUNITY_TEMPLATES);
  info.community_type = await askChoice(
    "Type de communauté ?",
    communityTypes.map((t) => t.charAt(0).toUpperCase() + t.slice(1))
  );
  info.community_type = info.community_type.toLowerCase();

  // Informations de base
  info.community_name = await ask("Nom officiel de la communauté");
  info.city_name = await ask("Ville/Localisation", info.community_name.split(" ").pop());
  info.subdomain = await ask(
    "Sous-domaine (ex: corte, universita)",
    generateSubdomain(info.city_name)
  );

  // Codes administratifs
  info.insee_code = await ask("Code INSEE/UAI (optionnel)", "");
  info.region_code = await ask("Code région", "COR");
  info.region_name = await ask("Nom région", "Corse");

  // Contact
  info.contact_email = await ask("Email de contact admin");
  info.contact_name = await ask("Nom du contact pilote", "");

  // Géolocalisation
  const defaultCenter = "42.3084,9.1505"; // Corte par défaut
  const center = await ask("Centre carte (lat,lon)", defaultCenter);
  info.map_center = center.split(",").map(Number);

  // Supabase
  console.log("\n--- Configuration Supabase ---");
  console.log("Créez un projet sur https://supabase.com/dashboard");
  console.log("Organisation recommandée: C.O.R.S.I.C.A.");
  console.log("Région: eu-west-3 (Paris)\n");

  info.supabase_url = await ask("URL Supabase (https://xxx.supabase.co)");
  info.supabase_anon_key = await ask("Clé anon (eyJ...)");
  info.supabase_service_key = await ask("Clé service_role (eyJ...)");
  info.supabase_project_ref = info.supabase_url.replace("https://", "").replace(".supabase.co", "");

  // Hub (fédération)
  console.log("\n--- Fédération (Hub) ---");
  const useHub = await ask("Connecter à un hub ? (o/n)", "o");
  if (useHub.toLowerCase() === "o") {
    info.hub_url = await ask("URL du hub Supabase", process.env.VITE_SUPABASE_URL || "");
    info.hub_anon_key = await ask("Clé anon du hub", process.env.VITE_SUPABASE_ANON_KEY || "");
  }

  // Clés API (optionnel)
  console.log("\n--- Clés API (optionnel, peut être ajouté plus tard) ---");
  info.openai_key = await ask("Clé OpenAI (sk-...)", "");
  info.anthropic_key = await ask("Clé Anthropic (sk-ant-...)", "");

  return info;
}

// ============================================
// Génération du SQL pour le vault
// ============================================

function generateVaultSQL(info) {
  const template = COMMUNITY_TEMPLATES[info.community_type] || COMMUNITY_TEMPLATES.municipality;

  const config = {
    // Identité
    COMMUNITY_NAME: info.community_name,
    COMMUNITY_TYPE: info.community_type,
    CITY_NAME: info.city_name,
    CITY_TAGLINE: info.city_name.toUpperCase(),
    SUBDOMAIN: info.subdomain,

    // Branding
    MOVEMENT_NAME: template.movement_template
      .replace("{city}", info.city_name)
      .replace("{name}", info.community_name)
      .replace("{code}", info.subdomain),
    HASHTAG: template.hashtag_template
      .replace("{city}", info.city_name.replace(/\s/g, ""))
      .replace("{code}", info.subdomain),
    BOT_NAME: "Ophélia",
    CONTACT_EMAIL: info.contact_email,

    // Géographie
    MAP_DEFAULT_CENTER: info.map_center,
    COMMUNE_INSEE: info.insee_code,
    REGION_NAME: info.region_name,
    REGION_CODE: info.region_code,
  };

  // Secrets (conditionnels)
  const secrets = {};
  if (info.hub_url) {
    secrets.NATIONAL_API_URL = info.hub_url;
    secrets.NATIONAL_API_KEY = info.hub_anon_key;
  }
  if (info.openai_key) secrets.OPENAI_API_KEY = info.openai_key;
  if (info.anthropic_key) secrets.ANTHROPIC_API_KEY = info.anthropic_key;

  // Générer le SQL
  let sql = `-- ============================================
-- Vault provisioning pour: ${info.community_name}
-- Subdomain: ${info.subdomain}
-- Généré le: ${new Date().toISOString()}
-- ============================================

-- Nettoyer la config existante (si re-provisioning)
DELETE FROM instance_config WHERE key IN (
${Object.keys(config)
  .map((k) => `  '${k}'`)
  .join(",\n")}
);

-- Configuration publique
INSERT INTO instance_config (key, value, is_secret, description) VALUES
${Object.entries(config)
  .map(([key, value], i, arr) => {
    const jsonValue = JSON.stringify(value);
    const comma = i < arr.length - 1 ? "," : "";
    return `  ('${key}', '${jsonValue}', false, 'Auto-provisioned')${comma}`;
  })
  .join("\n")}
;
`;

  if (Object.keys(secrets).length > 0) {
    sql += `
-- Secrets (accessibles uniquement via service_role)
INSERT INTO instance_config (key, value, is_secret, description) VALUES
${Object.entries(secrets)
  .map(([key, value], i, arr) => {
    const jsonValue = JSON.stringify(value);
    const comma = i < arr.length - 1 ? "," : "";
    return `  ('${key}', '${jsonValue}', true, 'Secret - Auto-provisioned')${comma}`;
  })
  .join("\n")}
;
`;
  }

  return sql;
}

// ============================================
// Génération du SQL pour le registry (hub)
// ============================================

function generateRegistrySQL(info) {
  return `-- ============================================
-- Enregistrement dans le registry (à exécuter sur le HUB)
-- ============================================

INSERT INTO instance_registry (
  subdomain,
  community_name,
  community_code,
  community_type,
  supabase_url,
  supabase_anon_key,
  region,
  is_active,
  contact_email,
  metadata
) VALUES (
  '${info.subdomain}',
  '${info.community_name}',
  '${info.insee_code || info.subdomain.toUpperCase()}',
  '${info.community_type}',
  '${info.supabase_url}',
  '${info.supabase_anon_key}',
  '${info.region_code}',
  true,
  '${info.contact_email}',
  '${JSON.stringify({
    contact_name: info.contact_name,
    map_center: info.map_center,
    provisioned_at: new Date().toISOString(),
  })}'
)
ON CONFLICT (subdomain) DO UPDATE SET
  community_name = EXCLUDED.community_name,
  supabase_url = EXCLUDED.supabase_url,
  supabase_anon_key = EXCLUDED.supabase_anon_key,
  is_active = true,
  updated_at = NOW();
`;
}

// ============================================
// Application des migrations
// ============================================

async function applyMigrations(info) {
  console.log("\n📦 Application des migrations...\n");

  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
  const migrations = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql") && !f.includes("old_unused"))
    .sort();

  console.log(`Migrations à appliquer: ${migrations.length}`);

  // Créer client Supabase avec service_role
  const supabase = createClient(info.supabase_url, info.supabase_service_key);

  for (const migration of migrations) {
    const filePath = path.join(migrationsDir, migration);
    const sql = fs.readFileSync(filePath, "utf-8");

    console.log(`  → ${migration}...`);

    try {
      // Exécuter via l'API SQL de Supabase
      const { error } = await supabase.rpc("exec_sql", { sql_query: sql });
      if (error) {
        console.log(`    ⚠️  Erreur (peut-être déjà appliquée): ${error.message}`);
      } else {
        console.log(`    ✅ OK`);
      }
    } catch (err) {
      console.log(`    ⚠️  ${err.message}`);
    }
  }
}

// ============================================
// Sauvegarde de la configuration
// ============================================

function saveInstanceConfig(info) {
  const instancesDir = path.join(process.cwd(), "instances");
  if (!fs.existsSync(instancesDir)) {
    fs.mkdirSync(instancesDir, { recursive: true });
  }

  const configPath = path.join(instancesDir, `${info.subdomain}.json`);

  // Ne pas sauvegarder les secrets
  const safeInfo = { ...info };
  delete safeInfo.supabase_service_key;
  delete safeInfo.openai_key;
  delete safeInfo.anthropic_key;
  delete safeInfo.hub_anon_key;

  fs.writeFileSync(configPath, JSON.stringify(safeInfo, null, 2));
  console.log(`\n📁 Configuration sauvegardée: ${configPath}`);

  return configPath;
}

// ============================================
// Génération des fichiers SQL
// ============================================

function generateSQLFiles(info) {
  const sqlDir = path.join(process.cwd(), "instances", "sql");
  if (!fs.existsSync(sqlDir)) {
    fs.mkdirSync(sqlDir, { recursive: true });
  }

  // Vault SQL
  const vaultSQL = generateVaultSQL(info);
  const vaultPath = path.join(sqlDir, `${info.subdomain}-vault.sql`);
  fs.writeFileSync(vaultPath, vaultSQL);
  console.log(`📄 SQL Vault: ${vaultPath}`);

  // Registry SQL
  const registrySQL = generateRegistrySQL(info);
  const registryPath = path.join(sqlDir, `${info.subdomain}-registry.sql`);
  fs.writeFileSync(registryPath, registrySQL);
  console.log(`📄 SQL Registry: ${registryPath}`);

  return { vaultPath, registryPath, vaultSQL, registrySQL };
}

// ============================================
// Exécution du SQL
// ============================================

async function executeSQL(info, sql, description) {
  console.log(`\n⚡ ${description}...`);

  const supabase = createClient(info.supabase_url, info.supabase_service_key);

  try {
    // Essayer d'exécuter via RPC (si la fonction existe)
    const { error } = await supabase.rpc("exec_sql", { sql_query: sql });

    if (error) {
      // Fallback: instruction manuelle
      console.log(`\n⚠️  Exécution automatique impossible.`);
      console.log(`Veuillez exécuter manuellement dans Supabase SQL Editor:\n`);
      console.log("─".repeat(60));
      console.log(sql);
      console.log("─".repeat(60));
      return false;
    }

    console.log(`✅ ${description} - OK`);
    return true;
  } catch (err) {
    console.log(`\n⚠️  Erreur: ${err.message}`);
    console.log(`Veuillez exécuter manuellement:\n`);
    console.log(sql);
    return false;
  }
}

// ============================================
// Résumé final
// ============================================

function printSummary(info, sqlFiles) {
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║                    ✅ PROVISIONING TERMINÉ                  ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`
📍 Instance: ${info.community_name}
🌐 URL: https://${info.subdomain}.transparence.corsica
🗄️  Supabase: ${info.supabase_url}

📋 Étapes restantes:

1. Exécuter le SQL du vault sur l'instance:
   ${sqlFiles.vaultPath}

2. Exécuter le SQL du registry sur le HUB:
   ${sqlFiles.registryPath}

3. Tester l'accès:
   - Dev: http://localhost:5173/?instance=${info.subdomain}
   - Prod: https://${info.subdomain}.transparence.corsica

4. Créer le premier admin:
   - S'inscrire sur la plateforme
   - UPDATE users SET role = 'admin' WHERE email = '${info.contact_email}';

5. Vérifier la version du schéma:
   npm run schema:check

📚 Documentation: docs/DEPLOY_UNIVERSITE_CORSE.md
`);
}

// ============================================
// Main
// ============================================

async function main() {
  try {
    // Mode interactif
    const info = await collectInstanceInfo();

    // Sauvegarder la config
    saveInstanceConfig(info);

    // Générer les fichiers SQL
    const sqlFiles = generateSQLFiles(info);

    // Demander si on applique automatiquement
    const autoApply = await ask("\nAppliquer automatiquement le SQL ? (o/n)", "n");

    if (autoApply.toLowerCase() === "o") {
      // Appliquer les migrations
      await applyMigrations(info);

      // Appliquer le vault
      await executeSQL(info, sqlFiles.vaultSQL, "Provisioning du vault");

      // Pour le registry, on a besoin des credentials du hub
      if (info.hub_url) {
        const hubServiceKey = await ask("Clé service_role du HUB pour le registry");
        if (hubServiceKey) {
          const hubInfo = { supabase_url: info.hub_url, supabase_service_key: hubServiceKey };
          await executeSQL(hubInfo, sqlFiles.registrySQL, "Enregistrement dans le registry");
        }
      }
    }

    // Afficher le résumé
    printSummary(info, sqlFiles);
  } catch (err) {
    console.error("\n❌ Erreur:", err.message);
  } finally {
    rl.close();
  }
}

// Lancer
main();
