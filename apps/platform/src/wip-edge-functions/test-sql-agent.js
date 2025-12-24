// File: netlify/edge-functions/test-sql-agent.js
// Description: Test edge function to verify AI agent access to the sql_query tool.
import { executeToolCalls } from "./lib/tools/executor.js";

export default async (request) => {
  try {
    // Simulate an AI agent's tool call request
    const toolCalls = [
      {
        id: "test-sql-1",
        function: {
          name: "sql_query",
          arguments: JSON.stringify({
            query: "SELECT id, display_name FROM users LIMIT 2",
          }),
        },
      },
    ];

    // Execute the tool call
    const results = await executeToolCalls(toolCalls, "test-provider");

    return new Response(JSON.stringify(results, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = {
  path: "/test-sql-agent",
};
