/**
 * Scénario : autorite-regulation-suivi-conformite-workflow
 *
 * === PISTE ACTUELLEMENT TRAITÉE "EN PROFONDEUR" ===
 *
 * Thème : Le travail d'une **Autorité de régulation indépendante** conçue explicitement
 * comme une "Machine à explorer" les futurs possibles d'un secteur régulé,
 * tout en fonctionnant comme un Stabilisateur structurel contre l'effet Ubik
 * et contre les différentes formes de capture.
 *
 * Cette autorité ne se réduit pas à une logique de contrôle, de sanction ou de "mise en demeure"
 * (qui relèverait plutôt d'une "Machine à empêcher").
 *
 * Elle fonctionne selon une logique d'exploration rationnelle et systématique :
 *   - Quelles sont les trajectoires probables du secteur dans 5, 10, 20 ans selon les décisions
 *     que nous prenons aujourd'hui (octroi, conditions, refus) ?
 *   - Quels Stabilisateurs (règles, incitations, dispositifs de transparence, mécanismes de
 *     réversibilité, clauses anti-capture, audits, etc.) permettent d'orienter ces trajectoires
 *     vers des biens communs plutôt que vers la concentration de pouvoir ?
 *   - Quels signaux faibles et quelles sérendipités révèlent que les Stabilisateurs actuels
 *     deviennent obsolètes, pervers, ou contournés ?
 *   - Comment capitaliser et rendre vivante la mémoire des décisions passées (ce qui a marché,
 *     ce qui a produit des effets pervers, ce qui a été capturé) afin que l'autorité elle-même
 *     ne devienne pas un vecteur d'oubli ou de capture ?
 *
 * Ce scénario est l'un des principaux lieux où nous creusons actuellement la distinction
 * entre "Machine à explorer" et "Machine à empêcher".
 */

export default {
  name: "autorite-regulation-suivi-conformite-workflow",
  description:
    "Fonction de régulation indépendante comme 'Machine à explorer' : octroi d'autorisations lourdes, suivi continu, détection de signaux faibles, ajustement des Stabilisateurs, et capitalisation de la mémoire réglementaire sur plusieurs décennies.",

  steps: [
    {
      name: "demande-autorisation-strategique-et-evaluation-des-futurs",
      description:
        "Un acteur important demande (ou renouvelle) une autorisation lourde. L'autorité ne se contente pas d'instruire le passé : elle lance une exploration des futurs possibles du secteur si cette autorisation est accordée ou refusée.",
      async run(ctx) {
        ctx.emit({
          type: "autorite.demande.strategique.recue",
          data: {
            operateur: "Acteur dominant ou émergent du secteur",
            typeAutorisation:
              "Concession longue durée / Licence structurante / Accès à une infrastructure critique",
            horizon: "15-30 ans",
          },
        });

        ctx.emit({
          type: "autorite.exploration.futurs.lancee",
          data: {
            methode:
              "Scénarios + analyse des risques de capture + évaluation des Stabilisateurs existants",
            questions: [
              "Si on accorde cette autorisation sans nouvelles clauses anti-capture, quel scénario de concentration ou de rente est le plus probable dans 10 ans ?",
              "Quels signaux faibles actuels indiquent que les Stabilisateurs actuels sont en train de se fragiliser ?",
              "Quelles nouvelles formes de capture (technologiques, informationnelles, relationnelles) apparaissent ?",
            ],
          },
        });

        const instructionApprofondie = await ctx.callWithContinuation({
          from: "autorite",
          to: "operateur + experts + consultation large + modelisation",
          intent: "instruction-approfondie-avec-exploration-futurs",
          resumeTo: "autorite",
          resumeIntent: "deliberer-sur-les-stabilisateurs-a-mettre-en-place",
          taskId: "autorisation-strategique-2026-001",
          stepId: "instruction-futurs",
        });
        ctx.scheduler.register(instructionApprofondie.continuation);
      },
    },

    {
      name: "octroi-avec-conception-explicite-des-stabilisateurs",
      description:
        "L'autorité n'accorde pas seulement une autorisation : elle conçoit et impose un paquet de Stabilisateurs adaptés aux risques de capture identifiés. C'est le cœur de la 'Machine à explorer'.",
      async run(ctx) {
        ctx.emit({
          type: "autorite.stabilisateurs.concus",
          data: {
            stabilisateurs: [
              "Obligations de transparence structurelle (pas seulement reporting)",
              "Mécanismes automatiques de renégociation en cas de concentration excessive",
              "Clauses de réversibilité et de portabilité des données/infrastructures",
              "Dispositif d'alerte interne protégé pour les lanceurs d'alerte",
              "Audit indépendant périodique avec publication des résultats bruts",
              "Mécanisme de plafonnement des rentes excessives avec réinvestissement obligatoire",
            ],
            philosophie:
              "Chaque Stabilisateur est conçu comme une hypothèse testable : 'Si nous mettons ce mécanisme, quel scénario de capture est-il censé rendre moins probable ?'",
          },
        });

        const suiviRenforce = await ctx.callWithContinuation({
          from: "autorite",
          to: "operateur",
          intent: "suivi-renforce-avec-mecanismes-d-experimentation",
          payload: {
            rythme:
              "reporting annuel + revue stratégique tous les 5 ans + déclenchement sur signaux faibles",
            experimentation:
              "certains Stabilisateurs sont mis en place à titre expérimental avec clause de rendez-vous",
          },
          resumeTo: "autorite",
          resumeIntent: "premiere-revue-strategique",
          taskId: "autorisation-strategique-2026-001",
          stepId: "suivi-structure",
          resumeAfter: new Date(Date.now() + 1000 * 60).toISOString(), // 5 ans en mode démo
        });
        ctx.scheduler.register(suiviRenforce.continuation);
      },
    },

    {
      name: "surveillance-continue-et-capture-des-signaux-faibles",
      description:
        "L'autorité ne se contente pas des reporting officiels. Elle maintient une capacité à capter les signaux faibles et les sérendipités (plaintes d'usagers, lanceurs d'alerte, évolutions technologiques, concentration via des opérations apparemment anodines, etc.).",
      async run(ctx) {
        await ctx.bus.publish({
          type: "signal.faible.detecte",
          data: {
            source: "Plainte d'usagers + données ouvertes + observation d'un consultant externe",
            nature:
              "L'opérateur est en train de verrouiller subtilement l'accès à une infrastructure critique via des pratiques contractuelles",
            urgence: "moyenne mais structurelle",
          },
        });

        // L'autorité déclenche une investigation plus profonde (nouvelle continuation)
        const investigationApprofondie = await ctx.callWithContinuation({
          from: "autorite",
          to: "equipe-specialisee + experts",
          intent: "investigation-sur-pratiques-anticoncurrentielles-structurelles",
          resumeTo: "autorite",
          resumeIntent: "decider-mesures-correctrices-ou-evolution-du-cadre",
          taskId: "autorisation-strategique-2026-001",
          stepId: "investigation-serendipite",
        });
        ctx.scheduler.register(investigationApprofondie.continuation);
      },
    },

    {
      name: "revue-strategique-periodique-et-ajustement-des-stabilisateurs",
      description:
        "Revue stratégique programmée (tous les 5 ans par exemple). L'autorité évalue collectivement : quels Stabilisateurs ont fonctionné ? Lesquels ont créé des effets pervers ? Quelles nouvelles formes de capture sont apparues ? Faut-il renforcer, alléger, ou inventer de nouveaux Stabilisateurs ?",
      async run(ctx) {
        ctx.emit({
          type: "autorite.revue.strategique",
          data: {
            bilan: "Évaluation systématique des Stabilisateurs mis en place 5 ans plus tôt",
            apprentissages: [
              "Tels mécanismes ont bien limité la rente mais ont ralenti l'investissement",
              "Telle clause anti-capture a été contournée par une innovation contractuelle imprévue",
              "De nouvelles formes de capture informationnelle sont apparues",
            ],
            decision:
              "Ajustement du paquet de Stabilisateurs + évolution possible du cadre réglementaire lui-même",
          },
        });

        // Nouvelle continuation pour le prochain cycle d'exploration
        const prochainCycle = await ctx.callWithContinuation({
          from: "autorite",
          to: "operateur + parties-prenantes + recherche",
          intent: "nouveau-cycle-d-exploration-des-futurs",
          resumeTo: "autorite",
          resumeIntent: "prochain-octroi-ou-ajustement-majeur",
          taskId: "autorisation-strategique-2026-001",
          stepId: "prochain-cycle",
          resumeAfter: new Date(Date.now() + 1000 * 60).toISOString(),
        });
        ctx.scheduler.register(prochainCycle.continuation);
      },
    },

    {
      name: "renouvellement-ou-retrait-avec-capitalisation",
      description:
        "À l'échéance de l'autorisation, l'autorité ne se contente pas de dire 'oui' ou 'non'. Elle produit une capitalisation structurée des enseignements des 15-20 dernières années, qui servira pour les prochaines décisions et pour la mémoire collective du secteur.",
      async run(ctx) {
        ctx.emit({
          type: "autorite.capitalisation",
          data: {
            document:
              "Rapport de capitalisation 'Ce que 20 ans de régulation de ce secteur nous ont appris sur les formes de capture et les Stabilisateurs efficaces'",
            usage:
              "Référence pour les futures attributions, pour l'évolution de la doctrine de l'autorité, et pour la recherche sur la régulation",
          },
        });
      },
    },

    {
      name: "memoire-reglementaire-comme-infrastructure-cognitive",
      description:
        "L'autorité traite explicitement sa propre mémoire réglementaire comme une infrastructure cognitive critique (anti-Ubik du régulateur lui-même). Elle met en place des dispositifs pour que les leçons ne soient pas perdues quand les équipes tournent.",
      async run(ctx) {
        const memoireVive = await ctx.callWithContinuation({
          from: "autorite",
          to: "future-equipe + chercheurs + societe-civile",
          intent: "maintenir-memoire-vive-des-stabilisateurs",
          payload: {
            dispositifs: [
              "Base de données structurée des décisions et de leurs effets observés",
              "Récits de cas emblématiques (succès et échecs)",
              "Protocoles de transmission lors des rotations d'équipes",
              "Ouverture contrôlée aux chercheurs pour analyse externe",
            ],
            philosophie:
              "Une autorité de régulation qui oublie ses propres apprentissages devient elle-même un vecteur de capture ou d'inefficacité systémique.",
          },
          resumeTo: "autorite",
          resumeIntent: "revisiter-memoire-lors-de-nouvelles-crises-ou-nouveaux-dossiers",
          taskId: "autorisation-strategique-2026-001",
          stepId: "memoire-reglementaire",
          resumeAfter: new Date(Date.now() + 1000 * 80).toISOString(),
        });

        ctx.scheduler.register(memoireVive.continuation);

        ctx.emit({
          type: "autorite.machine.explorer",
          data: {
            statut:
              "L'autorité a explicitement organisé sa capacité à explorer les futurs, à tester des Stabilisateurs, à apprendre des accidents et des sérendipités, et à ne pas oublier ses propres leçons. C'est une 'Machine à explorer' en action.",
          },
        });
      },
    },
  ],
};
