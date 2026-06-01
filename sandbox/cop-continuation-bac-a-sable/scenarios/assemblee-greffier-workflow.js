/**
 * Scénario : assemblee-greffier-workflow
 *
 * Nouveau workflow pour élargir le corpus.
 *
 * Rôle central : un agent simple, presque "modeste" — le **Greffier** lors d'une Assemblée.
 *
 * Ce n'est pas le décideur, ni le visionnaire, ni même nécessairement le facilitateur.
 * C'est la personne (ou le rôle) dont la fonction principale est de **faire exister la mémoire collective** de l'assemblée dans le temps.
 *
 * Pourquoi ce rôle est particulièrement intéressant pour COP + Cogentia :
 * - Le Greffier est littéralement un **interface humain avec le protocole** (le "Bus" et le "Store" de l'assemblée).
 * - Son travail consiste à transformer des paroles éphémères en **Événements** traçables.
 * - Il gère les **points en suspens** (Continuations) : décisions reportées, questions à approfondir, suivis à faire.
 * - Il produit des **Artifacts** officiels (procès-verbal, relevé de décisions, archives).
 * - Il lutte directement contre l'**effet Ubik** de l'assemblée : l'oubli, la réinterprétation intéressée, la perte de cohérence des décisions collectives au fil du temps.
 * - Il doit composer avec le **hasard** (interventions inattendues, changements d'humeur, nouveaux éléments qui surgissent) tout en maintenant la trace.
 *
 * Ce scénario modélise le travail du Greffier comme un processus cognitif à part entière, avec ses propres suspensions, associations, et besoins de stabilisation.
 *
 * Isomorphie COP ↔ Cogentia (très claire ici) :
 * - L'Assemblée = un Topic de délibération collective.
 * - Une séance ou un cycle de délibération = un Task.
 * - Les différentes phases (ordre du jour, débats, décisions, points divers) = Steps.
 * - Les "points reportés", "questions à creuser", "décisions à mettre en œuvre plus tard" = Continuations explicites.
 * - Les interventions, émotions, nouveaux éléments = Événements sur le Bus de l'assemblée.
 * - Le Greffier + ses outils (cahier, enregistrement, logiciel, mémoire) = une implémentation humaine du COPScheduler + du COPStore.
 * - La production du procès-verbal et des archives = création d'Artefacts durables.
 *
 * Ce workflow est volontairement centré sur un rôle "simple" mais essentiel. Il complète très bien les précédents (chercheur solo, projet territorial, infrastructure technique) en montrant comment COP peut servir des processus démocratiques/deliberatifs concrets.
 */

export default {
  name: "assemblee-greffier-workflow",
  description:
    "Travail du Greffier lors d'une Assemblée : capture des événements, gestion des points en suspens (continuations), production d'artefacts traçables, et stabilisation de la mémoire collective contre l'oubli et la manipulation.",

  steps: [
    {
      name: "preparation-et-ouverture-de-la-trace",
      description:
        "Avant l'assemblée : préparation du dispositif de traçabilité et ouverture formelle de la séance comme 'Topic' dans le système de mémoire.",
      async run(ctx) {
        ctx.emit({
          type: "assemblee.session.opened",
          data: {
            type: "assemblée ordinaire / extraordinaire / comité",
            date: "2026-06-XX",
            participants: "liste ou nombre",
            ordreDuJour: ["point 1", "point 2", "..."],
            greffier: "nom ou rôle",
          },
        });

        // Le Greffier ouvre explicitement plusieurs continuations "en veille" pour les points qui risquent de déborder ou d'être reportés.
        const suiviPoint1 = await ctx.callWithContinuation({
          from: "greffier",
          to: "assemblee",
          intent: "suivi-point-1",
          payload: { point: "point 1 de l'ordre du jour" },
          resumeTo: "greffier",
          resumeIntent: "relever-decision-ou-report",
          taskId: "assemblee-2026-06-ordinaire",
          stepId: "point-1",
          waitForEvents: ["decision.prise", "report.demande", "nouveau-element.emerge"],
        });
        ctx.scheduler.register(suiviPoint1.continuation);

        ctx.emit({
          type: "greffier.trace.opened",
          data: {
            system: "cahier + enregistrement audio + notes structurées (proto-COP)",
            objectif: "rendre la séance aussi traçable et résumable que possible",
          },
        });
      },
    },

    {
      name: "capture-en-temps-reel",
      description:
        "Pendant l'assemblée : le Greffier fonctionne comme un 'Bus humain'. Il transforme les paroles en événements structurés tout en restant attentif aux associations et aux points de suspension potentiels.",
      async run(ctx) {
        // Simulation d'interventions qui génèrent des événements
        await ctx.bus.publish({
          type: "intervention",
          data: {
            orateur: "Participant X",
            contenu: "...",
            moment: "débat sur le point 2",
          },
        });

        // Le greffier repère un point en suspens (continuation potentielle)
        ctx.emit({
          type: "point.en.suspens.detecte",
          data: {
            description: "Demande de report du point 3 pour approfondissement",
            raison: "besoin de documents complémentaires",
            continuationPotentielle: true,
          },
        });

        // Création explicite d'une continuation pour ce report
        const reportPoint3 = await ctx.callWithContinuation({
          from: "greffier",
          to: "assemblee",
          intent: "report-point-3",
          payload: {
            raison: "documents manquants",
            deadlineSouhaitee: "prochaine séance",
          },
          resumeTo: "greffier",
          resumeIntent: "re-inscrire-point-3",
          taskId: "assemblee-2026-06-ordinaire",
          stepId: "point-3-report",
        });
        ctx.scheduler.register(reportPoint3.continuation);

        // Sérendipité classique en assemblée
        await ctx.bus.publish({
          type: "serendipite.assemblee",
          data: {
            source:
              "Intervention inattendue d'un participant qui fait un lien avec un sujet ancien",
            effet: "Le greffier note le lien et crée une petite trace associative pour plus tard",
          },
        });
      },
    },

    {
      name: "gestion-des-continuations-pendant-la-seance",
      description:
        "Le Greffier gère activement les points en suspens qui émergent en temps réel. Il décide quels sont les vrais 'continuations' à suivre et lesquels sont des digressions.",
      async run(ctx) {
        ctx.emit({
          type: "greffier.continuations.gerees",
          data: {
            enCours: "Plusieurs points reportés ou à approfondir",
            decision:
              "Le greffier propose une formulation claire des points en suspens pour le procès-verbal",
          },
        });

        // Le greffier peut créer des continuations "légères" pour des choses qui pourraient resurgir par hasard plus tard
        const veilleAssociative = await ctx.callWithContinuation({
          from: "greffier",
          to: "future-assemblee",
          intent: "veille-associative",
          payload: {
            sujet: "Lien inattendu fait aujourd'hui entre le point 2 et une discussion de 2024",
            instruction: "Resurgir si le sujet revient dans les 12 prochains mois",
          },
          resumeTo: "greffier",
          resumeIntent: "rappeler-le-lien",
          taskId: "assemblee-2026-06-ordinaire",
          stepId: "veille-associative",
          // Très ouvert → conçu pour la sérendipité
          waitForEvents: ["sujet.similaire.aborde"],
        });
        ctx.scheduler.register(veilleAssociative.continuation);
      },
    },

    {
      name: "cloture-de-seance-et-production-artefacts",
      description:
        "Fin de l'assemblée : le Greffier transforme la trace brute en artefacts officiels et stables (procès-verbal, relevé de décisions, liste des points en suspens).",
      async run(ctx) {
        ctx.emit({
          type: "assemblee.session.closed",
          data: {
            duree: "...",
            decisions: ["décision 1", "décision 2"],
            pointsEnSuspens: ["point reporté", "question à approfondir"],
          },
        });

        ctx.emit({
          type: "greffier.artifact.produced",
          data: {
            artifacts: [
              "Procès-verbal complet",
              "Relevé de décisions (version courte et traçable)",
              "Liste structurée des continuations / points en suspens avec responsables et délais",
            ],
            stabilisateur:
              "Le procès-verbal + la liste des continuations constituent les premiers Stabilisateurs de la mémoire de l'assemblée",
          },
        });
      },
    },

    {
      name: "stabilisation-long-terme-de-la-memoire-collective",
      description:
        "Après la séance : le Greffier (ou le dispositif qu'il incarne) entre dans son rôle de gardien de la mémoire sur le long terme. C'est ici que se joue vraiment la lutte contre l'effet Ubik de l'assemblée.",
      async run(ctx) {
        ctx.emit({
          type: "greffier.long-term.stabilization",
          data: {
            taches: [
              "Archivage physique et numérique",
              "Transmission aux personnes concernées",
              "Veille des points en suspens (via le Scheduler)",
              "Possibilité de ré-association future (quand un nouveau sujet fait écho à une ancienne discussion)",
            ],
            antiUbik:
              "Sans ce travail de greffe, les décisions de l'assemblée ont une forte tendance à s'évaporer, à être réinterprétées, ou à être oubliées — exactement l'effet Ubik appliqué à la mémoire collective.",
          },
        });

        // Continuation ultime du greffier : la mémoire de l'assemblée elle-même
        const memoireAssemblee = await ctx.callWithContinuation({
          from: "greffier",
          to: "future-greffier + future-assemblee",
          intent: "maintenir-memoire-vivante",
          payload: {
            artefacts: "Procès-verbaux + liste des continuations historiques",
            instruction:
              "Permettre aux futures assemblées de se reconnecter facilement aux discussions passées quand une association émerge",
          },
          resumeTo: "greffier",
          resumeIntent: "transmettre-ou-reprendre",
          taskId: "assemblee-2026-06-ordinaire",
          stepId: "long-term-memory",
          resumeAfter: new Date(Date.now() + 1000 * 30).toISOString(), // plusieurs mois
        });

        ctx.scheduler.register(memoireAssemblee.continuation);
      },
    },
  ],
};
