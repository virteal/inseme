# Hugging Face Space Ophélia – Documentation rapide

## Objectif

Proposer une démo publique, interactive et sans compte d’Ophélia via Hugging Face Space (Gradio).

## Structure prévue

- Dépôt Space HF (ex : `pertitellu/ophelia-space`)
- Interface Gradio (Python) : textbox, historique, branding
- Appels HTTP à l’API REST centrale (pas de logique métier dans le Space)
- README détaillé (fonctionnement, limites, licence)
- Assets (avatar, screenshots)

## Exemple de flux

1. L’utilisateur pose une question dans l’interface Gradio
2. Le Space envoie la requête à `/api/ophelia` (hébergé sur LePP.fr)
3. La réponse est affichée dans l’UI, avec sources et métadonnées

## Points d’attention

- Gérer les timeouts et erreurs API
- Limiter le nombre de requêtes par minute côté Space
- Afficher un lien vers LePP.fr pour la version complète
- Respecter la licence et la charte d’usage

## À venir

- Publication du Space sur Hugging Face
- Tests de robustesse
- Promotion sur les réseaux civic-tech

---

Pour toute question, voir le plan dans `docs/plan-ophelia.md` ou contacter l’équipe.
