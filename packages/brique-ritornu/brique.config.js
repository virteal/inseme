/**
 * Ritornu — personal publication retrofit.
 *
 * This brique begins as a declared integration boundary. It does not collect,
 * authenticate, crawl, store captures, or write to GitHub at this stage.
 */
export default {
  id: "ritornu",
  status: "skeleton",
  name: "Ritornu — retrofit patrimonial",
  feature: "ritornu",
  description:
    "Prépare, sous mandat humain, des candidats d'intégration de publications personnelles.",

  // A UI, functions, edge functions, and COP tools require separate mandates.
  routes: [],
  menuItems: [],
  functions: {},
  edgeFunctions: {},
  tools: [],

  configSchema: {
    ritornu_storage_root: {
      type: "string",
      description:
        "Racine locale privée des captures et manifestes ; ne doit jamais désigner un répertoire versionné Git.",
    },
    ritornu_default_review_required: {
      type: "boolean",
      default: true,
      description:
        "Interdit toute remise vers un corpus sans revue humaine explicite.",
    },
  },
};
