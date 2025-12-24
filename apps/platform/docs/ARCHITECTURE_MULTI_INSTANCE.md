# Architecture Multi-Instance Ophélia, Work In Progress (WIP)

## Vue d'ensemble

Le système Ophélia supporte le déploiement de multiples instances (communautés) avec une
architecture fédérée. Chaque instance possède sa propre base de données mais partage le code source
commun.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ARCHITECTURE OPHÉLIA                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐            │
│   │   Instance   │   │   Instance   │   │   Instance   │            │
│   │    Corte     │   │  Université  │   │  Copro XYZ   │            │
│   │ (Hub Corse)  │   │   di Corse   │   │              │            │
│   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘            │
│          │                  │                  │                    │
│          ▼                  ▼                  ▼                    │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐            │
│   │  Supabase A  │   │  Supabase B  │   │  Supabase C  │            │
│   │ + instance_  │   │ + instance_  │   │ + instance_  │            │
│   │   config     │   │   config     │   │   config     │            │
│   └──────────────┘   └──────────────┘   └──────────────┘            │
│          │                  │                  │                    │
│          │            FÉDÉRATION               │                    │
│          ◀────────────────────────────────────▶
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                    CODE SOURCE COMMUN                       │   │
│   │              github.com/JeanHuguesRobert/survey             │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐            │
│   │   Wiki Git   │   │   Wiki Git   │   │   Wiki Git   │            │
│   │  Repo Corte  │   │  Repo Uni    │   │  Repo Copro  │            │
│   └──────────────┘   └──────────────┘   └──────────────┘            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 1. Routage Multi-Instances

### Stratégie : Sous-domaines + Détection automatique

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ROUTAGE MULTI-INSTANCES                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   URL                              Instance détectée                │
│   ─────────────────────────────    ──────────────────────────────   │
│   corte.transparence.corsica   →   Supabase Corte (2B096)           │
│   bastia.transparence.corsica  →   Supabase Bastia (2B033)          │
│   uni.transparence.corsica     →   Supabase Université              │
│   localhost:5173?instance=test →   Instance de test                 │
│                                                                     │
│   FALLBACK                                                          │
│   ─────────────────────────────                                     │
│   transparence.corsica         →   Page d'accueil multi-instances   │
│   ?instance=xxx                →   Override pour dev/test           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Configuration DNS (Cloudflare/Netlify DNS)

Pour l'instant, c'est hébergé sous LePP.fr

```
# Enregistrements DNS
*.transparence.corsica    CNAME   app.netlify.com
transparence.corsica      CNAME   app.netlify.com

# Ou avec IP Netlify
*.transparence.corsica    A       75.2.60.5
```

### Mapping sous-domaine → Instance (instance_registry)

```sql
-- Table de mapping sous-domaine → instance Supabase
CREATE TABLE IF NOT EXISTS instance_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subdomain text UNIQUE NOT NULL,       -- 'corte', 'bastia', 'universite'
  display_name text NOT NULL,           -- 'Ville de Corte'
  supabase_url text NOT NULL,           -- 'https://xxx.supabase.co'
  supabase_anon_key text NOT NULL,      -- Clé publique
  status text DEFAULT 'active',         -- 'active', 'suspended', 'pending'
  created_at timestamptz DEFAULT now(),
  metadata jsonb                        -- { insee, type, region... }
);

-- Index pour lookup rapide
CREATE INDEX idx_instance_registry_subdomain ON instance_registry(subdomain);

-- Exemples
INSERT INTO instance_registry (subdomain, display_name, supabase_url, supabase_anon_key, metadata) VALUES
  ('corte', 'Ville de Corte', 'https://abc.supabase.co', 'eyJ...', '{"insee": "2B096", "type": "municipality"}'),
  ('bastia', 'Ville de Bastia', 'https://def.supabase.co', 'eyJ...', '{"insee": "2B033", "type": "municipality"}'),
  ('universite', 'Università di Corsica', 'https://ghi.supabase.co', 'eyJ...', '{"type": "university"}');
```

### Détection de l'instance (Frontend)

```javascript
// src/lib/instanceResolver.js

/**
 * Résout l'instance Supabase à utiliser selon l'URL
 */
export async function resolveInstance() {
  // 1. Override via paramètre URL (dev/test)
  const urlParams = new URLSearchParams(window.location.search);
  const instanceOverride = urlParams.get("instance");

  // 2. Extraction du sous-domaine
  const hostname = window.location.hostname;
  let subdomain = null;

  if (hostname.includes(".transparence.corsica")) {
    subdomain = hostname.split(".")[0];
  } else if (hostname === "localhost" || hostname === "127.0.0.1") {
    // Dev local : utiliser le paramètre ou .env
    subdomain = instanceOverride || import.meta.env.VITE_INSTANCE || "corte";
  }

  // 3. Lookup dans le registre (via API centrale)
  if (subdomain && subdomain !== "www" && subdomain !== "app") {
    const instance = await lookupInstance(subdomain);
    if (instance) {
      return instance;
    }
  }

  // 4. Fallback : instance par défaut ou page de sélection
  return {
    subdomain: "default",
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    isDefault: true,
  };
}

/**
 * Lookup dans le registre central
 */
async function lookupInstance(subdomain) {
  // Option A : API centrale (un Supabase "master")
  const registryUrl = import.meta.env.VITE_REGISTRY_URL || "https://registry.transparence.corsica";

  try {
    const response = await fetch(`${registryUrl}/api/instance/${subdomain}`);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.warn("Registry lookup failed:", error);
  }

  // Option B : Fichier statique (pour démarrer simple)
  return STATIC_INSTANCES[subdomain] || null;
}

// Fallback statique (peut être généré au build)
const STATIC_INSTANCES = {
  corte: {
    subdomain: "corte",
    displayName: "Ville de Corte",
    supabaseUrl: "https://abc.supabase.co",
    supabaseAnonKey: "eyJ...",
    metadata: { insee: "2B096" },
  },
  bastia: {
    subdomain: "bastia",
    displayName: "Ville de Bastia",
    supabaseUrl: "https://def.supabase.co",
    supabaseAnonKey: "eyJ...",
    metadata: { insee: "2B033" },
  },
};
```

### Initialisation de Supabase dynamique

```javascript
// src/lib/supabase.js

import { createClient } from "@supabase/supabase-js";
import { resolveInstance } from "./instanceResolver";

let supabaseInstance = null;
let currentInstance = null;

/**
 * Initialise le client Supabase pour l'instance détectée
 */
export async function initSupabase() {
  if (supabaseInstance && currentInstance) {
    return { supabase: supabaseInstance, instance: currentInstance };
  }

  currentInstance = await resolveInstance();

  supabaseInstance = createClient(currentInstance.supabaseUrl, currentInstance.supabaseAnonKey, {
    auth: {
      persistSession: true,
      storageKey: `sb-${currentInstance.subdomain}-auth`, // Session par instance
    },
  });

  // Stocker pour accès synchrone
  window.__OPHELIA_INSTANCE__ = currentInstance;

  return { supabase: supabaseInstance, instance: currentInstance };
}

/**
 * Accès synchrone après initialisation
 */
export function getSupabase() {
  if (!supabaseInstance) {
    throw new Error("Supabase not initialized. Call initSupabase() first.");
  }
  return supabaseInstance;
}

export function getInstance() {
  return currentInstance;
}
```

### Point d'entrée React

```jsx
// src/main.jsx

import React from "react";
import ReactDOM from "react-dom/client";
import { initSupabase } from "./lib/supabase";
import App from "./App";

async function bootstrap() {
  // Résoudre l'instance AVANT le rendu
  const { instance } = await initSupabase();

  console.log(`🏛️ Instance: ${instance.displayName || instance.subdomain}`);

  // Afficher un loader pendant l'init si nécessaire
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App instance={instance} />
    </React.StrictMode>
  );
}

bootstrap();
```

### Netlify Edge Function (routage serveur)

```javascript
// netlify/edge-functions/instance-router.js

export default async function handler(request, context) {
  const url = new URL(request.url);
  const hostname = url.hostname;

  // Extraire le sous-domaine
  let subdomain = null;
  if (hostname.endsWith(".transparence.corsica")) {
    subdomain = hostname.replace(".transparence.corsica", "");
  }

  // Injecter l'instance dans les headers pour le frontend
  if (subdomain && subdomain !== "www") {
    const response = await context.next();

    // Ajouter un header pour le frontend
    response.headers.set("X-Ophelia-Instance", subdomain);

    return response;
  }

  return context.next();
}

export const config = {
  path: "/*",
};
```

### Page de sélection d'instance (accueil)

```jsx
// src/pages/InstanceSelector.jsx

import { useState, useEffect } from "react";

export default function InstanceSelector() {
  const [instances, setInstances] = useState([]);

  useEffect(() => {
    // Charger la liste des instances publiques
    fetch("/api/instances")
      .then((r) => r.json())
      .then(setInstances);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
      <div className="container mx-auto py-16 px-4">
        <h1 className="text-4xl font-bold text-center mb-4">Bienvenue sur Ophélia</h1>
        <p className="text-center text-gray-600 mb-12">Choisissez votre communauté</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {instances.map((instance) => (
            <a
              key={instance.subdomain}
              href={`https://${instance.subdomain}.transparence.corsica`}
              className="block p-6 bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center gap-4">
                {instance.logo && (
                  <img src={instance.logo} alt="" className="w-12 h-12 rounded-full" />
                )}
                <div>
                  <h2 className="font-semibold text-lg">{instance.displayName}</h2>
                  <p className="text-sm text-gray-500">{instance.metadata?.type}</p>
                </div>
              </div>
            </a>
          ))}
        </div>

        <div className="text-center mt-12">
          <a href="/onboarding" className="text-primary-600 hover:underline">
            Créer une nouvelle instance →
          </a>
        </div>
      </div>
    </div>
  );
}
```

### Configuration netlify.toml

```toml
# netlify.toml

[build]
  publish = "dist"
  command = "npm run build"

# Edge function pour résoudre l'instance
[[edge_functions]]
  path = "/*"
  function = "instance-resolver"
  excludedPath = ["/assets/*", "/images/*", "/fonts/*"]

# API de lookup d'instance
[[redirects]]
  from = "/api/instance/*"
  to = "/.netlify/functions/instance-lookup?subdomain=:splat"
  status = 200

[[redirects]]
  from = "/api/instances"
  to = "/.netlify/functions/instances-list"
  status = 200

# Headers pour exposer les infos d'instance au JS
[[headers]]
  for = "/*"
  [headers.values]
    Access-Control-Expose-Headers = "X-Ophelia-Instance, X-Ophelia-Supabase-URL"
```

### Utilisation en développement local

En développement sur localhost, les sous-domaines ne fonctionnent pas. Utilisez le **paramètre URL**
`?instance=xxx` :

```bash
# Démarrer le serveur de dev
npm run dev

# Accéder à une instance spécifique
http://localhost:5173?instance=corte
http://localhost:5173?instance=bastia

# Sans paramètre = instance par défaut (env vars)
http://localhost:5173
```

### Fichiers créés

| Fichier                                              | Description                              |
| ---------------------------------------------------- | ---------------------------------------- |
| `src/lib/instanceResolver.js`                        | Résolution sous-domaine/param → instance |
| `src/lib/supabase.js`                                | Client Supabase dynamique                |
| `src/main.jsx`                                       | Bootstrap asynchrone avec résolution     |
| `src/pages/InstanceSelector.jsx`                     | Page de sélection d'instance             |
| `netlify/edge-functions/instance-resolver.js`        | Edge function de routage                 |
| `netlify/functions/instance-lookup.js`               | API lookup d'instance                    |
| `netlify/functions/instances-list.js`                | API liste des instances                  |
| `supabase/migrations/20251205_instance_registry.sql` | Table de registre                        |

---

## 2. Instance Vault (Configuration en base)

> **Note** : Le vault est résolu APRÈS la détection de l'instance (voir section 1). Chaque instance
> a sa propre table `instance_config` dans sa base Supabase.

### ⚠️ Approche Progressive ("en douceur")

Le vault est conçu pour **ne pas casser l'instance existante** :

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ORDRE DE PRIORITÉ                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   1. Variables d'environnement (.env, Netlify)                      │
│      └── Toujours chargées en premier (comportement actuel)         │
│                                                                     │
│   2. Table instance_config (si migration appliquée)                 │
│      └── SURCHARGE les env vars (priorité supérieure)               │
│                                                                     │
│   Résultat : l'app fonctionne toujours, même sans migration         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Scénarios :**

| État                                   | Comportement                                 |
| -------------------------------------- | -------------------------------------------- |
| Migration **non appliquée**            | Env vars uniquement (comportement actuel ✅) |
| Migration appliquée, table **vide**    | Env vars uniquement                          |
| Migration appliquée, table **peuplée** | DB surcharge env vars                        |

### Problème résolu

Les variables d'environnement posent plusieurs problèmes :

- **Fragmentation** : configs dispersées entre `.env`, Netlify, Supabase
- **Pas de versioning** : pas d'historique des modifications
- **Secrets exposés** : risque de commit accidentel
- **Pas d'UI** : modification = déploiement

### Solution : Table `instance_config`

Toute la configuration est stockée dans une table Supabase :

```sql
CREATE TABLE instance_config (
  key text PRIMARY KEY,           -- ex: 'community_name'
  value text,                     -- valeur simple
  value_json jsonb,               -- valeur JSON complexe
  category text,                  -- 'identity', 'secrets', 'features'...
  is_secret boolean,              -- masqué dans les API publiques
  is_public boolean,              -- accessible sans auth
  version integer,                -- auto-incrémenté à chaque update
  previous_value text,            -- audit trail
  updated_by uuid                 -- qui a modifié
);
```

### Catégories de configuration

| Catégorie    | Exemples                               | Accès      |
| ------------ | -------------------------------------- | ---------- |
| `identity`   | community_name, community_type, region | Public     |
| `branding`   | bot_name, hashtag, colors, logo        | Public     |
| `secrets`    | api_keys, oauth_secrets, tokens        | Admin only |
| `features`   | feature_wiki, feature_chatbot          | Public     |
| `federation` | is_hub, parent_hub_url, peers          | Selon      |
| `map`        | default_lat, default_lng, zoom         | Public     |
| `chatbot`    | welcome_message, threshold             | Public     |

### Utilisation côté JavaScript

```javascript
import { initializeInstance, getConfig, isFeatureEnabled } from "TODO";

// Au démarrage de l'app.
await initializeInstance();

// Lecture d'une config
const communityName = getConfig("community_name", "Corte");

// Vérifier une feature
if (isFeatureEnabled("wiki")) {
  // ...
}
```

### Avantages

✅ **Un seul endroit** pour toute la config ✅ **UI admin** possible pour modifier sans déploiement
✅ **Audit trail** avec versioning et previous_value ✅ **RLS sécurisé** : secrets protégés par rôle
admin ✅ **Cache intelligent** : TTL de 5 minutes

---

## 3. Modèle Multi-Repository (Wiki par communauté)

### Problème

Le wiki doit être personnalisé par communauté :

- Contenu spécifique (pages, délibérations)
- Historique Git des modifications
- Backup externe (hors Supabase)

### Solution : Un repo Git par communauté

```
Organisation GitHub: JeanHuguesRobert/Survey
│
├── survey (code source commun)
│   ├── src/
│   ├── supabase/
│   └── public/
│
├── ophelia-bastia
│   ├── pages/
│   │   ├── accueil.md
│   │   ├── conseil-municipal/
│   │   └── deliberations/
│   └── assets/
│       └── images/
│
├── ophelia-universite-corse
│   ├── pages/
│   │   ├── accueil.md
│   │   ├── conseil-administration/
│   │   └── vie-etudiante/
│   └── assets/
│
└── ophelia-copro-marina
    ├── pages/
    └── assets/
```

### Configuration du repo wiki

Dans `instance_config` :

```sql
INSERT INTO instance_config (key, value, category, is_secret) VALUES
  ('github_token', 'ghp_xxx...', 'secrets', true),
  ('github_repo', 'CORSICA-Association/ophelia-wiki-corte', 'secrets', true),
  ('github_wiki_branch', 'main', 'secrets', false);
```

### Synchronisation Wiki ↔ DB

```
┌─────────────────────────────────────────────────────────────────┐
│                        SYNC WIKI                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   GitHub Repo                      Supabase                     │
│   ┌──────────┐                    ┌──────────┐                  │
│   │ pages/   │  ──── Webhook ───▶   wiki_
│   │ *.md     │                    │ pages    │                  │
│   │          │  ◀─── API Push ───
│   └──────────┘                    └──────────┘                  │
│                                         │                       │
│                                         ▼                       │
│                              ┌─────────────────┐                │
│                              │ Embeddings RAG  │                │
│                              │ (recherche IA)  │                │
│                              └─────────────────┘                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

1. **Modification dans Supabase** (via UI) → Push à la demande vers GitHub
2. **Modification dans GitHub** (PR/commit) → TODO: Webhook déclenche sync vers DB
3. **Les embeddings RAG** TODO: sont recalculés après chaque sync

---

## 4. Déploiement d'une nouvelle instance

### TODO: Étapes automatisables

```bash
# 1. Créer le projet Supabase
npx supabase projects create ophelia-universite-corse \
  --org-id $ORG_ID \
  --region eu-west-3

# 2. Appliquer les migrations (incluant instance_vault)
npx supabase db push

# 3. Créer le repo wiki
gh repo create CORSICA-Association/ophelia-wiki-universite-corse \
  --public \
  --template CORSICA-Association/ophelia-wiki-template

# 4. Configurer l'instance via SQL
psql $DATABASE_URL -f - <<EOF
SELECT set_instance_config('community_name', 'Università di Corsica');
SELECT set_instance_config('community_type', 'university');
SELECT set_instance_config('bot_name', 'Ophélia');
SELECT set_instance_config('github_repo', 'CORSICA-Association/ophelia-wiki-universite-corse');
EOF

# 5. Déployer le frontend (Netlify)
netlify sites:create --name ophelia-universite-corse
netlify env:set VITE_SUPABASE_URL $SUPABASE_URL
netlify env:set VITE_SUPABASE_ANON_KEY $SUPABASE_ANON_KEY
netlify deploy --prod
```

### Variables d'environnement minimales

Avec le vault, seules **2 variables** sont nécessaires côté Netlify :

| Variable                 | Description            |
| ------------------------ | ---------------------- |
| `VITE_SUPABASE_URL`      | URL du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clé anonyme (publique) |

Tout le reste est dans la table `instance_config` !

---

## 5. UI Admin pour le Vault

### TODO: Page `/admin/config`

### TODO: Avantages de l'UI

- Modifier les configs **sans redéployer**
- Activer/désactiver des features en temps réel
- Changer le branding instantanément
- Voir l'historique des modifications

---

## 6. Sécurité

### Protection des secrets

1. **RLS strict** : seuls les admins lisent `is_secret = true`
2. **Vue masquée** : `instance_config_admin` affiche `***HIDDEN***`
3. **Pas de logs** : les secrets ne sont jamais loggés
4. **Chiffrement optionnel** : TODO: pgcrypto disponible pour at-rest

### Audit trail

```sql
-- Chaque modification garde une trace
SELECT key, value, previous_value, updated_at, updated_by
FROM instance_config
WHERE key = 'community_name'
ORDER BY version DESC;
```

---

## 7. Migration depuis .env

> **Important** : Avec l'architecture multi-instances, les variables d'environnement sont réduites
> au strict minimum. Seules `SUPABASE_URL` et `SUPABASE_ANON_KEY` sont nécessaires, le reste vient
> du vault. Plus `SUPABASE_SERVICE_ROLE_KEY`, seulement pour l'adminitration.

---

## Résumé

### Options de routage multi-instances

| Approche             | URL Exemple                  | Avantages           | Inconvénients               |
| -------------------- | ---------------------------- | ------------------- | --------------------------- |
| **Sous-domaines** ✅ | `corte.transparence.corsica` | SEO, isolation, pro | Config DNS                  |
| **Paramètre URL**    | `?instance=corte`            | Simple              | URLs moches, perte du param |
|                      |

**Recommandation** : Sous-domaines avec fallback paramètre pour le dev.

### Flux de résolution d'instance

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FLUX DE RÉSOLUTION                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Requête HTTP                                                    │
│     corte.transparence.corsica/accueil                              │
│                    │                                                │
│                    ▼                                                │
│  2. Edge Function (Netlify)                                         │
│     → Extrait subdomain "corte"                                     │
│     → Header X-Ophelia-Instance: corte                              │
│                    │                                                │
│                    ▼                                                │
│  3. Frontend (instanceResolver.js)                                  │
│     → Lookup dans le registre central                               │
│     → Récupère supabaseUrl + anonKey                                │
│                    │                                                │
│                    ▼                                                │
│  4. Initialisation Supabase                                         │
│     → createClient(url, key)                                        │
│     → Session isolée par instance                                   │
│                    │                                                │
│                    ▼                                                │
│  5. Chargement du Vault                                             │
│     → loadConfig() depuis instance_config                           │
│     → getConfig('community_name') → "Corte"                         │
│                    │                                                │
│                    ▼                                                │
│  6. Rendu React                                                     │
│     → App personnalisée pour Corte                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Configuration minimale par instance

| Aspect             | Avant (env vars)       | Après (vault)          |
| ------------------ | ---------------------- | ---------------------- |
| **Stockage**       | Fichiers .env, Netlify | Table Supabase         |
| **Modification**   | Redéploiement          | UI admin en temps réel |
| **Secrets**        | Risque de leak         | RLS + chiffrement      |
| **Historique**     | Aucun                  | Versioning complet     |
| **Multi-instance** | Dupliquer .env         | 1 row par config       |
| **Wiki**           | Dans le même repo      | Repo Git séparé        |

---

## Fichiers Migrés

### Frontend (src/)

| Fichier                                    | Clés utilisées                                           |
| ------------------------------------------ | -------------------------------------------------------- |
| `lib/instanceConfig.js`                    | Module principal - toutes les clés                       |
| `constants.js`                             | `community_type`, `contact_email`                        |
| `pages/Contact.jsx`                        | `contact_email`                                          |
| `pages/Admin.jsx`                          | `contact_email`                                          |
| `pages/UserPage.jsx`                       | `contact_email`                                          |
| `pages/Gazette.jsx`                        | `global_gazette_editor_group`                            |
| `pages/PostEdit.jsx`                       | `global_gazette_editor_group`                            |
| `pages/IncidentEditor.jsx`                 | `global_gazette_editor_group`                            |
| `lib/gazetteAssignments.js`                | `global_gazette_editor_group`                            |
| `components/social/PostEditor.jsx`         | `global_gazette_editor_group`                            |
| `components/rgpd/RGPDSettings.jsx`         | `contact_email`                                          |
| `components/common/ShareMenu.jsx`          | `bot_name`                                               |
| `components/common/AuthModal.jsx`          | `facebook_app_id`                                        |
| `components/common/FacebookPagePlugin.jsx` | `facebook_page_url`                                      |
| `components/ophelia/FeedOpheliaModal.jsx`  | `bot_name`                                               |
| `components/map/CitizenMap.jsx`            | `map_default_lat`, `map_default_lng`, `map_default_zoom` |
| `components/map/AddressSearchControl.jsx`  | `map_default_lat`, `map_default_lng`                     |
| `components/bob/v2/Header.jsx`             | `facebook_page_url`                                      |
| `components/bob/v2/useChatLogic.js`        | `huggingface_api_key`                                    |

### Backend (netlify/functions/)

| Fichier                  | Clés utilisées                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| `lib/instanceConfig.js`  | Module principal backend                                                                            |
| `constants.js`           | `github_token`, `github_repo`, `github_wiki_branch`                                                 |
| `generateShareText.js`   | `bot_name`, `city_name`, `movement_name`, `party_name`, `hashtag`, `openai_api_key`, `openai_model` |
| `analyze-content.js`     | `bot_name`, `city_name`, `movement_name`, `party_name`, `hashtag`, `openai_api_key`, `openai_model` |
| `sync-wiki.js`           | `openai_api_key`, `openai_model`                                                                    |
| `optimize-wiki-title.js` | `openai_api_key`, `openai_model`                                                                    |
| `admin-update.js`        | `contact_email`                                                                                     |
| `facebook-avatar.js`     | `facebook_app_id`, `facebook_client_secret`, `facebook_token`                                       |
| `facebook-oembed.js`     | `facebook_app_id`, `facebook_client_secret`, `facebook_token`                                       |

---

_Document créé le 5 décembre 2024_ _Architecture Ophélia v2.0_
