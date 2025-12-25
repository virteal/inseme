# Inseme Monorepo

Ce dépôt regroupe les différentes applications et packages du projet Inseme et de la Plateforme Citoyenne.

## Structure

- `apps/inseme` : L'application principale Inseme (React 18, Vite 5).
- `apps/platform` : La Plateforme Citoyenne (anciennement Survey, React 19, Vite 7).
- `apps/platform/packages/*` : Packages partagés et utilitaires de la plateforme.

## Développement

Pour lancer les applications en mode développement :

```bash
# Inseme
npm run inseme:dev

# Plateforme Citoyenne
npm run platform:dev
```

## Déploiement

Chaque application peut être déployée indépendamment sur Netlify.
Dans la configuration Netlify :
- **Application Inseme** : Base directory = `apps/inseme`
- **Plateforme Citoyenne** : Base directory = `apps/platform`
