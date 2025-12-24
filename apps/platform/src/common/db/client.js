// File: src/db/client.js
// Description: Database client initialization using Drizzle ORM and Postgres.js.
// Handles connection management and exports the 'db' instance for services.

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../schema/tables.js";
// import "dotenv/config";

// 1. Get connection string from environment
const connectionString = null; // JHR, TODO. was: process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("⚠️ WARNING: DATABASE_URL is not defined in environment variables.");
  console.warn("Service layer database operations will fail until this is configured.");
  const error = new Error("DATABASE_URL environment variable is required");
  console.log("stack:", error.stack);
  console.trace();
  throw error;
}

// 2. Initialize Postgres client
// 'prepare: false' is recommended for Supabase Transaction Pooler (port 6543) compatibility
export const client = connectionString ? postgres(connectionString, { prepare: false }) : null;

// 3. Initialize Drizzle ORM
// We pass the schema to enable Relational Queries (e.g., db.query.users.findMany)
export const db = client ? drizzle(client, { schema }) : null;
