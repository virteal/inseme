// File: src/schema/tables.js
// Description: Drizzle ORM schema definitions mapping the existing Supabase PostgreSQL tables (public schema).

import { pgTable, uuid, text, timestamp, jsonb, boolean, primaryKey } from "drizzle-orm/pg-core";

// --- Core Identity ---
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  display_name: text("display_name").notNull().default(""),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  neighborhood: text("neighborhood"),
  interests: text("interests"),
  rgpd_consent_accepted: boolean("rgpd_consent_accepted").default(false),
  rgpd_consent_date: timestamp("rgpd_consent_date", { withTimezone: true }),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  metadata: jsonb("metadata").notNull().default({ schemaVersion: 1 }),
  role: text("role").notNull().default("user"),
  public_profile: boolean("public_profile").notNull().default(true),
});

// --- Social Content ---
export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  author_id: uuid("author_id")
    .references(() => users.id)
    .notNull(),
  content: text("content").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb("metadata").notNull().default({ schemaVersion: 1 }),
});

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  post_id: uuid("post_id")
    .references(() => posts.id)
    .notNull(),
  user_id: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  content: text("content").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb("metadata").notNull().default({ schemaVersion: 1 }),
});

export const reactions = pgTable("reactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  target_type: text("target_type").notNull(),
  target_id: uuid("target_id").notNull(),
  emoji: text("emoji").notNull(),
  metadata: jsonb("metadata").default({}),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Groups & Federation ---
export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  created_by: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb("metadata").notNull().default({ schemaVersion: 1 }),
});

export const groupMembers = pgTable(
  "group_members",
  {
    group_id: uuid("group_id")
      .references(() => groups.id)
      .notNull(),
    user_id: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").default({}),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.group_id, t.user_id] }),
  })
);

// --- Civic Governance (Kudocracy) ---
export const propositions = pgTable("propositions", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  author_id: uuid("author_id").references(() => users.id),
  status: text("status").default("active"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  metadata: jsonb("metadata").notNull().default({ schemaVersion: 1 }),
});

export const votes = pgTable("votes", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  proposition_id: uuid("proposition_id")
    .references(() => propositions.id)
    .notNull(),
  vote_value: text("vote_value"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  metadata: jsonb("metadata").default({}),
});

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description").default(""),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb("metadata").notNull().default({ schemaVersion: 1 }),
});

export const delegations = pgTable("delegations", {
  id: uuid("id").primaryKey().defaultRandom(),
  delegator_id: uuid("delegator_id")
    .references(() => users.id)
    .notNull(),
  delegate_id: uuid("delegate_id")
    .references(() => users.id)
    .notNull(),
  tag_id: uuid("tag_id")
    .references(() => tags.id)
    .notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb("metadata").notNull().default({ schemaVersion: 1 }),
});

// --- Knowledge Base ---
export const wikiPages = pgTable("wiki_pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  author_id: uuid("author_id").references(() => users.id),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  summary: text("summary"),
  metadata: jsonb("metadata").notNull().default({ schemaVersion: 1 }),
});
