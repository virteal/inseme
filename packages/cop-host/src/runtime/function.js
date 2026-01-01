/**
 * packages/cop-host/src/runtime/function.js
 * 
 * Helper for Netlify Functions (Node.js runtime) to handle dynamic instance resolution.
 * Similar to how Edge Functions handle it, but adapted for the Node.js context.
 */

import { loadInstanceConfig, getInstanceConfig } from '../instanceConfig.js';

/**
 * Resolves the target instance based on the request (Standard Request or Netlify Event).
 * Loads the configuration into the global scope if not already loaded (or forces reload).
 * 
 * @param {Request|Object} request - The standard Request object or Netlify Function event
 * @param {Object} [options]
 * @param {boolean} [options.forceReload=true] - Force reloading config (crucial for multi-tenant isolation in Node)
 * @returns {Promise<Object|null>} The loaded configuration or null if not found
 */
export async function resolveInstanceFromRequest(request, options = {}) {
    const { forceReload = true } = options;
    
    let host;
    // Handle standard Request object (Netlify V2)
    if (request instanceof Request) {
        host = request.headers.get("host") || request.headers.get("x-forwarded-host");
    } 
    // Handle legacy Event object (Netlify V1)
    else if (request.headers) {
        host = request.headers.host || request.headers.Host;
    }

    if (!host) {
        console.warn("[cop-host] No Host header found in request");
        return null;
    }
    
    // Normalize localhost
    if (host.includes(":")) host = host.split(":")[0];

    try {
        const config = await loadInstanceConfig(forceReload, { hostname: host });
        return config;
    } catch (error) {
        console.error(`[cop-host] Failed to resolve instance for host ${host}:`, error);
        return null;
    }
}

/**
 * Helper to get the current instance config (if already resolved).
 */
export function getCurrentInstance() {
    return getInstanceConfig();
}

/**
 * Standard Function Wrapper for Briques.
 * Automatically resolves the SaaS Instance before executing the handler.
 * 
 * @param {Function} handler - async (req, context) => Response
 * @returns {Function} Wrapped handler
 */
export function defineFunction(handler) {
    return async (req, context) => {
        // 1. Resolve SaaS Instance context
        const config = await resolveInstanceFromRequest(req);
        
        if (!config) {
             // Optional: Return 404/500 if instance resolution is strict?
             // For now, allow proceeding (fallback logic might be in handler)
             // but log warning.
             console.warn("[cop-host] Processing request without resolved instance.");
        }

        // 2. Execute Handler
        try {
            return await handler(req, context);
        } catch (err) {
            console.error("[cop-host] Uncaught error in brique handler:", err);
            return new Response("Internal Server Error", { status: 500 });
        }
    };
}
