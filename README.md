# 🗳️ Inseme Monorepo - Écosystème Citoyen & Démocratie Liquide

Bienvenue dans le dépôt **Inseme**, une infrastructure numérique **open source** et **neutre** dédiée à la participation citoyenne, à la délibération augmentée et à la transparence démocratique.

Ce projet regroupe les outils du mouvement citoyen **#PERTITELLU** (Corte, Corse) et vise à fournir des solutions libres pour redonner le pouvoir aux citoyens.

---

## 🏛️ Structure du Dépôt

Le projet est organisé en monorepo (Turbo) pour faciliter le partage de code entre les différentes briques de l'écosystème :

### 📱 Applications (`/apps`)

- **`apps/platform` (Kudocracy.Survey)** : La plateforme de consultation et d'engagement.
  - **Focus** : Consultations, Wiki collaboratif, Gazette citoyenne, Café social.
  - **Architecture** : Multi-instances (Corte, Bastia, Università di Corsica, etc.).
  - **Stack** : React 19, Vite 7, Tailwind CSS 4, Supabase.

- **`apps/inseme` (L'Agora)** : Outil de démocratie directe et liquide.
  - **Focus** : Assemblées physiques/distantes, vote instantané, gestuelle digitale.
  - **IA** : Ophélia (Médiatrice IA) intégrée via Edge Functions.
  - **Stack** : React 18, Vite 5, Tailwind CSS, Supabase.

### 📦 Packages (`/packages`)

- **`packages/cop-core`** : Logique métier partagée (Cognitive Orchestration Protocol).
- **`packages/ophelia`** : Cœur de l'intelligence artificielle médiatrice.

---

## 🎯 À quoi ça sert ?

L'écosystème Inseme rassemble plusieurs espaces complémentaires pour le quotidien citoyen :

### 1. 💬 Ophélia — L'IA Médiatrice

Ophélia est l'IA de la plateforme. Elle répond aux questions, aide à formuler des idées, guide vers les démarches utiles et facilite le consensus lors des débats sans jamais s'imposer.

### 2. ☕ Café & Social — Discuter et s'organiser

Le Café est un lieu convivial pour créer des groupes par quartier, association ou thème. Tout est pensé pour rendre les échanges lisibles et bienveillants.

### 3. 🗳️ Kudocracy — Débattre et voter (Agora Liquide)

Permet de déposer des propositions, de voter et de déléguer sa voix à quelqu'un de confiance sur un sujet précis. Inseme (Agora) pousse ce concept plus loin avec une gestuelle digitale temps réel.

### 4. 📖 Wiki collaboratif — La mémoire commune

Un carnet de bord collectif pour les comptes rendus, fiches pratiques et idées de quartier. La recherche est instantanée et l'interface simple.

### 5. 📊 Consultations & Transparence

Prendre le pouls de la population via des enquêtes et suivre les engagements des élus via un tableau de bord de transparence (score de transparence automatique).

---

## 🚀 Technologie (Modern Stack)

- **Frontend** : React (v18/v19) + Vite + Tailwind CSS.
- **Backend Realtime** : Supabase (PostgreSQL, Realtime, Auth).
- **AI Agent** : OpenAI GPT-4o orchestré via **Netlify Edge Functions** (Deno).
- **Multi-Instance** : Système de résolution dynamique par sous-domaine pour déployer une instance par commune. [Voir la documentation](packages/cop-host/docs/MULTI_INSTANCE.md) et la [liste des tâches restantes](packages/cop-host/docs/TODO.md).

---

## 🛠️ Installation et Développement

### Prérequis

- Node.js (v20+ recommandé)
- Netlify CLI (`npm install netlify-cli -g`)

### Setup Rapide

1.  **Clonez le dépôt** :

    ```bash
    git clone https://github.com/JeanHuguesRobert/inseme.git
    cd inseme
    ```

2.  **Installez les dépendances** :

    ```bash
    npm install
    ```

3.  **Lancez l'application souhaitée** :

    ```bash
    # Pour la Plateforme Citoyenne (Survey)
    npm run platform:dev

    # Pour l'Agora Inseme
    npm run inseme:dev
    ```

_Note : Pour le développement avec les Edge Functions, utilisez `netlify dev` dans le dossier de l'application correspondante._

---

## ⚖️ Neutralité & Engagement

Inseme est une infrastructure **neutre** et **indépendante**. Elle ne finance, ne promeut et ne soutient aucun parti politique, aucune campagne électorale, ni aucun candidat ou liste. Elle fournit des outils numériques utilisables par tout citoyen, collectif ou institution souhaitant renforcer la démocratie locale.

---

## 📜 Licence & Auteur

Ce projet est sous licence **MIT**.

**Auteur : Jean Hugues Noël Robert**

- Projet porté par l'association **C.O.R.S.I.C.A.** (Président Fondateur : Jean Hugues Noël Robert).
- Communauté [LePP.fr](https://lepp.fr).
- Fait avec ❤️ à Corte, Corse.

---

### #PERTITELLU | CORTI CAPITALE
