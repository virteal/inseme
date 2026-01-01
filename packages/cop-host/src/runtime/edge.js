/**
 * packages/cop-host/src/runtime/edge.js
 * Helper universel pour les Edge Functions Inseme.
 * Gère le CORS, le chargement du Vault, la résolution d'instance et la gestion d'erreurs.
 */

import {
  loadInstanceConfig,
  getConfig,
  getSupabase,
  newSupabase,
  getAllConfigKeys,
  getConfigInfo,
} from "../config/instanceConfig.edge.js";
import {
  substituteVariables,
  getCommonVariables,
  substituteWithInstanceConfig,
} from "../lib/template.js";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Ophelia-Instance",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
  "Access-Control-Expose-Headers":
    "X-Ophelia-Instance, X-Ophelia-Instance-Name, X-Ophelia-Supabase-URL, X-Ophelia-Supabase-Anon-Key, X-Ophelia-Instance-Error",
};

/**
 * Encapsule une fonction Edge pour injecter les comportements standards.
 * @param {Function} handler - La logique de la fonction (request, runtime, context)
 */
export function defineEdgeFunction(handler) {
  return async (request, context) => {
    // Gestion automatique du CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: CORS_HEADERS });
    }

    try {
      // 1. Initialisation automatique de la configuration (Vault)
      await loadInstanceConfig();

      // 2. Préparation du runtime injecté
      const runtime = {
        getConfig: (key, defaultValue) => getConfig(key, defaultValue),
        getAllConfigKeys: () => getAllConfigKeys(),
        getConfigInfo: () => getConfigInfo(),
        getSupabase: () => getSupabase(),
        newSupabase: (admin, options) => newSupabase(admin, options),

        // Helper pour les réponses JSON avec CORS
        json: (data, status = 200, extraHeaders = {}) =>
          new Response(JSON.stringify(data), {
            status,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json",
              ...extraHeaders,
            },
          }),

        // Helper pour les erreurs standardisées
        error: (message, status = 500) =>
          new Response(JSON.stringify({ error: message }), {
            status,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          }),

        // Accès aux variables d'environnement (Netlify.env ou Deno.env)
        env: {
          get: (key) => {
            try {
              if (typeof Netlify !== "undefined" && Netlify.env)
                return Netlify.env.get(key);
            } catch (_e) {}
            try {
              if (typeof Deno !== "undefined" && Deno.env)
                return Deno.env.get(key);
            } catch (_e) {}
            return undefined;
          },
        },
      };

      // 3. Exécution de la logique métier
      return await handler(request, runtime, context);
    } catch (err) {
      console.error("Edge Function Runtime Error:", err);
      return new Response(
        JSON.stringify({
          error: err.message,
          stack:
            typeof Deno !== "undefined" && Deno.env.get("NETLIFY_DEV")
              ? err.stack
              : undefined,
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }
  };
}

/**
 * Utilitaire de substitution dynamique des métadonnées SEO dans le HTML.
 * @param {string} html - Le contenu HTML original
 * @param {Object} config - Les valeurs de configuration (city_name, party_name, etc.)
 * @returns {string} HTML modifié
 */
export function substituteSeoMetadata(html, config = {}) {
  // On utilise la nouvelle fonction générique
  const vars = {
    CITY_NAME: config.cityName || "Corte",
    PARTY_NAME: config.partyName || "Petit Parti",
    APP_URL: (config.appUrl || "https://lepp.fr").replace(/\/$/, ""),
    FACEBOOK_APP_ID: config.facebookAppId || "",
  };

  return substituteVariables(html, vars);
}

/**
 * Logique générique de résolution d'instance à partir du hostname.
 * @param {string} hostname - Le nom d'hôte de la requête
 * @param {Object} options - Options de détection
 * @returns {string|null} Le sous-domaine identifié ou null
 */
export function resolveSubdomain(hostname, options = {}) {
  const {
    baseDomains = ["lepp.fr", "kudocracy.org", "inseme.org"],
    ignoredSubdomains = ["www", "app", "api", "admin", "staging", "preview"],
  } = options;

  if (hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return null;
  }

  for (const baseDomain of baseDomains) {
    if (hostname.endsWith(`.${baseDomain}`)) {
      const subdomain = hostname.replace(`.${baseDomain}`, "");
      if (ignoredSubdomains.includes(subdomain)) return null;
      return subdomain;
    }
  }

  return null;
}

/**
 * Applique les headers CORS à une réponse existante.
 * @param {Response} response
 * @returns {Response}
 */
export function applyCorsHeaders(response) {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

/**
 * Recherche une instance dans le registre central.
 * @param {string} subdomain - Le sous-domaine à rechercher
 * @returns {Promise<Object|null>} L'instance trouvée ou null
 */
export async function lookupInstanceInRegistry(subdomain) {
  // Initialiser la config si besoin pour avoir accès au registre
  await loadInstanceConfig();

  // URL du registre central (hub)
  const registryUrl =
    getConfig("REGISTRY_SUPABASE_URL") || getConfig("SUPABASE_URL");
  const registryKey =
    getConfig("REGISTRY_SUPABASE_ANON_KEY") || getConfig("SUPABASE_ANON_KEY");

  if (!registryUrl || !registryKey) {
    console.warn("[instance-resolver] No registry configured");
    return null;
  }

  try {
    const supabase = newSupabase(false, {
      supabaseUrl: registryUrl,
      supabaseKey: registryKey,
    });

    const { data, error } = await supabase.rpc("get_instance_by_subdomain", {
      p_subdomain: subdomain,
    });

    if (error) {
      if (error.code === "42883") {
        console.log(
          "[instance-resolver] Registry not available (migration not applied)"
        );
        return null;
      }
      console.error("[instance-resolver] Lookup error:", error.message);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[instance-resolver] Lookup failed:", err.message);
    return null;
  }
}

/**
 * Logique complète de résolution d'instance pour les Edge Functions.
 * @param {Request} request
 * @param {Object} context
 * @param {Object} options - Options de résolution (baseDomains, ignoredSubdomains)
 * @returns {Promise<Response>}
 */
export async function handleInstanceResolution(request, context, options = {}) {
  const url = new URL(request.url);
  const hostname = url.hostname;

  // 1. Extraire le sous-domaine
  const subdomain = resolveSubdomain(hostname, options);

  if (!subdomain) {
    return applyCorsHeaders(await context.next());
  }

  // 2. Recherche l'instance
  const instance = await lookupInstanceInRegistry(subdomain);

  // 2.5 Recharger la config pour l'instance cible (Étape 4 du plan)
  if (instance && instance.supabase_url && instance.supabase_anon_key) {
    console.log(
      `[instance-resolver] Switching context to instance: ${subdomain}`
    );
    await loadInstanceConfig(true, {
      supabaseUrl: instance.supabase_url,
      supabaseKey: instance.supabase_anon_key,
    });
  }

  // 3. Exécuter la suite de la chaîne
  const response = await context.next();

  // 4. Injecter les headers
  if (instance) {
    response.headers.set("X-Ophelia-Instance", subdomain);
    response.headers.set(
      "X-Ophelia-Instance-Name",
      instance.display_name || subdomain
    );
    response.headers.set("X-Ophelia-Supabase-URL", instance.supabase_url);
    response.headers.set(
      "X-Ophelia-Supabase-Anon-Key",
      instance.supabase_anon_key
    );
  } else {
    response.headers.set("X-Ophelia-Instance", subdomain);
    response.headers.set("X-Ophelia-Instance-Error", "not-found");
  }

  return applyCorsHeaders(response);
}

/**
 * Gère la redirection optionnelle vers un tunnel de développement (ngrok).
 * @param {Request} request
 * @param {Object} context
 * @returns {Promise<Response|null>} Retourne une Response de redirection ou null si on continue
 */
export async function handleDevTunnelRedirect(request, context) {
  const url = new URL(request.url);

  // Charger la configuration si pas déjà fait
  await loadInstanceConfig();

  const redirectEnabled = getConfig("redirect_enabled", false);
  const redirectUrl = getConfig("redirect_url", "");

  // Bypass si ?redirect=false ou cookie présent
  const bypass =
    url.searchParams.get("redirect") === "false" ||
    context.cookies.get("site_redirect_override") === "deployed";

  if (redirectEnabled && redirectUrl && !bypass) {
    console.log("[dev-tunnel] Redirecting to ngrok:", redirectUrl);
    return Response.redirect(redirectUrl, 307);
  }

  return null;
}

/**
 * Gère la substitution des métadonnées SEO dans le HTML.
 * @param {Request} request
 * @param {Object} context
 * @returns {Promise<Response>}
 */
export async function handleSeoSubstitution(request, context) {
  try {
    // Récupérer le contenu de index.html
    const response = await context.next();
    if (response.status !== 200) return response;

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return response;

    let html = await response.text();

    // Effectuer les substitutions dynamiques via l'utilitaire asynchrone
    html = await substituteWithInstanceConfig(html, {
      loadConfig: loadInstanceConfig,
      getConfig,
    });

    // Retourner la réponse modifiée
    return new Response(html, {
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        "content-type": "text/html; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("[seo-substitution] Error during substitution:", error);
    return context.next();
  }
}

/**
 * Point d'entrée principal pour la racine de l'application.
 * Combine la redirection tunnel et la substitution SEO.
 * @param {Request} request
 * @param {Object} context
 * @returns {Promise<Response>}
 */
export async function handleAppEntry(request, context) {
  const url = new URL(request.url);

  // On ne traite que les requêtes vers la racine ou index.html
  if (url.pathname !== "/" && url.pathname !== "/index.html") {
    return context.next();
  }

  // 1. Gérer le tunnel ngrok
  const redirectResponse = await handleDevTunnelRedirect(request, context);
  if (redirectResponse) return redirectResponse;

  // 2. Gérer la substitution SEO
  return await handleSeoSubstitution(request, context);
}

// function removed as per technical debt resolution (TODO.md)
