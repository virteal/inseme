/*
  # Kudocracy Delegative Democracy Voting System

  ## Overview
  This migration creates a complete delegative democracy voting system where users can:
  - Vote directly on propositions (approve/disapprove)
  - Delegate voting power to others on specific topics (tags)
  - Change votes at any time (reversible votes)
  - View public, transparent voting records

  ## New Tables

  ### 1. `users`
  Stores user information for the voting system
  - `id` (uuid, primary key) - Unique user identifier
  - `email` (text, unique, not null) - User email address
  - `display_name` (text) - Public display name
  - `created_at` (timestamptz) - Account creation timestamp

  ### 2. `tags`
  Categories/keywords for organizing propositions
  - `id` (uuid, primary key) - Unique tag identifier
  - `name` (text, unique, not null) - Tag name (e.g., "healthcare", "education")
  - `description` (text) - Optional tag description
  - `created_at` (timestamptz) - Tag creation timestamp

  ### 3. `propositions`
  Proposals that users can vote on
  - `id` (uuid, primary key) - Unique proposition identifier
  - `title` (text, not null) - Proposition title
  - `description` (text, not null) - Detailed proposition description
  - `author_id` (uuid, foreign key -> users) - Proposition creator
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  - `status` (text) - Proposition status: 'active', 'closed', 'draft'

  ### 4. `proposition_tags`
  Many-to-many relationship between propositions and tags
  - `proposition_id` (uuid, foreign key -> propositions)
  - `tag_id` (uuid, foreign key -> tags)
  - Primary key: (proposition_id, tag_id)

  ### 5. `votes`
  Direct votes cast by users on propositions
  - `id` (uuid, primary key) - Unique vote identifier
  - `user_id` (uuid, foreign key -> users) - Voter
  - `proposition_id` (uuid, foreign key -> propositions) - Target proposition
  - `vote_value` (boolean, not null) - true = approve, false = disapprove
  - `created_at` (timestamptz) - Vote creation timestamp
  - `updated_at` (timestamptz) - Last vote change timestamp
  - Unique constraint: (user_id, proposition_id) - one vote per user per proposition

  ### 6. `delegations`
  Delegation assignments where users delegate voting power on specific tags
  - `id` (uuid, primary key) - Unique delegation identifier
  - `delegator_id` (uuid, foreign key -> users) - User delegating their vote
  - `delegate_id` (uuid, foreign key -> users) - User receiving delegation
  - `tag_id` (uuid, foreign key -> tags) - Tag scope for this delegation
  - `created_at` (timestamptz) - Delegation creation timestamp
  - Unique constraint: (delegator_id, tag_id) - one delegate per tag per user

  ## Security

  ### Row Level Security (RLS)
  All tables have RLS enabled with the following policies:

  #### Users Table
  - Anyone can read user profiles (public transparency)
  - Users can update their own profiles only

  #### Tags Table
  - Anyone can read tags (public)
  - Authenticated users can create tags

  #### Propositions Table
  - Anyone can read active propositions (public transparency)
  - Authenticated users can create propositions
  - Authors can update their own propositions

  #### Proposition Tags Table
  - Anyone can read proposition-tag associations (public)
  - Authenticated users can create associations when creating propositions

  #### Votes Table
  - Anyone can read all votes (public transparency - core feature)
  - Authenticated users can create votes
  - Users can update/delete their own votes (reversible voting)

  #### Delegations Table
  - Anyone can read delegations (public transparency)
  - Authenticated users can create delegations for themselves
  - Users can update/delete their own delegations

  ## Notes

  1. **Public Transparency**: All votes and delegations are publicly readable to prevent fraud and enable open discussion
  2. **Reversible Votes**: Users can update or delete votes at any time via update/delete policies
  3. **Direct Vote Priority**: Application logic will ensure direct votes override delegated votes
  4. **Real-time Updates**: Supabase real-time subscriptions can be used for live vote tracking
  5. **Indexes**: Added for performance on common queries (user votes, proposition votes, tag searches)
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  display_name text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read user profiles"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Authenticated users can create profiles"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tags"
  ON tags FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create tags"
  ON tags FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create propositions table
CREATE TABLE IF NOT EXISTS propositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  author_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'closed', 'draft')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE propositions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active propositions"
  ON propositions FOR SELECT
  USING (status = 'active' OR author_id = auth.uid());

CREATE POLICY "Authenticated users can create propositions"
  ON propositions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update own propositions"
  ON propositions FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- Create proposition_tags junction table
CREATE TABLE IF NOT EXISTS proposition_tags (
  proposition_id uuid REFERENCES propositions(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (proposition_id, tag_id)
);

ALTER TABLE proposition_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read proposition tags"
  ON proposition_tags FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create proposition tags"
  ON proposition_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM propositions
      WHERE propositions.id = proposition_id
      AND propositions.author_id = auth.uid()
    )
  );

-- Create votes table
CREATE TABLE IF NOT EXISTS votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  proposition_id uuid REFERENCES propositions(id) ON DELETE CASCADE NOT NULL,
  vote_value boolean NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, proposition_id)
);

ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read votes"
  ON votes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create votes"
  ON votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own votes"
  ON votes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own votes"
  ON votes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create delegations table
CREATE TABLE IF NOT EXISTS delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delegator_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  delegate_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  tag_id uuid REFERENCES tags(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (delegator_id, tag_id),
  CHECK (delegator_id != delegate_id)
);

ALTER TABLE delegations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read delegations"
  ON delegations FOR SELECT
  USING (true);

CREATE POLICY "Users can create own delegations"
  ON delegations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = delegator_id);

CREATE POLICY "Users can update own delegations"
  ON delegations FOR UPDATE
  TO authenticated
  USING (auth.uid() = delegator_id)
  WITH CHECK (auth.uid() = delegator_id);

CREATE POLICY "Users can delete own delegations"
  ON delegations FOR DELETE
  TO authenticated
  USING (auth.uid() = delegator_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_votes_user_id ON votes(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_proposition_id ON votes(proposition_id);
CREATE INDEX IF NOT EXISTS idx_delegations_delegator_id ON delegations(delegator_id);
CREATE INDEX IF NOT EXISTS idx_delegations_tag_id ON delegations(tag_id);
CREATE INDEX IF NOT EXISTS idx_proposition_tags_tag_id ON proposition_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_propositions_status ON propositions(status);
CREATE INDEX IF NOT EXISTS idx_propositions_author_id ON propositions(author_id);