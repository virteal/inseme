/**
 * Ritornu — personal publication retrofit.
 *
 * M0: versioned packages + deterministic normalization + handoff rules.
 * M1: Substack public URL adapter via platform tool + private Supabase storage.
 *
 * Still no Git writes, no auth bypass, no recursive collection.
 */
export default {
  id: "ritornu",
  status: "experimental",
  name: "Ritornu — retrofit patrimonial",
  feature: "ritornu",
  description:
    "Prépare, sous mandat humain, des candidats d'intégration de publications personnelles.",

  // No UI routes yet (M3 may add a review surface).
  routes: [],
  menuItems: [],
  functions: {},
  edgeFunctions: {},

  tools: [
    {
      type: "function",
      handler: "./src/edge/tool-prepare-substack.js",
      function: {
        name: "prepare_substack_post",
        description:
          "Sous mandat explicite, récupérer UNE publication Substack publique (URL /p/slug), en conserver la preuve dans le bucket privé plateforme, normaliser le corps éditorial et produire un candidat de revue. N'écrit jamais dans Git. En cas d'indisponibilité (paywall, 404, erreur réseau), retourne un échec explicite avec replis légitimes (export officiel, copie fournie, navigation assistée). Ne contourne ni CAPTCHA, ni authentification, ni limitation de débit.",
        parameters: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description:
                "URL https publique unique d'un post Substack (/p/slug). Une seule URL par invocation.",
            },
          },
          required: ["url"],
        },
      },
    },
  ],

  configSchema: {
    ritornu_storage_bucket: {
      type: "string",
      default: "ritornu-private",
      description:
        "Bucket Supabase privé pour captures, transcriptions et candidats. Jamais un dépôt Git, jamais public par défaut.",
    },
    ritornu_default_review_required: {
      type: "boolean",
      default: true,
      description: "Interdit toute remise vers un corpus sans revue humaine explicite.",
    },
  },
};
