// GENERATED AUTOMATICALLY BY COP-HOST COMPILER
import { defineNodeFunctionWithLogging } from "../../../../../../packages/cop-host/src/lib/logging/node-wrapper.js";
import { defineFunction as DEFINE_FUNCTION } from "../../../../../../packages/cop-host/src/runtime/function.js";
import handler from "../../../../../../packages/brique-wiki/src/functions/search.js";

export default defineNodeFunctionWithLogging(DEFINE_FUNCTION(handler), {
  name: "wiki-search",
  logRequest: true,
  logResponse: true,
  logErrors: true,
  defaultLogData: {
    briqueId: "wiki",
    functionName: "search",
  },
});
