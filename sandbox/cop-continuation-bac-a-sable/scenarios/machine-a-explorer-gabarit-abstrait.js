/**
 * GABARIT ABSTRAIT — "Machine à explorer"
 *
 * Ce fichier ne décrit pas un scénario concret, mais le **modèle générique / gabarit abstrait**
 * d'une "Machine à explorer" selon la méthode en cours de développement.
 *
 * Objectif de ce gabarit :
 * - Servir de référence commune à partir de laquelle on peut dériver des sous-classes
 *   et des instances concrètes (autorité de régulation, notaire, greffier d'assemblée,
 *   commissaire aux comptes, chercheur solo, projet territorial, processus de soin, etc.).
 * - Permettre de construire progressivement un **écosystème interconnecté et réactif**
 *   de Machines à explorer coopératives.
 * - Rendre visible et opérable la distinction fondamentale avec les "Machines à empêcher".
 *
 * Philosophie générale :
 * Une Machine à explorer n'a pas pour vocation première d'empêcher, de contrôler ou de sanctionner.
 * Sa fonction centrale est d'**augmenter la capacité rationnelle d'un acteur (individuel ou collectif)
 * à explorer certains possibles**, tout en maintenant la cohérence et la durabilité de cette exploration
 * face aux forces d'oubli, de capture, de dégradation et de rigidification (effet Ubik + capture).
 *
 * Elle agit donc simultanément comme :
 * - un moteur d'exploration (génération, suspension, reprise, croisement de possibles)
 * - un système de stabilisation (anti-Ubik, anti-capture, maintien de la mémoire et de la cohérence)
 * - un nœud dans un réseau plus large de machines similaires (interconnexion et coopération)
 *
 * Politique Explorer / Conservator — "Artificial Genius by Disinhibition" :
 * - Le gabarit peut être spécialisé par une séparation explicite entre un **Explorer**, chargé
 *   d'ouvrir et bifurquer des pistes avec une inhibition volontairement réduite, et un
 *   **Conservator**, chargé de la preuve, de la cohérence, de la sélection et de la réintégration.
 * - Cette séparation est une politique cognitive, pas une nouvelle couche normative de COP.
 * - Dans une réalisation COP, une Continuation peut matérialiser le point de retour d'une excursion :
 *   état minimal de reprise + conditions de réveil + lignée causale + capacité de routage.
 * - "Return to Ithaca" désigne le motif de retour/réintégration vers cette continuation d'origine
 *   (ou sa lignée), et non une primitive supplémentaire.
 * - Le backtracking est de même une politique sur les continuations (fork/suspend/resume/obsolete/
 *   cross-pollinate), laissant COP Core neutre quant à la stratégie d'exploration.
 * - Le scénario `solo-creative-researcher-workflow` est le laboratoire concret déjà existant pour
 *   les bifurcations, continuations dormantes, réveils associatifs et continuations hybrides.
 * - L'hypothèse "Artificial Genius by Disinhibition" doit être testée par la fécondité mesurable
 *   des descendants produits ; elle n'est pas présumée vraie par le gabarit.
 *
 * -----------------------------------------------------------------------------
 * INVARIANTS STRUCTURAUX D'UNE MACHINE À EXPLORER (version 0.1 du gabarit)
 * -----------------------------------------------------------------------------
 *
 * 1. **Espace des possibles**
 *    - La machine opère sur un espace de possibles (états futurs, trajectoires, décisions, configurations).
 *    - Cet espace n'est pas figé : il évolue avec les explorations et les découvertes.
 *
 * 2. **Continuations comme unités d'exploration suspendue**
 *    - Les explorations peuvent et doivent être suspendues (pour maturation, attente d'information,
 *      sérendipité, décision d'un autre acteur, etc.).
 *    - Une Continuation est une unité structurée qui contient :
 *        - l'état de l'exploration au moment de la suspension
 *        - les conditions de reprise (événements, temps, décisions, agents)
 *        - les liens avec d'autres continuations (associations, dépendances, bifurcations)
 *
 * 3. **Événements comme signaux et déclencheurs**
 *    - Les événements (planifiés ou imprévus) sont les déclencheurs principaux de reprise,
 *      de bifurcation, ou de création de nouvelles explorations.
 *    - La machine doit être capable de capter non seulement les signaux attendus,
 *      mais aussi les signaux faibles et les sérendipités.
 *
 * 4. **Scheduler comme moteur de décision temporelle et réactive**
 *    - Le Scheduler décide quand réveiller quelles explorations, en fonction :
 *        - de conditions temporelles
 *        - d'événements reçus
 *        - de l'état global de la mémoire
 *        - de priorités stratégiques explicites
 *
 * 5. **Bus comme couche d'interconnexion**
 *    - Le Bus permet à la machine d'échanger des événements avec d'autres machines,
 *      d'autres acteurs, ou avec son environnement.
 *    - C'est le support principal de la coopération entre Machines à explorer.
 *
 * 6. **Artifacts comme mémoire durable et Stabilisateurs**
 *    - Les Artifacts (rapports, décisions, protocoles, cartes, traces, etc.) sont les
 *      objets qui survivent aux explorations individuelles.
 *    - Certains Artifacts ont une fonction de Stabilisateur : ils ralentissent ou
 *      inversent les tendances à la dégradation, à l'oubli ou à la capture.
 *
 * 7. **Boucles d'apprentissage et de capitalisation**
 *    - La machine ne se contente pas d'explorer : elle observe les effets de ses explorations
 *      et de ses Stabilisateurs, et elle modifie sa propre structure (règles, priorités,
 *      dispositifs de capture de sérendipité, etc.).
 *    - Cette méta-exploration (exploration de l'exploration elle-même) est essentielle.
 *
 * 8. **Opposition explicite aux Machines à empêcher**
 *    - Une Machine à explorer doit pouvoir identifier, modéliser et contrer les
 *      mécanismes d'empêchement qui agissent sur son domaine d'exploration.
 *    - Les empêchements typiques incluent : rigidité procédurale, amnésie organisationnelle,
 *      capture par intérêts dominants, sur-contrôle, fragmentation des mémoires, etc.
 *
 * -----------------------------------------------------------------------------
 * MÉCANISMES TRANSVERSAUX À IMPLÉMENTER DANS LES INSTANCES
 * -----------------------------------------------------------------------------
 *
 * - Dispositifs de capture et de valorisation de la sérendipité
 * - Mécanismes de mémoire active (pas seulement archivage passif)
 * - Protocoles d'interconnexion et de coopération avec d'autres machines
 * - Outils de modélisation des empêchements et de leurs contre-mesures
 * - Cycles de revue stratégique des Stabilisateurs eux-mêmes
 * - Interfaces entre exploration rationnelle et action concrète (théorie ↔ pratique)
 *
 * -----------------------------------------------------------------------------
 * RÈGLES MINIMALES DE DÉRIVATION D'UNE INSTANCE CONCRÈTE
 * -----------------------------------------------------------------------------
 *
 * Pour transformer ce gabarit en une instance opérationnelle, il faut au minimum définir :
 *
 * 1. Le **domaine d'exploration** (l'Espace des Possibles spécifique).
 * 2. Les **types de Continuations** pertinents et leurs conditions de reprise typiques.
 * 3. Les **canaux d'Événements** (internes, externes, et dispositifs de capture de sérendipité).
 * 4. Les **Stabilisateurs** caractéristiques du domaine (et les empêchements qu'ils visent).
 * 5. La **mémoire active** : comment on interroge, associe et réactive les traces.
 * 6. Les **interfaces d'interconnexion** avec d'autres machines de l'écosystème.
 * 7. Les **rythmes de méta-exploration** (revue des Stabilisateurs, capitalisation des leçons).
 *
 * -----------------------------------------------------------------------------
 * STATUT
 * -----------------------------------------------------------------------------
 *
 * Ce gabarit est un artefact vivant. Version actuelle : 0.3.
 *
 * -----------------------------------------------------------------------------
 * ARCHITECTURE À PLUSIEURS NIVEAUX (selon Jean Hugues Robert)
 * -----------------------------------------------------------------------------
 *
 * Ce gabarit s'inscrit dans une architecture explicite à plusieurs niveaux :
 *
 * 1. **Niveau le plus général** : La cognition (humaine, mécanique, hybride).
 *    Cadre ontologique et épistémologique fondamental de l'exploration.
 *
 * 2. **Niveau méthodologique** : Méthode générale d'exploration rationnelle des possibles.
 *
 * 3. **Deux grandes déclinaisons opérationnelles** :
 *
 *    a. **Cogentia Commons** (déclinaison "manuelle / légère")
 *       - Conversations avec agents IA
 *       - Copier/coller
 *       - Fichiers Markdown
 *       - Archivage réactif dans GitHub
 *       - Version la plus développée et pratiquée aujourd'hui.
 *
 *    b. **Fractanet / FractaVolta** (déclinaison "automatique / lourde")
 *       - Cœur technique : le protocole COP (Cognitive Orchestration Protocol)
 *       - Coordination d'agents et d'outils
 *       - Interaction possible avec des humains via diverses interfaces
 *       - Réseau multi-niveaux / multi-substrats
 *       - Au centre de l'offre de la "startup à impact" FractaVolta.
 *
 * L'objectif est de faire émerger un écosystème de "Machines à explorer" coopératives
 * capables de neutraliser efficacement les "Machines à empêcher".
 */

export default {
  name: "machine-a-explorer-gabarit-abstrait",
  description:
    "Gabarit abstrait de la 'Machine à explorer' — référence commune pour la conception d'instances concrètes et d'un écosystème coopératif.",

  steps: [
    {
      name: "invariants-structurels",
      description:
        "Rappel des invariants de base d'une Machine à explorer (voir le commentaire en tête de fichier).",
      async run(ctx) {
        ctx.emit({
          type: "gabarit.invariance.declaree",
          data: {
            note: "Ce step est principalement documentaire. Il sert de point d'ancrage conceptuel pour les instances concrètes.",
          },
        });
      },
    },

    {
      name: "identification-des-empêchements-cibles",
      description:
        "Avant de concevoir les Stabilisateurs et les mécanismes d'exploration, la machine doit explicitement modéliser les 'Machines à empêcher' et les formes d'empêchement qui agissent dans son domaine.",
      async run(ctx) {
        ctx.emit({
          type: "empêchements.cibles.modelises",
          data: {
            question:
              "Quelles sont les forces, logiques, procédures ou structures qui, dans ce domaine, tendent à rigidifier, à faire oublier, à capturer ou à refermer l'espace des possibles ?",
            usage:
              "Cette modélisation doit être maintenue vivante et mise à jour au fil des explorations.",
          },
        });
      },
    },

    {
      name: "conception-des-dispositifs-d-exploration",
      description:
        "Conception des mécanismes de base (continuations, événements, scheduler, bus, artefacts) adaptés au domaine, en s'appuyant sur le gabarit.",
      async run(ctx) {
        // Les instances concrètes implémentent ici leur version spécifique
      },
    },

    {
      name: "mise-en-place-des-mecanismes-anti-empêchement",
      description:
        "Traduction des empêchements identifiés en Stabilisateurs et en dispositifs de contre-empêchement concrets.",
      async run(ctx) {
        // Exemples : clauses anti-capture, mémoire active, protocoles de sérendipité, etc.
      },
    },

    {
      name: "boucles-de-capitalisation-et-de-méta-exploration",
      description:
        "La machine doit s'observer elle-même : comment ses propres Stabilisateurs et ses propres modes d'exploration évoluent-ils ? Quelles nouvelles formes d'empêchement apparaissent à cause de ses propres dispositifs ?",
      async run(ctx) {
        // Concrete support in COP kernel (see artifacts.js + continuation.js + jobScheduler + cogitorCooperation):
        // - lookupReusableArtifact(cacheKey, {minStability: 'stable'}) for capitalizing intermediary results across branches without recompute.
        // - applyRetentionPolicy / runRetentionSweep for GC + legal policies (right to forget, fixed years, until_superseded, legal_hold, forever).
        // - Artifacts carry cache_key + retention_policy + legal_hold + stability_level + derives_from.
        // - Obsolescence (markContinuationObsolete / jobScheduler.markObsolete) for dead-end pruning by AI/human judgment.
        // - Fork/join via cogitorCooperation + stack framing for dynamic tree walk (deep or broad).
        ctx.emit({
          type: "capitalisation.mecanismes.actives",
          data: {
            cache: "lookupReusableArtifact by cacheKey (cross-branch reuse)",
            retention:
              "retentionPolicy + expiresAt + legalHold + sweep (forget vs keep-forever vs superseded)",
            judgment: "agent-decided obsolescence on continuations/jobs for pruning dead ends",
            tree: "forkCogitor / createForkedCogitorContinuation + stack framing for branching paths",
          },
        });
        ctx.emit({
          type: "machine.meta-exploration",
          data: {
            principe:
              "Une Machine à explorer qui ne s'explore pas elle-même finit par se rigidifier ou par devenir un vecteur d'empêchement.",
          },
        });
      },
    },
    {
      name: "arbitrage-et-jugement-par-agents",
      description:
        "Arbitration/judgment (AI or human) to choose paths, prune dead-ends, decide merges, apply retention or obsolescence. Not pure algo — explicit agent decisions published as events/artifacts.",
      async run(ctx) {
        // In practice: agents subscribe to exploration events, emit decisions that call markObsolete, applyRetention, or create new high-priority continuations.
      },
    },

    {
      name: "interconnexion-avec-d-autres-machines",
      description:
        "Conception et mise en œuvre des interfaces de coopération avec d'autres Machines à explorer (échange d'événements, partage de mémoires partielles, délégation de continuations, alerte mutuelle sur des empêchements détectés).",
      async run(ctx) {
        ctx.emit({
          type: "ecosysteme.interconnexion",
          data: {
            objectif:
              "Passer d'une collection de machines isolées à un écosystème réactif et coopératif capable de traiter des empêchements qui dépassent les capacités d'une seule machine.",
          },
        });
      },
    },
  ],
};
