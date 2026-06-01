/**
 * Scénario : examen-projet-loi-constitutionnelle-workflow
 *
 * Nouveau workflow pour élargir le corpus.
 *
 * Thème : L'examen parlementaire d'un **projet ou proposition de loi constitutionnelle**
 * visant à modifier la Constitution française.
 *
 * Ce workflow est particulièrement intéressant pour COP + Cogentia car :
 *
 * - La Constitution est l'**ultime Stabilisateur** du système politique et juridique français.
 *   Modifier la Constitution, c'est toucher au cœur de l'ordre juridique. L'effet Ubik y est
 *   particulièrement dangereux : une modification mal pensée, mal tracée ou capturée peut
 *   dégrader durablement l'ensemble de l'édifice républicain.
 *
 * - Le processus est **extrêmement formalisé** (article 89 de la Constitution + règles des
 *   assemblées + jurisprudence du Conseil constitutionnel) tout en étant profondément politique.
 *   C'est une boucle théorie (droit constitutionnel, séparation des pouvoirs, droits fondamentaux)
 *   ↔ pratique (rapports de force politiques, opportunités, crises, opinion publique).
 *
 * - Il y a de **très nombreuses continuations naturelles** :
 *   - Navette entre Assemblée nationale et Sénat
 *   - Travaux en commission (où se joue souvent l'essentiel du texte)
 *   - Attente d'accords politiques, de retraits d'amendements, de positions de groupes
 *   - Convocation du Congrès (si accord des deux assemblées)
 *   - Éventuel référendum (voie alternative rare)
 *   - Délais constitutionnels et réglementaires
 *
 * - La **traçabilité** est maximale et a une valeur constitutionnelle elle-même :
 *   - Procès-verbaux des commissions et séances
 *   - Rapports des rapporteurs
 *   - Débats en séance (qui font jurisprudence interprétative)
 *   - L'ensemble forme la "travaux préparatoires" qui seront utilisés pendant des décennies
 *     par le Conseil constitutionnel, les juges, les avocats, les historiens.
 *
 * - Le **hasard et la sérendipité** jouent un rôle énorme :
 *   - Un amendement déposé à la dernière minute qui change tout
 *   - Un événement extérieur (crise, attentat, scandale) qui fait basculer les votes
 *   - Une position inattendue d'un groupe ou d'un sénateur influent
 *   - Une intervention présidentielle de dernière minute
 *
 * - Le rôle des "agents simples" (rapporteurs, greffiers de commission, administrateurs des
 *   assemblées, conseillers juridiques) est crucial pour la mémoire et la cohérence du processus.
 *
 * Isomorphie COP ↔ Cogentia (très forte et de haut niveau) :
 * - La Constitution = le Topic suprême du système juridique et politique.
 * - Un projet de révision constitutionnelle = un Task de très haute portée avec des conséquences
 *   sur tous les autres Topics (lois ordinaires, règlements, jurisprudence).
 * - Les différentes phases (initiative, examen en commission, navette, Congrès ou référendum) = Steps.
 * - Les points en suspens, les navettes, les accords à trouver = Continuations avec conditions de
 *   reprise très complexes (accord des deux assemblées, majorité qualifiée au Congrès, etc.).
 * - Les amendements, les rapports, les interventions en séance, les votes = Événements sur le Bus
 *   du Parlement.
 * - Le "dossier législatif" complet (travaux préparatoires) = un Artifact constitutionnel majeur,
 *   qui devient lui-même source d'interprétation future.
 * - Les greffiers, administrateurs, rapporteurs = interfaces humaines avec le COP du Parlement
 *   (ils font circuler l'information, gèrent les rappels, produisent la mémoire officielle).
 * - La procédure elle-même (article 89) + les règles des assemblées + le contrôle du Conseil
 *   constitutionnel = un système sophistiqué de Stabilisateurs anti-Ubik pour empêcher une
 *   modification constitutionnelle hâtive, capturée ou mal tracée.
 *
 * Ce scénario complète très bien les précédents (notaire, commissaire aux comptes, greffier
 * d'assemblée, suivi d'appel d'offre public, etc.) en apportant l'angle **processus
 * constituant / révision constitutionnelle** avec son extrême formalisme, sa portée systémique
 * et son besoin de mémoire sur plusieurs générations.
 */

export default {
  name: "examen-projet-loi-constitutionnelle-workflow",
  description:
    "Examen parlementaire d'un projet ou proposition de loi constitutionnelle : de l'initiative jusqu'à l'adoption définitive (Congrès ou référendum), en passant par les travaux en commission, la navette et la gestion des amendements.",

  steps: [
    {
      name: "initiative-et-depot-du-projet",
      description:
        "Le projet ou la proposition de loi constitutionnelle est déposé. C'est l'Événement fondateur du processus constituant.",
      async run(ctx) {
        ctx.emit({
          type: "loi.constitutionnelle.deposee",
          data: {
            origine:
              "Gouvernement (sur proposition du Premier ministre) ou Parlement (proposition de loi)",
            objet:
              "Modification de tel ou tel article de la Constitution (ex: durée du mandat présidentiel, composition du Sénat, introduction d'un nouveau droit, etc.)",
            motivation: "Réponse à une crise, promesse électorale, évolution sociétale, etc.",
          },
        });

        // Ouverture de la première grande continuation : examen en première assemblée
        const examenPremiereAssemblee = await ctx.callWithContinuation({
          from: "parlement",
          to: "commission + assemblee",
          intent: "examen-premiere-lecture",
          resumeTo: "parlement",
          resumeIntent: "adopter-texte-ou-le-rejeter",
          taskId: "revision-constitutionnelle-2026-001",
          stepId: "depot",
          waitForEvents: ["rapport.commission", "texte.adopte", "texte.rejete"],
        });
        ctx.scheduler.register(examenPremiereAssemblee.continuation);

        ctx.currentRevision = { taskId: "revision-constitutionnelle-2026-001" };
      },
    },

    {
      name: "travaux-en-commission",
      description:
        "Examen approfondi en commission. C'est souvent là que le texte est le plus profondément modifié. Le greffier/rapporteur joue un rôle central de mémoire et de coordination.",
      async run(ctx) {
        ctx.emit({
          type: "commission.travaux.en.cours",
          data: {
            commission: "Commission des lois (ou commission saisie au fond)",
            amendementsDeposes: "des dizaines ou centaines",
            auditions: "experts, associations, personnalités qualifiées",
          },
        });

        // Le rapporteur/greffier gère les amendements et les points en suspens
        const gestionAmendements = await ctx.callWithContinuation({
          from: "rapporteur",
          to: "commission + groupes-politiques",
          intent: "examiner-amendements-et-preparer-rapport",
          resumeTo: "rapporteur",
          resumeIntent: "presenter-texte-en-seance",
          taskId: ctx.currentRevision.taskId,
          stepId: "commission",
          waitForEvents: ["amendements.examines", "texte.modifie", "rapport.adopte"],
        });
        ctx.scheduler.register(gestionAmendements.continuation);

        // Continuation pour les points qui nécessitent des expertises complémentaires (sérendipité ou complexité)
        const expertisesComplementaires = await ctx.callWithContinuation({
          from: "rapporteur",
          to: "services-juridiques + experts",
          intent: "obtenir-analyses-juridiques",
          resumeTo: "rapporteur",
          resumeIntent: "integrer-expertises",
          taskId: ctx.currentRevision.taskId,
          stepId: "expertises",
          waitForEvents: ["notes.juridiques.recues"],
        });
        ctx.scheduler.register(expertisesComplementaires.continuation);
      },
    },

    {
      name: "debat-et-vote-en-seance-publique",
      description:
        "Discussion en séance publique. Interventions, amendements de séance, votes. Le texte peut être profondément transformé. Le hasard politique joue beaucoup.",
      async run(ctx) {
        ctx.emit({
          type: "assemblee.debat.public",
          data: {
            duree: "plusieurs jours",
            interventions: "majorité, opposition, orateurs divers",
            amendementsAdoptes: "parfois en grand nombre",
            climat: "tendu / consensuel / imprévisible",
          },
        });

        await ctx.bus.publish({
          type: "serendipite.legislative",
          data: {
            source:
              "Amendement surprise déposé par un groupe ou un député isolé + événement extérieur (crise, déclaration présidentielle, manifestation)",
            effet: "Le texte peut basculer complètement en quelques heures",
          },
        });

        // Résultat du vote en première lecture
        ctx.emit({
          type: "texte.vote.premiere.lecture",
          data: {
            assemblee: "Assemblée nationale ou Sénat",
            resultat: "adopté / rejeté / modifié",
          },
        });
      },
    },

    {
      name: "navette-parlementaire",
      description:
        "Le texte va dans l'autre assemblée. Début de la navette. Chaque assemblée peut modifier le texte. Le processus peut s'éterniser ou aboutir à un blocage.",
      async run(ctx) {
        ctx.emit({
          type: "navette.parlementaire.debut",
          data: {
            texteTransmis: "version adoptée en première lecture",
            delai: "pas de délai maximum strict, mais pression politique",
          },
        });

        // Grande continuation : attente du résultat dans la seconde assemblée
        const navette = await ctx.callWithContinuation({
          from: "parlement",
          to: "seconde-assemblee",
          intent: "examen-deuxieme-lecture",
          resumeTo: "parlement",
          resumeIntent: "comparer-textes-et-decider-suite",
          taskId: ctx.currentRevision.taskId,
          stepId: "navette",
          waitForEvents: ["texte.adopte.seconde.lecture", "texte.modifie", "texte.rejete"],
        });
        ctx.scheduler.register(navette.continuation);
      },
    },

    {
      name: "accord-ou-desaccord-et-congres",
      description:
        "Si les deux assemblées votent un texte identique → possibilité de Congrès. Si désaccord persistant → le processus peut s'enliser ou être abandonné (sauf volonté présidentielle forte).",
      async run(ctx) {
        ctx.emit({
          type: "navette.resultat",
          data: {
            accord: "oui / non",
            texteIdentique: "version commune ou dernières divergences",
          },
        });

        // Si accord : convocation du Congrès (la grande continuation finale)
        const congres = await ctx.callWithContinuation({
          from: "president-republique",
          to: "congres.parlement",
          intent: "vote-congres-majorite-3-5",
          resumeTo: "parlement",
          resumeIntent: "adopter-ou-rejeter-revision",
          taskId: ctx.currentRevision.taskId,
          stepId: "congres",
          waitForEvents: ["congres.convoque", "vote.3-5.obtenu", "vote.3-5.refuse"],
        });
        ctx.scheduler.register(congres.continuation);
      },
    },

    {
      name: "adoption-promulgation-et-publication",
      description:
        "Si le Congrès adopte (ou référendum), le Président promulgue la révision constitutionnelle. Le texte modifié entre en vigueur. C'est l'acte constituant lui-même.",
      async run(ctx) {
        ctx.emit({
          type: "constitution.modifiee",
          data: {
            articlesModifies: "...",
            datePromulgation: "...",
            publication: "Journal officiel",
          },
        });

        // Artefact suprême : la Constitution modifiée + les travaux préparatoires complets
        ctx.emit({
          type: "artifact.constitutionnel.produced",
          data: {
            type: "Texte de la Constitution modifié + dossier législatif complet",
            valeur:
              "Source d'interprétation pour les décennies suivantes (Conseil constitutionnel, doctrine, juges, citoyens)",
          },
        });
      },
    },

    {
      name: "archivage-memoire-constitutionnelle-long-terme",
      description:
        "Le dossier entre dans la mémoire constitutionnelle de la République. Il sera utilisé pendant des générations pour interpréter la norme modifiée. C'est l'un des plus puissants Stabilisateurs du système.",
      async run(ctx) {
        const memoireConstitutionnelle = await ctx.callWithContinuation({
          from: "parlement + conseil-constitutionnel",
          to: "future-institutions + historiens + citoyens",
          intent: "conserver-memoire-constitante",
          payload: {
            artefacts:
              "Travaux préparatoires complets (rapports, débats, amendements, votes, messages du Président, etc.)",
            usage:
              "Interprétation de la Constitution modifiée, recherche historique, contentieux constitutionnel futur",
          },
          resumeTo: "institutions",
          resumeIntent: "reutiliser-travaux-preparatoires",
          taskId: ctx.currentRevision.taskId,
          stepId: "memoire-constitutionnelle",
          resumeAfter: new Date(Date.now() + 1000 * 100).toISOString(), // plusieurs décennies
        });

        ctx.scheduler.register(memoireConstitutionnelle.continuation);

        ctx.emit({
          type: "revision.constitutionnelle.entree.orbit.long.terme",
          data: {
            status:
              "La Constitution a été modifiée. La nouvelle norme va maintenant structurer (ou déstructurer) l'ensemble du système juridique et politique pour les générations futures. La qualité de la trace constituante conditionne la solidité de cette modification.",
          },
        });
      },
    },
  ],
};
