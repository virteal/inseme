# Configuration des Avatars Sociaux (OAuth Custom)

> [!IMPORTANT] Ce document décrit le **système OAuth custom** pour l'import manuel d'avatars. Pour
> le **login social complet** (créer un compte via Facebook/GitHub/Google), voir
> [`social_login_supabase.md`](file:///C:/Users/admin/.gemini/antigravity/brain/7c99168f-a643-41c3-a5b9-3c759ea29853/social_login_supabase.md).

## Vue d'ensemble

Le système permet aux utilisateurs d'importer leur photo de profil depuis Facebook, GitHub ou Google
via OAuth 2.0.

### Deux systèmes OAuth distincts

**1. Login Social (Supabase Auth)** - _Recommandé pour les nouveaux utilisateurs_

- Permet de créer un compte directement avec Facebook/GitHub/Google
- Géré par Supabase Auth (configuration dans le Dashboard)
- Avatar importé automatiquement au premier login
- Voir
  [`social_login_supabase.md`](file:///C:/Users/admin/.gemini/antigravity/brain/7c99168f-a643-41c3-a5b9-3c759ea29853/social_login_supabase.md)
  pour l'implémentation

**2. Import d'Avatar Custom (ce document)** - _Pour utilisateurs existants_

- Permet d'importer/changer l'avatar après création du compte
- Système custom avec Netlify Functions
- Fonctionne même si l'utilisateur s'est inscrit avec email/password
- Implémentation actuelle **fonctionnelle avec Facebook**

### Architecture du système custom

Le système est composé de :

**Backend (Netlify Functions)** :

- [`netlify/lib/oauthProviders.js`](file:///c:/tweesic/survey/netlify/lib/oauthProviders.js) -
  Configuration des 3 providers (Facebook, GitHub, Google)
- [`netlify/functions/oauth-providers.js`](file:///c:/tweesic/survey/netlify/functions/oauth-providers.js) -
  API pour lister les providers activés
- [`netlify/functions/oauth-start.js`](file:///c:/tweesic/survey/netlify/functions/oauth-start.js) -
  Initie le flux OAuth
- [`netlify/functions/oauth-complete.js`](file:///c:/tweesic/survey/netlify/functions/oauth-complete.js) -
  Finalise le flux et stocke l'avatar
- [`netlify/functions/facebook-deauthorize.js`](file:///c:/tweesic/survey/netlify/functions/facebook-deauthorize.js) -
  Webhook RGPD pour Facebook

**Frontend (React)** :

- [`src/hooks/useSocialAvatar.js`](file:///c:/tweesic/survey/src/hooks/useSocialAvatar.js) - Hook
  React pour gérer le flux OAuth
- [`src/components/SocialAvatarButton.jsx`](file:///c:/tweesic/survey/src/components/SocialAvatarButton.jsx) -
  Bouton d'importation
- [`src/pages/OAuthConsent.jsx`](file:///c:/tweesic/survey/src/pages/OAuthConsent.jsx) - Page de
  consentement RGPD
- [`src/pages/UserProfile.jsx`](file:///c:/tweesic/survey/src/pages/UserProfile.jsx) - Intégration
  dans le profil utilisateur

**Base de données** :

- Table `users` avec colonne `metadata` (JSONB)
- Stockage : `metadata.avatarUrl`, `metadata.facebookId`, `metadata.facebook_consent`

---

## Flux OAuth Implémenté (Facebook)

### 1. Démarrage du flux

L'utilisateur clique sur "Importer depuis Facebook" dans
[`UserProfile.jsx`](file:///c:/tweesic/survey/src/pages/UserProfile.jsx#L226-L234) :

```javascript
<Link to="/oauth/consent?provider=facebook">Importer depuis Facebook</Link>
```

### 2. Page de consentement

[`OAuthConsent.jsx`](file:///c:/tweesic/survey/src/pages/OAuthConsent.jsx) affiche les informations
RGPD et lance le flux via `useSocialAvatar.start()`.

### 3. Génération de l'URL d'autorisation

[`oauth-start.js`](file:///c:/tweesic/survey/netlify/functions/oauth-start.js) :

- Valide la session Supabase de l'utilisateur
- Génère un `state` aléatoire sécurisé (protection CSRF)
- Stocke le `state` dans `users.metadata.oauth.facebook`
- Retourne l'URL d'autorisation Facebook

### 4. Redirection vers Facebook

L'utilisateur est redirigé vers Facebook pour autoriser l'accès à sa photo de profil.

### 5. Callback et échange de code

Facebook redirige vers `/oauth/facebook/callback?code=...&state=...`

[`useSocialAvatar.completeIfCallback()`](file:///c:/tweesic/survey/src/hooks/useSocialAvatar.js#L34-L82)
détecte le callback et appelle
[`oauth-complete.js`](file:///c:/tweesic/survey/netlify/functions/oauth-complete.js) qui :

- Valide le `state` stocké dans la base
- Échange le `code` contre un `access_token` Facebook
- Récupère le profil utilisateur via l'API Graph
- Extrait l'URL de l'avatar : `profile.picture.data.url`
- Stocke dans `users.metadata` :
  - `avatarUrl` : URL de la photo
  - `facebookId` : Nom ou ID Facebook
  - `facebook_consent.grantedAt` : Timestamp du consentement
- Supprime le `state` temporaire

### 6. Affichage de l'avatar

[`UserProfile.jsx`](file:///c:/tweesic/survey/src/pages/UserProfile.jsx#L193-L223) lit
`currentUser.metadata.avatarUrl` et affiche l'image.

---

## Configuration Facebook (Implémenté ✅)

### Variables d'environnement requises

| Variable                 | Description                                                            |
| ------------------------ | ---------------------------------------------------------------------- |
| `APP_BASE_URL`           | URL de base de l'app (ex: `https://votre-site.netlify.app`)            |
| `FACEBOOK_APP_ID`        | App ID Facebook (aussi utilisé en frontend via `VITE_FACEBOOK_APP_ID`) |
| `FACEBOOK_CLIENT_SECRET` | App Secret Facebook                                                    |

### Étapes de configuration

1. **Créer une App Facebook** :
   - Allez sur [Facebook Developers](https://developers.facebook.com/)
   - Créez une nouvelle app ou utilisez une existante
   - Type : "Consumer" ou "Business"

2. **Configurer Facebook Login** :
   - Dans le dashboard, ajoutez le produit "Facebook Login"
   - **Valid OAuth Redirect URIs** :
     - Production : `https://votre-site.netlify.app/oauth/facebook/callback`
     - Dev : `http://localhost:8888/oauth/facebook/callback`

3. **Récupérer les identifiants** :
   - **App ID** : Visible dans Settings > Basic
   - **App Secret** : Visible dans Settings > Basic (cliquez sur "Show")

4. **Configurer le webhook de déauthorisation (RGPD)** :
   - Dans Settings > Basic, section "Data Deletion Request URL"
   - URL : `https://votre-site.netlify.app/api/facebook-deauthorize`
   - Cette URL est gérée par
     [`facebook-deauthorize.js`](file:///c:/tweesic/survey/netlify/functions/facebook-deauthorize.js)

5. **Ajouter les variables d'environnement** :

   ```env
   APP_BASE_URL=https://votre-site.netlify.app
   FACEBOOK_APP_ID=votre_app_id
   VITE_FACEBOOK_APP_ID=votre_app_id
   FACEBOOK_CLIENT_SECRET=votre_app_secret
   ```

6. **Passer en mode Production** :
   - Dans App Review, activez le mode "Live"
   - Demandez l'approbation pour `public_profile` si nécessaire

### Configuration dans `oauthProviders.js`

```javascript
facebook: {
  name: "Facebook",
  authorizeUrl: "https://www.facebook.com/v16.0/dialog/oauth",
  tokenUrl: "https://graph.facebook.com/v16.0/oauth/access_token",
  profileUrl: "https://graph.facebook.com/me?fields=id,name,picture{url}",
  clientIdEnv: "FACEBOOK_APP_ID",
  clientSecretEnv: "FACEBOOK_CLIENT_SECRET",
  redirectPath: "/oauth/facebook/callback",
  scopes: ["public_profile", "email"],
  mapProfile: (profile) => ({
    providerUserId: profile.id,
    username: profile.name,
    rawAvatarUrl: profile.picture?.data?.url,
  }),
  normalizeAvatarUrl: (raw) => raw,
}
```

---

## Configuration GitHub (Prêt à activer 🔧)

### Variables d'environnement

| Variable               | Description                         |
| ---------------------- | ----------------------------------- |
| `GITHUB_CLIENT_ID`     | Client ID de l'OAuth App GitHub     |
| `GITHUB_CLIENT_SECRET` | Client Secret de l'OAuth App GitHub |

### Étapes de configuration

1. **Créer une OAuth App GitHub** :
   - Allez sur [GitHub Developer Settings](https://github.com/settings/developers)
   - Cliquez sur **New OAuth App**
   - **Application Name** : "Kudocracy" (ou votre nom)
   - **Homepage URL** : `https://votre-site.netlify.app`
   - **Authorization callback URL** : `https://votre-site.netlify.app/oauth/github/callback`

2. **Récupérer les identifiants** :
   - Copiez le **Client ID**
   - Générez et copiez le **Client Secret**

3. **Ajouter les variables d'environnement** :

   ```env
   GITHUB_CLIENT_ID=votre_client_id
   GITHUB_CLIENT_SECRET=votre_client_secret
   ```

4. **Pour le développement local** :
   - Créez une **seconde OAuth App** dédiée au dev
   - Callback URL : `http://localhost:8888/oauth/github/callback`

### Configuration dans `oauthProviders.js`

```javascript
github: {
  name: "GitHub",
  authorizeUrl: "https://github.com/login/oauth/authorize",
  tokenUrl: "https://github.com/login/oauth/access_token",
  profileUrl: "https://api.github.com/user",
  clientIdEnv: "GITHUB_CLIENT_ID",
  clientSecretEnv: "GITHUB_CLIENT_SECRET",
  redirectPath: "/oauth/github/callback",
  scopes: ["read:user"],
  mapProfile: (profile) => ({
    providerUserId: profile.id,
    username: profile.login,
    rawAvatarUrl: profile.avatar_url,
  }),
  normalizeAvatarUrl: (raw) => {
    if (!raw) return null;
    return raw.includes("?") ? `${raw}&s=128` : `${raw}?s=128`;
  },
}
```

---

## Configuration Google (Prêt à activer 🔧)

### Variables d'environnement

| Variable               | Description                         |
| ---------------------- | ----------------------------------- |
| `GOOGLE_CLIENT_ID`     | Client ID de l'OAuth 2.0 Client     |
| `GOOGLE_CLIENT_SECRET` | Client Secret de l'OAuth 2.0 Client |

### Étapes de configuration

1. **Créer un projet Google Cloud** :
   - Allez sur [Google Cloud Console](https://console.cloud.google.com/)
   - Créez un nouveau projet ou sélectionnez-en un

2. **Configurer l'écran de consentement** :
   - Allez dans **APIs & Services > OAuth consent screen**
   - Type : **External**
   - Remplissez les informations obligatoires
   - Scopes : Ajoutez `userinfo.profile` et `userinfo.email`

3. **Créer des identifiants OAuth 2.0** :
   - Allez dans **APIs & Services > Credentials**
   - Cliquez sur **Create Credentials > OAuth client ID**
   - Application type : **Web application**
   - **Authorized JavaScript origins** :
     - `https://votre-site.netlify.app`
     - `http://localhost:8888` (pour dev)
   - **Authorized redirect URIs** :
     - `https://votre-site.netlify.app/oauth/google/callback`
     - `http://localhost:8888/oauth/google/callback` (pour dev)

4. **Récupérer les identifiants** :
   - Copiez le **Client ID**
   - Copiez le **Client Secret**

5. **Ajouter les variables d'environnement** :
   ```env
   GOOGLE_CLIENT_ID=votre_client_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=votre_client_secret
   ```

### Configuration dans `oauthProviders.js`

```javascript
google: {
  name: "Google",
  authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
  clientIdEnv: "GOOGLE_CLIENT_ID",
  clientSecretEnv: "GOOGLE_CLIENT_SECRET",
  redirectPath: "/oauth/google/callback",
  scopes: [
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
  ],
  mapProfile: (profile) => ({
    providerUserId: profile.sub,
    username: profile.name,
    rawAvatarUrl: profile.picture,
  }),
  normalizeAvatarUrl: (raw) => raw,
}
```

---

## Tester en Local

1. **Installer Netlify CLI** :

   ```bash
   npm install -g netlify-cli
   ```

2. **Créer un fichier `.env`** à la racine :

   ```env
   APP_BASE_URL=http://localhost:8888

   # Facebook
   FACEBOOK_APP_ID=votre_app_id_dev
   VITE_FACEBOOK_APP_ID=votre_app_id_dev
   FACEBOOK_CLIENT_SECRET=votre_secret_dev

   # GitHub (optionnel)
   GITHUB_CLIENT_ID=votre_client_id_dev
   GITHUB_CLIENT_SECRET=votre_secret_dev

   # Google (optionnel)
   GOOGLE_CLIENT_ID=votre_client_id_dev
   GOOGLE_CLIENT_SECRET=votre_secret_dev
   ```

3. **Lancer l'application** :

   ```bash
   netlify dev
   ```

4. **Tester le flux** :
   - Allez sur `http://localhost:8888/profile`
   - Cliquez sur "Importer depuis Facebook"
   - Autorisez l'accès
   - Vérifiez que l'avatar s'affiche

---

## Sécurité et RGPD

### Protection CSRF

- Utilisation d'un `state` aléatoire cryptographiquement sécurisé
- Validation du `state` côté serveur avant d'accepter le callback

### Stockage sécurisé

- Les secrets OAuth ne sont jamais exposés au frontend
- Les tokens d'accès ne sont pas stockés (usage unique)
- Seule l'URL publique de l'avatar est conservée

### Consentement RGPD

- Page de consentement explicite
  ([`OAuthConsent.jsx`](file:///c:/tweesic/survey/src/pages/OAuthConsent.jsx))
- Tracking du consentement dans `metadata.facebook_consent` :
  - `requestedAt` : Quand le consentement a été demandé
  - `grantedAt` : Quand l'utilisateur a autorisé
  - `revokedAt` : Quand l'utilisateur a révoqué (via Facebook)
  - `scopes` : Liste des permissions demandées

### Webhook de déauthorisation Facebook

[`facebook-deauthorize.js`](file:///c:/tweesic/survey/netlify/functions/facebook-deauthorize.js)
gère les demandes de suppression de données :

- Vérifie la signature HMAC du `signed_request` Facebook
- Recherche l'utilisateur par `facebookId` dans `metadata`
- Supprime `avatarUrl`, `facebookId` et marque `facebook_consent.revokedAt`

---

## Dépannage

### L'avatar ne s'affiche pas

- Vérifiez que `users.metadata.avatarUrl` contient une URL valide
- Vérifiez les CORS dans la CSP ([`netlify.toml`](file:///c:/tweesic/survey/netlify.toml#L117))
- Pour Facebook : vérifiez que l'app est en mode "Live"

### Erreur "Invalid state"

- Le `state` a expiré (1 heure max)
- L'utilisateur a changé de session entre le start et le callback
- Solution : Recommencer le flux OAuth

### Erreur "redirect_uri mismatch"

- L'URL de callback configurée chez le provider ne correspond pas exactement
- Vérifiez `APP_BASE_URL` et les URLs dans les consoles des providers
- Attention : `http://localhost:8888` ≠ `http://127.0.0.1:8888`

### Le bouton n'apparaît pas

- Vérifiez que les variables d'environnement sont bien définies
- [`oauth-providers.js`](file:///c:/tweesic/survey/netlify/functions/oauth-providers.js) ne liste
  que les providers avec un `CLIENT_ID` configuré
- Vérifiez la console du navigateur pour les erreurs

---

## Prochaines étapes

Voir
[`social_login_supabase.md`](file:///C:/Users/admin/.gemini/antigravity/brain/7c99168f-a643-41c3-a5b9-3c759ea29853/social_login_supabase.md)
pour :

- Login social complet (pas seulement avatar)
- Intégration de Gravatar
- Support de providers additionnels (Twitter/X, LinkedIn, Microsoft)

---

## Quand utiliser ce système ?

**Utilisez le système custom (ce document) si :**

- ✅ L'utilisateur a déjà un compte (email/password ou autre)
- ✅ Vous voulez permettre de changer d'avatar sans se reconnecter
- ✅ Vous voulez un contrôle total sur le flux OAuth

**Utilisez Supabase Auth social login si :**

- ✅ Vous voulez permettre la création de compte via Facebook/GitHub/Google
- ✅ Vous voulez simplifier le code (moins de maintenance)
- ✅ Vous voulez bénéficier des fonctionnalités natives de Supabase (account linking, etc.)

**Recommandation** : Les deux systèmes peuvent coexister. Utilisez Supabase Auth pour le login et
conservez ce système pour permettre aux utilisateurs de changer d'avatar manuellement.
