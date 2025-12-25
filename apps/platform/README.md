# 📊 Kudocracy.Survey - Plateforme de Consultation Citoyenne

**Kudocracy.Survey** est la plateforme de consultation citoyenne et de démocratie participative du monorepo Inseme. Elle est conçue pour être réutilisable par n'importe quelle commune ou collectif.

> Pour une vue d'ensemble de l'écosystème (Agora, IA, Multi-instances), consultez le [README global du dépôt](../../README.md).

---

## 🎯 À quoi ça sert ?

Kudocracy.Survey rassemble plusieurs espaces complémentaires pour le quotidien citoyen :

### 1. ☕ Café — Discuter entre voisins
Un lieu convivial pour créer des groupes par quartier, association ou thème. On y publie des messages, on réagit avec des emojis et on suit les conversations.

### 2. 💬 Ophélia — Une assistante qui répond
L'IA de la plateforme répond aux questions, aide à formuler des idées et guide vers les démarches utiles en s'appuyant sur le wiki et les consultations.

### 3. 📖 Wiki collaboratif — La mémoire commune
Un carnet de bord collectif pour les comptes rendus, fiches pratiques et idées de quartier.

### 4. 🗳️ Kudocratie — Débattre et voter
Permet de déposer une proposition, de voter et de déléguer sa voix à quelqu'un de confiance sur un sujet précis.

### 5. 🔍 Transparence — Comprendre comment la ville décide
Un tableau de bord synthétise les engagements de transparence : score automatique, comptes rendus publiés, accès aux archives.

---

## 🚀 Fonctionnalités Clés

- **Multi-Instances** : Déploiement automatique par sous-domaine pour chaque commune.
- **Gazette Citoyenne** : Un journal local éditorialisé par les membres du collectif.
- **Missions & Tâches** : Système Kanban pour s'organiser et agir concrètement sur le terrain.
- **Cartographie Citoyenne** : Visualisation des événements et incidents sur une carte interactive.

---

## 🛠️ Structure du Projet

```
apps/platform/
├── src/
│   ├── components/
│   │   ├── social/        # Café Pertitellu
│   │   ├── kudocracy/     # Propositions et votes
│   │   └── wiki/          # Wiki collaboratif
│   ├── pages/             # Pages de l'application
│   └── lib/               # Utilitaires (Supabase, hooks)
├── supabase/
│   ├── schema.sql         # Schéma de base de données
│   └── migrations/        # Migrations SQL
└── README.md              # Ce fichier
```

---

## ⚖️ Neutralité & Engagement
Cette plateforme est une infrastructure **neutre**. Elle ne soutient aucun parti politique, aucune campagne électorale, ni aucun candidat ou liste.

---

## 📜 Licence & Auteur

Ce projet est sous licence **MIT**. 

**Auteur : Jean Hugues Noël Robert**
- Projet porté par l'association **C.O.R.S.I.C.A.**
- Communauté [LePP.fr](https://lepp.fr).

---

### #PERTITELLU | CORTI CAPITALE
