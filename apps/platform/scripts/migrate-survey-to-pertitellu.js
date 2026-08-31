#!/usr/bin/env node

/**
 * migrate-survey-to-pertitellu.js
 * Script de migration one-shot : Survey Legacy -> Inseme Platform (pertitellu-corte hosted on John DB)
 *
 * Usage :
 *   node migrate-survey-to-pertitellu.js --dry-run
 *   node migrate-survey-to-pertitellu.js --export-json <output_dir>
 *   node migrate-survey-to-pertitellu.js --import-json <input_dir>
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PERTITELLU_INSTANCE_ID = "00000000-0000-0000-0000-000000000010";
const JHN_ROOT_INSTANCE_ID = "00000000-0000-0000-0000-000000000001";

export function transformWikiRow(row, instanceId = PERTITELLU_INSTANCE_ID) {
  return {
    id: row.id,
    instance_id: instanceId,
    slug: String(row.slug).trim().toLowerCase(),
    title: row.title,
    content: row.content,
    summary: row.summary || null,
    author_id: row.author_id || null,
    metadata: row.metadata || { schemaVersion: 1 },
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

export function transformPropositionRow(row, instanceId = PERTITELLU_INSTANCE_ID) {
  return {
    id: row.id,
    instance_id: instanceId,
    title: row.title,
    description: row.description,
    author_id: row.author_id || null,
    status: row.status || "active",
    metadata: row.metadata || { schemaVersion: 1 },
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

export function transformVoteRow(row, instanceId = PERTITELLU_INSTANCE_ID) {
  let voteValue = row.vote_value;
  if (voteValue === true || voteValue === "true" || voteValue === "for" || voteValue === "pour") {
    voteValue = "approve";
  } else if (
    voteValue === false ||
    voteValue === "false" ||
    voteValue === "against" ||
    voteValue === "contre"
  ) {
    voteValue = "disapprove";
  } else if (!["approve", "disapprove", "neutral", "false_choice"].includes(voteValue)) {
    voteValue = "neutral";
  }

  return {
    id: row.id,
    instance_id: instanceId,
    user_id: row.user_id,
    proposition_id: row.proposition_id,
    vote_value: voteValue,
    delegated_from_user_id: row.delegated_from_user_id || null,
    metadata: row.metadata || {},
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

export function transformDelegationRow(row, instanceId = PERTITELLU_INSTANCE_ID) {
  return {
    id: row.id,
    instance_id: instanceId,
    delegator_id: row.delegator_id,
    delegate_id: row.delegate_id,
    tag_id: row.tag_id || null,
    status: row.status || "active",
    metadata: row.metadata || { schemaVersion: 1 },
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");

  console.log("=================================================");
  console.log("📦 LEPP / SURVEY -> INSEME PLATFORM MIGRATOR");
  console.log(`Target Instance ID : ${PERTITELLU_INSTANCE_ID} (pertitellu-corte)`);
  console.log(`Host Twin Root     : ${JHN_ROOT_INSTANCE_ID} (jhn)`);
  console.log(`Mode               : ${isDryRun ? "DRY-RUN (audit only)" : "STANDARD"}`);
  console.log("=================================================");

  console.log("✔ Transformation rules loaded for wiki_pages, propositions, votes, delegations.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(console.error);
}
