# Social Features - Forums, Blogs & Communities

## Vue d'ensemble

Système social complet pour Pertitellu permettant :

- **Forums de discussion** : Threads de discussion publics ou dans des groupes
- **Blogs** : Articles longs avec commentaires
- **Communautés** : Quartiers, associations, forums thématiques
- **Réactions emoji** : Sur posts et commentaires
- **Commentaires imbriqués** : Threads de discussion avec réponses

## Architecture

### Tables principales

#### `groups` (existante, étendue)

Groupes/communautés de différents types :

- `groupType` : `neighborhood`, `association`, `community`, `forum`
- `location` : Localisation géographique
- `avatarUrl`, `tags` : Métadonnées visuelles

#### `posts` (existante, étendue)

Publications dans groupes ou standalone :

- `postType` : `blog`, `forum`, `announcement`
- `title` : Titre obligatoire
- `groupId` : Groupe d'appartenance (optionnel)
- `linkedType`/`linkedId` : Lien vers wiki_page ou proposition
- `isPinned`, `isLocked` : Modération
- `viewCount` : Compteur de vues

#### `comments` (existante, étendue)

Commentaires imbriqués sur posts :

- `parentCommentId` : Pour réponses imbriquées
- `isEdited`, `editedAt` : Historique d'édition

#### `reactions` (nouvelle)

Réactions emoji sur posts/comments :

- `emoji` : Emoji Unicode
- `target_type` : `post` ou `comment`
- `target_id` : ID de la cible
- Unique constraint : 1 réaction par user/emoji/target

#### `group_members` (existante)

Adhésions aux groupes

#### `read_tracking` (nouvelle)

Suivi de lecture par utilisateur (pour notifications futures)

#### `activity_log` (nouvelle)

Audit trail des actions importantes

### Pattern Metadata JSONB

Toutes les tables utilisent un champ `metadata jsonb` avec :

```javascript
{
  schemaVersion: 1,  // Version du schéma metadata
  ...autres_champs_flexibles
}
```

### Audit fields (`metadata.lastModifiedBy`)

We store the full edit ledger in `metadata.lastModifiedBy` as an ordered array of entries:

```javascript
lastModifiedBy: [
  { id: "user_uuid", displayName: "Alice", timestampISO: "2025-12-02T10:00:00.000Z" },
  { id: "moderator_uuid", displayName: "Editor Bob", timestampISO: "2025-12-03T12:30:00.000Z" },
];
```

Rules:

- Stored entries are ordered with the newest first.
- A helper appends or merges entries (consecutive edits by the same user within 1 hour are merged).
- Reads fallback to the `author_id`/`created_at` when the array is missing; we do not persist this
  fallback until an actual edit occurs.

**Avantages** :

- Extensibilité sans migration SQL
- Versionning du schéma
- Flexibilité pour évolution

### RLS (Row Level Security)

**Politique générale** :

- **Public read** : Transparence démocratique
- **Authenticated write** : Création réservée aux connectés
- **Owner edit/delete** : Chacun gère son contenu
- **Soft delete** : via `metadata.isDeleted`

**Exceptions** :

- Admins de groupes peuvent gérer membres
- Posts verrouillés (`isLocked`) bloquent nouveaux commentaires

## Structure des fichiers

```
src/
├── lib/
│   ├── metadata.js              # Helpers génériques metadata
│   ├── socialMetadata.js        # Helpers spécifiques social
│   └── supabase.js              # Client Supabase + useAuth hook
├── components/social/
│   ├── GroupList.jsx            # Liste de groupes avec filtres
│   ├── GroupCard.jsx            # Carte groupe
│   ├── GroupDetail.jsx          # Page détail groupe + membres + posts
│   ├── GroupForm.jsx            # Création/édition groupe
│   ├── PostEditor.jsx           # Éditeur de post (nouveau/édition)
│   ├── PostList.jsx             # Liste de posts avec filtres
│   ├── PostCard.jsx             # Carte post
│   ├── PostView.jsx             # Vue détaillée post + commentaires
│   ├── CommentThread.jsx        # Thread commentaires imbriqués
│   ├── CommentForm.jsx          # Formulaire commentaire
│   └── ReactionPicker.jsx       # Sélecteur emoji avec compteurs
└── pages/
    ├── Social.jsx               # Page d'accueil social (tabs)
    ├── GroupPage.jsx            # Wrapper GroupDetail
    ├── GroupCreate.jsx          # Wrapper GroupForm
    ├── PostPage.jsx             # Wrapper PostView
    └── PostCreate.jsx           # Wrapper PostEditor

supabase/migrations/
└── 20251119_create_social_tables.sql  # Migration complète
```

## Routes

```
/social                  - Page d'accueil (tous/groupes/posts)
/groups/new              - Créer un groupe
/groups/:id              - Détail d'un groupe
/posts/new               - Créer une publication
/posts/new?groupId=...   - Créer dans un groupe spécifique
/posts/new?linkedType=wiki_page&linkedId=...  - Lier à wiki/proposition
/posts/:id               - Détail d'un article
```

## Intégrations

### Menu principal (App.jsx)

```jsx
<Link to="/social">Social (Forums & Blogs)</Link>
```

### Pages Wiki/Proposition

Bouton "💬 Discuter" pour créer un article lié :

```jsx
<button onClick={() => navigate(`/posts/new?linkedType=wiki_page&linkedId=${page.id}`)}>
  💬 Discuter
</button>
```

## Workflow typique

### 1. Créer un groupe (quartier, association)

```javascript
const metadata = createGroupMetadata("neighborhood", {
  location: "Centre-ville",
  tags: ["urbanisme", "culture"],
  requireApproval: true,
});

await supabase.from("groups").insert({
  name: "Quartier Saint-Joseph",
  description: "Groupe des habitants du quartier",
  created_by: userId,
  metadata,
});
```

### 2. Publier dans le groupe

```javascript
const metadata = createPostMetadata("forum", "Nouvel aménagement place", {
  groupId: groupId,
  tags: ["urbanisme"],
});

await supabase.from("posts").insert({
  user_id: userId,
  content: "Que pensez-vous du nouvel aménagement ?",
  metadata,
});
```

### 3. Commenter avec réponse imbriquée

```javascript
// Commentaire principal
const mainComment = await supabase.from("comments").insert({
  post_id: postId,
  user_id: userId,
  content: "Je trouve ça bien !",
  metadata: { schemaVersion: 1, parentCommentId: null },
});

// Réponse au commentaire
await supabase.from("comments").insert({
  post_id: postId,
  user_id: userId2,
  content: "@user1 Moi aussi !",
  metadata: { schemaVersion: 1, parentCommentId: mainComment.id },
});
```

### 4. Réagir avec emoji

```javascript
await supabase.from("reactions").insert({
  user_id: userId,
  target_type: "post",
  target_id: postId,
  emoji: "❤️",
  metadata: { schemaVersion: 1 },
});
```

## Helpers principaux

### `src/lib/metadata.js`

```javascript
initMetadata(data); // Initialise avec schemaVersion
getMetadata(entity, field); // Récupère champ metadata
setMetadata(entity, updates); // Met à jour metadata
isDeleted(entity); // Vérifie soft delete
softDelete(entity, userId); // Marque comme supprimé
restore(entity); // Restaure
migrateMetadata(entity, v); // Migration schéma
```

### `src/lib/socialMetadata.js`

```javascript
// Groups
createGroupMetadata(type, opts)
getGroupType(group)

// Posts
createPostMetadata(type, title, opts)
getPostType(post)
getPostTitle(post)
isPinned(post)
isLocked(post)
incrementViewCount(post)

// Comments
createCommentMetadata(opts)
getParentCommentId(comment)
isReply(comment)
isEdited(comment)
markAsEdited(comment)

// Constants
GROUP_TYPES = { NEIGHBORHOOD, ASSOCIATION, COMMUNITY, FORUM }
POST_TYPES = { BLOG, FORUM, ANNOUNCEMENT }
REACTION_EMOJIS = { THUMBS_UP, HEART, LAUGH, ... }
```

## Real-time

Les composants `CommentThread` et `ReactionPicker` s'abonnent aux changements Supabase :

```javascript
const channel = supabase
  .channel(`comments:${postId}`)
  .on("postgres_changes", { event: "*", table: "comments" }, () => loadComments())
  .subscribe();
```

## Sécurité

- **Soft delete** : `metadata.isDeleted = true` au lieu de DELETE
- **RLS strict** : Users ne peuvent modifier que leur contenu
- **Public read** : Transparence par défaut
- **Modération manuelle** : via `isPinned`, `isLocked`, soft delete

## Migration

Pour déployer :

```bash
# Exécuter la migration dans Supabase
psql -h your-db -U postgres -d postgres -f supabase/migrations/20251119_create_social_tables.sql

# Ou via Supabase CLI
supabase db push
```

## Tests recommandés

1. ✅ Créer un groupe → Vérifier visibilité publique
2. ✅ Rejoindre un groupe → Vérifier `group_members`
3. ✅ Créer un article dans groupe → Vérifier `metadata.groupId`
4. ✅ Créer un article lié à wiki → Vérifier `linkedType`/`linkedId`
5. ✅ Commenter → Vérifier commentaires imbriqués
6. ✅ Réagir avec emoji → Vérifier unique constraint
7. ✅ Soft delete post → Vérifier disparition de la liste
8. ✅ Modifier commentaire → Vérifier `isEdited`/`editedAt`
9. ✅ Épingler post → Vérifier tri en haut
10. ✅ Verrouiller post → Vérifier blocage commentaires

## Évolutions futures

- [ ] Notifications (avec `read_tracking`)
- [ ] Recherche full-text dans posts/comments
- [ ] Upload images (Supabase Storage)
- [ ] Modération avancée (flags, reports)
- [ ] Permissions granulaires par groupe
- [ ] Tags recherchables
- [ ] Abonnements à groupes/posts
- [ ] Export/archive de discussions
