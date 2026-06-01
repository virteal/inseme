/**
 * Scénario : commissaire-aux-comptes-certification-bilan-workflow
 *
 * Nouveau workflow pour élargir le corpus.
 *
 * Rôle central : le **Commissaire aux Comptes** (statutory auditor) qui "certifie" les comptes annuels
 * (bilan, compte de résultat, annexes) d'une entreprise.
 *
 * Ce rôle est particulièrement intéressant pour COP + Cogentia pour plusieurs raisons :
 *
 * - C'est un **rôle de certification / assurance** externe et indépendant. Le commissaire aux comptes
 *   n'est pas un décideur interne, mais un tiers qui apporte une opinion formelle sur la fiabilité
 *   des informations financières produites par l'entreprise.
 *
 * - Son travail est **très fortement structuré par des normes** (Normes d'Exercice Professionnel - NEP
 *   en France, ISA au niveau international) tout en nécessitant un jugement professionnel constant.
 *   C'est un bel exemple de théorie (les normes) ↔ pratique (la réalité spécifique de chaque client).
 *
 * - La traçabilité est **obligatoire et lourde** : le dossier d'audit (papier de travail) doit être
 *   conservé pendant de nombreuses années. Il peut être inspecté par les autorités de supervision
 *   (H3C, CNCC, etc.). C'est un Stabilisateur anti-Ubik majeur contre les manipulations comptables
 *   ou les erreurs qui pourraient apparaître plus tard.
 *
 * - Il y a de très nombreux **points en suspens naturels** (continuations) :
 *   - Attente de documents du client
 *   - Confirmations externes (banques, clients, fournisseurs, avocats)
 *   - Réponses de la direction aux questions d'audit
 *   - Validation par le conseil d'administration ou l'assemblée générale
 *   - Délais légaux de dépôt des comptes
 *
 * - Le "hasard" et la sérendipité jouent un rôle important : découverte d'irrégularités, de fraudes,
 *   de problèmes de continuité d'exploitation, d'opérations avec apparentés non déclarées, etc.
 *   Le commissaire aux comptes doit être organisé pour capter ces signaux faibles.
 *
 * - L'effet Ubik est très présent : sans certification rigoureuse et sans mémoire du dossier,
 *   les comptes d'une entreprise peuvent devenir de plus en plus éloignés de la réalité économique
 *   au fil des années (surtout en cas de rotation des équipes ou de pressions).
 *
 * Isomorphie COP ↔ Cogentia (très forte) :
 * - La mission d'audit d'un exercice = un Task dans un Topic plus large (la relation d'audit sur plusieurs années).
 * - Les différentes phases (planification, contrôle interne, tests de substance, événements postérieurs,
 *   rédaction du rapport) = Steps.
 * - Les demandes en suspens, les confirmations attendues, les points d'audit ouverts = Continuations
 *   avec conditions de reprise (réponse client, date limite, validation du collège).
 * - Les écritures comptables, les pièces justificatives, les confirmations, les PV de réunion = Artifacts.
 * - Les anomalies significatives, les fraudes soupçonnées, les problèmes de continuité = Événements
 *   qui doivent être tracés et qui peuvent déclencher des continuations spécifiques.
 * - Le dossier d'audit permanent + le dossier de l'exercice = une implémentation très concrète
 *   d'un COPStore avec forte exigence de durabilité et d'intégrité.
 * - Le commissaire aux comptes + son équipe + ses outils (logiciel d'audit, check-lists, mémos) =
 *   un Scheduler humain + un Bus qui fait circuler les informations et les rappels.
 *
 * Ce workflow complète très bien les précédents (greffier d'assemblée, suivi d'appel d'offre public,
 * infrastructure technique, chercheur solo) en apportant l'angle "certification externe indépendante
 * de l'information financière d'une entité privée ou publique".
 */

export default {
  name: "commissaire-aux-comptes-certification-bilan-workflow",
  description:
    "Mission de certification des comptes annuels par un Commissaire aux Comptes : de l'acceptation du mandat à l'émission du rapport de certification, en passant par toutes les phases d'audit et la gestion des points en suspens.",

  steps: [
    {
      name: "acceptation-renouvellement-mandat-et-planification",
      description:
        "Le commissaire aux comptes accepte ou renouvelle son mandat, évalue les risques, et planifie la mission (stratégie d'audit, seuils de signification, approche par cycles).",
      async run(ctx) {
        ctx.emit({
          type: "cac.mandat.accepte",
          data: {
            societe: "Société X SAS",
            exercice: "2025",
            typeMission: "certification des comptes annuels (NEP-200)",
            rotation: "première année ou renouvellement",
            risquesIdentifies: [
              "risque de fraude sur les revenus",
              "problèmes de continuité d'exploitation",
              "opérations avec apparentés",
            ],
          },
        });

        // Ouverture de plusieurs continuations pour les phases clés
        const controleInterne = await ctx.callWithContinuation({
          from: "commissaire-aux-comptes",
          to: "client + equipe-audit",
          intent: "evaluation-controle-interne",
          resumeTo: "commissaire-aux-comptes",
          resumeIntent: "adapter-programme-audit",
          taskId: "certification-comptes-2025-societe-x",
          stepId: "planification-controle-interne",
          waitForEvents: ["documentation.controles.recue", "tests-controles.realises"],
        });
        ctx.scheduler.register(controleInterne.continuation);

        ctx.currentMission = { taskId: "certification-comptes-2025-societe-x" };
      },
    },

    {
      name: "phase-intermediaire-et-tests",
      description:
        "Travaux d'audit intermédiaires (tests de contrôle, tests de substance sur les cycles significatifs). Beaucoup de demandes au client.",
      async run(ctx) {
        ctx.emit({
          type: "audit.phase.intermediaire",
          data: {
            period: "juin - septembre 2025",
            cyclesAudites: [
              "ventes/clients",
              "achats/fournisseurs",
              "stocks",
              "immobilisations",
              "trésorerie",
            ],
          },
        });

        // Continuations classiques : attente de réponses et de pièces
        const confirmationClients = await ctx.callWithContinuation({
          from: "equipe-audit",
          to: "clients-du-client",
          intent: "confirmation-soldes-clients",
          resumeTo: "commissaire-aux-comptes",
          resumeIntent: "analyser-reponses-confirmations",
          taskId: ctx.currentMission.taskId,
          stepId: "confirmations-clients",
          waitForEvents: ["reponses.confirmations.recues"],
        });
        ctx.scheduler.register(confirmationClients.continuation);

        const reponsesDirection = await ctx.callWithContinuation({
          from: "commissaire-aux-comptes",
          to: "direction-generale",
          intent: "reponses-questions-audit",
          resumeTo: "commissaire-aux-comptes",
          resumeIntent: "evaluer-reponses-et-ajuster",
          taskId: ctx.currentMission.taskId,
          stepId: "questions-direction",
        });
        ctx.scheduler.register(reponsesDirection.continuation);
      },
    },

    {
      name: "phase-finale-et-evenements-posterieurs",
      description:
        "Travaux de fin d'exercice : inventaire physique, cut-off, événements postérieurs à la clôture, évaluation de la continuité d'exploitation, lettre d'affirmation.",
      async run(ctx) {
        await ctx.bus.publish({
          type: "evenement.posterieur.detecte",
          data: {
            nature: "Litige important avec un client majeur survenu après la clôture",
            impactPotentiel: "Provision à évaluer + information en annexe",
          },
        });

        ctx.emit({
          type: "lettre.affirmation.demandee",
          data: {
            destinataires: "Président et Directeur Financier",
            pointsCouverts: [
              "exhaustivité des passifs",
              "continuité d'exploitation",
              "fraude",
              "opérations avec apparentés",
            ],
          },
        });

        // Continuation critique : attente de la lettre d'affirmation et de la validation par les organes
        const validationGouvernance = await ctx.callWithContinuation({
          from: "commissaire-aux-comptes",
          to: "conseil-administration + assemblee-generale",
          intent: "approbation-comptes-et-certification",
          resumeTo: "commissaire-aux-comptes",
          resumeIntent: "emettre-rapport-certification",
          taskId: ctx.currentMission.taskId,
          stepId: "validation-gouvernance",
          waitForEvents: ["comptes.approuves", "lettre.affirmation.recue"],
        });
        ctx.scheduler.register(validationGouvernance.continuation);
      },
    },

    {
      name: "redaction-rapport-et-decision-certification",
      description:
        "Rédaction du rapport de certification (ou de certification avec réserves / refus de certifier). C'est le moment de vérité où le commissaire aux comptes prend sa responsabilité.",
      async run(ctx) {
        ctx.emit({
          type: "rapport.certification.emis",
          data: {
            typeOpinion: "certification sans réserve / avec réserves / refus",
            pointsCles: [
              "continuité d'exploitation",
              "provision litige client",
              "évaluation stocks",
            ],
            responsabilite:
              "Le commissaire aux comptes engage sa responsabilité civile et pénale sur cette opinion",
          },
        });

        // Artefact majeur : le rapport de certification + le dossier d'audit complet
        ctx.emit({
          type: "artifact.produced",
          data: {
            type: "Rapport du Commissaire aux Comptes + Dossier d'audit permanent + Dossier de l'exercice",
            retention: "10 ans minimum (obligation légale)",
          },
        });
      },
    },

    {
      name: "depot-comptes-et-debut-periode-garantie",
      description:
        "Dépôt des comptes certifiés au greffe / au BODACC. Début de la période de garantie / responsabilité du commissaire aux comptes.",
      async run(ctx) {
        ctx.emit({
          type: "comptes.deposes",
          data: {
            date: "2026-07-31",
            organisme: "Greffe du Tribunal de Commerce",
            responsabilite:
              "Le commissaire aux comptes reste responsable pendant plusieurs années des erreurs ou omissions dans sa certification",
          },
        });

        // Continuation longue : surveillance des événements qui pourraient remettre en cause la certification
        const surveillancePostCertification = await ctx.callWithContinuation({
          from: "commissaire-aux-comptes",
          to: "self + assureur",
          intent: "veille-post-certification",
          payload: {
            duree: "plusieurs années",
            evenementsASurveiller: [
              "découverte de fraudes",
              "redressements fiscaux importants",
              "dépôt de bilan de la société",
              "plainte d'un tiers",
            ],
          },
          resumeTo: "commissaire-aux-comptes",
          resumeIntent: "evaluer-necessite-alerte-ou-defense",
          taskId: ctx.currentMission.taskId,
          stepId: "periode-responsabilite",
          resumeAfter: new Date(Date.now() + 1000 * 20).toISOString(),
        });
        ctx.scheduler.register(surveillancePostCertification.continuation);
      },
    },

    {
      name: "archivage-dossier-et-memoire-long-terme",
      description:
        "Archivage complet du dossier d'audit (papier de travail permanent + exercice). Ce dossier est le principal Stabilisateur contre l'effet Ubik des comptes de l'entreprise.",
      async run(ctx) {
        ctx.emit({
          type: "dossier.audit.archive",
          data: {
            contenu:
              "Dossier permanent (organisation, contrats importants, organigramme, historique des problèmes) + Dossier de l'exercice (programme d'audit, tests, conclusions, correspondance)",
            dureeConservation: "10 ans (minimum légal, souvent plus par prudence)",
            usageFutur:
              "Référence pour les audits suivants, défense en cas de mise en cause, inspection par les autorités de supervision",
          },
        });

        // La vraie continuité longue du commissaire aux comptes : la capacité à se souvenir et à se défendre des certifications passées
        const memoireCertification = await ctx.callWithContinuation({
          from: "commissaire-aux-comptes",
          to: "future-equipe + assureur + avocat",
          intent: "maintenir-capacite-defense-certifications-passees",
          payload: {
            artefactCentral: "Dossier d'audit complet et structuré",
            instruction:
              "Permettre dans 3, 5 ou 8 ans de reconstituer précisément ce qui a été fait, vu, et conclu lors de la certification des comptes 2025",
          },
          resumeTo: "commissaire-aux-comptes",
          resumeIntent: "reouvrir-dossier-en-cas-de-litige",
          taskId: ctx.currentMission.taskId,
          stepId: "memoire-long-terme",
          resumeAfter: new Date(Date.now() + 1000 * 60).toISOString(), // plusieurs années
        });

        ctx.scheduler.register(memoireCertification.continuation);

        ctx.emit({
          type: "mission.entree.orbit.long.terme",
          data: {
            status:
              "La certification est émise et les comptes sont déposés. La vraie protection de la société et des tiers repose maintenant sur la qualité et la pérennité de la trace d'audit.",
          },
        });
      },
    },
  ],
};
