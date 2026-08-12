// Deno-native edge source for Olé Olé (profile core.edge_functions).
// IMPORTANT: this file is copied into netlify/profiles/oleole/edge-functions/,
// so the import path must be relative to THAT destination:
//   apps/oleole/netlify/profiles/oleole/edge-functions/ → monorepo root = ../../../../../../
import handler from "../../../../../../packages/brique-oleole/src/edge/presence-api.js";

export default handler;

export const config = {
  path: "/api/oleole/*",
};
