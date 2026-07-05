# @inseme/cop-host

Cœur de l'infrastructure d'hébergement et de runtime pour l'écosystème Inseme.

## Fonctionnalités Clés

- **Gestion de Configuration Multi-Instance** : Chargement dynamique des paramètres depuis Supabase
  avec cache global.
- **Résolution d'Instance** : Middleware pour Edge Functions permettant de router les requêtes vers
  la bonne base de données selon le sous-domaine.
- **Moteur de Template** : Substitution de variables style Mustache (`{{ VAR }}`) dans le HTML et le
  Markdown.
- **Composants Partagés** : Boutons de partage, sections de commentaires, et utilitaires UI.
- **Tunnel réutilisable** : runtime de tunnel Cloudflare/Ngrok utilisable par Inseme ou par un
  projet externe en mode standalone.

## Documentation

- [Architecture Multi-Instance](docs/MULTI_INSTANCE.md)
- [Liste des tâches restantes (TODO)](docs/TODO.md)

## Tunnel Runtime

Le runtime de tunnel est exporté par `@inseme/cop-host/tunnel`. Dans Inseme, le point d'entrée
historique `apps/platform/scripts/tunnel.js` reste un wrapper compatible qui injecte la
configuration Supabase/Vault. Pour un autre projet, utiliser le mode standalone avec un fichier
`.env` explicite :

```bash
node apps/platform/scripts/tunnel.js --standalone --env-file path/to/.env --port 8080
```

L'inspecteur est local par défaut. L'exposition publique de l'inspecteur exige `--public-inspector`
et un token explicite ; le terminal inspecteur reste désactivé sauf avec `--terminal`.

## Structure

- `src/config/` : Logique de configuration (Core, Edge, Backend, Client).
- `src/runtime/` : Helpers pour les différents environnements d'exécution (Edge, Functions, Public
  Storage).
- `src/lib/` : Utilitaires partagés (Template, Metadata, Permissions).
