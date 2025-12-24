# Analyse des dépendances Supabase et stratégie de portabilité

> **Projet:** Survey (Plateforme civique pour Corte) **Date:** 4 décembre 2025 **Objectif:** Étudier
> les dépendances à Supabase, identifier les alternatives, et planifier une stratégie de portabilité

---

## Table des matières

1. [État des lieux des dépendances Supabase](#1-état-des-lieux-des-dépendances-supabase)
2. [Classification par familles de services](#2-classification-par-familles-de-services)
3. [Solutions modernes et prometteuses](#3-solutions-modernes-et-prometteuses)
4. [Solutions souveraines (indépendance numérique)](#4-solutions-souveraines-indépendance-numérique)
5. [Solutions à maintenance minimale](#5-solutions-à-maintenance-minimale)
6. [Solutions 100% Open Source](#6-solutions-100-open-source)
7. [Solutions gratuites pour petites communes](#7-solutions-gratuites-pour-petites-communes)
8. [Solutions haute performance](#8-solutions-haute-performance)
9. [Matrice multi-critères des compromis](#9-matrice-multi-critères-des-compromis)
10. [Recommandations finales](#10-recommandations-finales)

---

## 1. État des lieux des dépendances Supabase

### 1.1 Dépendances npm

```json
{
  "@supabase/supabase-js": "^2.76.1",
  "supabase": "^2.63.1"
}
```

### 1.2 Variables d'environnement

> **Note**: Le projet utilise un système de configuration centralisé ("vault") qui gère
> automatiquement les fallbacks entre ces variables. Voir `docs/CONFIGURATION_VAULT.md` pour plus de
> détails.

| Variable                    | Usage                        |
| --------------------------- | ---------------------------- |
| `SUPABASE_URL`              | Backend (Netlify Functions)  |
| `VITE_SUPABASE_URL`         | Frontend (Vite)              |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin access serverless      |
| `VITE_SUPABASE_ANON_KEY`    | Public anonymous key         |
| `POSTGRES_URL`              | Connexion directe PostgreSQL |

### 1.3 Statistiques d'usage

| Métrique                    | Valeur |
| --------------------------- | ------ |
| Fichiers important Supabase | 50+    |
| Tables base de données      | 40+    |
| Fonctions RPC               | 15+    |
| Types ENUM personnalisés    | 20+    |
| Buckets Storage             | 2      |
| Patterns Realtime           | 4      |

### 1.4 Niveau de lock-in par service

| Service           | Niveau lock-in | Raison                                        |
| ----------------- | -------------- | --------------------------------------------- |
| **Auth**          | 🔴 Élevé       | SDK direct, format session, validation tokens |
| **Database**      | 🔴 Élevé       | ENUMs custom, RLS, RPC, triggers              |
| **PostgREST API** | 🔴 Élevé       | Syntaxe `.from().select()` partout            |
| **Realtime**      | 🟡 Moyen       | API channels spécifique                       |
| **Storage**       | 🟢 Faible      | Opérations simples, facilement abstrait       |

---

## 2. Classification par familles de services

### Famille 1: Authentification & Identité

**Services utilisés:**

- `auth.getUser()` — Validation tokens
- `auth.getSession()` — Récupération session
- `auth.onAuthStateChange()` — Listeners auth
- `auth.admin.deleteUser()` — RGPD suppression

**Fichiers clés:**

- `src/contexts/SupabaseContext.jsx`
- `src/contexts/CurrentUserContext.jsx`
- `netlify/functions/*.mjs`

### Famille 2: Base de données (PostgREST)

**Opérations:**

- CRUD: `.from().select/insert/update/delete()`
- Jointures: `.select("*, relation(*)")`
- Filtres: `.eq(), .in(), .gte()`
- Upsert: `.upsert({}, { onConflict })`

**Spécificités PostgreSQL:**

- 20+ types ENUM (`civic_actor_type`, `acte_type_acte`, etc.)
- Colonnes `vector(1536)` pour embeddings (pgvector)
- Contraintes CHECK extensives
- Index GIN sur JSONB
- Row Level Security (RLS)

### Famille 3: Fonctions RPC (Stored Procedures)

| Fonction                          | Usage                 |
| --------------------------------- | --------------------- |
| `count_user_subscribers`          | Comptage followers    |
| `match_propositions_by_embedding` | Recherche vectorielle |
| `update_acte_versioned`           | Versionnement actes   |
| `log_responsibility`              | Audit trail           |
| `approve/reject_outgoing_action`  | Workflow validation   |

### Famille 4: Temps réel (Realtime)

| Canal         | Table surveillée        | Fichier                                     |
| ------------- | ----------------------- | ------------------------------------------- |
| Notifications | `content_subscriptions` | `src/hooks/useSubscriptionNotifications.js` |
| Jobs          | `jobs`                  | `src/hooks/useJobMonitor.js`                |
| Connexion     | Heartbeat               | `src/hooks/useRealtimeConnection.js`        |

### Famille 5: Stockage fichiers (Storage)

| Bucket             | Usage             |
| ------------------ | ----------------- |
| `public-documents` | Documents publics |
| `civic-proofs`     | Preuves civiques  |

**Opérations:** `upload()`, `getPublicUrl()`, `remove()`

---

## 3. Solutions modernes et prometteuses

### Authentification

| Solution          | Type         | Points forts                                                 |
| ----------------- | ------------ | ------------------------------------------------------------ |
| **🥇 Clerk**      | SaaS         | Composants React drop-in, organisations B2B, billing intégré |
| **🥈 Ory Kratos** | Auto-hébergé | API-first, headless, conforme RGPD, léger                    |
| **🥉 Authentik**  | Auto-hébergé | UI moderne, SSO/SAML/OIDC complet, K8s natif                 |

### Base de données + ORM

| Solution           | Type      | Points forts                                               |
| ------------------ | --------- | ---------------------------------------------------------- |
| **🥇 Drizzle ORM** | Librairie | TypeScript-first, RLS support, ~14x plus rapide que Prisma |
| **🥈 Neon**        | SaaS      | PostgreSQL serverless, branching Git-like, auto-scaling    |
| **🥉 Convex**      | SaaS      | Backend TypeScript tout-en-un, realtime natif              |

### Temps réel

| Solution          | Type      | Points forts                                         |
| ----------------- | --------- | ---------------------------------------------------- |
| **🥇 Liveblocks** | SaaS      | Collaboration Figma-like, AI Copilots, SOC 2 + HIPAA |
| **🥈 PartyKit**   | SaaS/Edge | Cloudflare Workers natif, stateful websockets        |

### Stockage

| Solution             | Type         | Points forts                                       |
| -------------------- | ------------ | -------------------------------------------------- |
| **🥇 Cloudflare R2** | SaaS         | Zéro egress fees, API S3-compatible, 10 GB gratuit |
| **🥈 MinIO**         | Auto-hébergé | S3-compatible, haute performance, Kubernetes natif |

### Backend tout-en-un

| Solution          | Type         | Points forts                           |
| ----------------- | ------------ | -------------------------------------- |
| **🥇 Convex**     | SaaS         | TypeScript end-to-end, realtime natif  |
| **🥈 Appwrite**   | Hybride      | Open-source, Auth+DB+Storage+Functions |
| **🥉 PocketBase** | Auto-hébergé | 1 seul binaire Go, très léger          |

---

## 4. Solutions souveraines (indépendance numérique)

### Authentification souveraine

| Solution          | Hébergement  | Juridiction                                     |
| ----------------- | ------------ | ----------------------------------------------- |
| **Keycloak**      | Auto-hébergé | Votre choix — Standard administration française |
| **LemonLDAP::NG** | Auto-hébergé | 🇫🇷 France — Développé par la Gendarmerie        |
| **Ory Kratos**    | Auto-hébergé | Votre choix — Société allemande                 |

### Cloud français

| Solution                | Type  | Certifications                       |
| ----------------------- | ----- | ------------------------------------ |
| **Scaleway**            | Cloud | 🇫🇷 Datacenters Paris/Amsterdam       |
| **OVHcloud**            | Cloud | 🇫🇷 SecNumCloud, "Cloud de Confiance" |
| **Clever Cloud**        | PaaS  | 🇫🇷 Startup française, Nantes/Paris   |
| **Outscale (Dassault)** | Cloud | 🇫🇷 SecNumCloud, partenaire État      |

### Architecture souveraine recommandée

```
┌─────────────────────────────────────────────────────────────┐
│                    STACK SOUVERAIN FR                       │
├─────────────────────────────────────────────────────────────┤
│  Frontend     │ Clever Cloud / Scaleway Containers          │
│  Serverless   │ Scaleway Functions / Clever Cloud           │
│  Auth         │ Keycloak (auto-hébergé) ou LemonLDAP::NG    │
│  Database     │ Scaleway PostgreSQL + Drizzle ORM           │
│  Storage      │ Scaleway Object Storage (S3-compatible)     │
│  Realtime     │ Socket.io auto-hébergé / NATS               │
│  Vectors/AI   │ pgvector sur PostgreSQL Scaleway            │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Solutions à maintenance minimale

### Synthèse par famille

| Famille   | Solution zéro-ops     | Maintenance |
| --------- | --------------------- | ----------- |
| Auth      | Supabase Auth / Clerk | Zéro        |
| Database  | Supabase / Neon       | Zéro        |
| Storage   | Supabase Storage / R2 | Zéro        |
| Realtime  | Supabase Realtime     | Zéro        |
| Functions | Netlify Functions     | Zéro        |
| Hosting   | Netlify               | Zéro        |

### Stack maintenance zéro

```
┌─────────────────────────────────────────────────────────────┐
│              STACK MAINTENANCE MINIMALE ✨                  │
├─────────────────────────────────────────────────────────────┤
│  Auth         │ Supabase Auth (actuel) ou Clerk             │
│  Database     │ Supabase (actuel) ou Neon                   │
│  Storage      │ Supabase Storage (actuel) ou Cloudflare R2  │
│  Realtime     │ Supabase Realtime (actuel)                  │
│  Functions    │ Netlify Functions (actuel)                  │
│  Hosting      │ Netlify (actuel)                            │
│  ORM          │ Ajouter Drizzle (abstraction sans ops)      │
└─────────────────────────────────────────────────────────────┘
```

**Conclusion:** Le stack actuel (Supabase + Netlify) est déjà optimal pour la maintenance minimale.

---

## 6. Solutions 100% Open Source

### Par famille

| Famille    | Solution OSS                      | Licence                |
| ---------- | --------------------------------- | ---------------------- |
| Auth       | Keycloak / Ory Kratos / Authentik | Apache 2.0 / MIT       |
| Database   | PostgreSQL                        | BSD                    |
| ORM        | Drizzle / Prisma / Kysely         | Apache 2.0 / MIT       |
| Storage    | MinIO / SeaweedFS                 | AGPL v3 / Apache 2.0   |
| Realtime   | Socket.io / NATS / Centrifugo     | MIT / Apache 2.0       |
| Functions  | OpenFaaS / Node.js + PM2          | MIT                    |
| Tout-en-un | PocketBase / Appwrite / Supabase  | MIT / BSD / Apache 2.0 |

### Stacks 100% OSS

```
┌─────────────────────────────────────────────────────────────┐
│  Option A: Minimaliste (1 binaire)                          │
│  ─────────────────────────────────────────────────────────  │
│  Tout-en-un  │ PocketBase (Auth+DB+Realtime+Storage)        │
│  Hosting     │ VPS (Hetzner, OVH, Scaleway)                 │
├─────────────────────────────────────────────────────────────┤
│  Option B: Équivalent Supabase                              │
│  ─────────────────────────────────────────────────────────  │
│  Tout-en-un  │ Supabase self-hosted (Docker)                │
│  Même code   │ Aucune modification requise !                │
├─────────────────────────────────────────────────────────────┤
│  Option C: Composants séparés (max flexibilité)             │
│  ─────────────────────────────────────────────────────────  │
│  Auth        │ Ory Kratos ou Keycloak                       │
│  Database    │ PostgreSQL + Drizzle ORM                     │
│  Storage     │ MinIO (S3-compatible)                        │
│  Realtime    │ Centrifugo ou Socket.io                      │
│  Functions   │ Node.js + PM2 ou OpenFaaS                    │
└─────────────────────────────────────────────────────────────┘
```

**Note importante:** Supabase est open source (Apache 2.0) — vous pouvez l'auto-héberger sans
changer une ligne de code.

---

## 7. Solutions gratuites pour petites communes

### Contexte Corte

- Population: ~ 7700 habitants
- Ménages: ~ 4400
- Élus: 29
- Agents municipaux: 113
- **Estimation utilisateurs actifs:** 100 - 500 MAU

### Seuils gratuits par service

| Service           | Seuil gratuit    | Usage Corte estimé | Suffisant ?   |
| ----------------- | ---------------- | ------------------ | ------------- |
| Supabase Auth     | 50 000 MAU       | ~500 MAU           | ✅ 100x marge |
| Supabase DB       | 500 MB           | ~50 MB             | ✅ 10x marge  |
| Supabase Storage  | 1 GB             | ~200 MB            | ✅ 5x marge   |
| Netlify Functions | 125K/mois        | ~10K/mois          | ✅ 12x marge  |
| Netlify Hosting   | 100 GB bandwidth | ~10 GB             | ✅ 10x marge  |

### Stack 100% gratuit

```
┌─────────────────────────────────────────────────────────────┐
│         STACK GRATUIT POUR CORTE 🆓 (~7700 hab)             │
├─────────────────────────────────────────────────────────────┤
│  Auth         │ Supabase Auth (50K MAU gratuit)             │
│  Database     │ Supabase (500 MB gratuit)                   │
│  Storage      │ Supabase Storage (1 GB gratuit)             │
│  Realtime     │ Supabase Realtime (inclus)                  │
│  Functions    │ Netlify Functions (125K/mois gratuit)       │
│  Hosting      │ Netlify (100 GB bandwidth gratuit)          │
│  AI/Chatbot   │ Groq API (free tier) ou Mistral             │
│  Vectors      │ Supabase pgvector (inclus)                  │
├─────────────────────────────────────────────────────────────┤
│  COÛT TOTAL   │ 0€/mois (hors IA si usage intensif)         │
└─────────────────────────────────────────────────────────────┘
```

### Projection

Le tier gratuit Supabase + Netlify devrait suffire pour **5-10 ans** d'usage normal à l'échelle de
Corte.

### Alternative 100% gratuite perpétuelle

**Oracle Cloud Free Tier** (gratuit à vie):

- 2 VMs ARM (4 OCPU, 24 GB RAM chacune)
- 200 GB block storage
- Suffisant pour PocketBase + Ollama (AI locale)

---

## 8. Solutions haute performance

### Par famille

| Famille   | Solution rapide       | Latence                    |
| --------- | --------------------- | -------------------------- |
| Hosting   | Cloudflare Pages      | TTFB <50ms                 |
| Functions | Cloudflare Workers    | 0ms cold start             |
| Database  | Turso / Cloudflare D1 | <10ms edge                 |
| ORM       | Drizzle               | 14x plus rapide que Prisma |
| Auth      | Clerk                 | Edge token validation      |
| Storage   | Cloudflare R2         | CDN intégré                |
| Realtime  | PartyKit              | <10ms Durable Objects      |
| AI        | Groq                  | ~500 tokens/s              |

### Stack ultra-rapide

```
┌────────────────────────────────────────────────────────────┐
│              STACK PERFORMANCE MAXIMALE ⚡                 │
├────────────────────────────────────────────────────────────┤
│  Hosting      │ Cloudflare Pages (TTFB <50ms)              │
│  Functions    │ Cloudflare Workers (0ms cold start)        │
│  Database     │ Turso ou Cloudflare D1 (<10ms edge)        │
│  ORM          │ Drizzle (14x plus rapide que Prisma)       │
│  Auth         │ Clerk (edge token validation)              │
│  Storage      │ Cloudflare R2 (CDN intégré)                │
│  Realtime     │ PartyKit (Durable Objects, <10ms)          │
│  AI           │ Groq (inférence ultra-rapide)              │
├────────────────────────────────────────────────────────────┤
│  LATENCE P95  │ <100ms end-to-end                          │
└────────────────────────────────────────────────────────────┘
```

### Comparaison

| Métrique             | Stack Actuel | Stack Rapide |
| -------------------- | ------------ | ------------ |
| TTFB Frontend        | ~100ms       | <50ms        |
| Cold start functions | 200-500ms    | **0ms**      |
| Latence DB           | 30-100ms     | <10ms        |
| Latence realtime     | 50-200ms     | <20ms        |

---

## 9. Matrice multi-critères des compromis

### Dimensions d'évaluation

| Dimension                | Description                |
| ------------------------ | -------------------------- |
| 💰 **Coût**              | TCO mensuel/annuel         |
| ⚡ **Performance**       | Latence, débit             |
| 🔧 **Maintenance**       | Effort opérationnel        |
| 🔓 **Portabilité**       | Facilité de migration      |
| 🇪🇺 **Souveraineté**      | Contrôle juridique données |
| 📖 **Open Source**       | Licence, transparence      |
| 📈 **Scalabilité**       | Croissance future          |
| 🧑‍💻 **DX**                | Expérience développeur     |
| 📚 **Documentation**     | Qualité docs, communauté   |
| 🔒 **Sécurité**          | Certifications, audit      |
| 🌱 **Maturité**          | Stabilité, pérennité       |
| 🌍 **Empreinte carbone** | Green hosting              |

### Dimensions souvent oubliées

| Dimension                     | Question clé                              | Impact                  |
| ----------------------------- | ----------------------------------------- | ----------------------- |
| 🏛️ **Pérennité fournisseur**  | L'entreprise existera-t-elle dans 5 ans ? | Risque migration forcée |
| 📜 **Conformité légale**      | RGPD, HDS, CCPA, accessibilité ?          | Amendes, blocages       |
| 🔄 **Réversibilité**          | Export des données facile ?               | Coût de sortie caché    |
| 🧪 **Environnements**         | Dev/staging/prod faciles ?                | Vélocité équipe         |
| 📊 **Observabilité**          | Logs, metrics, traces inclus ?            | Debug, monitoring       |
| 🆘 **Disaster Recovery**      | Backups, RTO, RPO ?                       | Risque perte données    |
| 🌐 **Multi-tenant**           | Plusieurs communes sur 1 instance ?       | Architecture future     |
| 🗣️ **Communauté FR**          | Docs/support en français ?                | Accessibilité agents    |
| 💼 **Procurement**            | Facile à acheter par une mairie ?         | Marchés publics         |
| 🎓 **Courbe d'apprentissage** | Temps formation équipe ?                  | Coût caché              |

### Profils types

#### 🏛️ Commune prudente

| Priorités      | Poids      |
| -------------- | ---------- |
| 💰 Coût        | ⭐⭐⭐⭐⭐ |
| 🔧 Maintenance | ⭐⭐⭐⭐⭐ |
| 🌱 Maturité    | ⭐⭐⭐⭐   |

**→ Stack:** Supabase + Netlify (actuel) ✅

#### 🇫🇷 Institution souveraine

| Priorités       | Poids      |
| --------------- | ---------- |
| 🇪🇺 Souveraineté | ⭐⭐⭐⭐⭐ |
| 🔒 Sécurité     | ⭐⭐⭐⭐⭐ |
| 📖 Open Source  | ⭐⭐⭐⭐   |

**→ Stack:** Scaleway + Keycloak + PostgreSQL + MinIO

#### 🚀 Startup civictech

| Priorités      | Poids      |
| -------------- | ---------- |
| 🧑‍💻 DX          | ⭐⭐⭐⭐⭐ |
| 📈 Scalabilité | ⭐⭐⭐⭐⭐ |
| ⚡ Performance | ⭐⭐⭐⭐   |

**→ Stack:** Vercel + Clerk + Neon + Convex

#### 🔐 Maximaliste open source

| Priorités       | Poids      |
| --------------- | ---------- |
| 📖 Open Source  | ⭐⭐⭐⭐⭐ |
| 🔓 Portabilité  | ⭐⭐⭐⭐⭐ |
| 🇪🇺 Souveraineté | ⭐⭐⭐⭐   |

**→ Stack:** PocketBase ou Appwrite + Keycloak + MinIO

#### ⚡ Performance obsédé

| Priorités      | Poids      |
| -------------- | ---------- |
| ⚡ Performance | ⭐⭐⭐⭐⭐ |
| 📈 Scalabilité | ⭐⭐⭐⭐   |

**→ Stack:** Cloudflare full stack

### Matrice de scoring

```
                    Coût   Perf   Maint  Porta  Souv   OSS    Scale  DX
                    ────   ────   ────   ────   ────   ────   ────   ────
Supabase Cloud      ██████ ████   ██████ ████   ██     ██████ █████  ██████
Supabase Self       ████   ████   ██     ██████ ██████ ██████ ████   ████
PocketBase          ██████ ████   ████   ██████ ██████ ██████ ██     ████
Appwrite Cloud      █████  ████   █████  █████  ███    ██████ █████  █████
Cloudflare Stack    █████  ██████ █████  ███    ██     ████   ██████ █████
Convex              █████  █████  ██████ ██     ██     ██     ██████ ██████
Scaleway FR         ███    ████   ███    █████  ██████ ████   ████   ████
```

### Tableau de décision simplifié

| Si votre priorité est... | Alors choisissez...              |
| ------------------------ | -------------------------------- |
| Simplicité maximale      | Rester sur Supabase + Netlify    |
| Coût zéro garanti        | PocketBase sur Oracle Free Tier  |
| Souveraineté française   | Scaleway + stack OSS             |
| Performance edge         | Cloudflare full stack            |
| Meilleur DX TypeScript   | Convex ou Drizzle + Neon         |
| Open source pur          | Appwrite ou Supabase self-hosted |
| Scaling national         | Supabase Pro ou Cloudflare       |
| Green IT                 | Infomaniak ou Scaleway           |
| Marchés publics faciles  | OVHcloud (référencé UGAP)        |

---

## 10. Recommandations finales

### Pour Corte (contexte actuel)

**Profil identifié:** Commune prudente — budget limité, équipe technique réduite, ~7700 habitants.

**Recommandation:** ✅ **Garder le stack actuel** (Supabase + Netlify)

**Raisons:**

1. Déjà 100% gratuit à cette échelle
2. Maintenance zéro
3. Maturité et stabilité de Supabase
4. Excellente DX

### Actions recommandées

#### Court terme (immédiat)

1. **Ajouter Drizzle ORM** comme couche d'abstraction
   - Pas de maintenance supplémentaire
   - Améliore la portabilité
   - Compatible Supabase natif

#### Moyen terme (6-12 mois)

2. **Documenter une stratégie de sortie**
   - Scripts d'export des données
   - Mapping vers alternatives identifiées
   - Rassure les décideurs

3. **Créer des interfaces TypeScript** par famille
   - `IAuthService`
   - `IStorageService`
   - `IRealtimeService`

#### Long terme (si nécessaire)

4. **Migration vers souveraineté** (si exigence politique)
   - Scaleway + Supabase self-hosted
   - Effort: ~2-4 semaines

5. **Migration vers performance** (si scaling national)
   - Cloudflare full stack
   - Effort: ~3-6 semaines

---

## Annexe: Liens utiles

### Solutions mentionnées

| Solution      | Lien                      |
| ------------- | ------------------------- |
| Supabase      | https://supabase.com      |
| Drizzle ORM   | https://orm.drizzle.team  |
| Clerk         | https://clerk.com         |
| Neon          | https://neon.tech         |
| Cloudflare R2 | https://cloudflare.com/r2 |
| PocketBase    | https://pocketbase.io     |
| Appwrite      | https://appwrite.io       |
| Convex        | https://convex.dev        |
| Liveblocks    | https://liveblocks.io     |
| Scaleway      | https://scaleway.com      |
| OVHcloud      | https://ovhcloud.com      |
| Keycloak      | https://keycloak.org      |
| Ory Kratos    | https://ory.sh/kratos     |
| MinIO         | https://min.io            |

### Documentation Supabase self-hosted

- Guide officiel: https://supabase.com/docs/guides/self-hosting
- Docker Compose: https://github.com/supabase/supabase/tree/master/docker

---

_Document généré le 4 décembre 2025_
