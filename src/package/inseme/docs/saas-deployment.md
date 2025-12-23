# Inseme v3.0 : Déploiement SaaS & Stockage R2

Ce guide explique comment configurer Inseme pour un déploiement multi-tenant (SaaS) et comment utiliser Cloudflare R2 pour le stockage des archives et des messages vocaux.

## 1. Architecture SaaS

Inseme utilise une table `inseme_rooms` pour gérer les différentes instances de salles. Chaque salle est identifiée par un `slug` unique.

### Migration Database (Supabase)
Assurez-vous d'avoir appliqué la migration `20251223020400_saas_rooms.sql` qui crée la table des salons et les politiques de sécurité (RLS) associées.

```sql
CREATE TABLE public.inseme_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    owner_id UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

## 2. Configuration Cloudflare R2

Inseme supporte nativement Cloudflare R2 pour le stockage des fichiers (PV, messages vocaux, snapshots). Si R2 n'est pas configuré, le système bascule automatiquement sur Supabase Storage.

### Avantages de R2
- Coût de stockage et de bande passante (egress) nul.
- Performance accrue via le réseau Cloudflare.
- Compatibilité S3 totale.

### Variables d'Environnement (Netlify/Edge)
Configurez les variables suivantes dans votre interface Netlify :

| Variable | Description |
| :--- | :--- |
| `R2_ACCOUNT_ID` | Votre ID de compte Cloudflare. |
| `R2_ACCESS_KEY_ID` | Clé d'accès API R2. |
| `R2_SECRET_ACCESS_KEY` | Clé secrète API R2. |
| `R2_PUBLIC_DOMAIN` | (Optionnel) Votre domaine personnalisé R2 (ex: `cdn.inseme.org`). |

### Activation côté Client
Pour activer l'upload vers R2, définissez cette variable dans votre `.env` de build :
```env
VITE_USE_R2=true
```

## 3. Déploiement des Edge Functions

Les fonctions Edge gèrent la logique intelligente (Ophélia) et les opérations de stockage sécurisées.

1.  **Ophélia (`/api/ophelia`)** : Gère les appels OpenAI et la médiation.
2.  **Upload (`/api/upload`)** : Gère l'upload vers R2 via le SDK AWS S3.
3.  **Sessions (`/api/sessions`)** : Analyse l'historique pour regrouper les messages par sessions.

### Déploiement Netlify
Les fonctions dans `src/netlify/edge-functions/` sont automatiquement détectées par Netlify si le fichier `netlify.toml` est présent à la racine.

```toml
[[edge_functions]]
  path = "/api/ophelia"
  function = "ophelia"

[[edge_functions]]
  path = "/api/upload"
  function = "upload"
```

## 4. Archivage des Procès-Verbaux (PV)

Chaque salon peut configurer son propre bucket de stockage dans ses réglages :
```json
{
  "storage_bucket": "mon-organisation-pv"
}
```
Si non spécifié, le bucket par défaut est `public-documents`.

## 5. Sécurité & RLS

Le trigger `handle_new_user` (migration `20251223150000_fix_guest_trigger_robust.sql`) assure que chaque utilisateur (invité ou membre) possède un profil public synchronisé. Cela est crucial pour que les messages soient correctement attribués dans les archives.
