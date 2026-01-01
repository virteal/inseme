# Inseme - Liste des tâches restantes (TODO)

Ce document répertorie les sujets restant à traiter dans l'écosystème Inseme, classés par urgence et importance.

## 🚨 Urgence Haute

### 1. Alignement des fonctions Node.js
*   **Sujet** : Les fonctions Netlify standard (Node.js) ne gèrent pas encore nativement le switch d'instance dynamique.
*   **Action** : Créer un helper dans `cop-host/runtime/function.js` (similaire à `handleInstanceResolution` pour Edge) pour détecter l'instance et appeler `loadInstanceConfig(true, targetConfig)`.
*   **Fichiers concernés** : `apps/platform/src/netlify/functions/*.js`.

### 2. Déploiement du Registre Hub
*   **Sujet** : La résolution d'instance dépend d'une table `instances` et d'une RPC `get_instance_by_subdomain` sur l'instance Hub.
*   **Action** : Fournir et appliquer le script SQL de migration pour créer ces structures sur l'instance Hub de production.

### 3. Validation de l'Isolation du Cache
*   **Sujet** : Le switch d'instance modifie un cache global dans `instanceConfig.core.js`.
*   **Action** : Vérifier que dans l'environnement Netlify Edge (Deno), ce cache est bien isolé par requête ou que le rechargement systématique n'entraîne pas de collisions entre requêtes concurrentes ciblant des instances différentes.

---

## 💎 Importance Haute

### 1. Sécurisation des En-têtes
*   **Sujet** : Exposition des paramètres Supabase de l'instance cible dans les headers HTTP.
*   **Action** : Auditer les informations envoyées. S'assurer que seules les clés `ANON` sont exposées et jamais les clés `SERVICE_ROLE`.

### 2. Nettoyage et Refactoring
*   **Sujet** : Présence de code obsolète.
*   **Action** : 
    *   Supprimer `generate-meta-init.js` (remplacé par la substitution dynamique dans `app-entry.js`).
    *   Supprimer `handleSeoMetadataSubstitution` dans `cop-host/runtime/edge.js` une fois la migration validée.

### 3. Gestion d'Erreurs de Résolution
*   **Sujet** : Comportement en cas d'instance inconnue.
*   **Action** : Implémenter une redirection vers une page "Instance non trouvée" conviviale au lieu de simplement injecter un header `X-Ophelia-Instance-Error`.

---

## 📈 Importance Moyenne / Basse

### 1. CORS Dynamique
*   **Sujet** : `Access-Control-Allow-Origin: *` est trop permissif.
*   **Action** : Mettre à jour `CORS_HEADERS` dans `cop-host` pour valider l'origine par rapport à la liste des domaines autorisés de l'instance.

### 2. Documentation des Variables de Template
*   **Sujet** : Liste des placeholders `{{ VARIABLE }}`.
*   **Action** : Maintenir une liste exhaustive des variables supportées par `substituteVariables` dans `MULTI_INSTANCE.md`.

### 3. Cas de l'application Survey
*   **Sujet** : Anciennement Survey, devenue Platform.
*   **Action** : Clarifier si des briques spécifiques à l'ancienne application Survey doivent encore être supportées ou si la transition vers Platform est totale.
