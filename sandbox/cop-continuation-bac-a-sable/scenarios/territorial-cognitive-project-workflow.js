/**
 * Scénario : territorial-cognitive-project-workflow
 *
 * Nouveau workflow pour élargir le corpus avant systématisation.
 *
 * Thème : Développement d'un projet territorial long terme combinant :
 * - Recherche / élaboration conceptuelle
 * - Action locale et territoriale (énergie, habitat, gouvernance)
 * - Rencontres humaines, événements imprévus, sérendipité
 * - Production d'artefacts concrets (protocoles, structures, documents)
 *
 * Ce type de workflow est très différent du "chercheur seul à son bureau" :
 * - Il est multi-échelle (individu ↔ territoire ↔ institutions)
 * - Il implique beaucoup d'acteurs humains (pas seulement "parts de soi")
 * - La sérendipité vient souvent de rencontres physiques, opportunités territoriales, crises locales
 * - La traçabilité est critique car le projet dure des années et implique des gens différents
 * - Besoin permanent de passer de la théorie (modèles de souveraineté) à la pratique (construire quelque chose de réel)
 *
 * Isomorphie avec COP (intéressante pour future généralisation) :
 * - Le "projet territorial" = un Topic de très longue durée
 * - Les différentes phases / chantiers = Tasks
 * - Les points de blocage, attente de financement, de décision politique, de maturation locale = Continuations
 * - Les rencontres, crises, nouveaux partenaires = Événements qui réveillent ou créent des continuations
 * - Le chercheur/acteur doit jouer à la fois le rôle de Scheduler (prioriser les réveils) et de Bus (faire circuler l'information)
 *
 * Ce scénario ajoute de la variété au bac à sable :
 * - Interactions avec acteurs externes (pas seulement "self")
 * - Plus grande place au hasard territorial
 * - Tension forte entre vision de long terme et opportunités du moment
 */

export default {
  name: "territorial-cognitive-project-workflow",
  description:
    "Développement d'un projet territorial long terme (recherche + action locale + gouvernance + énergie). Beaucoup de rencontres humaines et de sérendipité territoriale.",

  steps: [
    {
      name: "open-territorial-possibility",
      description:
        "Ouverture d'un projet territorial qui mêle recherche conceptuelle et action concrète sur un lieu.",
      async run(ctx) {
        ctx.emit({
          type: "territorial.project.opened",
          data: {
            scale: "local + research",
            theme: "Souveraineté énergétique + cognitive sur un petit territoire",
            location: "ex: village ou micro-territoire en Corse ou ailleurs",
            initialVision:
              "Créer un lieu qui soit à la fois laboratoire vivant et démonstrateur de nouvelles formes de souveraineté",
          },
        });

        // Première continuation : phase d'exploration du terrain + rencontres humaines
        const exploration = await ctx.callWithContinuation({
          from: "researcher-actor",
          to: "local-actors + terrain",
          intent: "map-existing-forces-and-desires",
          payload: { focus: "qui est déjà là ? quelles énergies, compétences, volontés ?" },
          resumeTo: "researcher-actor",
          resumeIntent: "first-synthesis-with-local-realities",
          taskId: "territorial-sovereignty-001",
          stepId: "step-0-terrain-exploration",
          waitForEvents: ["local-actor.met", "unexpected-opportunity.appeared"],
        });

        ctx.scheduler.register(exploration.continuation);
        ctx.currentProject = { taskId: "territorial-sovereignty-001" };
      },
    },

    {
      name: "serendipitous-local-encounter",
      description:
        "Le hasard territorial : rencontre avec une personne ou un lieu qui change la donne (très fréquent dans les vrais projets territoriaux).",
      async run(ctx) {
        await ctx.bus.publish({
          type: "unexpected.local.encounter",
          data: {
            person:
              "Un agriculteur / artisan / habitant qui parle d'un vieux réseau d'irrigation ou d'une ancienne pratique de solidarité",
            resonance:
              "Cette pratique locale ancienne fait écho à des idées théoriques sur les 'réseaux de paquets' et la résilience distribuée",
            effect:
              "Le projet bascule partiellement : on ne part plus seulement d'un modèle abstrait, mais on 'recolle' à quelque chose qui existe déjà localement",
          },
        });

        // Cette rencontre crée une nouvelle continuation hybride recherche + action locale
        const hybrid = await ctx.callWithContinuation({
          from: "researcher-actor",
          to: "local-knowledge-holders + conceptual-work",
          intent: "hybridize-local-practice-with-cognitive-model",
          payload: {
            oldLocalPractice: "réseau d'entraide / irrigation ancienne",
            theoreticalFrame: "packet-based sovereignty",
          },
          resumeTo: "researcher-actor",
          resumeIntent: "co-design-first-prototype",
          taskId: ctx.currentProject.taskId,
          stepId: "serendipity-integration",
        });
        ctx.scheduler.register(hybrid.continuation);
      },
    },

    {
      name: "long-horizon-vision-meets-short-term-opportunity",
      description:
        "Tension classique des projets territoriaux : vision à 10-20 ans vs opportunité concrète qui arrive maintenant (subvention, terrain disponible, crise locale).",
      async run(ctx) {
        ctx.emit({
          type: "project.tension.long-vs-short",
          data: {
            longVision:
              "Construire une souveraineté cognitive + énergétique structurelle et reproductible",
            shortOpportunity:
              "Un bâtiment / un terrain devient disponible dans les 6 prochains mois",
            risk: "Saisir l'opportunité trop vite peut déformer ou affaiblir la vision de long terme",
          },
        });

        // Deux continuations en parallèle : une sur la vision de long terme, une sur la réponse rapide à l'opportunité
        const longTerm = await ctx.callWithContinuation({
          from: "researcher-actor",
          to: "self + conceptual-allies",
          intent: "protect-long-term-vision",
          resumeTo: "researcher-actor",
          resumeIntent: "evaluate-opportunity-against-vision",
          taskId: ctx.currentProject.taskId,
          stepId: "long-term-protection",
          resumeAfter: new Date(Date.now() + 1000 * 8).toISOString(),
        });
        ctx.scheduler.register(longTerm.continuation);

        const shortTerm = await ctx.callWithContinuation({
          from: "researcher-actor",
          to: "local-partners + administration",
          intent: "assess-feasibility-of-opportunity",
          resumeTo: "researcher-actor",
          resumeIntent: "decide-go-or-no-go",
          taskId: ctx.currentProject.taskId,
          stepId: "short-term-assessment",
          waitForEvents: ["feasibility.report.available", "political-signal.received"],
        });
        ctx.scheduler.register(shortTerm.continuation);
      },
    },

    {
      name: "decision-and-new-artifact",
      description:
        "Décision prise (ou non) et production d'un artefact concret (lettre d'intention, protocole, demande de subvention, etc.).",
      async run(ctx) {
        ctx.emit({
          type: "project.decision.made",
          data: {
            choice: "On saisit l'opportunité, mais en la cadrant fortement avec la vision longue",
            artifact:
              "Protocole d'intention + cahier des charges qui lie l'opération courte à la vision de souveraineté cognitive",
          },
        });
      },
    },

    {
      name: "long-term-orbit-with-territorial-memory",
      description:
        "Le projet entre dans une phase longue avec nécessité de garder trace de tout (rencontres, décisions, concepts, échecs) pour les acteurs futurs et pour soi dans 5-10 ans.",
      async run(ctx) {
        const longOrbit = await ctx.callWithContinuation({
          from: "researcher-actor",
          to: "future-collectif + future-self",
          intent: "maintain-coherence-over-years",
          payload: {
            memoryNeeds:
              "Toutes les rencontres, les intuitions, les erreurs, les promesses faites aux gens du territoire doivent rester vivantes et retrouvables",
            serendipityInstruction:
              "Continuer à laisser de la porosité pour que le hasard territorial puisse encore intervenir dans les années qui viennent",
          },
          resumeTo: "researcher-actor",
          resumeIntent: "major-recalibration",
          taskId: ctx.currentProject.taskId,
          stepId: "long-term-territorial-orbit",
          resumeAfter: new Date(Date.now() + 1000 * 25).toISOString(),
        });

        ctx.scheduler.register(longOrbit.continuation);

        ctx.emit({
          type: "project.entered-long-term-territorial-orbit",
          data: {
            status:
              "Le projet est maintenant lancé dans le temps long du territoire. Le dispositif de traçabilité et de mémoire (équivalent COP) devient aussi important que l'action elle-même.",
          },
        });
      },
    },
  ],
};
