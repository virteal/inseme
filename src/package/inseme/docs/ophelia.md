# Ophélia v3.0 : Documentation de l'Agente Inseme

Ophélia est une intelligence artificielle agentique intégrée à Inseme pour agir comme médiatrice ("Monsieur Loyal") et participante active lors des assemblées.

## 1. Architecture
Ophélia repose sur une architecture **stateless et événementielle** utilisant les Netlify Edge Functions :
- **Déclenchement** : Elle est "réveillée" par le hook frontend `useInseme` lors d'événements clés (nouveaux messages, minuteurs).
- **Contexte** : À chaque appel, elle reçoit un instantané complet de la salle (historique des messages, proposition actuelle, file d'attente des orateurs).
- **Actions** : Elle utilise le "Tool Calling" d'OpenAI pour agir sur l'état de la salle.

## 2. Configuration de la Personnalité
Vous pouvez modifier son comportement sans toucher au code en éditant le fichier :
`public/prompts/inseme.md`

Ce fichier définit sa mission, son ton et ses priorités (ex: favoriser le consensus, limiter le temps de parole).

## 3. Configuration de la Voix (TTS)
La voix d'Ophélia est définie par le paramètre `VOICE` tout au début du fichier `public/prompts/inseme.md`.

**Exemple :**
```markdown
VOICE: shimmer
# Mission d'Ophélia...
```

**Options disponibles :**
- `nova` : Énergique et professionnelle (Haut-parleur par défaut).
- `shimmer` : Douce et posée.
- `alloy` : Neutre et équilibrée.
- `echo` : Masculine et calme.
- `fable` : Narrative et dynamique.
- `onyx` : Masculine et autoritaire.

## 4. Capacités et Outils
Ophélia dispose d'une palette d'outils pour animer l'assemblée :
- `send_message` : Participer au chat textuel.
- `speak` : Intervenir oralement via synthèse vocale (TTS).
- `set_proposition` : Reformuler et figer une proposition pour le vote suite à un consensus.
- `manage_speech_queue` : Suggérer d'inviter ou de retirer des participants de la file d'attente.
- `cast_vote` : Exprimer son propre avis en tant que membre de l'assemblée.

## 5. Médiation Proactive
Ophélia est configurée pour observer le flux de messages. Par défaut, elle s'auto-saisit du débat environ tous les 10 messages pour :
- Synthétiser les points d'accord/désaccord.
- Rappeler l'ordre des prises de parole.
- Proposer de passer au vote si une proposition claire émerge.

---
*Note technique : Ophélia utilise le modèle `gpt-4o` pour sa réflexion et `tts-1` pour sa voix.*
