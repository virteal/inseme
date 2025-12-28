// File: scripts/diagnose_db.js
import { db, client } from "../src/common/db/client.js";
import * as schema from "../src/common/schema/tables.js";
import { sql } from "drizzle-orm";

async function main() {
  console.log("🔍 DIAGNOSTIC START");

  // 1. Inspect Schema Exports
  console.log("\n--- 1. Inspecting Schema Object ---");
  const keys = Object.keys(schema);
  console.log(`Schema Keys: ${keys.join(", ")}`);

  if (keys.length > 0) {
    const firstKey = keys[0];
    const firstTable = schema[firstKey];
    console.log(`\nInspecting table '${firstKey}':`);

    // Check for common internal properties
    const internalKeys = Object.keys(firstTable).concat(
      Object.getOwnPropertySymbols(firstTable).map((s) => s.toString())
    );
    console.log(`Properties: ${internalKeys.join(", ")}`);

    // Check specific properties we rely on
    try {
      console.log(`table._:`, firstTable._);
      if (firstTable._) {
        console.log(`table._.name:`, firstTable._.name);
      }
    } catch (e) {
      console.log("Error accessing table._:", e.message);
    }
  }

  // 2. Test Connection
  console.log("\n--- 2. Testing Database Connection ---");
  try {
    const result = await db.execute(sql`SELECT 1 as "test"`);
    console.log("✅ Connection Successful. Result:", result);
  } catch (e) {
    console.error("❌ Connection Failed:", e.message);
    process.exit(1);
  }

  // 3. Check for 'users' table existence
  console.log("\n--- 3. Checking 'users' table ---");
  try {
    const tableCheck = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'users'
    `);

    if (tableCheck.length > 0) {
      console.log("✅ 'users' table EXISTS in database.");
    } else {
      console.error("❌ 'users' table DOES NOT EXIST in database.");
      console.warn("⚠️ Hint: Has 'supabase/schema.sql' been applied to this database instance?");
    }
  } catch (e) {
    console.error("❌ Failed to query information_schema:", e.message);
  }

  process.exit(0);
}

main();
