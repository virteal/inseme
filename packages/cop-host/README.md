# @inseme/cop-host

Cœur de l'infrastructure d'hébergement et de runtime pour l'écosystème Inseme.

## Fonctionnalités Clés

- **Gestion de Configuration Multi-Instance** : Chargement dynamique des paramètres depuis Supabase avec cache global.
- **Résolution d'Instance** : Middleware pour Edge Functions permettant de router les requêtes vers la bonne base de données selon le sous-domaine.
- **Moteur de Template** : Substitution de variables style Mustache (`{{ VAR }}`) dans le HTML et le Markdown.
- **Composants Partagés** : Boutons de partage, sections de commentaires, et utilitaires UI.

## Documentation

- [Architecture Multi-Instance](docs/MULTI_INSTANCE.md)
- [Liste des tâches restantes (TODO)](docs/TODO.md)

## Structure

- `src/config/` : Logique de configuration (Core, Edge, Backend, Client).
- `src/runtime/` : Helpers pour les différents environnements d'exécution (Edge, Functions, Public Storage).
- `src/lib/` : Utilitaires partagés (Template, Metadata, Permissions).
