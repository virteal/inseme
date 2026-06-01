/**
 * Scénario : solo-creative-researcher-workflow
 *
 * Modélisation du processus créatif d'un chercheur indépendant "seul", fonctionnant principalement
 * par **association d'idées** (méthode de l'utilisateur).
 *
 * Caractéristiques clés de cette méthode :
 * 1. **Ne rien oublier** : Tout ce qui a été pensé, lu, ressenti, expérimenté doit rester accessible
 *    et pouvoir être ré-associé des années plus tard. → Forte traçabilité via Events + Artifacts + Continuations.
 *
 * 2. **Association d'idées comme moteur principal** : Le progrès vient souvent de connexions inattendues
 *    entre domaines, époques, expériences personnelles et lectures. Le "chercheur seul" a besoin d'un
 *    système qui lui rappelle les bons vieux threads au bon moment.
 *
 * 3. **Théorie ↔ Pratique en boucle serrée** : L'objectif n'est pas de rester dans l'abstraction.
 *    Toute formalisation théorique doit rapidement redescendre dans du concret (rituels, outils,
 *    protocoles testés sur soi), et les retours de la pratique doivent modifier la théorie.
 *    But ultime : faire converger les deux.
 *
 * Ce scénario modélise cela avec les primitives COP (surtout Scheduler + Bus comme "mémoire associative externe").
 *
 * Isomorphie COP ↔ Cogentia (côté créatif du chercheur seul) :
 * - Association d'idées ~ Événements qui réveillent plusieurs Continuations dormantes en même temps.
 * - "Ne rien oublier" ~ Event log + Artifacts + Continuations comme prothèse de mémoire externe.
 * - Théorie ↔ Pratique ~ Allers-retours explicites entre Steps abstraits et Steps de grounding/expérimentation.
 * - Le chercheur seul comme son propre Scheduler + son propre Bus.
 */

export default {
  name: "solo-creative-researcher-workflow",
  description:
    "Processus créatif long d'un chercheur indépendant/solo. Multiples fils, maturations, bifurcations possibilistes, production d'artefacts. Utilise le vrai COPScheduler.",

  steps: [
    {
      name: "open-possibility-space",
      description:
        "Ouverture d'un nouvel espace de recherche/possibilité (le chercheur seul commence souvent par 'sentir' un territoire).",
      async run(ctx) {
        ctx.emit({
          type: "researcher.possibility-space.opened",
          data: {
            researcherType: "independent-lone",
            theme: "souveraineté cognitive et architectures anti-capture à l'échelle individuelle",
            initialTension:
              "Comment un individu peut-il préserver sa capacité d'exploration dans un monde de plus en plus orchestré par des systèmes cognitifs centralisés ?",
          },
        });

        // Première continuation : phase de veille large (le chercheur seul lit beaucoup sans savoir encore ce qui sera utile)
        const veille = await ctx.callWithContinuation({
          from: "researcher",
          to: "self-memory + external-sources",
          intent: "wide-veille",
          payload: {
            domains: [
              "philosophie politique",
              "systèmes distribués",
              "histoire des techniques",
              "énergétique territoriale",
            ],
            horizon: "3-6 mois",
          },
          resumeTo: "researcher",
          resumeIntent: "first-synthesis-attempt",
          taskId: "solo-research-2026-possibilism",
          stepId: "step-0-veille",
          waitForEvents: ["new.source.processed", "internal.insight.emerged"],
        });

        ctx.scheduler.register(veille.continuation);
        ctx.currentResearch = { taskId: "solo-research-2026-possibilism" };
      },
    },

    {
      name: "inject-new-sources-and-insight",
      description:
        "Simulation d'apports qui arrivent pendant la veille (très fréquent chez le chercheur solo : un livre, un article, une conversation, un événement).",
      async run(ctx) {
        await ctx.bus.publish({
          type: "new.source.processed",
          data: {
            source:
              "lecture de 'The Stack' + article sur les micro-réseaux énergétiques + note personnelle de 2024",
            emergingConnection:
              "l'idée de 'packet' comme unité de souveraineté (énergie + computation + cognition)",
          },
        });

        // Un insight interne peut aussi déclencher une reprise
        await ctx.bus.publish({
          type: "internal.insight.emerged",
          data: {
            insight:
              "La continuité entre Energy Packet Networks et ce que je cherche à faire en cognition distribuée est plus forte que je ne le pensais",
          },
        });
      },
    },

    {
      name: "first-tentative-synthesis-with-suspension",
      description:
        "Le chercheur tente une première synthèse et se suspend presque immédiatement (classique : 'je sens qu'il manque quelque chose d'important').",
      async run(ctx) {
        ctx.emit({
          type: "researcher.synthesis.attempt",
          data: {
            version: "v0.1",
            keyIdea:
              "Souveraineté individuelle comme capacité à émettre, router et recevoir des 'paquets' de différents types (énergie, information, intention, attention)",
            feeling:
              "intéressant mais trop abstrait, besoin de redescendre dans le concret du quotidien du chercheur",
          },
        });

        // Suspension longue pour maturation + besoin de "redescendre" (très solo)
        const maturation = await ctx.callWithContinuation({
          from: "researcher",
          to: "daily-life-observer-self",
          intent: "ground-in-concrete-experience",
          payload: {
            instruction:
              "observer pendant 2-3 semaines comment je gère (ou ne gère pas) mon temps cognitif comme un réseau de paquets",
          },
          resumeTo: "researcher",
          resumeIntent: "integrate-grounded-observations",
          taskId: ctx.currentResearch.taskId,
          stepId: "step-1-first-synthesis",
          resumeAfter: new Date(Date.now() + 1000 * 12).toISOString(), // pause de 12s = plusieurs semaines en mode démo
        });

        ctx.scheduler.register(maturation.continuation);
      },
    },

    {
      name: "grounded-observations-arrive",
      description:
        "Les observations du quotidien reviennent (le chercheur seul doit souvent se forcer à noter ce qui se passe vraiment dans sa vie).",
      async run(ctx) {
        await ctx.bus.publish({
          type: "grounded.observations.received",
          data: {
            observations: [
              "Le matin je perds systématiquement 45-90 min en 'réception de paquets' non sollicités (mails, notifications, pensées parasites)",
              "Quand je protège vraiment 3h le matin, je produis des 'paquets' de très haute densité (textes, connexions)",
              "L'après-midi est souvent du 'routing' de paquets déjà existants (relecture, administration, réponses)",
            ],
            emotionalNote: "frustration forte quand je sens que je suis en mode purement réactif",
          },
        });
      },
    },

    {
      name: "bifurcation-possibiliste",
      description:
        "Le chercheur solo ouvre plusieurs pistes en parallèle (très caractéristique du travail créatif indépendant : on n'a pas de chef pour dire 'reste sur un sujet').",
      async run(ctx) {
        ctx.emit({
          type: "researcher.bifurcation",
          data: {
            decision:
              "Ouvrir deux sous-threads : un très concret (rituels quotidiens du chercheur) et un plus théorique (formalisation du modèle Packet comme unité de souveraineté cognitive)",
          },
        });

        // Branche 1 : pratique / rituels (souvent plus urgente pour un chercheur seul)
        const pratique = await ctx.callWithContinuation({
          from: "researcher",
          to: "self",
          intent: "design-personal-packet-rituals",
          payload: { focus: "protection des paquets à haute densité le matin" },
          resumeTo: "researcher",
          resumeIntent: "test-rituals-in-real-life",
          taskId: ctx.currentResearch.taskId,
          stepId: "subthread-pratique",
          resumeAfter: new Date(Date.now() + 1000 * 6).toISOString(),
        });
        ctx.scheduler.register(pratique.continuation);

        // Branche 2 : théorique / formalisation (laissée en maturation plus longue)
        const theorique = await ctx.callWithContinuation({
          from: "researcher",
          to: "theoretical-self",
          intent: "formalize-packet-sovereignty-model",
          payload: {
            ambition:
              "lier Energy Packets, Inference Packets et Cognitive Packets dans un même cadre",
          },
          resumeTo: "researcher",
          resumeIntent: "cross-with-practical-experiments",
          taskId: ctx.currentResearch.taskId,
          stepId: "subthread-theorique",
          resumeAfter: new Date(Date.now() + 1000 * 20).toISOString(), // plus longue maturation
        });
        ctx.scheduler.register(theorique.continuation);
      },
    },

    {
      name: "associative-cross-link",
      description:
        "Cœur de la méthode par association d'idées : un nouvel élément (lecture, expérience, insight) crée soudain des liens entre des threads qui n'avaient rien à voir jusqu'ici. Le système (Scheduler + Bus) doit aider le chercheur seul à ne pas rater ces connexions.",
      async run(ctx) {
        ctx.emit({
          type: "researcher.association.triggered",
          data: {
            newElement:
              "Découverte du concept d' 'Inference Packet' dans un autre contexte + fatigue liée à une surcharge de 'paquets reçus' dans la vraie vie",
            unexpectedLinks: [
              "Le modèle théorique des paquets cognitifs éclaire directement le problème pratique de surcharge attentionnelle",
              "La pratique des rituels du matin devient un terrain d'expérimentation concret pour tester le modèle théorique",
            ],
            consequence:
              "Deux continuations jusque-là séparées (théorique et pratique) sont maintenant explicitement liées",
          },
        });

        // Le Scheduler + Bus agissent ici comme "mémoire associative externe" du chercheur seul.
        // Un événement associatif réveille plusieurs continuations dormantes en même temps.
        await ctx.bus.publish({
          type: "association.cross-link",
          data: {
            linkedContinuations: ["subthread-pratique", "subthread-theorique"],
            newJointDirection:
              "Utiliser les rituels quotidiens comme protocole de test du modèle de souveraineté par paquets",
          },
        });

        // Création d'une nouvelle continuation "hybride" qui n'existait pas avant l'association
        const hybrid = await ctx.callWithContinuation({
          from: "researcher",
          to: "self",
          intent: "run-theory-through-daily-practice",
          payload: {
            newProtocol:
              "Traiter chaque 'paquet attentionnel' reçu le matin selon son type et sa priorité, en s'inspirant du modèle théorique",
          },
          resumeTo: "researcher",
          resumeIntent: "evaluate-hybrid-experiment",
          taskId: ctx.currentResearch.taskId,
          stepId: "subthread-hybrid-theory-practice",
          resumeAfter: new Date(Date.now() + 1000 * 10).toISOString(),
        });
        ctx.scheduler.register(hybrid.continuation);
      },
    },

    {
      name: "practical-experiment-feedback",
      description: "Retour du terrain (le chercheur seul teste ses idées sur lui-même).",
      async run(ctx) {
        await ctx.bus.publish({
          type: "practical.experiment.feedback",
          data: {
            ritualTested: "Micro-ancrage du matin (12 min max)",
            result:
              "Fonctionne bien les jours 'normaux', s'effondre complètement les jours de forte perturbation externe",
            newQuestion: "Comment rendre le rituel résilient aux 'paquets d'urgence' inattendus ?",
          },
        });
      },
    },

    {
      name: "deliberate-associative-recall",
      description:
        "Le chercheur seul active volontairement sa 'mémoire associative externe' (Event log + Artifacts + Continuations) pour forcer des connexions qu'il n'aurait pas vues spontanément. C'est un des piliers de la méthode pour 'ne rien oublier'.",
      async run(ctx) {
        ctx.emit({
          type: "researcher.associative-recall",
          data: {
            method:
              "Recherche active dans les traces passées (événements, anciennes continuations, notes) à la recherche de 'résonances' avec le travail en cours",
            discoveries: [
              "Un ancien thread de 2024 sur les 'micro-décisions' qui n'avait jamais été relié au modèle Packet",
              "Plusieurs expériences ratées de 'gestion du temps' qui deviennent soudain des données précieuses pour tester le firewall attentionnel",
            ],
          },
        });

        // Cela déclenche souvent de nouvelles continuations hybrides
        const memoryHybrid = await ctx.callWithContinuation({
          from: "researcher",
          to: "self",
          intent: "integrate-forgotten-threads",
          payload: { oldThreads: ["micro-decisions-2024", "failed-time-management-experiments"] },
          resumeTo: "researcher",
          resumeIntent: "update-model-with-historical-data",
          taskId: ctx.currentResearch.taskId,
          stepId: "memory-association",
        });
        ctx.scheduler.register(memoryHybrid.continuation);
      },
    },

    {
      name: "cross-pollination-and-new-artifact",
      description:
        "Croisement des branches + feedback explicite théorie ↔ pratique. Le chercheur seul force la boucle pour ne pas rester dans la théorie pure.",
      async run(ctx) {
        ctx.emit({
          type: "researcher.cross-pollination",
          data: {
            insight:
              "La résilience du rituel dépend de la capacité à router rapidement les paquets d'urgence sans les laisser polluer les paquets à haute densité",
            newConcept: "Packet Priority + Packet Firewall personnel",
          },
        });

        // Boucle théorie → pratique
        ctx.emit({
          type: "researcher.theory-to-practice",
          data: {
            action: "Conception et test sur soi pendant 3 semaines du 'Packet Firewall du matin'",
            expectedOutcome: "Données concrètes pour affiner (ou réfuter) le modèle théorique",
          },
        });

        ctx.emit({
          type: "researcher.artifact.produced",
          data: {
            artifactType: "working-paper-draft + protocole-expérimental",
            title:
              "Souveraineté cognitive individuelle comme capacité de routage et de filtrage de paquets",
            version: "v0.3",
            includes: "Protocole testable + métriques subjectives de charge mentale",
          },
        });
      },
    },

    {
      name: "practice-feedback-to-theory",
      description:
        "Retour de l'expérimentation concrète qui modifie la théorie. C'est le moment où la méthode 'théorie + pratique' porte ses fruits.",
      async run(ctx) {
        await ctx.bus.publish({
          type: "practice.feedback.received",
          data: {
            experiment: "Packet Firewall du matin testé 3 semaines",
            results: [
              "Réduction nette de la frustration vespérale",
              "Mais le système s'effondre complètement quand arrive un 'paquet d'urgence' de très haute intensité émotionnelle",
              "Découverte : il manque un mécanisme de 'quarantine' temporaire des paquets trop chargés affectivement",
            ],
            impactOnTheory:
              "Le modèle doit intégrer une dimension 'charge affective' des paquets et un mécanisme de buffering",
          },
        });

        ctx.emit({
          type: "researcher.practice-to-theory",
          data: {
            update:
              "Ajout du concept de 'Affective Load' et de 'Emotional Quarantine Buffer' dans le modèle Packet",
            consequence: "La théorie est rendue plus robuste par le contact avec la réalité vécue",
          },
        });
      },
    },

    {
      name: "serendipitous-encounter",
      description:
        "Le 'hasard' et la sérendipité : un événement complètement extérieur au plan de recherche (vie personnelle, lecture non liée, conversation inattendue) crée une connexion puissante. Pour le chercheur seul, c'est souvent l'une des principales sources de progrès. Le système (Bus + Scheduler + mémoire associative) doit être conçu pour laisser de la place au hasard et le capturer quand il arrive.",
      async run(ctx) {
        // Un événement "sauvage", non sollicité, qui vient de la vie réelle
        await ctx.bus.publish({
          type: "serendipitous.event.arrived",
          data: {
            source:
              "conversation fortuite avec une personne qui travaille sur les 'rituels de seuil' dans une tradition non-occidentale + article lu par hasard sur les systèmes immunitaires biologiques",
            unexpectedResonance:
              "Le concept de 'quarantine' dans le modèle Packet trouve un écho très fort dans les rituels de seuil et les mécanismes immunitaires (séparer temporairement ce qui est 'étranger' sans le détruire)",
            powerOfChance:
              "Aucune de ces deux sources n'aurait été cherchée intentionnellement dans le cadre de cette recherche",
          },
        });

        ctx.emit({
          type: "researcher.serendipity.recognized",
          data: {
            recognition: "Cette connexion n'existait pas dans mon plan. Elle est venue du dehors.",
            adjustment:
              "Je modifie mon système de capture pour mieux accueillir les signaux faibles et les événements 'hors sujet' : élargissement des waitForEvents sur certaines continuations + journal plus permissif des 'choses qui n'ont rien à voir'",
          },
        });

        // Création d'une continuation spécifiquement ouverte sur la sérendipité
        const serendipityCatcher = await ctx.callWithContinuation({
          from: "researcher",
          to: "self",
          intent: "stay-open-to-unexpected-connections",
          payload: {
            instruction:
              "Maintenir une partie de la mémoire associative 'poreuse' : ne pas trop filtrer les événements entrants pour laisser le hasard opérer",
          },
          resumeTo: "researcher",
          resumeIntent: "integrate-serendipitous-insight",
          taskId: ctx.currentResearch.taskId,
          stepId: "serendipity-capture",
          // Très peu de conditions précises → conçu pour la sérendipité
          waitForEvents: ["*"], // symbolique : écoute large
        });
        ctx.scheduler.register(serendipityCatcher.continuation);
      },
    },

    {
      name: "long-term-associative-memory-orbit",
      description:
        "Le chercheur seul place le thread dans une orbite longue avec une mémoire associative active. L'objectif est double : 1) ne rien oublier (toutes les associations passées restent interrogeables), 2) permettre des reconnexions futures entre théorie et pratique quand de nouveaux éléments apparaîtront.",
      async run(ctx) {
        const longTerm = await ctx.callWithContinuation({
          from: "researcher",
          to: "future-self + associative-memory-system",
          intent: "major-revision-or-new-cycle",
          payload: {
            questions: [
              "Le modèle Packet tient-il toujours après 6 mois de pratique ?",
              "Quelles associations inattendues sont apparues entre ce thread et d'autres ?",
              "Où la pratique a-t-elle le plus fait évoluer (ou contredit) la théorie ?",
            ],
            memoryInstruction:
              "Garder toutes les continuations, événements et artefacts accessibles pour de futures associations",
            trigger:
              "nouveau projet, nouvelle tension importante, ou association spontanée avec un autre thread",
          },
          resumeTo: "researcher",
          resumeIntent: "re-open-with-new-associations",
          taskId: ctx.currentResearch.taskId,
          stepId: "long-term-associative-orbit",
          resumeAfter: new Date(Date.now() + 1000 * 30).toISOString(),
        });

        ctx.scheduler.register(longTerm.continuation);

        ctx.emit({
          type: "researcher.workflow.entered-associative-long-term-orbit",
          data: {
            status:
              "Le processus créatif est maintenant en orbite longue avec mémoire associative active. Le chercheur seul peut y revenir dans des années sans rien avoir perdu, et de nouvelles associations pourront le réveiller.",
            goal: "Maintenir la tension productive entre accumulation de traces (ne rien oublier) et production de résultats concrets (théorie incarnée dans des rituels/outils testés)",
          },
        });
      },
    },
  ],
};
