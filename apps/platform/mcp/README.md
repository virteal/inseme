// mcp/README.md

# Prototype serveur MCP pour Ophélia

Ce serveur expose les ressources, outils et prompts d’Ophélia selon le Model Context Protocol (MCP),
et permet d’interroger le moteur via `/ask`.

## Lancer le serveur

```
cd mcp
npm install express cors
node server.js
```

## Endpoints MCP

- `GET /resources` : liste des ressources (wiki, Q&A, docs)
- `GET /tools` : liste des outils (search_wiki, web_search…)
- `GET /prompts` : prompts spécialisés
- `POST /ask` : proxy vers le moteur Ophélia (question, options)

## Exemple d’appel

```
curl -X POST http://localhost:3030/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Quelle est la capitale de la Corse ?"}'
```

## À venir

- Mapping dynamique des ressources et outils
- Authentification MCP
- Documentation OpenAPI
- Tests avec Claude Desktop, Continue, Cursor

---

Voir aussi : `docs/MCP-OPHELIA.md`
