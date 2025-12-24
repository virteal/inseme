# Guide Rapide : Provisionner une Instance

## 🚀 Méthode Express (5 minutes)

### Étape 1 : Créer le projet Supabase

1. Aller sur https://supabase.com/dashboard
2. **New Project** dans l'organisation C.O.R.S.I.C.A. (à vérifier)
3. Nom : `ophelia-{subdomain}` (ex: `ophelia-universita`)
4. Région : `eu-west-3` (Paris)
5. Copier les clés depuis **Settings > API**

### Étape 2 : Lancer le script de provisioning

```bash
node scripts/provision-instance.js
```

Le script interactif vous guide :

- Type de communauté
- Nom, localisation
- Sous-domaine
- Clés Supabase
- Configuration hub (fédération)

### Étape 3 : Exécuter les SQL générés

Le script génère 2 fichiers dans `instances/sql/` :

```bash
# 1. Sur l'INSTANCE (nouveau projet Supabase)
# Ouvrir SQL Editor et coller le contenu de:
instances/sql/{subdomain}-vault.sql

# 2. Sur le HUB (projet Supabase principal)
# Ouvrir SQL Editor et coller le contenu de:
instances/sql/{subdomain}-registry.sql
```

### Étape 4 : Tester

```bash
# En local
npm run dev
# Ouvrir http://localhost:5173/?instance={subdomain}

# En production (après push)
# https://{subdomain}.lepp.fr
```

---

## 📋 Checklist Provisioning

- [ ] Projet Supabase créé
- [ ] Script de provisioning exécuté
- [ ] SQL vault appliqué sur l'instance
- [ ] SQL registry appliqué sur le hub
- [ ] Test local OK
- [ ] Test production OK
- [ ] Premier admin créé
- [ ] Version schéma vérifiée (`npm run schema:check`)

---

## 📊 Gestion des versions de schéma

Chaque instance stocke sa version de schéma. Pour vérifier l'état :

```bash
# Voir l'état de toutes les instances
npm run schema:check

# Générer les SQL de mise à jour
npm run schema:sync

# Mettre à jour une instance spécifique
npm run schema:update corte
```

### Comment ça marche ?

1. **Table `schema_migrations`** : historique des migrations appliquées
2. **Table `schema_version`** : version courante (lecture rapide)
3. **Fonction `register_migration()`** : enregistre une migration
4. **Registry hub** : agrège les versions de toutes les instances

### Workflow de mise à jour

```
1. Nouvelle migration créée dans supabase/migrations/
2. npm run schema:check → affiche les instances outdated
3. npm run schema:update {subdomain} → génère le SQL
4. Exécuter le SQL sur l'instance Supabase
5. La version est automatiquement mise à jour
```

---

## 🔧 Provisioning manuel (sans script)

Si vous préférez faire manuellement :

### 1. Créer le projet Supabase

Même process qu'au-dessus.

### 2. Appliquer les migrations

```bash
# Lier au nouveau projet
npx supabase link --project-ref {project-id}

# Appliquer toutes les migrations
npx supabase db push
```

### 3. Provisionner le vault

Dans SQL Editor de l'instance :

```sql
INSERT INTO instance_config (key, value, is_secret) VALUES
('COMMUNITY_NAME', '"Ma Communauté"', false),
('COMMUNITY_TYPE', '"municipality"', false),
('CITY_NAME', '"MaVille"', false),
('BOT_NAME', '"Ophélia"', false),
('CONTACT_EMAIL', '"admin@maville.fr"', false),
('MAP_DEFAULT_CENTER', '[42.0, 9.0]', false);
```

### 4. Enregistrer dans le registry

Dans SQL Editor du HUB :

```sql
INSERT INTO instance_registry (
  subdomain, community_name, community_type,
  supabase_url, supabase_anon_key, is_active
) VALUES (
  'maville',
  'Ma Communauté',
  'municipality',
  'https://xxx.supabase.co',
  'eyJ...',
  true
);
```

---

## 📁 Structure des fichiers

```
instances/
├── instance-schema.json     # Schema de validation
├── universita.example.json  # Exemple de config
├── {subdomain}.json         # Config générée (sans secrets)
└── sql/
    ├── {subdomain}-vault.sql    # SQL pour l'instance
    └── {subdomain}-registry.sql # SQL pour le hub
```

---

## ❓ FAQ

**Q: Puis-je modifier la config après provisioning ?** R: Oui, soit via `/admin/vault` soit
directement en SQL.

**Q: Comment supprimer une instance ?** R:
`UPDATE instance_registry SET status = 'archived' WHERE subdomain = 'xxx';`

**Q: Les migrations échouent ?** R: Certaines migrations peuvent déjà être appliquées. Les erreurs
"already exists" sont normales.

**Q: Comment ajouter les clés API plus tard ?** R:

```sql
INSERT INTO instance_config (key, value, is_secret)
VALUES ('OPENAI_API_KEY', '"sk-xxx"', true);
```

**Q: Comment voir la version du schéma d'une instance ?** R:

```sql
SELECT * FROM get_schema_version();
-- Ou
SELECT * FROM schema_version;
```

**Q: Comment forcer la re-synchronisation des versions ?** R:

```bash
curl -X POST https://your-site.netlify.app/api/sync-schema-version \
  -H "Content-Type: application/json" \
  -d '{"subdomain": "corte"}'
```
