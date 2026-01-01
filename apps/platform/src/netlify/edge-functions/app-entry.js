// netlify/edge-functions/app-entry.js
import { handleAppEntry } from "@inseme/cop-host/runtime/edge";

export default async (request, context) => {
  return await handleAppEntry(request, context);
};

export const config = {
  path: ["/", "/index.html"],
};
