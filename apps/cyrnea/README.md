# 🍷 Cyrnea - L'Expérience Sociale & Gamifiée
 
**Cyrnea** est une application légère de l'écosystème Inseme dédiée à l'animation sociale dans les lieux de convivialité (bars, cafés citoyens, tiers-lieux). Elle permet de créer une interaction dynamique entre le "Barman" (organisateur) et les "Clients" (participants) à travers des jeux, des playlists collaboratives et un suivi de l'ambiance ("Vibe").

> Pour une vue d'ensemble de l'écosystème (Plateforme, Agora, IA), consultez le [README global du dépôt](../../README.md).

---

## 🎯 À quoi ça sert ?

Cyrnea transforme un lieu physique en un espace interactif et ludique :

### 1. 🍹 Dashboard Barman
Un outil de pilotage pour l'organisateur :
- **Gestion de la Vibe** : Suivi en temps réel de l'humeur de la salle.
- **Contrôle des Jeux** : Lancement de quiz, défis ou votes rapides.
- **Animation** : Diffusion de messages et gestion des rôles.

### 2. 📱 Mini-App Client
Une interface ultra-légère pour les participants (sans installation) :
- **Participation aux Jeux** : Répondez aux quiz et participez aux défis.
- **Vibe Monitor** : Partagez votre ressenti sur l'ambiance actuelle.
- **Playlist Collaborative** : Suggérez et votez pour les prochains morceaux.

---

## 🚀 Technologie (Light Stack)

- **Frontend** : React 18 + Vite + Tailwind CSS.
- **Briques** : Utilise `@inseme/brique-cyrnea` pour la logique métier partagée.
- **Temps Réel** : Supabase Realtime pour la synchronisation Barman/Clients.
- **Iconographie** : Lucide React.

---

## 🛠️ Installation et Développement

### Setup Rapide

1.  **Installez les dépendances** :
    ```bash
    npm install
    ```

2.  **Lancez le serveur de développement** :
    ```bash
    npm run dev
    ```

3.  **Accédez aux interfaces** :
    - **Interface Client** : `http://localhost:5173/`
    - **Dashboard Barman** : `http://localhost:5173/bar`

---

## ⚖️ Neutralité & Engagement

Comme tous les outils du projet Inseme, **Cyrnea** est une infrastructure **neutre** et **open source**. Elle vise à renforcer le lien social et la convivialité locale sans aucune finalité commerciale ou politique partisane.

---

## 📜 Licence & Auteur

Ce projet est sous licence **MIT**.

**Auteur : Jean Hugues Noël Robert**

- Projet porté par l'association **C.O.R.S.I.C.A.**
- Communauté [LePP.fr](https://lepp.fr).
- Fait avec ❤️ à Corte, Corse.

---

### #PERTITELLU | CORTI CAPITALE
