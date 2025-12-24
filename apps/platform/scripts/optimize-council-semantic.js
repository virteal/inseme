import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { loadConfig, getConfig } from "./lib/config.js";

// Charger la configuration
await loadConfig();

const COUNCIL_FILE = path.resolve("public", "docs", "conseils", "conseil-consolidated.md");
const OUTPUT_FILE = COUNCIL_FILE.replace(".md", ".semantic.md");
const JSON_OUTPUT = COUNCIL_FILE.replace(".md", ".semantic.json");

const openai = new OpenAI({ apiKey: getConfig("openai_api_key") });

// ============================================================================
// EXTRACTION SÉMANTIQUE
// ============================================================================

async function extractCouncilData(sectionText) {
  const prompt = `Tu es un expert en structuration de données municipales.

**MISSION**: Extrais TOUS les faits de ce compte-rendu de conseil municipal au format JSON.

**RÈGLES STRICTES**:
1. AUCUNE perte d'information factuelle
2. Garder TOUS les chiffres, votes, montants, dates exactes
3. Garder TOUS les noms d'élus avec fonctions
4. Format JSON strict

**STRUCTURE REQUISE**:
\`\`\`json
{
  "date": "YYYY-MM-DD",
  "type": "conseil municipal|bureau|commission",
  "participants": {
    "presents": ["Nom (Fonction)", ...],
    "absents_excuses": ["Nom (Fonction)", ...],
    "absents": ["Nom", ...]
  },
  "deliberations": [
    {
      "numero": "2024-XX",
      "titre": "titre complet",
      "rapporteur": "Nom",
      "vote": {
        "pour": X,
        "contre": Y,
        "abstention": Z,
        "detail_vote": "texte si vote nominatif important"
      },
      "budget_euros": montant_numerique ou null,
      "echeance": "YYYY-MM-DD" ou null,
      "resume": "résumé en 1-2 phrases des points clés",
      "importance": "haute|moyenne|basse"
    }
  ],
  "debats": [
    {
      "sujet": "...",
      "intervenants": [{"nom": "...", "position": "..."}],
      "decision": "..."
    }
  ],
  "informations": ["info importante 1", ...]
}
\`\`\`

**TEXTE DU CONSEIL**:

${sectionText}

**JSON EXTRAIT**:`;

  const systemMessage = `Tu rédiges une réponse JSON structurée, sans explication.`;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt },
      ],
      max_tokens: 4096,
    });

    const text = response.choices[0].message?.content || "";
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/({[\s\S]*})/);

    if (!jsonMatch) {
      throw new Error("Pas de JSON trouvé dans la réponse");
    }

    return JSON.parse(jsonMatch[1]);
  } catch (error) {
    console.error("[Extract] Erreur parsing:", error.message || error);
    throw error;
  }
}

// ============================================================================
// CONVERSION JSON → MARKDOWN ULTRA-COMPACT
// ============================================================================

function jsonToCompactMarkdown(councilsData) {
  let md = `# Conseils Municipaux — Synthèse Structurée\n\n`;
  md += `*Généré le ${new Date().toLocaleDateString("fr-FR")} • ${councilsData.length} conseils*\n\n`;
  md += `---\n\n`;

  for (const data of councilsData) {
    md += `# ${data.date} | ${data.type}\n\n`;

    // Participants ultra-compact
    const presents = data.participants.presents || [];
    const presentsDisplay =
      presents.length > 6
        ? `${presents.slice(0, 6).join(" • ")} + ${presents.length - 6} autres`
        : presents.join(" • ");

    md += `👥 **Présents (${presents.length})**: ${presentsDisplay}\n\n`;

    if (data.participants.absents_excuses?.length) {
      md += `⚠️ **Absents excusés**: ${data.participants.absents_excuses.join(", ")}\n\n`;
    }

    // Tableau ultra-compact des délibérations
    if (data.deliberations?.length) {
      md += `## 📋 Délibérations (${data.deliberations.length})\n\n`;
      md += `| N° | Titre | Vote | Budget | Échéance |\n`;
      md += `|:---|:------|:----:|-------:|---------:|\n`;

      for (const d of data.deliberations) {
        const vote = `${d.vote.pour}-${d.vote.contre}-${d.vote.abstention}`;
        const budget = d.budget_euros ? `${(d.budget_euros / 1000).toFixed(0)}k€` : "-";
        const titre = d.titre.length > 50 ? d.titre.substring(0, 47) + "..." : d.titre;
        const echeance = d.echeance ? d.echeance.substring(5) : "-"; // MM-DD seulement

        md += `| **${d.numero}** | ${titre} | ${vote} | ${budget} | ${echeance} |\n`;
      }
      md += `\n`;

      // Détails uniquement des délibérations importantes
      const importantes = data.deliberations.filter(
        (d) =>
          d.importance === "haute" ||
          d.vote.contre > 0 ||
          d.vote.abstention > 2 ||
          (d.budget_euros && d.budget_euros > 100000)
      );

      if (importantes.length > 0) {
        md += `### 🔴 Délibérations importantes\n\n`;

        for (const d of importantes) {
          md += `#### ${d.numero} — ${d.titre}\n\n`;
          md += `- **Vote**: ${d.vote.pour} pour • ${d.vote.contre} contre • ${d.vote.abstention} abst.\n`;
          if (d.rapporteur) md += `- **Rapporteur**: ${d.rapporteur}\n`;
          if (d.budget_euros) md += `- **Budget**: ${d.budget_euros.toLocaleString("fr-FR")} €\n`;
          if (d.echeance) md += `- **Échéance**: ${d.echeance}\n`;
          if (d.resume) md += `- **Résumé**: ${d.resume}\n`;
          if (d.vote.detail_vote) md += `- **Détail**: ${d.vote.detail_vote}\n`;
          md += `\n`;
        }
      }
    }

    // Débats (seulement si présents)
    if (data.debats?.length) {
      md += `## 💬 Débats\n\n`;
      for (const deb of data.debats) {
        md += `**${deb.sujet}**\n`;
        deb.intervenants.forEach((int) => (md += `- ${int.nom}: ${int.position}\n`));
        md += `→ *${deb.decision}*\n\n`;
      }
    }

    // Informations
    if (data.informations?.length) {
      md += `## ℹ️ Informations\n\n`;
      data.informations.forEach((info) => (md += `- ${info}\n`));
      md += `\n`;
    }

    md += `---\n\n`;
  }

  return md;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("🧠 Compression Sémantique Intelligente");
  console.log("═══════════════════════════════════════════════════════\n");

  // Vérifications
  if (!getConfig("openai_api_key")) {
    console.error("❌ OPENAI_API_KEY manquant dans .env");
    process.exit(1);
  }

  if (!fs.existsSync(COUNCIL_FILE)) {
    console.error(`❌ Fichier introuvable: ${COUNCIL_FILE}`);
    console.log("💡 Exécutez d'abord: npm run build:council");
    process.exit(1);
  }

  const original = fs.readFileSync(COUNCIL_FILE, "utf-8");
  console.log(`📊 Fichier original: ${original.length.toLocaleString()} chars\n`);

  // Découper par section (chaque conseil)
  const sections = original.split(/^## Conseil —/m).filter((s) => s.trim());
  console.log(`📦 ${sections.length} sections détectées\n`);

  const allData = [];

  for (let i = 0; i < sections.length; i++) {
    const section = "## Conseil —" + sections[i];
    const sectionPreview = section.substring(0, 100).replace(/\n/g, " ");

    console.log(`[${i + 1}/${sections.length}] 🔄 Extraction: ${sectionPreview}...`);

    try {
      const data = await extractCouncilData(section);
      allData.push(data);
      console.log(
        `[${i + 1}/${sections.length}] ✅ ${data.date} | ${data.deliberations?.length || 0} délib.`
      );
    } catch (error) {
      console.error(`[${i + 1}/${sections.length}] ❌ Échec:`, error.message);
      // Continue malgré l'erreur
    }

    // Pause anti-rate-limit
    if (i < sections.length - 1) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  if (allData.length === 0) {
    console.error("\n❌ Aucune donnée extraite !");
    process.exit(1);
  }

  console.log(`\n✅ ${allData.length}/${sections.length} conseils extraits avec succès\n`);

  // Sauvegarder JSON (pour debug)
  fs.writeFileSync(JSON_OUTPUT, JSON.stringify(allData, null, 2), "utf-8");
  console.log(`💾 JSON sauvegardé: ${JSON_OUTPUT}`);

  // Conversion Markdown compact
  console.log(`📝 Conversion en Markdown ultra-compact...\n`);
  const compactMd = jsonToCompactMarkdown(allData);

  // Statistiques
  const totalDelibs = allData.reduce((sum, d) => sum + (d.deliberations?.length || 0), 0);
  const totalDebats = allData.reduce((sum, d) => sum + (d.debats?.length || 0), 0);

  console.log("═══════════════════════════════════════════════════════");
  console.log("📊 RÉSUMÉ");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`Original:      ${original.length.toLocaleString()} chars`);
  console.log(`Compressé:     ${compactMd.length.toLocaleString()} chars`);
  console.log(`Réduction:     ${((1 - compactMd.length / original.length) * 100).toFixed(1)}%`);
  console.log(`Conseils:      ${allData.length}`);
  console.log(`Délibérations: ${totalDelibs}`);
  console.log(`Débats:        ${totalDebats}\n`);

  fs.writeFileSync(OUTPUT_FILE, compactMd, "utf-8");
  console.log(`✅ Markdown compressé: ${OUTPUT_FILE}\n`);
  console.log("   1. Vérifier: cat " + OUTPUT_FILE.replace(/\\/g, "/"));
  console.log("   2. Si OK: npm run council:apply-semantic");
  console.log("   3. Tester Bob\n");
}
main().catch((err) => {
  console.error("❌ Erreur fatale:", err);
  process.exit(1);
});
