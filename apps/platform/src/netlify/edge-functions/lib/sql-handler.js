import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import postgres from "https://deno.land/x/postgresjs/mod.js";
import { getConfig } from "../../../common/config/instanceConfig.edge.js";

export async function handleExplicitSql(request, body, TOOL_HANDLERS) {
  try {
    const reqUrl = new URL(request.url);
    const explicitSql = reqUrl.searchParams.get("sql") || body?.sql || null;
    if (!explicitSql) return null;

    console.log("[EdgeFunction] ℹ️ Explicit SQL request detected (helper)");

    const supabaseUrl = getConfig("supabase_url");
    const supabaseKey = getConfig("supabase_service_role_key");
    let supabase = null;
    try {
      if (supabaseUrl && supabaseKey) supabase = createClient(supabaseUrl, supabaseKey);
    } catch (err) {
      console.warn("[EdgeFunction] ⚠️ Supabase client init failed (helper):", err?.message || err);
      supabase = null;
    }

    let postgresClient = null;
    try {
      if (
        supabaseUrl &&
        typeof supabaseUrl === "string" &&
        supabaseUrl.includes(".supabase.co") &&
        supabaseKey
      ) {
        const projectRef = supabaseUrl
          .replace("https://", "")
          .replace("http://", "")
          .replace(".supabase.co", "");
        const postgresConnectionString = `postgresql://postgres:${supabaseKey}@db.${projectRef}.supabase.co:5432/postgres`;
        try {
          postgresClient = new postgres(postgresConnectionString);
          console.log("[EdgeFunction] ℹ️ Postgres client initialized (helper)");
        } catch (e) {
          postgresClient = null;
        }
      }
    } catch (err) {
      console.warn("[EdgeFunction] ⚠️ Postgres init failed (helper):", err?.message || err);
      postgresClient = null;
    }

    let authorized = false;
    const cliToken = String(request.headers.get("x-cli-token") || "");
    const envCli = getConfig("cli_token");
    if (cliToken && envCli && cliToken === envCli) {
      authorized = true;
      console.log("[EdgeFunction] ✅ Authorized via X-CLI-TOKEN (helper)");
    } else {
      const authHeader = (request.headers.get("authorization") || "").split(" ")[1];
      if (authHeader && supabaseUrl && supabaseKey) {
        try {
          const authUrl = supabaseUrl.replace(/\/$/, "") + "/auth/v1/user";
          const resp = await fetch(authUrl, {
            headers: { Authorization: `Bearer ${authHeader}`, apikey: supabaseKey },
          });
          if (resp.ok) {
            const userInfo = await resp.json();
            const isAdminMetadata = Boolean(
              (userInfo.user_metadata &&
                (userInfo.user_metadata.is_admin || userInfo.user_metadata.role === "admin")) ||
              (userInfo.app_metadata &&
                (userInfo.app_metadata.is_admin || userInfo.app_metadata.role === "admin"))
            );
            if (isAdminMetadata) {
              authorized = true;
              console.log("[EdgeFunction] ✅ Authorized via user metadata (admin) (helper)");
            } else if (supabase) {
              try {
                const { data: urow, error: uerr } = await supabase
                  .from("users")
                  .select("id,role,is_admin")
                  .eq("id", userInfo.id)
                  .limit(1)
                  .maybeSingle();
                if (uerr)
                  console.warn(
                    "[EdgeFunction] ⚠️ users table check error (helper):",
                    uerr.message || uerr
                  );
                if (urow && (urow.is_admin || urow.role === "admin")) {
                  authorized = true;
                  console.log("[EdgeFunction] ✅ Authorized via users table (helper)");
                }
              } catch (err) {
                console.warn(
                  "[EdgeFunction] ⚠️ users table check failed (helper):",
                  err?.message || err
                );
              }
            }
          }
        } catch (err) {
          console.warn("[EdgeFunction] ⚠️ JWT validation failed (helper):", err?.message || err);
        }
      }
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: "Not authorized to execute SQL" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const rawSql = String(explicitSql || "").trim();
    if (!/^\s*SELECT\b/i.test(rawSql)) {
      return new Response(JSON.stringify({ error: "Only single SELECT queries are allowed." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (rawSql.includes(";")) {
      return new Response(
        JSON.stringify({ error: "Multiple statements or semicolons are not allowed." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const limit = Number(body?.limit) || 100;
    const format = typeof body?.format === "string" ? body.format : undefined;
    try {
      const out = await TOOL_HANDLERS.sql_query(
        { query: rawSql, limit, format },
        { postgres: postgresClient, supabase }
      );
      return new Response(String(out), {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    } catch (err) {
      console.error("[EdgeFunction] ❌ SQL execution error (helper):", err?.message || err);
      return new Response(
        JSON.stringify({ error: "SQL execution failed", detail: String(err?.message || err) }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    console.warn("[EdgeFunction] ⚠️ Explicit SQL helper error:", err?.message || err);
    return null;
  }
}
