# Inseme - Démocratie Directe et Liquide v3.0

**Inseme** est une plateforme facilitant la participation à distance à des assemblées physiques, inspiré par les principes de la démocratie directe et liquide. Cette version modernisée intègre l'intelligence artificielle et des technologies WebRTC de pointe pour une expérience fluide et proactive.

Déployé sur : [https://LePP.fr/inseme](https://LePP.fr/inseme)
[![Netlify Status](https://api.netlify.com/api/v1/badges/dfaef2a1-e96d-45fe-9e5d-ecdfb02067fe/deploy-status)](https://app.netlify.com/projects/inseme/deploys)

---

## 🏛️ Qu'est-ce que Inseme ?

Inseme permet aux participants distants de :
- **Visioconférence Low-Latency** : Intégration native de Jitsi Meet (WebRTC) pour moins de 200ms de latence.
- **Médiation IA (Ophélia)** : Une agente intelligente qui anime, résume et structure les débats.
- **Démocratie Liquide** : Système de délégation de vote (`bye`) et de procuration dynamique.
- **Gestuelle Digitale** : Vote instantané via une gestuelle standardisée (Accord, Désaccord, Besoin d'air, etc.).

---

## 🚀 Technologie (v3 - Modern Stack)

- **Frontend** : [React](https://reactjs.org/) + [Vite](https://vitejs.dev/) + [Tailwind CSS](https://tailwindcss.com/)
- **Backend Realtime** : [Supabase](https://supabase.com/) (PostgreSQL, Realtime, Auth)
- **AI Agent** : OpenAI GPT-4o & TTS-1 orchestrés via **Netlify Edge Functions** (Deno).
- **Media** : [Jitsi Meet SDK](https://jitsi.org/) pour la vidéo temps réel.
- **Stockage SaaS** : Cloudflare R2 (compatible S3) pour l'archivage volumineux, avec fallback Supabase Storage.
- **Documentation** : [Configuration d'Ophélia](./docs/ophelia.md)

---

## ☁️ Déploiement SaaS & Stockage R2

Inseme supporte désormais une architecture SaaS multi-tenant avec stockage hybride :

1. **Dashboard SaaS** : Gérez vos propres assemblées, configurez Ophélia et accédez à vos archives.
2. **Cloudflare R2** : Utilisé pour les enregistrements vocaux et les archives de session. 
   - Configurez `VITE_USE_R2=true` dans votre `.env`.
   - Les fichiers sont automatiquement synchronisés via les Edge Functions Netlify.
3. **Trigger Invité** : Un système robuste de gestion des profils (public.users) gère automatiquement les identités des invités et des IA.

---

## 🤖 Ophélia : L'Agente Médiatrice
Ophélia n'est pas un simple bot, c'est une participante active dotée de la parole :
- **Proactive** : Elle intervient d'elle-même pour synthétiser les échanges.
- **Vocale** : Elle utilise la synthèse vocale pour s'adresser à l'assemblée.
- **Programmable** : Sa personnalité se configure dans `public/prompts/inseme.md`.
- **Agentique** : Elle peut figer des propositions de vote ou gérer la file d'attente.

---

## 🛠️ Installation et Développement

### Prérequis
- Node.js & npm.
- [Netlify CLI](https://docs.netlify.com/cli/get-started/) (`npm install netlify-cli -g`).
- Un projet Supabase configuré.

### Setup
1. Clonez le dépôt.
2. Installez les dépendances : `npm install`
3. Configurez votre `.env` :
   ```env
   VITE_SUPABASE_URL=votre_url
   VITE_SUPABASE_ANON_KEY=votre_cle
   # Optionnel pour le développement local des Edge Functions
   OPENAI_API_KEY=votre_cle_openai
   ```
4. Lancez l'environnement de développement complet (recommandé) :
   ```bash
   netlify dev
   ```
   *L'application sera accessible sur `http://localhost:8888`.*

---

## 📖 Commandes "Inseme"
Pilotez l'assemblée directement depuis le chat :
- `inseme ? [Texte]` : Définit la proposition active (Markdown supporté).
- `inseme !` : Réinitialise les votes.
- `inseme live [url]` : Active le flux Jitsi Meet.
- `inseme pad [url]` : Affiche un Etherpad collaboratif.
- `inseme wiki [slug]` : Affiche une page du Wiki LePP.fr.
- `inseme image [url]` : Partage une image ou une illustration.

---

## 📜 Licence & Auteur

Ce projet est sous licence **MIT**. 

**Auteur : Jean Hugues Noël Robert**
- GitHub : [@JeanHuguesRobert](https://github.com/JeanHuguesRobert)
- Projet porté par la communauté [LePP.fr](https://lepp.fr).

---

*Note : La version originale (Firebase/Materialize) est archivée dans le dossier `/archive`.*
