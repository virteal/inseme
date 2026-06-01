/**
 * Scénario : cogentia-resumable-workflow (enriched version)
 *
 * Ce scénario modélise un workflow cognitif personnel typique de l'esprit Cogentia Commons :
 * - Processus long, itératif et introspectif (ex: KYS / psychocognitive analysis, clarification de projet, résolution de tension interne).
 * - Multiples points de suspension naturels : attente de données personnelles, maturation, input d'autres "parts de soi" ou agents externes, vérification émotionnelle.
 * - Production progressive d'artefacts traçables (cogentigram-like).
 * - Utilisation explicite des primitives COP (Continuation + Scheduler + Bus) pour rendre le workflow résumable, observable et orchestrable.
 *
 * Isomorphie explorée :
 * - Le workflow global ~ un Topic COP
 * - Chaque grande phase ~ un Task avec Steps
 * - Les pauses pour "réflexion / input / délégation" ~ Continuations avec conditions de reprise riches
 * - Les déclencheurs (journal, temps, autre agent, insight interne) ~ Events
 * - Le moteur qui réveille le processus au bon moment ~ COPScheduler
 *
 * Objectif du bac à sable : accumuler suffisamment d'exemples variés avant de systématiser la correspondance COP ↔ Cogentia Workflows.
 */

export default {
  name: "cogentia-resumable-workflow",
  description:
    "Workflow cognitif personnel enrichi de style Cogentia (KYS-like, multi-phases, multiples suspensions, production d'artefacts). Utilise le vrai COPScheduler et Bus.",

  steps: [
    {
      name: "init-personal-cognitive-process",
      description:
        "Ouverture formelle d'un processus de connaissance de soi / clarification (équivalent de l'ouverture d'un Task dans un Topic Cogentia).",
      async run(ctx) {
        ctx.emit({
          type: "cogentia.workflow.started",
          data: {
            workflowType: "KYS-psychocognitive-clarification",
            intent:
              "clarifier une tension persistante autour de la souveraineté temporelle et de la charge mentale",
            startedBy: "self",
          },
        });

        // Première suspension : attendre des données brutes (journaux, notes, événements récents)
        const cont1 = await ctx.callWithContinuation({
          from: "self-initiator",
          to: "memory-archives",
          intent: "collect-raw-material",
          payload: { focus: "last-30-days temporal sovereignty issues" },
          resumeTo: "self",
          resumeIntent: "begin-pattern-analysis",
          taskId: "cogentia-kys-001",
          stepId: "step-0-collection",
          waitForEvents: ["personal.raw-material.added"],
        });

        ctx.scheduler.register(cont1.continuation);
        ctx.activeWorkflow = { taskId: "cogentia-kys-001" };
      },
    },

    {
      name: "inject-raw-material",
      description:
        "Simulation d'apport de matériau personnel (très courant dans les workflows Cogentia).",
      async run(ctx) {
        await ctx.bus.publish({
          type: "personal.raw-material.added",
          data: {
            source: "journal + calendar + quick notes",
            excerpts: [
              "Beaucoup de micro-interruptions le matin",
              "Sensation de ne jamais 'commencer vraiment' avant 11h",
              "Culpabilité le soir sur le temps 'perdu'",
            ],
          },
        });
      },
    },

    {
      name: "first-pattern-detection",
      description:
        "Phase d'analyse qui détecte des patterns et décide de se suspendre pour 'laisser infuser' (classique Cogentia).",
      async run(ctx) {
        ctx.emit({
          type: "cogentia.analysis.pattern-detected",
          data: {
            patterns: [
              "matin = zone de haute vulnérabilité",
              "culpabilité vespérale comme signal secondaire",
            ],
            hypothesis:
              "Le problème n'est pas la quantité de temps, mais la qualité de l'entrée dans le temps",
          },
        });

        // Suspension pour maturation + input d'un "sub-agent" ou d'une autre couche de soi
        const cont2 = await ctx.callWithContinuation({
          from: "pattern-analyst",
          to: "deeper-self-or-emotional-layer",
          intent: "emotional-resonance-check",
          payload: { currentHypothesis: "problème de qualité d'entrée dans le temps" },
          resumeTo: "self",
          resumeIntent: "integrate-emotional-data",
          taskId: ctx.activeWorkflow.taskId,
          stepId: "step-1-patterns",
          resumeAfter: new Date(Date.now() + 1000 * 8).toISOString(), // pause de 8s pour simuler "infusion"
          meta: { note: "laisser le système nerveux réagir" },
        });

        ctx.scheduler.register(cont2.continuation);
      },
    },

    {
      name: "emotional-layer-response",
      description:
        "Simulation d'une réponse 'émotionnelle / sub-agent' (très présent dans les workflows Cogentia personnels).",
      async run(ctx) {
        // Dans un vrai workflow Cogentia, ceci pourrait venir d'un journal émotionnel, d'une conversation avec soi, ou d'un agent spécialisé.
        await ctx.bus.publish({
          type: "personal.emotional-resonance.received",
          data: {
            layer: "emotional / nervous system",
            response:
              "La culpabilité vespérale diminue quand je protège vraiment les 2 premières heures du matin",
          },
        });
      },
    },

    {
      name: "integration-and-new-continuation",
      description:
        "Intégration des données + création d'une nouvelle continuation pour la phase de conception de rituel (le workflow bifurque naturellement).",
      async run(ctx) {
        ctx.emit({
          type: "cogentia.analysis.integrated",
          data: {
            integratedInsight:
              "Protéger l'entrée du temps = levier à fort effet de levier sur la charge mentale",
          },
        });

        // Nouvelle continuation pour la phase créative / conception de solution
        const cont3 = await ctx.callWithContinuation({
          from: "integrated-self",
          to: "creative-design-self",
          intent: "design-temporal-sovereignty-ritual",
          payload: { constraint: "doit être extrêmement simple et résilient aux imprévus" },
          resumeTo: "self",
          resumeIntent: "evaluate-proposal",
          taskId: ctx.activeWorkflow.taskId,
          stepId: "step-2-design",
          waitForEvents: ["ritual-proposal.ready"],
        });

        ctx.scheduler.register(cont3.continuation);
      },
    },

    {
      name: "design-proposal",
      description:
        "Simulation de la production d'une proposition de rituel (artefact intermédiaire, très Cogentia).",
      async run(ctx) {
        await ctx.bus.publish({
          type: "ritual-proposal.ready",
          data: {
            proposal:
              "Rituel 'Micro-ancrage du matin' : 12 minutes maximum, 3 règles seulement, déclencheur = première tasse de boisson chaude",
            confidence: 0.75,
            openQuestions: [
              "Que faire les jours de gros décalage horaire ?",
              "Comment le rendre visible sans le transformer en charge ?",
            ],
          },
        });
      },
    },

    {
      name: "evaluation-and-closure-or-new-cycle",
      description:
        "Phase d'évaluation. Le workflow peut se clore ou décider d'ouvrir un nouveau cycle (très typique des processus cognitifs personnels).",
      async run(ctx) {
        ctx.emit({
          type: "cogentia.workflow.evaluation",
          data: {
            proposalQuality: "bon point de départ",
            decision: "Valider pour 3 semaines d'expérimentation + créer une continuation de suivi",
          },
        });

        // Continuation finale de suivi / ajustement (le workflow ne meurt pas, il entre en mode maintenance)
        const followUp = await ctx.callWithContinuation({
          from: "evaluator-self",
          to: "self",
          intent: "review-experiment",
          payload: {
            experimentDuration: "3 weeks",
            successCriteria:
              "réduction subjective de la charge mentale + sentiment de 'commencer vraiment' avant 10h",
          },
          resumeTo: "self",
          resumeIntent: "adjust-or-close",
          taskId: ctx.activeWorkflow.taskId,
          stepId: "step-3-experiment",
          resumeAfter: new Date(Date.now() + 1000 * 15).toISOString(), // 15s = 3 semaines en mode démo
        });

        ctx.scheduler.register(followUp.continuation);

        ctx.emit({
          type: "cogentia.workflow.entered-maintenance",
          data: { artifact: "cogentigram-temporal-sovereignty-v0.1" },
        });
      },
    },
  ],
};
