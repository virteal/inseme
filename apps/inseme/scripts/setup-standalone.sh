#!/bin/bash
# Inseme Standalone Setup Script
# Use this to deploy a dedicated instance for a single organization.

echo "🚀 Setting up Inseme Standalone instance..."

# 1. Environment Check
if [ ! -f .env ]; then
    echo "⚠️ .env file not found. Creating from template..."
    cp .env.example .env
fi

# 2. Database Migration (requires Supabase CLI)
if command -v supabase &> /dev/null
then
    echo "📦 Running database migrations..."
    supabase db push
else
    echo "❌ Supabase CLI not found. Please run migrations manually from /supabase/migrations"
fi

# 3. Build & Deploy
echo "🛠️ Installing dependencies..."
npm install

echo "✨ Standalone setup complete. Run 'npm run dev' to start."
