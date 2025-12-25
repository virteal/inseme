/**
 * apps/inseme/src/lib/config/edge-runtime.js
 * Helper universel pour les Edge Functions Inseme.
 * Gère le CORS, le chargement du Vault et la gestion d'erreurs.
 */

import { loadInstanceConfig, getConfig, getSupabase, newSupabase } from "../config/instanceConfig.edge.js";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
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
                getSupabase: () => getSupabase(),
                newSupabase: (admin, options) => newSupabase(admin, options),
                
                // Helper pour les réponses JSON avec CORS
                json: (data, status = 200, extraHeaders = {}) => new Response(JSON.stringify(data), {
                    status,
                    headers: { 
                        ...CORS_HEADERS, 
                        "Content-Type": "application/json",
                        ...extraHeaders
                    }
                }),

                // Helper pour les erreurs standardisées
                error: (message, status = 500) => new Response(JSON.stringify({ error: message }), {
                    status,
                    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
                }),

                // Accès direct aux variables d'environnement (Deno.env)
                env: Deno.env
            };

            // 3. Exécution de la logique métier
            return await handler(request, runtime, context);

        } catch (err) {
            console.error("Edge Function Runtime Error:", err);
            return new Response(JSON.stringify({ 
                error: err.message,
                stack: Deno.env.get("NETLIFY_DEV") ? err.stack : undefined 
            }), {
                status: 500,
                headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
            });
        }
    };
}
