/**
 * Scénario : agence-immobiliere-changement-locataire-workflow
 *
 * Nouveau workflow pour élargir le corpus.
 *
 * Rôle central : une **agence immobilière** qui gère le départ d'un locataire et son remplacement.
 *
 * Ce n'est pas un rôle "stratégique" ou "créatif" au sens large, mais un processus opérationnel très concret,
 * répétitif, et à fort enjeu de traçabilité. C'est exactement le type de workflow quotidien
 * que beaucoup d'agents ou de petites structures gèrent en continu.
 *
 * Pourquoi ce workflow est intéressant pour COP + Cogentia :
 *
 * - Il contient de **très nombreux points de suspension naturels** (continuations) :
 *   - Délai de préavis du locataire sortant
 *   - Recherche et visites de nouveaux candidats
 *   - Délais de signature du nouveau bail
 *   - Réalisation de travaux de remise en état
 *   - Restitution du dépôt de garantie (souvent après plusieurs mois)
 *
 * - La **traçabilité** est critique pour se protéger en cas de litige :
 *   - États des lieux d'entrée et de sortie (photos, descriptions)
 *   - Correspondances avec le locataire sortant et le nouveau
 *   - Factures de travaux
 *   - Preuves de versement / restitution du dépôt
 *   Sans bonne mémoire, l'agence s'expose à des conflits coûteux ("c'était déjà comme ça avant", "vous n'avez pas fait les travaux", etc.).
 *
 * - L'**effet Ubik** est très présent dans la gestion locative :
 *   - Les dossiers s'accumulent et se perdent dans le temps
 *   - Les équipes tournent (nouveaux agents qui ne connaissent pas l'historique)
 *   - Les petits problèmes non traités s'aggravent (fuites, dégradations, impayés)
 *   - Le "hasard" (découverte tardive d'une dégradation, changement de situation du locataire) peut tout faire basculer.
 *
 * - La **sérendipité** joue souvent : un candidat inattendu qui tombe au bon moment, une dégradation découverte par hasard lors d'une visite, un ancien locataire qui recontacte pour une affaire, etc.
 *
 * - Boucle **théorie ↔ pratique** très concrète :
 *   - La théorie = le cadre légal (loi 89, décrets sur l'état des lieux, encadrement des loyers, etc.)
 *   - La pratique = la réalité du bien, du marché local, du comportement humain des locataires et propriétaires.
 *
 * Isomorphie COP ↔ Cogentia (très opérationnelle ici) :
 * - Le "bien immobilier" + le "contrat de location" = un Topic de longue durée (souvent plusieurs années).
 * - Le "changement de locataire" = un Task avec un début (préavis) et une fin (nouveau bail signé + dépôt traité).
 * - Les différentes phases (préavis, recherche, sélection, état des lieux sortie, travaux, état des lieux entrée, signature, dépôt) = Steps.
 * - Les innombrables attentes = Continuations avec conditions de reprise variées (temps, événement "nouveau locataire trouvé", validation "travaux terminés", etc.).
 * - Les courriers, PV d'état des lieux, photos, factures, baux = Artifacts.
 * - Les incidents, réclamations, découvertes de problèmes = Événements sur le Bus de l'agence.
 * - L'agence + ses outils (logiciel de gestion locative, dossiers papier/numérique, check-lists) = une implémentation du COPScheduler + COPStore.
 *
 * Ce workflow complète très bien les précédents (greffier d'assemblée, commissaire aux comptes, suivi d'appel d'offre public, infrastructure technique, chercheur solo) en apportant l'angle **opérationnel commercial / gestion locative** avec ses contraintes de rapidité, de relation client, et de protection juridique quotidienne.
 */

export default {
  name: "agence-immobiliere-changement-locataire-workflow",
  description:
    "Gestion par une agence immobilière du départ d'un locataire et de son remplacement : du préavis à la signature du nouveau bail, en passant par l'état des lieux, la recherche, les travaux, et le traitement du dépôt de garantie.",

  steps: [
    {
      name: "reception-preavis-et-ouverture-dossier",
      description:
        "Le locataire donne son préavis. L'agence ouvre formellement le 'Task' de changement de locataire et commence à tracer tout.",
      async run(ctx) {
        ctx.emit({
          type: "locataire.preavis.recue",
          data: {
            locataire: "M. ou Mme X",
            bien: "Appartement 45m² - Rue Y",
            datePreavis: "2026-06-01",
            dateSortiePrevue: "2026-08-31",
            motif: "mutation professionnelle / achat / autre",
          },
        });

        // Ouverture de plusieurs continuations en parallèle
        const etatLieuxSortie = await ctx.callWithContinuation({
          from: "agence",
          to: "locataire-sortant",
          intent: "realiser-etat-lieux-sortie",
          resumeTo: "agence",
          resumeIntent: "analyser-degradations-et-facturer",
          taskId: "changement-locataire-bien-Y-2026",
          stepId: "etat-lieux-sortie",
          waitForEvents: ["etat-lieux.realise", "degradations.contestees"],
        });
        ctx.scheduler.register(etatLieuxSortie.continuation);

        const rechercheNouveau = await ctx.callWithContinuation({
          from: "agence",
          to: "marche-locatif",
          intent: "trouver-nouveau-locataire",
          resumeTo: "agence",
          resumeIntent: "selectionner-candidat",
          taskId: "changement-locataire-bien-Y-2026",
          stepId: "recherche-locataire",
          resumeAfter: new Date(Date.now() + 1000 * 15).toISOString(), // ~15 jours en démo
        });
        ctx.scheduler.register(rechercheNouveau.continuation);

        ctx.currentDossier = { taskId: "changement-locataire-bien-Y-2026" };
      },
    },

    {
      name: "etat-lieux-sortie-et-gestion-degradations",
      description:
        "Réalisation de l'état des lieux de sortie. C'est souvent le moment où surgissent les premiers conflits ou découvertes (sérendipité négative).",
      async run(ctx) {
        await ctx.bus.publish({
          type: "etat-lieux.sortie.realise",
          data: {
            constats: [
              "traces sur murs",
              "parquet rayé dans la chambre",
              "joint de douche à refaire",
            ],
            estimationTravaux: "850 €",
          },
        });

        // Continuation pour la négociation / retenue sur dépôt
        const gestionDepot = await ctx.callWithContinuation({
          from: "agence",
          to: "locataire-sortant + proprietaire",
          intent: "traiter-retenue-depot",
          resumeTo: "agence",
          resumeIntent: "restituer-solde-depot",
          taskId: ctx.currentDossier.taskId,
          stepId: "gestion-depot",
          waitForEvents: ["accord.locataire", "factures.travaux.recues"],
        });
        ctx.scheduler.register(gestionDepot.continuation);
      },
    },

    {
      name: "recherche-et-visites-nouveaux-candidats",
      description:
        "Mise en ligne de l'annonce, organisation des visites. Le 'hasard' joue beaucoup ici (qualité des candidatures, timing du marché).",
      async run(ctx) {
        ctx.emit({
          type: "annonce.publiee",
          data: {
            plateformes: ["Leboncoin", "PAP", "site agence"],
            loyer: "850 € CC",
            nombreVisites: 12,
          },
        });

        // Continuation ouverte pour la sélection
        const selection = await ctx.callWithContinuation({
          from: "agence",
          to: "candidats",
          intent: "selectionner-locataire",
          resumeTo: "agence",
          resumeIntent: "proposer-dossier-proprietaire",
          taskId: ctx.currentDossier.taskId,
          stepId: "selection-candidat",
          waitForEvents: ["candidature.complete", "proprietaire.decision"],
        });
        ctx.scheduler.register(selection.continuation);
      },
    },

    {
      name: "selection-validation-et-signature-bail",
      description:
        "Choix du locataire, constitution du dossier, validation par le propriétaire, signature du bail. Beaucoup de pièces à collecter.",
      async run(ctx) {
        await ctx.bus.publish({
          type: "candidat.selectionne",
          data: {
            locataire: "M. ou Mme Z",
            garant: "oui / non",
            delaiSignature: "15 jours",
          },
        });

        // Continuation critique : attente des pièces et de la signature
        const signature = await ctx.callWithContinuation({
          from: "agence",
          to: "nouveau-locataire + proprietaire",
          intent: "finaliser-signature-bail",
          resumeTo: "agence",
          resumeIntent: "remettre-cles",
          taskId: ctx.currentDossier.taskId,
          stepId: "signature-bail",
          waitForEvents: ["dossier.complet", "bail.signe"],
        });
        ctx.scheduler.register(signature.continuation);
      },
    },

    {
      name: "etat-lieux-entree-et-remise-cles",
      description:
        "État des lieux d'entrée avec le nouveau locataire + remise des clés. Dernière occasion de figer l'état du bien.",
      async run(ctx) {
        ctx.emit({
          type: "etat-lieux.entree.realise",
          data: {
            locataire: "nouveau",
            remarques: "traces anciennes déjà notées en sortie + nouvel état après travaux",
            photos: "dossier photo complet",
          },
        });

        // Continuation pour le suivi du dépôt du nouveau locataire (souvent bloqué plusieurs semaines)
        const depotNouveau = await ctx.callWithContinuation({
          from: "agence",
          to: "nouveau-locataire",
          intent: "encaisser-depot-garantie",
          resumeTo: "agence",
          resumeIntent: "archiver-justificatifs",
          taskId: ctx.currentDossier.taskId,
          stepId: "depot-garantie-nouveau",
        });
        ctx.scheduler.register(depotNouveau.continuation);
      },
    },

    {
      name: "traitement-final-depot-sortant-et-cloture-dossier",
      description:
        "Restitution (ou retenue) du dépôt du locataire sortant après travaux. Clôture administrative du dossier de départ.",
      async run(ctx) {
        ctx.emit({
          type: "depot.sortant.restitue",
          data: {
            montantRestitue: "1200 € - 850 € travaux = 350 €",
            delai: "dans les 2 mois après état des lieux (conforme à la loi)",
          },
        });

        ctx.emit({
          type: "dossier.changement.locataire.cloture",
          data: {
            artefacts: [
              "État des lieux sortie + photos",
              "Factures travaux",
              "Correspondance avec locataire sortant",
              "Nouveau bail + état des lieux entrée",
              "Justificatifs dépôt",
            ],
          },
        });
      },
    },

    {
      name: "memoire-long-terme-et-veille-litiges",
      description:
        "Le dossier entre dans l'orbite longue de l'agence. Il peut resurgir des années plus tard en cas de contentieux (impayés, dégradations non déclarées, litige sur le dépôt, etc.).",
      async run(ctx) {
        const memoire = await ctx.callWithContinuation({
          from: "agence",
          to: "future-agence + assureur + avocat",
          intent: "conserver-memoire-dossier",
          payload: {
            duree: "5 à 10 ans selon les délais de prescription",
            usage:
              "Défense en cas de procédure, transmission en cas de changement d'agence, analyse des problèmes récurrents du bien",
          },
          resumeTo: "agence",
          resumeIntent: "reouvrir-dossier-litige",
          taskId: ctx.currentDossier.taskId,
          stepId: "memoire-long-terme",
          resumeAfter: new Date(Date.now() + 1000 * 40).toISOString(),
        });

        ctx.scheduler.register(memoire.continuation);

        ctx.emit({
          type: "dossier.entree.orbit.long.terme",
          data: {
            status:
              "Le changement de locataire est terminé. La vraie protection de l'agence et du propriétaire repose maintenant sur la qualité et la pérennité de la trace.",
          },
        });
      },
    },
  ],
};
