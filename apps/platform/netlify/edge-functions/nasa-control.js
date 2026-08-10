/* global Deno */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function operatorSubjects() {
  return new Set(
    String(Deno.env.get("NASA_OPERATOR_SUBJECTS") || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function principalSubject() {
  return String(Deno.env.get("NASA_PRINCIPAL_SUBJECT") || "").trim();
}

function bearerToken(request) {
  const value = request.headers.get("authorization") || "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

export default async function nasaControl(request) {
  if (request.method !== "GET" && request.method !== "POST") {
    return response({ error: "method_not_allowed" }, 405);
  }

  const token = bearerToken(request);
  if (!token) return response({ error: "missing_bearer_token" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const publishableKey =
    Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("VITE_SUPABASE_ANON_KEY");
  if (!url || !publishableKey) {
    return response({ error: "jhn_auth_not_configured" }, 503);
  }

  const supabase = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return response({ error: "invalid_session" }, 401);

  const subjects = operatorSubjects();
  const principal = principalSubject();
  if (!principal) {
    return response({ error: "principal_subject_unconfigured" }, 503);
  }
  const accessClass =
    data.user.id === principal ? "principal" : subjects.has(data.user.id) ? "delegate" : null;
  if (!accessClass) {
    return response({ authenticated: true, authorized: false }, 403);
  }

  if (request.method === "POST") {
    // This deliberate no-op prevents an authenticated UI from becoming an accidental action plane.
    return response({ error: "action_bridge_not_configured" }, 501);
  }

  return response({
    authenticated: true,
    authorized: true,
    access_class: accessClass,
    action_bridge: "not_configured",
  });
}
