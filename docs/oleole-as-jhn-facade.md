# Olé Olé = façade d’Agent JHN

Status: architectural decision (2026-08-12) Issue:
[#42](https://github.com/JeanHuguesRobert/inseme/issues/42)

## Doctrine

Olé Olé **n’est pas** un second agent ni un second Twin. C’est une **façade de service** du même
Agent John / Twin JHN :

```text
twin:jhn  /  agent:jhn (John)
        │
        ├── façade personnelle     jhn.baronsmariani.org
        └── façade Presence Olé Olé
                ├── oleole.acorsica.org              ← CANONIQUE (public + éditeur)
                └── oleole.jhn.baronsmariani.org     ← même code (facette Twin)
```

| Host                               | Rôle                                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------- |
| **`oleole.acorsica.org`**          | **Site public canonique.** Éditeur au sens légal : **Association C.O.R.S.I.C.A.**  |
| **`oleole.jhn.baronsmariani.org`** | **Même artefact / même service**, présenté dans l’arbre DNS du Twin JHN (facette). |
| `jhn.baronsmariani.org`            | Landing Twin + `/john` (pas la carte Olé par défaut).                              |
| `/?facade=oleole` ou `/oleole`     | Smoke / dev sans DNS.                                                              |

- Agent conversationnel : **John** uniquement.
- Mémoire / claims de service : scope `service:oleole` (ne pas fusionner silencieusement avec la
  mémoire personnelle du Twin).
- Les deux hôtes Olé **atterrissent sur le même code** (`OleoleHome` / brique-oleole) via
  `classifyOleoleHost` / `isOleoleFacade`.

## Éditeur vs hébergeur technique

| Notion                        | Qui                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------ |
| **Éditeur** (service Olé Olé) | Association **C.O.R.S.I.C.A.** — identité publique sur **oleole.acorsica.org** |
| **Agent / Twin technique**    | John / `twin:jhn` — opéré dans l’écosystème JHN                                |
| **Hébergement**               | Même projet Netlify que JHN (domain aliases) ; cert LE multi-SAN               |

Le sous-domaine `oleole.jhn.baronsmariani.org` **ne change pas** l’éditeur légal : le footer affiche
explicitement le site public C.O.R.S.I.C.A. lorsqu’on est sur la facette Twin.

## Discrimination dans le code

```text
Host / query
  → classifyOleoleHost()
  → isOleoleFacade() === true
  → HomeRoute / App mount OleoleHome
```

Fichiers : `packages/brique-oleole/src/lib/facade-host.js`, `apps/platform/src/pages/HomeRoute.jsx`.

## Ops Netlify (un site, plusieurs noms)

Site cible : **`jhn-baronsmariani-org`**.

1. Domain management → ajouter **aliases** (ou domaines) :
   - `oleole.acorsica.org` (+ `www` si besoin)
   - `oleole.jhn.baronsmariani.org`
2. DNS :
   - **Gandi `acorsica.org`** : `oleole` → cible Netlify indiquée (souvent CNAME vers
     `jhn-baronsmariani-org.netlify.app`) — **ne pas inventer** le record.
   - **`baronsmariani.org`** : `oleole.jhn` (ou la forme que le DNS exige pour un sous-sous-domaine)
     → **même** cible Netlify.
3. Attendre le certificat LE couvrant les noms (SAN).
4. Redeploy `platform` profil JHN.

Option : redirect 301 de facettes preview (`oleole-acorsica.netlify.app`) vers
`https://oleole.acorsica.org`.

## Smoke

```text
https://oleole.acorsica.org/                 → façade Olé, rôle canonical
https://oleole.jhn.baronsmariani.org/        → même UX, footer « facette Twin »
https://jhn.baronsmariani.org/oleole         → façade sans DNS dédié
https://jhn.baronsmariani.org/?facade=oleole → idem
```

## Relation `apps/oleole`

Shell optionnel. **Source de vérité** : platform + profil JHN + `@inseme/brique-oleole`.
