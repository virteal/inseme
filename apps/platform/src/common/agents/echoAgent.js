// echoAgent.js
import { createHandlerContext } from "../../../../../packages/cop-kernel/src/handlerContext.js";

export async function echoAgentHandler(msg, runtimeOptions) {
  const ctx = createHandlerContext({ msg, ...runtimeOptions });

  await ctx.log("received", "in", { payload: msg.payload });

  await ctx.reply({
    intent: "echo.response",
    payload: { echo: msg.payload },
  });
}
