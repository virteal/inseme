# 💬 Système de Commentaires - Implémentation Complète

## ✅ Ce qui a été fait

### 1. Composant Réutilisable `CommentSection`

**Fichier :** `src/components/common/CommentSection.jsx`

Un composant universel qui permet d'ajouter des commentaires à n'importe quel type de contenu :

**Fonctionnalités :**

- ✅ Interface pliable/dépliable (collapsed par défaut)
- ✅ Création automatique d'un article de discussion invisible
- ✅ Commentaires imbriqués (réponses)
- ✅ Modification et suppression par l'auteur
- ✅ Réactions emoji
- ✅ Temps réel avec Supabase Realtime
- ✅ Compte de commentaires visible dans l'en-tête
- ✅ Gestion de l'authentification

**Architecture :**

```javascript
<CommentSection
  linkedType="wiki_page" // Type de contenu
  linkedId={pageId} // ID du contenu
  currentUser={currentUser} // Utilisateur connecté
  defaultExpanded={false} // Plié par défaut
/>
```

### 2. Composant `CommentCount`

**Fichier :** `src/components/common/CommentCount.jsx`

Un badge léger pour afficher le nombre de commentaires dans les listes :

```javascript
<CommentCount
  linkedType="wiki_page"
  linkedId={page.id}
  showZero={false} // Optionnel: afficher même si 0 commentaires
/>
```

**Usage typique :** Dans les listes de pages Wiki, propositions, etc. pour montrer l'activité.

### 3. Hook `useCurrentUser`

**Fichier :** `src/lib/useCurrentUser.js`

Un hook réutilisable pour récupérer l'utilisateur connecté dans n'importe quelle page :

```javascript
const { currentUser, loading, error } = useCurrentUser();
```

**Avantages :**

- Combine auth et profil utilisateur
- Écoute les changements d'authentification
- Réutilisable partout
- Gestion d'erreur intégrée

### 3. Intégrations Réalisées

#### ✅ Pages Wiki (`src/pages/WikiPage.jsx`)

- Section de commentaires en bas de chaque page
- Permet de discuter du contenu documentaire
- Plié par défaut pour ne pas alourdir

#### ✅ Propositions Kudocracy (`src/pages/Proposition.jsx`)

- Commentaires sur chaque proposition
- Facilite débats et discussions
- Plié par défaut

#### ✅ Page Méthodologie (`src/pages/Methodologie.jsx`)

- Commentaires et suggestions sur la méthodologie
- Permet aux citoyens de poser des questions
- Premier exemple d'intégration pour une page "statique"

### 4. Composants Helper

#### `CommentCount` - Badge de compteur

Affiche le nombre de commentaires dans les listes de contenu :

```jsx
import CommentCount from "../components/common/CommentCount";

// Dans une liste de pages Wiki
{
  pages.map((page) => (
    <div key={page.id}>
      <h3>{page.title}</h3>
      <CommentCount linkedType="wiki_page" linkedId={page.id} />
    </div>
  ));
}
```

**Avantages :**

- Léger et performant
- N'affiche rien si 0 commentaires (par défaut)
- Icône + nombre formaté
- Requête optimisée

## 🎯 Autres Endroits Suggérés

Le document `docs/COMMENT_SYSTEM_SUGGESTIONS.md` contient des suggestions détaillées pour :

1. **Page d'Audit Municipal** - Commenter les résultats d'audit
2. **Transparence Municipale** - Discussion sur les critères
3. **Profils de Groupe** - Discussion sur les activités du groupe
4. **Profils Utilisateur** - Messages publics (optionnel)
5. **Page de Contact** - FAQ collaborative
6. **Chatbot Bob** - Feedback sur les réponses (avancé)

## 🔧 Comment Intégrer

### Méthode simple (3 étapes)

**1. Importer les dépendances :**

```jsx
import CommentSection from "../components/common/CommentSection";
import { useCurrentUser } from "../lib/useCurrentUser";
```

**2. Récupérer l'utilisateur :**

```jsx
export default function MaPage() {
  const { currentUser } = useCurrentUser();
  // ... reste du code
}
```

**3. Ajouter le composant :**

```jsx
<CommentSection
  linkedType="nom_type_contenu"
  linkedId={idDuContenu}
  currentUser={currentUser}
  defaultExpanded={false}
/>
```

## 📊 Architecture Technique

### Base de Données

- Réutilise la table `posts` avec metadata spéciale :
  - `isDiscussionThread: true`
  - `isHidden: true` (invisible dans le feed social)
  - `linkedType` et `linkedId` pour lier au contenu
- Table `comments` existante (déjà créée pour l'espace social)
- RLS (Row Level Security) déjà configuré

### Pas de Migration Nécessaire

Le système utilise l'infrastructure existante de l'espace social. Aucune modification de schéma
requise !

## 🎨 Interface Utilisateur

### État Plié (par défaut)

```
┌─────────────────────────────────────────┐
│ 💬 Commentaires (5)          [▼]       │
└─────────────────────────────────────────┘
```

### État Déplié

```
┌─────────────────────────────────────────┐
│ 💬 Commentaires (5)          [▲]       │
├─────────────────────────────────────────┤
│                                         │
│ [Formulaire d'ajout de commentaire]    │
│                                         │
│ ┌─ Commentaire 1 ──────────────┐       │
│ │  Contenu...                  │       │
│ │  [👍 2] [Répondre]           │       │
│ │  ┌─ Réponse 1.1 ───────┐    │       │
│ │  │  Contenu...          │    │       │
│ │  └──────────────────────┘    │       │
│ └──────────────────────────────┘       │
│                                         │
│ ┌─ Commentaire 2 ──────────────┐       │
│ │  Contenu...                  │       │
│ │  [❤️ 5] [😊 3] [Répondre]    │       │
│ └──────────────────────────────┘       │
└─────────────────────────────────────────┘
```

## 🔐 Sécurité et Permissions

- ✅ Seuls les utilisateurs authentifiés peuvent commenter
- ✅ Chaque utilisateur peut modifier/supprimer uniquement ses propres commentaires
- ✅ Soft delete (les commentaires supprimés sont marqués mais conservés)
- ✅ RLS activé sur toutes les tables
- ✅ Validation côté serveur

## 📱 Responsive

Le composant s'adapte automatiquement aux petits écrans :

- Commentaires empilés verticalement
- Formulaire de réponse sous le bouton
- Indentation réduite sur mobile

## 🚀 Performance

**Optimisations :**

- Chargement lazy : les commentaires ne sont chargés qu'à l'ouverture
- Supabase Realtime : mise à jour automatique sans polling
- Pagination future : prévu pour les discussions longues

## 🔄 Différence avec le bouton "💬 Discuter"

### Bouton "💬 Discuter" (existant)

- Redirige vers la création d'un article social complet
- Le post apparaît dans le feed social public
- Pour des discussions générales et visibles

### Nouveau `CommentSection`

- Commentaires contextuels directement sur la page
- Invisible dans le feed social
- Pour des retours/questions spécifiques au contenu
- Plus discret et intégré

**Les deux peuvent coexister** selon l'usage souhaité !

## 📝 Prochaines Améliorations

### Court terme

- [ ] Notifications push quand quelqu'un répond
- [ ] Compteur de commentaires dans la liste des pages
- [ ] Marquage "résolu" pour les questions

### Moyen terme

- [ ] Système de mentions @utilisateur
- [ ] Modération avancée pour les admins
- [ ] Export des commentaires (PDF/CSV)
- [ ] Recherche dans les commentaires

### Long terme

- [ ] Vote/score pour commentaires utiles
- [ ] Tri avancé (pertinence, date, auteur)
- [ ] Pagination intelligente
- [ ] Analytics sur l'engagement

## 📖 Exemples d'Usage

### Page Wiki

```jsx
// Dans src/pages/WikiPage.jsx
<CommentSection linkedType="wiki_page" linkedId={page.id} currentUser={currentUser} />
```

### Proposition Kudocracy

```jsx
// Dans src/pages/Proposition.jsx
<CommentSection linkedType="proposition" linkedId={proposition.id} currentUser={currentUser} />
```

### Page Statique (Méthodologie)

```jsx
// Dans src/pages/Methodologie.jsx
<CommentSection linkedType="methodology" linkedId="main" currentUser={currentUser} />
```

### Groupe Spécifique

```jsx
// Dans src/pages/GroupPage.jsx
<CommentSection linkedType="group" linkedId={groupId} currentUser={currentUser} />
```

## 🐛 Debug

### Vérifier si les commentaires s'affichent

1. Ouvrir la console développeur
2. Regarder les logs de `loadDiscussionPost()`
3. Vérifier la table `posts` pour le post de discussion
4. Vérifier la table `comments` pour les commentaires

### Problèmes courants

- **Pas de currentUser :** Vérifier l'authentification
- **Commentaires ne s'affichent pas :** Vérifier les RLS policies
- **Erreur de création :** Vérifier les permissions Supabase

## 📚 Ressources

- [Documentation Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Documentation RLS Policies](https://supabase.com/docs/guides/auth/row-level-security)
- Code source : `src/components/common/CommentSection.jsx`
- Suggestions détaillées : `docs/COMMENT_SYSTEM_SUGGESTIONS.md`

---

**Dernière mise à jour :** 20 novembre 2025 **Version :** 1.0 **Auteur :** GitHub Copilot pour
Kudocracy.Survey
