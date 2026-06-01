/**
 * Scénario : personal-decision-workflow
 *
 * Autre archétype fréquent dans les Cogentia Workflows / Commons :
 * - Prise de décision personnelle importante (changement de projet, engagement, arbitrage entre plusieurs options).
 * - Besoin de consulter différentes "parts de soi" ou sources externes.
 * - Multiples allers-retours et suspensions explicites.
 * - Production d'un artefact de décision traçable.
 *
 * Isomorphie avec COP : très visible sur la délégation (différents resumeTo) et les checkpoints humains/émotionnels.
 */

export default {
  name: "personal-decision-workflow",
  description:
    "Workflow de prise de décision personnelle avec délégations et checkpoints (style Cogentia Commons).",

  steps: [
    {
      name: "frame-the-decision",
      description: "Clarification de la décision à prendre.",
      async run(ctx) {
        ctx.emit({
          type: "cogentia.decision.framed",
          data: {
            question: "Dois-je accepter ce nouveau projet important qui va manger 6 mois ?",
            options: ["Accepter", "Refuser", "Négocier une version allégée"],
          },
        });

        const cont = await ctx.callWithContinuation({
          from: "decider",
          to: "research-self",
          intent: "gather-pros-cons",
          resumeTo: "decider",
          resumeIntent: "first-synthesis",
          taskId: "decision-project-2026-05",
          stepId: "step-research",
          waitForEvents: ["research.complete"],
        });
        ctx.scheduler.register(cont.continuation);
      },
    },

    {
      name: "research-and-delegate-to-emotional-layer",
      description:
        "Recherche + délégation parallèle à la couche émotionnelle / valeurs (classique).",
      async run(ctx) {
        await ctx.bus.publish({
          type: "research.complete",
          data: {
            summary: "Le projet est excitant mais va réduire fortement le temps de deep work.",
          },
        });

        // Délégation à une autre "part"
        const emotional = await ctx.callWithContinuation({
          from: "decider",
          to: "values-and-energy-self",
          intent: "evaluate-energy-impact",
          resumeTo: "decider",
          resumeIntent: "integrate-emotional-signal",
          taskId: "decision-project-2026-05",
          stepId: "step-emotional-check",
        });
        ctx.scheduler.register(emotional.continuation);
      },
    },

    {
      name: "emotional-signal-arrives",
      description: "Simulation de la réponse de la couche émotionnelle.",
      async run(ctx) {
        await ctx.bus.publish({
          type: "emotional.signal.received",
          data: {
            signal:
              "forte réticence, sensation de 'trop', peur de perdre la souveraineté sur mon temps créatif",
          },
        });
      },
    },

    {
      name: "synthesis-and-proposal",
      description:
        "Synthèse et proposition de contre-offre (le workflow produit une décision intermédiaire).",
      async run(ctx) {
        ctx.emit({
          type: "cogentia.decision.proposal",
          data: {
            proposal:
              "Accepter sous condition : version allégée à 3 mois max + garde-fou explicite sur le deep work",
            rationale:
              "combine l'excitation du projet avec la protection de la souveraineté temporelle",
          },
        });
      },
    },

    {
      name: "final-checkpoint-and-closure",
      description:
        "Dernier checkpoint avant décision finale (souvent présent dans les workflows Cogentia).",
      async run(ctx) {
        ctx.emit({
          type: "cogentia.decision.finalized",
          data: {
            decision: "Envoyer la contre-proposition allégée",
            artifact: "decision-record-project-2026-05-v1",
            followUp: "Création d'une continuation de suivi de l'accord",
          },
        });
      },
    },
  ],
};
