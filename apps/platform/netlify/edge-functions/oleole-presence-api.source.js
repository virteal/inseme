// Olé Olé Presence API — edge entry for JHN site (façade of Agent JHN).
// Copied into profiles/jhn by compile-briques; import path is relative to
// apps/platform/netlify/profiles/jhn/edge-functions/ after profile emit.
// Destination depth: apps/platform/netlify/profiles/jhn/edge-functions → monorepo root = ../../../../../../
import handler from "../../../../../../packages/brique-oleole/src/edge/presence-api.js";

export default handler;

export const config = {
  path: "/api/oleole/*",
};
