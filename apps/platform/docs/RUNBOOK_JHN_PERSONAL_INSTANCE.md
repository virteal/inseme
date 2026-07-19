---
title: "Runbook — Instance personnelle JHN"
subtitle: "Priorité dogfooding : jhn.baronsmariani.org sur Inseme, sans toucher lepp.fr"
author: "Jean Hugues Noël Robert, baron Mariani"
date: "2026-07-19"
version: "0.1"
license: "CC BY-SA 4.0"
language: "fr"
status: "working-runbook"
document_role: "operational"
visibility: "public"
repository: "JeanHuguesRobert/inseme"
canonical_path: "apps/platform/docs/RUNBOOK_JHN_PERSONAL_INSTANCE.md"
related_documents:
  - "../../research/personal_instance_democracy_and_non_capturable_match.md"
  - "../instances/jhn.example.json"
  - "../instances/QUICKSTART.md"
  - "https://github.com/JeanHuguesRobert/inseme/issues/17"
---

# Runbook — Instance personnelle JHN

## Objectif

Disposer **en priorité** d’une instance personnelle pour Jean Hugues Noël Robert (JHN) :

| Élément | Cible |
|---------|--------|
| URL publique | `https://jhn.baronsmariani.org` |
| Code | monorepo **inseme**, app `apps/platform` |
| Base de données | **nouveau** projet Supabase (pas la DB Corte) |
| Site Netlify | **nouveau** site (ou site dédié preview/prod), **pas** le site lepp.fr / survey |
| lepp.fr / Pertitellu Corte | **inchangé** jusqu’à bascule ultérieure |

Doctrine : [personal_instance_democracy_and_non_capturable_match.md](../../research/personal_instance_democracy_and_non_capturable_match.md)  
Vertical slice agents / TwinRoot : [inseme#17](https://github.com/JeanHuguesRobert/inseme/issues/17) (après smoke de l’instance).

---

## Stratégie de déploiement (jour 1)

### Mode recommandé : mono-instance

Pour aller vite sans hub multi-tenant :

```text
Netlify (site inseme-jhn)
  env SUPABASE_*  →  projet Supabase JHN uniquement
  domaine         →  jhn.baronsmariani.org

Si le resolver extrait le sous-domaine "jhn" et ne trouve pas
d’entrée registry, il retombe sur la config env par défaut
= le même projet JHN. Comportement acceptable en mono-instance.
```

### Mode ultérieur : multi-apex + registry

Quand Corte basculera, un **hub** portera `instance_registry` avec au minimum :

```text
subdomain   = jhn
host_domain = baronsmariani.org   # (champ à généraliser ; metadata en attendant)
supabase_*  = projet JHN
```

et d’autres lignes pour `corte` / `*.lepp.fr`.

**Ne pas bloquer le jour 1 sur le hub.**

---

## Checklist globale

### A. Prérequis comptes

- [ ] Accès GitHub `JeanHuguesRobert/inseme`
- [ ] Accès Supabase (org C.O.R.S.I.C.A. ou perso)
- [ ] Accès Netlify (team qui hébergera le site **JHN**, pas forcément le site lepp.fr)
- [ ] Accès DNS `baronsmariani.org` (Cloudflare ou registrar)

### B. Supabase JHN

- [ ] Projet créé
- [ ] Migrations / schéma appliqués
- [ ] Vault `instance_config` seed JHN
- [ ] Auth : email (et providers choisis) configurés
- [ ] URL site autorisée dans Auth redirect URLs
- [ ] Compte admin JHN

### C. Netlify inseme → JHN

- [ ] Site lié au repo **inseme**
- [ ] Build base `apps/platform`
- [ ] Variables d’env = projet Supabase **JHN**
- [ ] Deploy preview ou production OK

### D. DNS

- [ ] `jhn.baronsmariani.org` → site Netlify JHN
- [ ] TLS OK
- [ ] **lepp.fr non modifié**

### E. Smoke

- [ ] Page d’accueil charge
- [ ] Login / session
- [ ] Vault / admin accessible
- [ ] Pas d’erreurs 500 massives sur fonctions critiques

### F. Ensuite (hors ce runbook jour 1)

- [ ] TwinRoot / constitution / mandats (#17)
- [ ] Plan bascule Pertitellu Corte

---

## Phase 0 — Config locale (fichier d’instance)

1. Copier le modèle :

```bash
cd apps/platform
cp instances/jhn.example.json instances/jhn.json
```

2. Éditer `instances/jhn.json` : coller `supabase_url` et `supabase_anon_key` **après** création du projet.  
   **Ne jamais committer** `jhn.json` avec des secrets service-role.  
   Le fichier exemple reste sans secrets ; `jhn.json` devrait rester gitignoré s’il contient des clés (sinon n’y mettre que l’anon key publique).

3. Vérifier le schéma actuel (contrainte legacy) :

```text
community_type = "association"   # enum actuel ; métadonnées portent le sens personal-twin
```

Les champs `deployment_kind`, `subject_kind`, `host_domain` sont dans le JSON / vault en **métadonnées** jusqu’à extension formelle du schéma (#17).

---

## Phase 1 — Projet Supabase JHN

### 1.1 Création

1. https://supabase.com/dashboard → **New project**
2. Organisation : C.O.R.S.I.C.A. (ou la vôtre)
3. Nom suggéré : `inseme-jhn` ou `ophelia-jhn`
4. Région : `eu-west-3` (Paris)
5. Mot de passe DB : stocké hors git (gestionnaire de secrets)
6. Noter :
   - Project URL : `https://xxxxx.supabase.co`
   - `anon` `public` key
   - `service_role` key (**secret**, Netlify only)

### 1.2 Schéma (ordre prudent)

Le dossier migrations est historique (`old_applied`, `old_unused`, COP). Pour un **projet neuf** :

**Option A — recommandée si `schema.sql` est à jour et cohérent :**

```bash
cd apps/platform
# Lier le projet (project-ref = id court Supabase)
npx supabase link --project-ref <PROJECT_REF>
# Appliquer le dump de référence si vous l’utilisez comme bootstrap
# ou rejouer old_applied dans l’ordre chronologique puis COP
```

**Option B — bootstrap SQL Editor (manuel) :**

1. Ouvrir SQL Editor du projet JHN.
2. Appliquer dans l’ordre raisonnable :
   - `supabase/migrations/old_applied/20251204_consolidated_schema.sql` et dépendances users si besoin
   - autres `old_applied/*.sql` **additifs** nécessaires à platform (vault, registry optionnel, feed, schema_versioning…)
   - `supabase/migrations/20251206_add_cop_core.sql` (+ idempotency, step claim)
   - `supabase/migrations/cop/applied/*.sql` si le vertical COP est voulu dès le jour 1
3. Ignorer `old_unused/` sauf besoin métier explicite.

**Critère d’acceptation Phase 1.2 :** l’app platform démarre en local contre ce projet sans erreur fatale de tables manquantes (`users`, `instance_config` au minimum).

### 1.3 Seed vault JHN

Exécuter le SQL fourni dans :

```text
instances/sql/jhn-vault.example.sql
```

(adapter email, noms, couleurs si besoin).

Valeurs d’identité attendues :

| key | value (indicatif) |
|-----|-------------------|
| community_name | Jean Hugues Noël Robert / Baron Mariani |
| community_type | association *(legacy enum)* |
| community_tagline | Instance personnelle JHN |
| bot_name | Ophélia (ou nom dédié) |
| contact_email | jhr@baronsmariani.org (ou email admin) |
| deployment_kind | personal *(metadata / config)* |
| host_domain | baronsmariani.org |
| app_url | https://jhn.baronsmariani.org |

### 1.4 Auth

Dans Supabase → Authentication → URL configuration :

```text
Site URL:     https://jhn.baronsmariani.org
Redirect URLs:
  https://jhn.baronsmariani.org/**
  http://localhost:5173/**
  http://localhost:8888/**
```

Activer au minimum **Email**. Providers OAuth : seulement si redirect configurés.

### 1.5 Premier admin

1. S’inscrire via l’UI une fois l’app jointe.
2. En SQL (service role / SQL Editor) :

```sql
UPDATE public.users
SET role = 'admin'
WHERE email = 'VOTRE_EMAIL@example.com';
```

(Ajuster le nom de table/colonne si le schéma réel diffère — vérifier `\d users` / Table Editor.)

---

## Phase 2 — Local smoke (avant Netlify)

```bash
cd C:\tweesic\inseme   # monorepo
pnpm install
# Depuis la racine ou apps/platform selon scripts
pnpm platform:dev
# ou : cd apps/platform && pnpm dev
```

Créer `apps/platform/.env` (non commité) :

```env
SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # serveur / functions only
```

Tests :

- [ ] `http://localhost:5173/` charge
- [ ] `http://localhost:5173/?instance=jhn` ne casse pas (mono-instance)
- [ ] Login
- [ ] Section admin / vault si présente

---

## Phase 3 — Site Netlify (inseme, pas lepp.fr)

### 3.1 Créer un **nouveau** site

1. Netlify → Add new site → Import from Git → `JeanHuguesRobert/inseme`
2. Branch : `main` (ou branche de dogfooding)
3. Build settings :

| Setting | Value |
|---------|--------|
| Base directory | `apps/platform` |
| Build command | `pnpm install --frozen-lockfile` au root monorepo peut exiger config monorepo ; en pratique souvent : depuis base, `cd ../.. && pnpm install && pnpm --filter platform build` — **ajuster** selon le premier build log |
| Publish directory | `apps/platform/dist` (ou `dist` si base = apps/platform) |

Le `netlify.toml` du monorepo sous `apps/platform` fixe déjà :

```toml
base = "apps/platform"
command = "npm run build"   # préférer pnpm si le site est configuré pnpm
publish = "dist"
```

Si le monorepo exige pnpm workspaces, configurer **Package manager = pnpm** et éventuellement :

```text
Build command: pnpm install && pnpm run build
```

avec base `apps/platform`, ou un script racine `pnpm platform:build` si vous l’ajoutez.

### 3.2 Variables d’environnement Netlify

Même jeu que `.env` local, **projet JHN uniquement** :

```text
SUPABASE_URL
VITE_SUPABASE_URL
SUPABASE_ANON_KEY
VITE_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Ne **pas** coller les clés du projet Corte / lepp.fr.

### 3.3 Domaine custom

1. Netlify → Domain management → Add domain : `jhn.baronsmariani.org`
2. Suivre les records DNS indiqués (CNAME vers `*.netlify.app` ou cible fournie)
3. Attendre certificat TLS

### 3.4 Interdiction explicite

```text
❌ Ne pas changer le repo lié du site lepp.fr (survey)
❌ Ne pas pointer *.lepp.fr vers ce site tant que la bascule Corte n’est pas planifiée
❌ Ne pas réutiliser la DB Supabase de Corte pour JHN
```

---

## Phase 4 — DNS baronsmariani.org

Chez le DNS de `baronsmariani.org` :

```text
Type   Name    Value
CNAME  jhn     <target-netlify-du-site-jhn>
```

(ou record A/ALIAS selon Netlify DNS).

Vérifications :

```text
https://jhn.baronsmariani.org
# certificat valide, app charge, login OK
```

`baronsmariani.org` apex / www : hors scope (peut rester site statique / autre).

---

## Phase 5 — Smoke production

| Test | OK ? |
|------|------|
| Home charge | |
| Login email | |
| Session persistante | |
| Admin / rôle admin | |
| Vault affiche community_name JHN | |
| Pas de fuite de config Corte (noms Pertitellu, etc.) | |
| Functions critiques (si utilisées) ne 500-ent pas en masse | |

Noter la date du smoke et le commit `inseme` déployé.

---

## Phase 6 — Après le smoke (hors jour 1)

Ordre conseillé :

1. Documenter le **project-ref** Supabase JHN et le **siteId** Netlify (hors git secrets).
2. Ouvrir / poursuivre [inseme#17](https://github.com/JeanHuguesRobert/inseme/issues/17) : TwinRoot, mandats, agents.
3. Étendre `instance-schema` / registry avec `deployment_kind`, `host_domain`.
4. **Seulement ensuite** : plan de bascule Pertitellu Corte (survey → inseme), en s’appuyant sur ce qui a marché pour JHN.

---

## Dépannage rapide

| Symptôme | Piste |
|----------|--------|
| Build monorepo échoue (workspace) | Installer depuis racine inseme ; pnpm ; vérifier `base` Netlify |
| Écran blanc / erreur Supabase | Env VITE_* manquantes ou mauvaises clés |
| Auth redirect invalid | URLs Auth Supabase |
| branding Corte | Vault non seedé ou mauvais projet Supabase |
| `jhn` not found en multi-instance | Normal sans registry ; mono-instance doit fallback env |
| lepp.fr cassé | Vous avez touché le mauvais site Netlify — restaurer le site survey |

---

## Fichiers associés

| Fichier | Rôle |
|---------|------|
| [instances/jhn.example.json](../instances/jhn.example.json) | Modèle de config (sans secrets) |
| [instances/sql/jhn-vault.example.sql](../instances/sql/jhn-vault.example.sql) | Seed vault |
| [instances/QUICKSTART.md](../instances/QUICKSTART.md) | Provisioning générique (legacy community) |
| [research/personal_instance_democracy_and_non_capturable_match.md](../../research/personal_instance_democracy_and_non_capturable_match.md) | Doctrine |

---

## Résumé en une page

```text
1. Créer Supabase inseme-jhn
2. Appliquer schéma + seed vault JHN
3. .env local → smoke pnpm platform:dev
4. Nouveau site Netlify → repo inseme → env JHN
5. DNS jhn.baronsmariani.org → ce site
6. Admin + smoke prod
7. (plus tard) TwinRoot / mandats
8. (encore plus tard) bascule Corte / lepp.fr
```

_Challenge via issues. Ne pas confondre instance personnelle et instance de redevabilité._
