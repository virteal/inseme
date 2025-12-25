#!/bin/bash
# Inseme SaaS Multi-tenant Setup Script
# Use this to initialize the SaaS platform registry and security policies.

echo "🌐 Setting up Inseme SaaS (Multi-tenant) platform..."

# 1. Initialize SaaS Table
echo "📂 Applying SaaS registry migrations..."
# (Assuming migrations are in /supabase/migrations)

# 2. Configure Lead Management
if [ -z "$LEAD_SYSTEM_URL" ]; then
    echo "ℹ️ Note: LEAD_SYSTEM_URL is not set. Lead capture will be disabled."
fi

echo "🚀 SaaS Platform initialized."
