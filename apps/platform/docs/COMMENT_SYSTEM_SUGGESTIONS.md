# Système de Commentaires - Suggestions d'Intégration

## 📝 Résumé

Un système de commentaires réutilisable a été implémenté avec le composant `CommentSection`. Ce
composant permet d'ajouter facilement des commentaires pliables/dépliables à n'importe quelle page.

## ✅ Déjà Implémenté

### 1. **Pages Wiki** (`src/pages/WikiPage.jsx`)

- Commentaires sur chaque page du Wiki
- Permet aux utilisateurs de discuter du contenu documentaire
- Section pliable par défaut pour ne pas alourdir la page

### 2. **Propositions Kudocracy** (`src/pages/Proposition.jsx`)

- Commentaires sur chaque proposition
- Facilite les discussions et débats sur les propositions
- Section pliable par défaut

## 🎯 Suggestions d'Autres Endroits

### 3. **Page d'Audit Municipal** (`src/pages/Audit.jsx`)

**Utilité :** Permettre aux citoyens de commenter les résultats d'audit de leur commune

```jsx
<CommentSection
  linkedType="audit_municipality"
  linkedId={municipalityId}
  currentUser={currentUser}
  defaultExpanded={false}
/>
```

### 4. **Articles de Blog dans l'Espace Social** (`src/pages/PostPage.jsx`)

**Note :** Déjà implémenté via `CommentThread` pour les posts de type "forum/blog"

- Pas de modification nécessaire

### 5. **Résultats de Transparence Municipale** (`src/pages/Transparence.jsx`)

**Utilité :** Commentaires sur les critères de transparence globaux ou par commune

```jsx
<CommentSection
  linkedType="transparency_global"
  linkedId="global"
  currentUser={currentUser}
  defaultExpanded={false}
/>
```

### 6. **Page Méthodologie** (`src/pages/Methodologie.jsx`)

**Utilité :** Permettre aux utilisateurs de poser des questions ou suggérer des améliorations
méthodologiques

```jsx
<CommentSection
  linkedType="methodology"
  linkedId="main"
  currentUser={currentUser}
  defaultExpanded={false}
/>
```

### 7. **Profil de Groupe** (`src/pages/GroupPage.jsx`)

**Utilité :** Discussion sur les activités et objectifs du groupe

```jsx
<CommentSection
  linkedType="group"
  linkedId={groupId}
  currentUser={currentUser}
  defaultExpanded={false}
/>
```

### 8. **Profil Utilisateur Public** (`src/pages/UserProfile.jsx`)

**Utilité :** Permettre de laisser des messages sur un profil public (si souhaité)

```jsx
<CommentSection
  linkedType="user_profile"
  linkedId={userId}
  currentUser={currentUser}
  defaultExpanded={false}
/>
```

### 9. **Page de Contact** (`src/pages/Contact.jsx`)

**Utilité :** FAQ collaborative ou discussions publiques

```jsx
<CommentSection
  linkedType="contact_page"
  linkedId="main"
  currentUser={currentUser}
  defaultExpanded={false}
/>
```

### 10. **Chatbot Bob - Réponses Spécifiques**

**Utilité :** Permettre aux utilisateurs de valider/commenter la qualité des réponses du chatbot

- Nécessiterait un refactoring pour identifier chaque interaction

## 🔧 Comment Intégrer

### Étapes d'intégration simple :

1. **Importer le composant :**

```jsx
import CommentSection from "../components/common/CommentSection";
```

2. **Récupérer l'utilisateur courant :**

```jsx
const [currentUser, setCurrentUser] = useState(null);

useEffect(() => {
  const fetchUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: userData } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();
      setCurrentUser(userData || user);
    }
  };
  fetchUser();
}, []);
```

3. **Ajouter le composant :**

```jsx
<CommentSection
  linkedType="TYPE_DE_CONTENU"
  linkedId={idDuContenu}
  currentUser={currentUser}
  defaultExpanded={false}
/>
```

## 📊 Architecture Technique

### Fonctionnement

- Le composant crée automatiquement un "post de discussion" invisible dans la base de données
- Ce post sert de conteneur pour tous les commentaires
- Le post est marqué comme `isHidden: true` pour ne pas apparaître dans le feed social
- Les commentaires sont liés au post via `post_id`

### Métadonnées du Post de Discussion

```javascript
{
  schemaVersion: 1,
  postType: 'forum',
  isDiscussionThread: true,
  linkedType: 'wiki_page|proposition|audit|etc.',
  linkedId: 'uuid-du-contenu',
  isHidden: true
}
```

## 🎨 Personnalisation

### Options disponibles :

- `defaultExpanded` : Ouvrir ou fermer par défaut (false recommandé)
- `linkedType` : Type de contenu (wiki_page, proposition, etc.)
- `linkedId` : ID unique du contenu commenté

### Styles

Le composant utilise les classes Tailwind standards du projet et s'adapte automatiquement au thème.

## 🔐 Sécurité

- RLS (Row Level Security) activé sur la table `comments`
- Seuls les utilisateurs authentifiés peuvent commenter
- Chaque utilisateur peut modifier/supprimer uniquement ses propres commentaires
- Soft delete : les commentaires supprimés sont marqués mais conservés

## 📈 Fonctionnalités

- ✅ Commentaires imbriqués (réponses)
- ✅ Modification et suppression
- ✅ Réactions emoji via `ReactionPicker`
- ✅ Temps réel (Supabase Realtime)
- ✅ Interface pliable/dépliable
- ✅ Compte de commentaires visible
- ✅ Support markdown (hérité de `CommentForm`)

## 🚀 Prochaines Améliorations Possibles

1. **Notifications** : Notifier quand quelqu'un répond à un commentaire
2. **Modération** : Outils de modération pour les administrateurs
3. **Mentions** : Système de @mentions pour notifier des utilisateurs
4. **Recherche** : Recherche dans les commentaires
5. **Export** : Exporter les commentaires en PDF/CSV
6. **Vote** : Système de vote pour les commentaires utiles
7. **Filtres** : Trier par date, pertinence, auteur
8. **Pagination** : Pour les discussions avec beaucoup de commentaires

## 📝 Notes

- Le bouton "💬 Discuter" existant sur les pages Wiki/Proposition redirige vers la création d'un
  post social séparé
- Le nouveau système de commentaires intégré est plus discret et contextuel
- Les deux systèmes peuvent coexister : discussion sociale publique VS commentaires contextuels
