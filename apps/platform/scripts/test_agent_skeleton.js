// File: scripts/test_agent_skeleton.js
// Description: Test script to verify the SqlAgent skeleton and AgentExecutorService guardrails.

// Import the SqlAgent and AgentExecutorService
import { SqlAgent } from "../src/common/agents/SqlAgent.js";

async function main() {
  console.log("🚀 Starting Agent Skeleton Test...\n");

  const agent = new SqlAgent();

  // 1. Test Schema Introspection
  console.log("--- Step 1: Introspecting Schema ---");
  const context = await agent.getContext();
  const tables = Object.keys(context);
  console.log(`✅ Found ${tables.length} tables: ${tables.join(", ")}`);

  // Print details for 'users' table if it exists
  if (context.users) {
    console.log("   Users table columns:", Object.keys(context.users).join(", "));
  }
  console.log("\n");

  // 2. Test Valid Query (Read-Only)
  console.log("--- Step 2: Executing Valid Query ---");
  const validQuery = "SELECT id, display_name, role FROM users LIMIT 3";
  const result = await agent.run(validQuery);

  if (result.status === "success") {
    console.log("✅ Query successful!");
    console.log(`   Retrieved ${result.count} rows:`);
    console.table(result.data);
  } else {
    console.error("❌ Query failed:", result.message);
  }
  console.log("\n");

  // 3. Test Invalid Query (Guardrail Check)
  console.log("--- Step 3: Testing Security Guardrails ---");
  const unsafeQuery = "DELETE FROM users WHERE role = 'user'";
  console.log(`   Attempting unsafe query: "${unsafeQuery}"`);

  const unsafeResult = await agent.run(unsafeQuery);

  if (unsafeResult.status === "error") {
    console.log("✅ Guardrail caught the violation!");
    console.log(`   Error message: ${unsafeResult.message}`);
  } else {
    console.error("❌ Guardrail FAILED! The query was executed.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
