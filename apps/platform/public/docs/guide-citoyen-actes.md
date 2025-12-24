# 🏛️ Guide Citoyen - Contrôle des Actes Municipaux

## Bienvenue !

Ce guide vous accompagne dans l'utilisation du système de contrôle citoyen des actes municipaux de
Corte. Vous êtes désormais acteur de la transparence démocratique locale.

---

## 🚀 Premiers pas

### Accéder au système

1. Rendez-vous sur le site
2. Connectez-vous avec votre compte
3. Accédez à la **Page d'accueil** via le menu `/actes/accueil`
4. Ou directement au **Tableau de bord** via `/actes`

### Comprendre l'interface

Le tableau de bord affiche :

- 📊 Les statistiques clés (actes suivis, demandes en cours)
- ⏰ Les alertes sur les délais
- 🔗 Les accès rapides aux actions principales

---

## 📋 Suivre un acte municipal

### Qu'est-ce qu'un acte ?

Un acte municipal est une décision officielle de la mairie :

- **Délibération** : Décision votée par le conseil municipal
- **Arrêté** : Décision du maire
- **Décision** : Acte individuel
- **Procès-verbal** : Compte-rendu officiel

### Ajouter un acte à suivre

1. Cliquez sur **"Nouvel acte"** (`/actes/nouveau`)
2. Remplissez les informations :
   - **Référence** : Numéro officiel (ex: DEL-2024-042)
   - **Titre** : Intitulé complet
   - **Type** : Délibération, Arrêté, etc.
   - **Date d'adoption** : Date du vote ou de la signature
3. Ajoutez vos **observations** personnelles
4. Cliquez sur **Enregistrer**

### Modifier un acte

⚠️ **Important** : Chaque modification crée une nouvelle version. L'historique complet est conservé.

1. Ouvrez l'acte concerné
2. Cliquez sur **"Modifier"**
3. Effectuez vos changements
4. Ajoutez une **note de modification** (obligatoire) expliquant pourquoi
5. Enregistrez

---

## 📬 Faire une demande administrative

### Types de demandes

| Type                 | Délai de réponse | Quand l'utiliser                      |
| -------------------- | ---------------- | ------------------------------------- |
| **CRPA**             | 1 mois           | Demande de communication de documents |
| **CADA**             | Après refus CRPA | Saisine de la Commission              |
| **Recours gracieux** | 2 mois           | Contester une décision                |
| **Recours TA**       | 2 mois           | Recours au Tribunal Administratif     |

### Créer une demande CRPA

La demande CRPA (Code des Relations entre le Public et l'Administration) vous permet d'obtenir des
documents administratifs.

1. Allez sur **"Nouvelle demande"** (`/demandes/nouvelle`)
2. Sélectionnez **"CRPA"**
3. Remplissez :
   - **Objet** : Ce que vous demandez précisément
   - **Contenu** : Le texte de votre demande
   - **Destinataire** : Mairie de Corte
4. Liez à un acte si pertinent (optionnel)
5. Enregistrez

📅 Le système calcule automatiquement la date limite de réponse (1 mois).

### Après l'envoi

1. **Marquez la demande comme envoyée** une fois le courrier/email parti
2. **Ajoutez une preuve** (capture d'écran, accusé de réception)
3. **Surveillez le délai** : une alerte apparaîtra à l'approche de l'échéance

### En cas de non-réponse

Si aucune réponse après 1 mois :

1. Le système marque la demande comme **"Sans réponse"**
2. Vous pouvez alors **saisir la CADA**
3. Créez une nouvelle demande de type "CADA"

---

## 📎 Gérer les preuves

### Pourquoi ajouter des preuves ?

Les preuves documentent vos constats et renforcent votre dossier en cas de recours.

### Types de preuves

- 🖼️ **Capture d'écran** : Site web, email
- 📄 **Document PDF** : Courrier reçu, document officiel
- 📧 **Email** : Échange avec l'administration
- 📬 **Accusé de réception** : Preuve d'envoi
- 📷 **Photo** : Affichage légal, panneau

### Ajouter une preuve

1. Allez sur **"Ajouter une preuve"** (`/preuves/ajouter`)
2. **Glissez-déposez** votre fichier ou cliquez pour parcourir
3. Sélectionnez :
   - **Type de preuve**
   - **Date du constat** : Quand avez-vous fait ce constat ?
4. Ajoutez une **description**
5. Liez à un acte ou une demande
6. Enregistrez

### Intégrité des preuves

Chaque fichier reçoit un **hash SHA-256** unique. Cela garantit que le document n'a pas été modifié.

---

## ⏰ Comprendre les délais légaux

### Délais automatiquement calculés

| Situation                    | Délai    | Conséquence si dépassé        |
| ---------------------------- | -------- | ----------------------------- |
| Transmission à la préfecture | 15 jours | Acte potentiellement illégal  |
| Réponse CRPA                 | 1 mois   | Refus implicite → Saisir CADA |
| Recours gracieux             | 2 mois   | Recours contentieux possible  |
| Recours TA                   | 2 mois   | Forclusion (plus de recours)  |

### Alertes

Le système vous alerte :

- 🟡 **7 jours avant** l'échéance
- 🟠 **3 jours avant** l'échéance
- 🔴 **Échéance dépassée**

Consultez régulièrement le tableau de bord !

---

## 🔍 File de modération

Si vous êtes modérateur, vous avez accès à des fonctions supplémentaires.

### Valider une action externe

Avant tout envoi officiel (courrier, email, saisine), l'action doit être validée :

1. Allez sur **"Actions en attente"** (`/moderation/actions`)
2. Examinez le contenu proposé
3. **Approuvez** si correct, ou **Rejetez** avec un motif

### Vérifier les preuves

Les preuves téléversées doivent être vérifiées :

1. Allez sur **"Vérification preuves"** (`/moderation/preuves`)
2. Examinez chaque document
3. Vérifiez :
   - Authenticité apparente
   - Cohérence de la date
   - Lisibilité
4. **Validez** ou **Rejetez**

---

## 📊 Exporter vos données

### Export PDF

Créez des documents officiels :

1. Allez sur **"Export PDF"** (`/exports/pdf`)
2. Choisissez le type :
   - Acte complet avec versions
   - Dossier de demande
   - Dossier pour recours TA
   - Dossier pour saisine CADA
3. Sélectionnez les options
4. Générez et imprimez

### Export CSV

Pour analyses dans Excel/LibreOffice :

1. Allez sur **"Export CSV"** (`/exports/csv`)
2. Sélectionnez les données à exporter
3. Choisissez les colonnes
4. Téléchargez

---

## 📅 Visualiser la chronologie

### Chronologie globale

Voir tous les événements récents :

1. Allez sur **"Chronologie"** (`/actes/chronologie`)
2. Filtrez par type d'événement
3. Ajustez la période (semaine, mois, année)

### Chronologie d'un acte

Voir l'historique complet d'un acte :

1. Ouvrez l'acte concerné
2. Cliquez sur **"Voir la chronologie"**

---

## ❓ Questions fréquentes

### Comment savoir si un acte est légal ?

Un acte doit être :

1. ✅ Transmis à la préfecture dans les 15 jours
2. ✅ Affiché publiquement
3. ✅ Pris par l'autorité compétente
4. ✅ Conforme aux procédures

### Que faire si la mairie ne répond pas à ma demande CRPA ?

1. Attendez le délai d'1 mois
2. Créez une demande de type **"CADA"**
3. Joignez votre demande initiale comme preuve
4. La CADA donnera un avis sous 1 mois

### Puis-je contester un acte ?

Oui, vous avez **2 mois** à compter de la publication pour :

1. Faire un **recours gracieux** auprès du maire
2. Ou directement un **recours contentieux** au Tribunal Administratif

### Les données sont-elles sécurisées ?

Oui :

- Connexion sécurisée (HTTPS)
- Authentification requise
- Historique complet des actions (qui a fait quoi, quand)
- Preuves avec hash d'intégrité

---

## 🆘 Besoin d'aide ?

### Ressources

- **CADA** : [cada.fr](https://www.cada.fr)
- **Légifrance** : [legifrance.gouv.fr](https://www.legifrance.gouv.fr)
- **Service-Public** : [service-public.fr](https://www.service-public.fr)

### Contact

Pour toute question sur le système :

- 📧 Contactez le collectif via la page Contact
- 💬 Utilisez Ophelia, l'assistant IA

---

## 📝 Lexique

| Terme            | Définition                                                |
| ---------------- | --------------------------------------------------------- |
| **CGCT**         | Code Général des Collectivités Territoriales              |
| **CRPA**         | Code des Relations entre le Public et l'Administration    |
| **CADA**         | Commission d'Accès aux Documents Administratifs           |
| **TA**           | Tribunal Administratif                                    |
| **RLS**          | Row Level Security (sécurité des données)                 |
| **Hash SHA-256** | Empreinte numérique garantissant l'intégrité d'un fichier |

---

Guide mis à jour le 4 décembre 2024

Ensemble, pour une démocratie locale transparente ! 🏛️
