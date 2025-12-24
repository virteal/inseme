# Ophélia API REST – Documentation rapide

## Endpoint

    POST /api/ophelia
    (Netlify Function: `netlify/functions/ophelia-api.js`)

## Authentification

- Header obligatoire : `x-api-key: <clé>`
- Clé de démo par défaut : `dev-demo-key` (à changer en production)

## Payload (JSON)

```
{
  "question": "<texte de la question>",
  "conversation_history": [ ... ], // optionnel
  "provider": "...",              // optionnel
  "model": "...",                 // optionnel
  "modelMode": "..."              // optionnel
}
```

## Exemple CURL

```
curl -X POST https://<votre-domaine>/api/ophelia \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-demo-key" \
  -d '{"question": "Quelle est la capitale de la Corse ?"}'
```

## Réponse (JSON)

```
{
  "success": true,
  "answer": "La capitale de la Corse est Ajaccio.",
  "metadata": {
    "provider": "...",
    "model": "...",
    "responseTime": 123,
    "timestamp": "2025-11-20T12:34:56.789Z"
  },
  "sources": [ ... ]
}
```

## Erreurs possibles

- 401 Unauthorized : clé API manquante ou invalide
- 400 Bad Request : question manquante ou JSON invalide
- 500 Internal Server Error : erreur interne

## À venir

- Rate limiting (limite par IP/clé)
- Logs d’usage
- Documentation OpenAPI/Swagger

---

Pour toute question, voir le plan dans `docs/plan-ophelia.md` ou contacter l’équipe.
