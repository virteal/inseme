#!/usr/bin/env node
console.log("Setting up Inseme SaaS multi-tenant platform...");

console.log(
  "Applying SaaS registry migrations is still manual; see apps/inseme/supabase/migrations."
);

if (!process.env.LEAD_SYSTEM_URL) {
  console.log("Note: LEAD_SYSTEM_URL is not set. Lead capture will be disabled.");
}

console.log("SaaS platform initialized.");
