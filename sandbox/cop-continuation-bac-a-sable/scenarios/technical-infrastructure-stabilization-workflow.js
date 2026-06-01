/**
 * Scénario : technical-infrastructure-stabilization-workflow
 *
 * Nouveau workflow pour élargir le corpus.
 *
 * Thème central : Développement et surtout **stabilisation à long terme** d'une infrastructure technique territoriale.
 *
 * Exemple concret inspiré par le travail de l'utilisateur :
 * - Le projet d'abreuvoir pour Rossignol dans le cadre de la République des Anes.
 * - Plus largement : toute infrastructure physique (point d'eau, énergie, habitat, chemin, etc.) qui doit durer des décennies dans un contexte territorial fragile.
 *
 * Concept clé : l'**effet Ubik** (d'après Philip K. Dick)
 * - Tendance naturelle des systèmes (techniques, sociaux, cognitifs, organisationnels) à se dégrader, à régresser vers des états antérieurs, à perdre leur cohérence et leur fonction anti-capture au fil du temps.
 * - Sans mécanismes actifs de stabilisation, toute infrastructure finit par "ubikiser" : se déliter, être capturée, devenir inutile ou contre-productive.
 *
 * Ce workflow modélise :
 * - La phase de conception et construction.
 * - Surtout la couche de **stabilisation** : protocoles de maintenance, gouvernance, surveillance, résilience face à la dégradation (physique, sociale, cognitive, financière, climatique).
 * - La place du hasard et de la sérendipité dans la découverte de modes de stabilisation.
 * - La boucle théorie (modèle abstrait des "Stabilisateurs") ↔ pratique (ce qui marche vraiment sur le terrain avec Rossignol et les ânes).
 * - La nécessité d'une traçabilité forte ("ne rien oublier" des décisions, observations, interventions) pour un chercheur/acteur seul ou en petit collectif sur le long terme.
 *
 * Isomorphie avec COP particulièrement intéressante ici :
 * - L'infrastructure physique = un "Topic" matériel qui doit rester fonctionnel sur des décennies.
 * - Les différents régimes de maintenance (quotidien, saisonnier, décennal, exceptionnel) = Continuations avec des conditions de reprise très différentes.
 * - Les signaux de dégradation (fuite, érosion, changement de comportement des animaux, abandon par les humains) = Événements qui doivent réveiller les bonnes continuations.
 * - Le "Scheduler" = le dispositif (humain + protocoles + artefacts) qui rappelle au bon moment les actions de stabilisation.
 * - Les "Stabilisateurs" = à la fois des objets techniques, des règles sociales, et des artefacts cognitifs (mémoire, savoir-faire transmis).
 *
 * Ce scénario complète bien les précédents en apportant :
 * - Le versant "infrastructure technique matérielle" (pas seulement cognitive ou décisionnelle).
 * - La problématique explicite de la **durabilité anti-entropique** sur très long terme.
 * - Le rôle des "stabilisateurs" comme concept transversal (technique + social + cognitif).
 */

export default {
  name: "technical-infrastructure-stabilization-workflow",
  description:
    "Conception, construction et surtout stabilisation à très long terme d'une infrastructure technique territoriale (ex: abreuvoir pour Rossignol / République des Anes). Focus sur les mécanismes anti-Ubik (dégradation).",

  steps: [
    {
      name: "identify-need-and-open-infrastructure-project",
      description:
        "Détection du besoin et ouverture du projet d'infrastructure (ex: point d'eau pour les ânes).",
      async run(ctx) {
        ctx.emit({
          type: "infrastructure.need.identified",
          data: {
            project: "Abreuvoir Rossignol - République des Anes",
            context:
              "Territoire fragile, besoin en eau pour les animaux, enjeu de présence et de souveraineté sur le lieu",
            initialTension:
              "Comment créer un point d'eau qui reste fonctionnel et pertinent pendant des décennies sans se dégrader ni être capturé ?",
          },
        });

        const design = await ctx.callWithContinuation({
          from: "researcher-conceptor",
          to: "local-knowledge + technical-design",
          intent: "design-durable-water-point",
          payload: {
            constraints: [
              "faible entretien",
              "résilience climatique",
              "intégration paysagère",
              "valeur symbolique et cognitive",
            ],
            antiUbikObjective:
              "Concevoir dès le départ les mécanismes qui empêcheront la dégradation et la perte de sens",
          },
          resumeTo: "researcher-conceptor",
          resumeIntent: "validate-design-with-territory",
          taskId: "abreuvoir-rossignol-001",
          stepId: "step-design",
          waitForEvents: ["local-feedback.received", "material-opportunity.appeared"],
        });
        ctx.scheduler.register(design.continuation);
        ctx.currentInfrastructure = { taskId: "abreuvoir-rossignol-001" };
      },
    },

    {
      name: "construction-and-initial-stabilizer-design",
      description:
        "Construction physique + conception simultanée des premiers 'Stabilisateurs' (techniques, sociaux, cognitifs).",
      async run(ctx) {
        ctx.emit({
          type: "infrastructure.built",
          data: {
            artifact: "Abreuvoir Rossignol",
            stabilizersDesigned: [
              "Choix de matériaux locaux et réparables",
              "Règle sociale : qui s'engage à venir vérifier l'état régulièrement ?",
              "Artefact cognitif : journal d'observation de l'abreuvoir (première trace)",
            ],
          },
        });

        // Création de plusieurs continuations de stabilisation avec des rythmes différents
        const dailyCheck = await ctx.callWithContinuation({
          from: "researcher-conceptor",
          to: "local-caretakers",
          intent: "daily-presence-and-observation",
          resumeTo: "researcher-conceptor",
          resumeIntent: "integrate-daily-signals",
          taskId: ctx.currentInfrastructure.taskId,
          stepId: "stabilizer-daily",
          waitForEvents: ["daily-observation.reported", "anomaly.detected"],
        });
        ctx.scheduler.register(dailyCheck.continuation);

        const seasonalMaintenance = await ctx.callWithContinuation({
          from: "researcher-conceptor",
          to: "technical-self + local-helpers",
          intent: "seasonal-deep-maintenance",
          resumeTo: "researcher-conceptor",
          resumeIntent: "perform-seasonal-stabilization",
          taskId: ctx.currentInfrastructure.taskId,
          stepId: "stabilizer-seasonal",
          resumeAfter: new Date(Date.now() + 1000 * 20).toISOString(), // rythme saisonnier
        });
        ctx.scheduler.register(seasonalMaintenance.continuation);
      },
    },

    {
      name: "first-degradation-signals-and-serendipity",
      description:
        "Apparition des premiers signes de l'effet Ubik + découverte par hasard d'un mode de stabilisation ancien ou inattendu.",
      async run(ctx) {
        await ctx.bus.publish({
          type: "degradation.signal.detected",
          data: {
            signal:
              "Fuite progressive + les ânes commencent à venir moins souvent (comportement changeant)",
            ubikEffect:
              "L'infrastructure commence déjà à perdre de son efficacité et de son attractivité",
          },
        });

        // Sérendipité : rencontre ou découverte qui apporte une solution
        await ctx.bus.publish({
          type: "serendipitous.stabilizer.discovered",
          data: {
            source:
              "Conversation avec un vieux berger ou lecture d'une technique ancienne d'entretien des points d'eau",
            stabilizer:
              "Pratique rituelle de 'nettoyage symbolique' combinée à un geste technique simple qui maintient à la fois la fonction et le sens",
            effect:
              "Cette pratique agit comme un stabilisateur social + cognitif en plus du technique",
          },
        });

        // Nouvelle continuation pour intégrer ce stabilisateur "sauvage"
        const wildStabilizer = await ctx.callWithContinuation({
          from: "researcher-conceptor",
          to: "self + local-actors",
          intent: "integrate-serendipitous-stabilizer",
          payload: { discoveredPractice: "nettoyage rituel + technique ancien" },
          resumeTo: "researcher-conceptor",
          resumeIntent: "formalize-and-test-hybrid-stabilizer",
          taskId: ctx.currentInfrastructure.taskId,
          stepId: "stabilizer-serendipity-integration",
        });
        ctx.scheduler.register(wildStabilizer.continuation);
      },
    },

    {
      name: "design-of-systemic-stabilizers",
      description:
        "Passage à une conception explicite et systémique des Stabilisateurs (technique + social + cognitif + financier). Boucle théorie (modèle abstrait des stabilisateurs face à l'Ubik) ↔ pratique (ce qui marche vraiment avec Rossignol).",
      async run(ctx) {
        ctx.emit({
          type: "stabilizers.system.designed",
          data: {
            layers: [
              "Technique : matériaux, forme, redondance",
              "Social : qui fait quoi, transmission intergénérationnelle, rituels collectifs",
              "Cognitif : journal d'observation, mémoire des dégradations passées, 'récit de l'abreuvoir'",
              "Économique : micro-fonds de maintenance, engagement léger mais durable",
            ],
            antiUbikPrinciple:
              "Chaque couche doit contenir des mécanismes qui ralentissent ou inversent la tendance à la dégradation et à la perte de sens",
          },
        });

        // Création d'une continuation de gouvernance / transmission sur très long terme
        const governance = await ctx.callWithContinuation({
          from: "researcher-conceptor",
          to: "future-local-collectif",
          intent: "transmit-and-adapt-stabilization-system",
          payload: {
            livingDocument: "Manuel vivant des Stabilisateurs de l'abreuvoir Rossignol",
            frequency: "Revue collective une fois par an minimum",
          },
          resumeTo: "researcher-conceptor",
          resumeIntent: "major-adaptation-or-transmission",
          taskId: ctx.currentInfrastructure.taskId,
          stepId: "stabilizer-governance",
          resumeAfter: new Date(Date.now() + 1000 * 25).toISOString(),
        });
        ctx.scheduler.register(governance.continuation);
      },
    },

    {
      name: "long-term-stabilization-orbit",
      description:
        "L'infrastructure entre dans son régime de vie longue. Le dispositif de stabilisation (le 'système anti-Ubik') devient lui-même un objet qui doit être maintenu et amélioré continuellement.",
      async run(ctx) {
        ctx.emit({
          type: "infrastructure.entered-long-term-stabilization",
          data: {
            status:
              "L'abreuvoir Rossignol existe physiquement. La vraie question sur 20-50 ans n'est plus sa construction, mais la vitalité de ses Stabilisateurs.",
            openQuestion:
              "Comment faire vivre les Stabilisateurs quand les personnes changent, que le climat évolue, et que le 'hasard' continue d'agir (positivement ou négativement) ?",
          },
        });

        // Continuation ultime : le méta-stabilisateur (le système qui maintient les stabilisateurs eux-mêmes)
        const metaStabilizer = await ctx.callWithContinuation({
          from: "researcher-conceptor",
          to: "future-self + future-collectif",
          intent: "maintain-the-stabilizers-themselves",
          payload: {
            corePrinciple:
              "Tout système de stabilisation finit par avoir besoin d'être stabilisé à son tour",
            memoryRequirement:
              "Conserver la trace de ce qui a marché, de ce qui a échoué, et des sérendipités qui ont sauvé le projet",
          },
          resumeTo: "researcher-conceptor",
          resumeIntent: "recalibrate-stabilization-system",
          taskId: ctx.currentInfrastructure.taskId,
          stepId: "meta-stabilizer",
          resumeAfter: new Date(Date.now() + 1000 * 40).toISOString(),
        });

        ctx.scheduler.register(metaStabilizer.continuation);
      },
    },
  ],
};
