# 🚀 Guide de Provisioning d'Instance

Ce guide documente la procédure pour déployer une nouvelle instance (ex: ville, université, association) sur la plateforme multi-instance Ophélia.

## 🏗️ Architecture
La plateforme utilise un **Hub National** (Corte/Pertitellu) et des instances secondaires isolées. Chaque instance possède sa propre base de données Supabase mais partage la même base de code (déploiement unique Netlify).

## 📋 Prérequis
1.  **Supabase** : Créer un nouveau projet (recommandé : organisation C.O.R.S.I.C.A., région `eu-west-3`).
2.  **GitHub** : Un token (`GITHUB_TOKEN`) avec des droits de création de dépôt si vous souhaitez automatiser le wiki.
3.  **DNS** : Le wildcard `*.lepp.fr` doit être configuré vers Netlify.

## 🚀 Procédure de Provisioning (Automatisée)

Le script `scripts/provision-instance.js` permet de piloter le processus de manière granulaire.

### 1. Collecte des informations
```bash
node scripts/provision-instance.js --interactive
```
Cette étape génère un fichier de configuration dans `instances/[subdomain].json`.

### 2. Création du repo Wiki (GitHub)
```bash
node scripts/provision-instance.js --subdomain=[nom] --step-github
```
Crée un dépôt à partir du template `commune-wiki-template`.

### 3. Application du Schéma (Supabase)
```bash
node scripts/provision-instance.js --subdomain=[nom] --step-migrations
```
Applique toutes les migrations SQL sur la nouvelle base Supabase.

### 4. Configuration du Vault
```bash
node scripts/provision-instance.js --subdomain=[nom] --step-vault
```
Injecte les variables d'identité et les secrets dans la table `instance_config`.

### 5. Enregistrement dans le Hub
```bash
node scripts/provision-instance.js --subdomain=[nom] --step-registry
```
Optionnel: Enregistre le sous-domaine dans le registry du Hub national pour la fédération.

### 6. Seeding initial du Wiki
```bash
node scripts/provision-instance.js --subdomain=[nom] --step-seed
```
Injecte les pages wiki de base (Accueil, Transparence) basées sur le type d'instance.

---

## 🛠️ Vérification Manuelle (Human-in-the-Loop)

Après le provisioning, effectuez ces points de contrôle :

- [ ] **Accès Local** : Testez via `http://localhost:5173/?instance=[subdomain]`.
- [ ] **Accès Prod** : Vérifiez que `https://[subdomain].lepp.fr` charge correctement.
- [ ] **Ophélia** : Posez une question pour vérifier que l'IA a bien capté l'identité locale.
- [ ] **Wiki** : Vérifiez que les pages de seed sont bien modifiables.
- [ ] **Admin** : Créez un compte et passez vous en `admin` via SQL :
  ```sql
  UPDATE users SET role = 'admin' WHERE email = 'votre@email.com';
  ```

## 🔧 Maintenance
Mises à jour : Un simple `git push` sur le repo principal met à jour toutes les instances simultanément.
Modification config : Utilisez `/admin/vault` sur l'instance concernée.

---
_Document généré le 1er janvier 2026_
