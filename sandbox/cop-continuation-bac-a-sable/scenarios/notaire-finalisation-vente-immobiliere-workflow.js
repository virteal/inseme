/**
 * Scénario : notaire-finalisation-vente-immobiliere-workflow
 *
 * Nouveau workflow pour élargir le corpus.
 *
 * Rôle central : le **Notaire** qui finalise une vente immobilière (ou d'un bien important).
 *
 * Le notaire est un officier public et ministériel. Il joue un rôle de **tiers de confiance neutre**
 * et de **gardien de la mémoire juridique** de la transaction.
 *
 * Ce rôle est particulièrement riche pour COP + Cogentia :
 *
 * - Le notaire est littéralement un **interface humain avec le droit** et avec la traçabilité officielle.
 *   Il transforme une intention privée (compromis de vente) en un acte authentique opposable à tous.
 *
 * - Son travail est extrêmement structuré par des **normes légales et procédurales** très strictes
 *   (Code civil, Code de l'urbanisme, Code général des impôts, règles de la publicité foncière, etc.),
 *   tout en nécessitant un fort jugement professionnel sur les cas concrets.
 *
 * - Il y a de **très nombreux points en suspens** (continuations) :
 *   - Obtention du prêt par l'acquéreur
 *   - Levée des conditions suspensives (urbanisme, diagnostics, droit de préemption, etc.)
 *   - Obtention des documents du vendeur (titre de propriété, diagnostics, situation fiscale, etc.)
 *   - Coordination avec les banques (prêteur, banque du vendeur pour purge des hypothèques)
 *   - Délais légaux et fiscaux
 *   - Obtention de l'accord des co-héritiers, indivisaires, etc.
 *
 * - La **traçabilité** est maximale : l'acte authentique est un artefact juridique de très haute valeur.
 *   Le notaire doit conserver les minutes pendant des décennies. La publicité foncière rend la transaction
 *   opposable à tous.
 *
 * - L'**effet Ubik** est combattu de front par l'institution notariale : sans cet intermédiaire,
 *   les ventes immobilières seraient bien plus fragiles (contestation de propriété, vices cachés non tracés,
 *   problèmes de financement non sécurisés, etc.).
 *
 * - La **sérendipité** est fréquente : découverte tardive d'une hypothèque, d'un droit de préemption oublié,
 *   d'un problème de mitoyenneté, d'un décès du vendeur en cours de procédure, etc.
 *
 * - Boucle **théorie ↔ pratique** permanente : le notaire applique un cadre légal très dense à la réalité
 *   souvent désordonnée d'une transaction humaine (famille, succession, divorce, SCI, etc.).
 *
 * Isomorphie COP ↔ Cogentia (très forte) :
 * - La transaction immobilière = un Topic de longue durée (souvent plusieurs mois).
 * - Le "dossier de vente" = un Task qui commence au compromis et se termine à la signature + publicité foncière.
 * - Les différentes phases (vérification des conditions suspensives, purge des hypothèques, préparation de l'acte,
 *   signature, post-signature) = Steps.
 * - Les innombrables attentes = Continuations avec conditions de reprise très variées (obtention du prêt,
 *   levée de condition, signature des parties, etc.).
 * - Les documents (compromis, diagnostics, titres, attestations, PV d'assemblée de copropriété, etc.) = Artifacts.
 * - Les découvertes de problèmes, les changements de situation = Événements sur le Bus du notaire.
 * - Le notaire + son étude + ses outils (logiciel notarial, base de données, archives) = une implémentation
 *   très aboutie du COPScheduler + COPStore + mécanismes de stabilisation.
 * - L'acte authentique + la publicité foncière = le Stabilisateur ultime contre les contestations futures.
 *
 * Ce workflow complète très bien les précédents (agence immobilière, greffier, commissaire aux comptes,
 * suivi d'appel d'offre public, infrastructure technique) en apportant l'angle "authentification juridique
 * solennelle et mémoire officielle d'une transaction importante".
 */

export default {
  name: "notaire-finalisation-vente-immobiliere-workflow",
  description:
    "Finalisation d'une vente immobilière par un Notaire : du compromis de vente jusqu'à la signature de l'acte authentique, la publicité foncière et l'archivage long terme.",

  steps: [
    {
      name: "reception-compromis-et-ouverture-dossier",
      description:
        "Réception du compromis de vente (ou promesse) et ouverture du dossier notarial. C'est l'Événement fondateur de la transaction authentique.",
      async run(ctx) {
        ctx.emit({
          type: "notaire.compromis.recue",
          data: {
            bien: "Maison / Appartement / Terrain - Adresse",
            vendeur: "...",
            acquereur: "...",
            prix: "... €",
            dateCompromis: "2026-XX-XX",
            delaiSignature: "3 mois généralement",
          },
        });

        // Ouverture de plusieurs continuations majeures
        const verificationConditions = await ctx.callWithContinuation({
          from: "notaire",
          to: "acquereur + banque + services-urbanisme",
          intent: "verifier-conditions-suspensives",
          resumeTo: "notaire",
          resumeIntent: "preparer-acte",
          taskId: "vente-bien-2026-001",
          stepId: "conditions-suspensives",
          waitForEvents: [
            "financement.obtenu",
            "certificat-urbanisme.recue",
            "diagnostics.complets",
          ],
        });
        ctx.scheduler.register(verificationConditions.continuation);

        ctx.currentDossier = { taskId: "vente-bien-2026-001" };
      },
    },

    {
      name: "verification-titre-et-purge-droits",
      description:
        "Vérification du titre de propriété du vendeur, recherche des hypothèques, servitudes, droits de préemption, etc. Coordination avec les banques pour purge des hypothèques.",
      async run(ctx) {
        ctx.emit({
          type: "notaire.titre.verifie",
          data: {
            hypothequesExistantes: "oui / non",
            servitudes: "...",
            droitPreemption: "SAFER, commune, etc.",
          },
        });

        // Continuation importante : purge des hypothèques et coordination bancaire
        const purgeHypotheques = await ctx.callWithContinuation({
          from: "notaire",
          to: "banque-vendeur + banque-acquereur",
          intent: "purger-hypotheques-et-obtenir-mainlevee",
          resumeTo: "notaire",
          resumeIntent: "valider-purges",
          taskId: ctx.currentDossier.taskId,
          stepId: "purge-hypotheques",
          waitForEvents: ["mainlevee.recue", "accord.banque.preteur"],
        });
        ctx.scheduler.register(purgeHypotheques.continuation);
      },
    },

    {
      name: "preparation-acte-authentique",
      description:
        "Rédaction de l'acte de vente authentique. Intégration de toutes les pièces, calcul des frais, préparation des clauses spécifiques.",
      async run(ctx) {
        ctx.emit({
          type: "acte.authentique.prepare",
          data: {
            clausesParticulieres: "travaux à réaliser, servitudes, etc.",
            fraisNotaries: "... €",
            dateSignaturePrevue: "...",
          },
        });

        // Continuation pour la convocation et la collecte des derniers documents
        const convocationSignature = await ctx.callWithContinuation({
          from: "notaire",
          to: "vendeur + acquereur + banques",
          intent: "convoquer-signature-acte",
          resumeTo: "notaire",
          resumeIntent: "proceder-signature",
          taskId: ctx.currentDossier.taskId,
          stepId: "preparation-signature",
          waitForEvents: ["toutes.pieces.recues", "fonds.disponibles"],
        });
        ctx.scheduler.register(convocationSignature.continuation);
      },
    },

    {
      name: "signature-acte-authentique",
      description:
        "Réunion de signature chez le notaire. Lecture de l'acte, explications, signatures. Moment solennel où la vente devient définitive.",
      async run(ctx) {
        ctx.emit({
          type: "acte.authentique.signe",
          data: {
            date: "2026-XX-XX",
            partiesPresentes: "vendeur(s), acquéreur(s), notaire, éventuellement banques",
            versement: "solde du prix + frais",
          },
        });

        // Artefact principal : l'acte authentique
        ctx.emit({
          type: "artifact.produced",
          data: {
            type: "Acte authentique de vente",
            valeur: "Titre de propriété officiel, opposable à tous après publicité foncière",
          },
        });
      },
    },

    {
      name: "publicite-fonciere-et-transmission",
      description:
        "Publication de l'acte à la conservation des hypothèques (publicité foncière). Remise des clés, transmission des documents au nouveau propriétaire.",
      async run(ctx) {
        ctx.emit({
          type: "vente.publiée.fonciere",
          data: {
            datePublication: "...",
            nouveauProprietaire: "officiellement inscrit",
          },
        });

        ctx.emit({
          type: "cles.remises",
          data: {
            date: "...",
            documentsRemis: "titre, diagnostics, notices, clés, etc.",
          },
        });

        // Continuation pour le suivi des formalités post-signature (taxes, etc.)
        const formalitesPost = await ctx.callWithContinuation({
          from: "notaire",
          to: "services.fiscaux + acquereur",
          intent: "traiter-formalites-post-signature",
          resumeTo: "notaire",
          resumeIntent: "cloturer-dossier",
          taskId: ctx.currentDossier.taskId,
          stepId: "formalites-post",
          waitForEvents: ["droits.enregistres", "attestations.recues"],
        });
        ctx.scheduler.register(formalitesPost.continuation);
      },
    },

    {
      name: "archivage-dossier-et-memoire-long-terme",
      description:
        "Archivage complet du dossier par l'étude notariale. Le notaire conserve la minute de l'acte. C'est le Stabilisateur ultime de la transaction.",
      async run(ctx) {
        ctx.emit({
          type: "dossier.notarial.archive",
          data: {
            contenu:
              "Acte authentique + toutes les pièces du dossier (compromis, diagnostics, titres, correspondance, etc.)",
            dureeConservation: "100 ans (ou transmission aux Archives départementales)",
            usageFutur:
              "Délivrance de copies authentiques, recherche de titres, contentieux éventuels sur la propriété ou les servitudes",
          },
        });

        // La vraie continuité longue du notariat : la capacité à produire des copies et à attester de l'acte des décennies plus tard
        const memoireActe = await ctx.callWithContinuation({
          from: "notaire",
          to: "future-notaire + services.archives",
          intent: "maintenir-acces-acte",
          payload: {
            instruction:
              "Permettre dans 30 ou 50 ans de retrouver facilement l'acte et de délivrer des copies authentiques",
          },
          resumeTo: "notaire",
          resumeIntent: "delivrer-copie-authentique",
          taskId: ctx.currentDossier.taskId,
          stepId: "memoire-long-terme-notarial",
          resumeAfter: new Date(Date.now() + 1000 * 60).toISOString(),
        });

        ctx.scheduler.register(memoireActe.continuation);

        ctx.emit({
          type: "vente.entree.orbit.long.terme",
          data: {
            status:
              "La vente est authentifiée et publiée. La protection des parties et des tiers repose maintenant sur la pérennité de l'acte notarié et de son archivage.",
          },
        });
      },
    },
  ],
};
