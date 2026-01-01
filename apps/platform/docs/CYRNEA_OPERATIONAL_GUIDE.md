# 🍻 Guide Opérationnel – Cyrnea / Inseme

Ce guide détaille la mise en œuvre du module "Bar Convivialité" pour les soirées au Cyrnea.

## 📍 Configuration des Lieux

Chaque zone du bar dispose de son propre agent Ophélia pour une ambiance adaptée.

### 1. Zone Intérieure (Calme / Discussion)
- **ID Instance** : `cyrnea-indoor`
- **Agent** : Ophélia Intime ♟️
- **Focus** : Musique d'ambiance, anecdotes, jeux de table discrets.
- **Règle IA** : Suggérer un morceau de Jazz/Folk toutes les 30 min.

### 2. Zone Terrasse (Dynamique / Rencontres)
- **ID Instance** : `cyrnea-outdoor`
- **Agent** : Ophélia Énergie 🎸
- **Focus** : Défis inter-tables, playlist rock/polyphonie, ambiance vivante.
- **Règle IA** : Lancer un mini-défi toutes les 15-20 min.

---

## 👨‍🍳 Guide Barman (Henry / Jean-Marie)

### Installation
1. Scanner le QR Code de configuration sur la tablette du bar.
2. Accéder à `https://cyrnea.lepp.fr/bar`.
3. Connecter le téléphone personnel au Bluetooth du bar.

### Actions Quotidiennes
- **Valider les gains** : Lorsqu'un client gagne un défi (échecs, cartes), une notification apparaît sur le dashboard. Cliquer sur "Valider" pour confirmer la remise du lot (ex: café offert).
- **Musique** : Ophélia propose des morceaux via le dashboard en fonction des votes clients. Le barman reste maître du passage au morceau suivant sur son téléphone.

---

## 📱 Guide Client

### Accès Rapide
- **QR Code sur les tables** : Pointe vers `https://cyrnea.lepp.fr/q`.
- **Interaction** : 
    - Tap on ❤️ pour voter pour un morceau.
    - Tap on ♟️ pour signaler le début d'une partie d'échecs.
    - Appui long sur 🎙️ pour parler à Ophélia.

---

## 🧩 Liste des Défis Initiaux

| Défi | Cible | Récompense |
| --- | --- | --- |
| **Le Gambit du Cyrnea** | Échecs (Intérieur) | Café offert par la maison |
| **La Main de Jean-Marie** | Cartes (Extérieur) | -10% sur la prochaine tournée |
| **L'Historien** | Anecdote validée par IA | Badge "Ami du Cyrnea" |

---

## 🛠️ Maintenance & Debug
- Pour changer le "Vibe Score" manuellement : Utiliser `/admin/vibe` (accès réservé staff).
- Urgence Musique : Bouton "Pause" immédiat sur le Dashboard Barman.

---
_Cyrnea - L'IA au service du comptoir._
