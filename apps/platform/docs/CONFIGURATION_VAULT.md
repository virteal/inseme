OBSOLETE

# Système de Configuration Centralisé (Vault)

## Vue d'ensemble

Le projet Survey utilise un système de configuration centralisé ("vault") qui permet de gérer les
variables d'environnement de manière unifiée à travers tous les composants de l'application.

### Problématique résolue

Avant le vault, la gestion des variables d'environnement était dispersée :

- Multiples noms pour la même variable (`SUPABASE_URL`, `VITE_SUPABASE_URL`, etc.)
- Pas de source de vérité unique
- Duplication de code pour les fallbacks
- Difficultés de maintenance

### Solution

Un système à trois niveaux avec fallback automatique :

```
┌─────────────────────────────────────────────────────────┐
│                    getConfig("key")                     │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  1. VAULT (table instance_config dans Supabase)         │
│     → Source de vérité pour les configurations partagées│
└─────────────────────────────────────────────────────────┘
                           │ (si absent)
                           ▼
┌─────────────────────────────────────────────────────────┐
│  2. VARIABLES D'ENVIRONNEMENT                           │
│     → .env local ou variables Netlify                   │
│     → Mapping automatique des variantes (VITE_*, etc.)  │
└─────────────────────────────────────────────────────────┘
                           │ (si absent)
                           ▼
┌─────────────────────────────────────────────────────────┐
│  3. VALEURS PAR DÉFAUT                                  │
│     → Définies dans DEFAULT_VALUES                      │
└─────────────────────────────────────────────────────────┘
```

---

## Architecture

### Modules de configuration

| Environnement         | Module                                         | Usage                            |
| --------------------- | ---------------------------------------------- | -------------------------------- |
| **Frontend**          | `src/lib/instanceConfig.js`                    | Composants React, hooks          |
| **Netlify Functions** | `netlify/lib/instanceConfig.js`                | API serverless Node.js           |
| **Edge Functions**    | `netlify/edge-functions/lib/instanceConfig.js` | API Deno                         |
| **Scripts CLI**       | `scripts/lib/config.js`                        | Scripts d'ingestion, maintenance |

### Table Supabase `instance_config`

```sql
CREATE TABLE IF NOT EXISTS instance_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les recherches rapides
CREATE INDEX IF NOT EXISTS idx_instance_config_key ON instance_config(key);
```

---

## Utilisation

### Pattern de base

```javascript
import { loadConfig, getConfig } from "./lib/instanceConfig.js";

// Charger la configuration (une fois au démarrage)
await loadConfig();

// Récupérer une valeur
const apiKey = getConfig("openai_api_key");

// Avec valeur par défaut
const cityName = getConfig("city_name", "Corte");
```

### Dans les scripts CLI

```javascript
import { initializeConfig_Backend, newSupabase, getConfig } from "TODO";

await initialize();

// Clients pré-configurés
const supabase = newSupabase();

// Accès aux valeurs
const model = getConfig("openai_heavy_model", "gpt-4o");
```

### Dans les Netlify Functions (Node.js)

```javascript
import { initializeConfig_Edge, getConfig, newSupabase } from "TODO";

export async function handler(event, context) {
  await initializeConfig_Edge();

  const supabase = newSupabase();
  const cityName = getConfig("city_name");

  // ...
}
```

---

## Clés de configuration

### Mapping des variables d'environnement

Le système mappe automatiquement les clés normalisées vers les variantes d'environnement :

| Clé normalisée              | Variables d'environnement recherchées         |
| --------------------------- | --------------------------------------------- |
| `supabase_url`              | `SUPABASE_URL`, `VITE_SUPABASE_URL`           |
| `supabase_anon_key`         | `SUPABASE_ANON_KEY`, `VITE_SUPABASE_ANON_KEY` |
| `supabase_service_role_key` | `SUPABASE_SERVICE_ROLE_KEY`                   |
| `openai_api_key`            | `OPENAI_API_KEY`                              |
| `openai_heavy_model`        | `OPENAI_HEAVY_MODEL`                          |
| `openai_small_model`        | `OPENAI_SMALL_MODEL`                          |
| `anthropic_api_key`         | `ANTHROPIC_API_KEY`                           |
| `gemini_api_key`            | `GEMINI_API_KEY`                              |
| `city_name`                 | `VITE_CITY_NAME`, `CITY_NAME`                 |
| `party_name`                | `VITE_PARTY_NAME`, `PARTY_NAME`               |
| `app_url`                   | `VITE_APP_URL`, `APP_URL`, `URL`              |
| `assistant_name`            | `VITE_ASSISTANT_NAME`, `ASSISTANT_NAME`       |

### Valeurs par défaut

```javascript
const DEFAULT_VALUES = {
  city_name: "Corte",
  party_name: "Petit Parti",
  assistant_name: "Ophélia",
  openai_heavy_model: "gpt-4o",
  openai_small_model: "gpt-4o-mini",
  embed_model: "text-embedding-3-small",
  port: 8888,
  // ... voir le code source pour la liste complète
};
```

---

## Cache et performance

### Stratégie de cache

- **TTL** : 5 minutes (configurable via `CONFIG_CACHE_TTL_MS`)
- **Invalidation** : Automatique après expiration
- **Fallback** : Si le vault est inaccessible, utilise les variables d'environnement

```javascript
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
```

### Rechargement forcé

```javascript
// Forcer le rechargement de la configuration
await loadConfig(true); // true = force refresh
```

---

## Migration depuis l'ancien système

### Avant (dispersé)

```javascript
// Ancien code - À ÉVITER
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);
```

### Après (centralisé)

```javascript
// Nouveau code - RECOMMANDÉ
import { loadConfig, createSupabaseClient } from "./lib/config.js";

await loadConfig();
const supabase = createSupabaseClient();
```

---

## Ajout d'une nouvelle variable

### 1. Ajouter au mapping (si variantes)

Dans chaque module `instanceConfig.js` :

```javascript
const ENV_KEY_MAPPING = {
  // ... existant
  ma_nouvelle_cle: ["MA_NOUVELLE_CLE", "VITE_MA_NOUVELLE_CLE"],
};
```

### 2. Ajouter une valeur par défaut (optionnel)

```javascript
const DEFAULT_VALUES = {
  // ... existant
  ma_nouvelle_cle: "valeur_par_defaut",
};
```

### 3. Utiliser dans le code

```javascript
const maValeur = getConfig("ma_nouvelle_cle", "fallback");
```

---

## Stockage en base de données

### Insérer une configuration

```sql
INSERT INTO instance_config (key, value)
VALUES ('city_name', 'Ma Ville')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
```

### Lire les configurations

```sql
SELECT key, value, updated_at FROM instance_config ORDER BY key;
```

### Supprimer une configuration

```sql
DELETE FROM instance_config WHERE key = 'city_name';
```

---

## Sécurité

### Bonnes pratiques

1. **Secrets sensibles** : Stockez les clés API en variables d'environnement Netlify, pas en base
2. **RLS** : La table `instance_config` doit être protégée (lecture seule pour les fonctions)
3. **Logs** : Ne jamais logger les valeurs des clés sensibles

### Variables à NE PAS stocker en base

- `SUPABASE_SERVICE_ROLE_KEY` (accès admin)
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.
- Tout secret de production

### Variables OK pour le vault

- `city_name`, `party_name`, `assistant_name`
- Configurations d'affichage
- Paramètres de modèles IA (noms, pas clés)
- parent_hub_api_key (clé API du hub parent, stockez-la dans le vault si vous souhaitez autoriser le
  forwarding depuis ce hub)

---

## Dépannage

### La configuration ne se charge pas

```javascript
// Vérifier que loadConfig() est appelé
await loadConfig();
console.log("Config loaded:", getConfig("city_name"));
```

### Valeur incorrecte retournée

1. Vérifier la priorité : vault > env > défaut
2. Inspecter la table `instance_config`
3. Vérifier les variables d'environnement : `netlify env:list`

### Cache obsolète

```javascript
// Forcer le rechargement
await loadConfig(true);
```

---

## Références

- [Migration SQL](../supabase/migrations/20241201_instance_config.sql)
- [Module Frontend](../src/lib/instanceConfig.js)
- [Module Netlify Functions](../netlify/lib/instanceConfig.js)
- [Module Edge Functions](../netlify/edge-functions/lib/instanceConfig.js)
- [Module Scripts CLI](../scripts/lib/config.js)
