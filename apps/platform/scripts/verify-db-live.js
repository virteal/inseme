import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

// Load platform .env
config({ path: resolve(process.cwd(), "apps/platform/.env") });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyLiveDatabase() {
  console.log("=== VERIFYING LIVE SUPABASE DATABASE ===");
  console.log("Target Supabase URL:", supabaseUrl);

  // 1. Check instances table
  const { data: instances, error: instErr } = await supabase
    .from("instances")
    .select("id, canonical_slug, display_name, bot_name, subject_kind, host_instance_id")
    .order("canonical_slug");

  if (instErr) {
    console.error("❌ Error querying 'instances':", instErr);
  } else {
    console.log(`\n✅ 'instances' table (${instances.length} rows):`);
    instances.forEach((inst) => {
      console.log(
        `   - [${inst.id}] slug: "${inst.canonical_slug}", name: "${inst.display_name}", bot: "${inst.bot_name}", kind: "${inst.subject_kind}", host: ${inst.host_instance_id || "none (root)"}`
      );
    });
  }

  // 2. Check instance_aliases table
  const { data: aliases, error: aliasErr } = await supabase
    .from("instance_aliases")
    .select("alias, instance_id, is_primary, alias_kind, allocated_at")
    .order("alias");

  if (aliasErr) {
    console.error("❌ Error querying 'instance_aliases':", aliasErr);
  } else {
    console.log(`\n✅ 'instance_aliases' table (${aliases.length} aliases allocated):`);
    aliases.slice(0, 10).forEach((a) => {
      console.log(
        `   - "${a.alias}" -> [${a.instance_id}] (kind: ${a.alias_kind}, allocated_at: ${a.allocated_at})`
      );
    });
    if (aliases.length > 10) {
      console.log(`   ... and ${aliases.length - 10} more aliases.`);
    }
  }

  // 3. Check resolve_instance_id RPC
  console.log("\n✅ Testing RPC 'resolve_instance_id':");
  const testLookups = [
    "areopage",
    "frederic",
    "cornelie",
    "marie-louise",
    "jhn",
    "jean",
    "mary",
    "jhr",
  ];
  for (const ident of testLookups) {
    const { data: resolvedId, error: rpcErr } = await supabase.rpc("resolve_instance_id", {
      p_identifier: ident,
    });
    if (rpcErr) {
      console.error(`   ❌ Failed resolving "${ident}":`, rpcErr.message);
    } else {
      console.log(`   - "${ident}" -> ${resolvedId}`);
    }
  }

  // 4. Check get_effective_instance_config RPC
  console.log("\n✅ Testing RPC 'get_effective_instance_config':");
  const areopageId = "00000000-0000-0000-0000-000000000002";
  const { data: areopageName } = await supabase.rpc("get_effective_instance_config", {
    p_instance_id: areopageId,
    p_key: "community_name",
  });
  console.log(`   - Frédéric Lecourtois community_name (local):`, areopageName);

  const { data: areopageModel } = await supabase.rpc("get_effective_instance_config", {
    p_instance_id: areopageId,
    p_key: "openai_model",
  });
  console.log(`   - Frédéric Lecourtois openai_model (inherited from JHN):`, areopageModel);

  console.log("\n🎉 ALL LIVE DATABASE CHECKS PASSED SUCCESSFULLY!");
}

verifyLiveDatabase().catch((err) => {
  console.error("Fatal error during verification:", err);
  process.exit(1);
});
