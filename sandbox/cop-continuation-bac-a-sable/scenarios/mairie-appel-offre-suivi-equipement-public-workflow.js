/**
 * Scénario : mairie-appel-offre-suivi-equipement-public-workflow
 *
 * Nouveau workflow pour élargir le corpus.
 *
 * Thème : Le suivi complet d'un appel d'offre lancé par une mairie
 * pour la réalisation d'un équipement public, suite à une décision
 * en conseil municipal.
 *
 * Ce workflow est très représentatif des processus administratifs
 * territoriaux réels :
 * - Décision politique (conseil municipal)
 * - Passage en mode administratif/procurement (marchés publics)
 * - Multiples acteurs (élus, services techniques, direction des finances,
 *   cabinet du maire, entreprises candidates, contrôle de légalité, etc.)
 * - Très forte exigence de traçabilité (deniers publics, anti-corruption,
 *   responsabilité)
 * - Nombreux points de suspension naturels (délais légaux, validations,
 *   financements, aléas techniques)
 * - Risque élevé d'effet Ubik (le projet peut s'étirer sur des années,
 *   perdre sa cohérence initiale, voir ses crédits fondre, ou être
 *   capturé par d'autres intérêts)
 *
 * Isomorphie COP particulièrement intéressante :
 * - La décision du conseil municipal = Événement fondateur qui crée un Task.
 * - L'appel d'offre et le suivi des travaux = un Topic de longue durée.
 * - Les différentes phases (préparation du dossier, publication,
 *   réception des offres, analyse, attribution, exécution, réception,
 *   garantie) = Steps ou sous-Tasks.
 * - Les innombrables attentes (délais de publication, période de
 *   recours, validation du contrôle de légalité, versements
 *   budgétaires, avancement des travaux, etc.) = Continuations
 *   avec conditions de reprise très variées (temps, événements,
 *   validation humaine).
 * - Le "greffier" ou les services des marchés publics / suivi des
 *   travaux = interface humaine avec le Bus et le Store de la
 *   procédure.
 * - Les Stabilisateurs ici sont cruciaux : protocoles de suivi,
 *   PV de chantier, mémoires techniques, clauses de pénalité,
 *   transmission des savoirs, etc.
 *
 * Ce scénario complète bien les précédents en apportant le point
 * de vue "action publique administrative" avec ses contraintes
 * légales, ses délais imposés, et son besoin permanent de
 * justification et de mémoire.
 */

export default {
  name: "mairie-appel-offre-suivi-equipement-public-workflow",
  description:
    "Suivi d'un appel d'offre lancé par une mairie pour un équipement public décidé en conseil municipal : de la décision politique jusqu'à la réception et la mise en garantie, avec forte traçabilité et gestion des aléas.",

  steps: [
    {
      name: "decision-conseil-municipal",
      description:
        "La décision politique est actée en conseil municipal. C'est l'Événement fondateur du projet.",
      async run(ctx) {
        ctx.emit({
          type: "assemblee.decision.municipale",
          data: {
            type: "conseil municipal",
            date: "2026-03-12",
            deliberation: "Délibération n°2026-XXX",
            objet:
              "Lancement d'un appel d'offre pour la construction/rénovation d'un [équipement public : salle polyvalente, école, gymnase, etc.]",
            budgetPrevisionnel: "1 250 000 € TTC",
            porteur: "Maire / Adjoint aux travaux",
          },
        });

        // Dès ce moment, plusieurs continuations "en veille" sont ouvertes
        const suiviProcedure = await ctx.callWithContinuation({
          from: "mairie",
          to: "services-techniques + direction-juridique",
          intent: "lancer-procedure-marches-publics",
          payload: {
            typeProcedure: "appel d'offre ouvert ou restreint",
            delaiPublication: "minimum légal",
          },
          resumeTo: "mairie",
          resumeIntent: "valider-dossier-consultation",
          taskId: "equipement-public-2026-001",
          stepId: "decision-conseil",
        });
        ctx.scheduler.register(suiviProcedure.continuation);

        ctx.currentProject = { taskId: "equipement-public-2026-001" };
      },
    },

    {
      name: "preparation-dossier-consultation",
      description:
        "Les services préparent le cahier des charges, le règlement de consultation, les pièces administratives. Beaucoup de coordinations internes.",
      async run(ctx) {
        ctx.emit({
          type: "procedure.preparation.en.cours",
          data: {
            servicesImpliques: ["techniques", "finances", "juridique", "commande publique"],
            difficultesFrequentes:
              "Définition précise des besoins, arbitrage sur les variantes, clauses sociales/environnementales",
          },
        });

        // Continuation pour la validation finale du dossier avant publication
        const validationDossier = await ctx.callWithContinuation({
          from: "services",
          to: "cabinet-maire + commission",
          intent: "valider-dossier-appel-offre",
          resumeTo: "services",
          resumeIntent: "publier-appel-offre",
          taskId: ctx.currentProject.taskId,
          stepId: "preparation-dossier",
          waitForEvents: ["validation.cabinet.recue", "arbitrage.effectue"],
        });
        ctx.scheduler.register(validationDossier.continuation);
      },
    },

    {
      name: "publication-et-periode-reception-offres",
      description:
        "Publication de l'appel d'offre. C'est une grosse période de suspension : on attend les offres dans les délais légaux.",
      async run(ctx) {
        ctx.emit({
          type: "appel.offre.publie",
          data: {
            datePublication: "2026-04-02",
            plateforme: "PLACE ou équivalent",
            delaiReception: "45 jours minimum",
          },
        });

        // Grande continuation "attente offres"
        const attenteOffres = await ctx.callWithContinuation({
          from: "mairie",
          to: "candidats-potentiels",
          intent: "reception-offres",
          payload: { nombreOffresAttendues: "entre 3 et 8" },
          resumeTo: "mairie",
          resumeIntent: "analyser-offres",
          taskId: ctx.currentProject.taskId,
          stepId: "publication",
          resumeAfter: new Date(Date.now() + 1000 * 45).toISOString(), // 45 jours en mode démo
        });
        ctx.scheduler.register(attenteOffres.continuation);
      },
    },

    {
      name: "reception-et-analyse-offres",
      description:
        "Ouverture des plis, analyse administrative, technique et financière. Commission d'appel d'offre.",
      async run(ctx) {
        await ctx.bus.publish({
          type: "offres.recues",
          data: { nombre: 5 },
        });

        ctx.emit({
          type: "commission.appel.offre",
          data: {
            date: "2026-06-10",
            decision: "Classement des offres, choix du titulaire pressenti",
          },
        });

        // Continuation pour le contrôle de légalité et la notification
        const notification = await ctx.callWithContinuation({
          from: "mairie",
          to: "prefecture + titulaire",
          intent: "notification-marche",
          resumeTo: "mairie",
          resumeIntent: "lancer-execution",
          taskId: ctx.currentProject.taskId,
          stepId: "attribution",
          waitForEvents: ["controle.legalite.ok", "recours.eventuel"],
        });
        ctx.scheduler.register(notification.continuation);
      },
    },

    {
      name: "suivi-execution-travaux",
      description:
        "Phase la plus longue et la plus riche en aléas : suivi du chantier, réunions de chantier, modifications, difficultés techniques, retards, pénalités.",
      async run(ctx) {
        ctx.emit({
          type: "chantier.lance",
          data: { date: "2026-07-15", dureePrevisionnelle: "14 mois" },
        });

        // Plusieurs continuations en parallèle pour le suivi
        const suiviMensuel = await ctx.callWithContinuation({
          from: "maitre-ouvrage",
          to: "maitre-oeuvre + entreprise",
          intent: "reunion-chantier-mensuelle",
          resumeTo: "maitre-ouvrage",
          resumeIntent: "valider-avancement",
          taskId: ctx.currentProject.taskId,
          stepId: "suivi-chantier",
          resumeAfter: new Date(Date.now() + 1000 * 30).toISOString(), // mensuel
        });
        ctx.scheduler.register(suiviMensuel.continuation);

        // Continuation "alerte dérive"
        const alerteDerive = await ctx.callWithContinuation({
          from: "maitre-ouvrage",
          to: "self",
          intent: "surveiller-derives-delais-couts",
          payload: { seuils: "dépassement > 10% ou retard > 2 mois" },
          resumeTo: "maitre-ouvrage",
          resumeIntent: "declencher-procedure-modificative",
          taskId: ctx.currentProject.taskId,
          stepId: "veille-derives",
        });
        ctx.scheduler.register(alerteDerive.continuation);
      },
    },

    {
      name: "reception-et-mise-en-garantie",
      description:
        "Réception des travaux, levée des réserves, mise en garantie décennale, transmission aux services qui vont gérer l'équipement au quotidien.",
      async run(ctx) {
        ctx.emit({
          type: "equipement.recu",
          data: {
            date: "2027-09-20",
            reserves: "liste",
            garantie: "10 ans décennale + 2 ans parfait achèvement",
          },
        });

        // Continuation finale importante : le passage de flambeau vers les services gestionnaires
        const passation = await ctx.callWithContinuation({
          from: "maitre-ouvrage",
          to: "services-techniques + direction-patrimoine",
          intent: "transmission-equipement",
          payload: {
            documents: "Dossier des ouvrages exécutés (DOE), notices, contrats de maintenance",
            formation: "formation des agents",
          },
          resumeTo: "maitre-ouvrage",
          resumeIntent: "cloture-administrative-definitive",
          taskId: ctx.currentProject.taskId,
          stepId: "passation-gestion",
        });
        ctx.scheduler.register(passation.continuation);
      },
    },

    {
      name: "cloture-projet-et-memoire-long-terme",
      description:
        "Clôture administrative et financière du projet. Surtout : mise en place de la mémoire du projet pour les 10-30 prochaines années (garanties, sinistres éventuels, enseignements pour les futurs projets).",
      async run(ctx) {
        ctx.emit({
          type: "marche.cloture",
          data: {
            date: "2028-03-15",
            bilanFinancier: "...",
            enseignements: "liste des difficultés rencontrées et bonnes pratiques",
          },
        });

        // La vraie continuité longue : la mémoire de ce projet pour les futurs élus et agents
        const memoireProjet = await ctx.callWithContinuation({
          from: "mairie",
          to: "future-mairie + future-agents",
          intent: "conserver-memoire-projet",
          payload: {
            artefacts:
              "Dossier complet du marché, PV de réception, contentieux éventuels, retour d'expérience",
            usage:
              "Référence pour les prochains appels d'offre du même type + gestion des garanties",
          },
          resumeTo: "mairie",
          resumeIntent: "reutiliser-enseignements",
          taskId: ctx.currentProject.taskId,
          stepId: "memoire-long-terme",
          resumeAfter: new Date(Date.now() + 1000 * 50).toISOString(), // plusieurs années
        });

        ctx.scheduler.register(memoireProjet.continuation);

        ctx.emit({
          type: "projet.entre.en.orbit.long.terme",
          data: {
            status:
              "L'équipement est livré et fonctionne. La vraie question sur 20 ans n'est plus sa construction, mais la vitalité de sa mémoire et de ses garanties.",
          },
        });
      },
    },
  ],
};
