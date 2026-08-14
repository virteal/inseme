// Shared territorial context API for the JHN deployment.
// The route deliberately sits outside /api/oleole so John and future facades
// can consume the same source-backed context contract.
// This source is copied into profiles/jhn/edge-functions before Netlify bundles it.
import handler from "../../../../../../packages/brique-oleole/src/edge/corsica-context-api.js";

export default handler;

export const config = { path: "/api/corsica/context" };
