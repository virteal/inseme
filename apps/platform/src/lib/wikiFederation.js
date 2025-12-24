import { createClient } from "@supabase/supabase-js";
import { getSupabase } from "./supabase.js";
import { getFederationConfig } from "../common/config/instanceConfig.client.js";
import { getInstance, getSubdomain } from "./instanceResolver.js";

// Maximum depth when walking parent chain to avoid infinite loops
const DEFAULT_MAX_DEPTH = 10;

function buildGlobalId({ pageKey, subdomain, isGlobalRoot }) {
  if (isGlobalRoot) return `global:${pageKey}`;
  const sub = subdomain || "instance";
  return `instance:${sub}:${pageKey}`;
}

function getLocalSubdomainSafe() {
  try {
    const inst = getInstance();
    if (inst && inst.subdomain) return inst.subdomain;
  } catch (e) {
    // ignore
  }
  // fallback to instanceConfig
  const cfg = instanceConfigLib.getFederationConfig();
  if (cfg?.parentHubUrl) {
    // if parentHubUrl present, return something like local
  }
  return "local";
}

async function createRemoteClientForUrl(url, apiKey = null) {
  const anonKey = apiKey || null;
  // Create remote client with isolated auth settings so we don't conflict
  // with the main app auth client (avoid multiple GoTrueClient warnings)
  const hostKey = (() => {
    try {
      return new URL(url).host.replace(/[:]/g, "-");
    } catch (e) {
      return "remote";
    }
  })();

  return createClient(url, anonKey || "", {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
      // unique storage key per remote host
      storageKey: `sb-remote-${hostKey}`,
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
    },
  });
}

async function findPageInClient({ client, pageKey, extended = false }) {
  // Try by slug
  try {
    const { data: pageBySlug, error: pgError } = await client
      .from("wiki_pages")
      .select("*")
      .eq("slug", pageKey)
      .limit(1)
      .maybeSingle();
    if (pgError) {
      // ignore
    }
    if (pageBySlug) {
      const status = pageBySlug?.metadata?.wiki_page?.status || "active";
      if (status === "active" || extended) return pageBySlug;
    }

    // Try metadata.page_key
    const { data: pagesByKey, error: pkeyError } = await client
      .from("wiki_pages")
      .select("*")
      .filter("metadata->wiki_page->>page_key", "eq", pageKey)
      .limit(1)
      .maybeSingle();
    if (!pkeyError && pagesByKey) {
      const status = pagesByKey?.metadata?.wiki_page?.status || "active";
      if (status === "active" || extended) return pagesByKey;
    }
  } catch (e) {
    console.warn("findPageInClient failed", e.message || e);
  }
  return null;
}

async function getParentHubInfo() {
  const cfg = getFederationConfig();
  if (cfg?.parentHubUrl) {
    return { url: cfg.parentHubUrl };
  }
  return null;
}

/**
 * Resolve page upwards along the federation chain.
 * @param {Object} opts - { hubUrl, pageKey, extended, apiKey }
 * @returns {Promise<{page, hubInfo, resolvedFrom, chain}>}
 */
export async function resolvePage({
  hubUrl = null,
  pageKey,
  extended = false,
  apiKey = null,
  maxDepth = DEFAULT_MAX_DEPTH,
}) {
  let depth = 0;
  const chain = [];
  // Start with local client if hubUrl not provided
  let client = getSupabase();
  let hubInfo = { url: hubUrl || null, subdomain: getLocalSubdomainSafe() };
  while (depth < maxDepth) {
    const found = await findPageInClient({ client, pageKey, extended });
    chain.push({ hub: hubInfo, found: !!found });
    if (found) {
      return { page: found, hubInfo, resolvedFrom: depth === 0 ? "local" : "parent", chain };
    }
    // Move to parent
    const parent = await getParentHubInfo();
    if (!parent || !parent.url) break;
    // create client for parent
    try {
      client = await createRemoteClientForUrl(parent.url, apiKey);
      hubInfo = { url: parent.url, subdomain: parent.url.replace(/https?:\/\//, "") };
    } catch (e) {
      console.warn("create remote client failed", e.message || e);
      break;
    }
    depth++;
  }
  return null;
}

/**
 * Upsert local page - always write locally
 */
export async function upsertLocalPage({
  pageKey,
  slug = null,
  title,
  content,
  authorId = null,
  status = "active",
  parent_revision_global_id = null,
  extraMetadata = {},
}) {
  const supabase = getSupabase();
  const subdomain = getLocalSubdomainSafe();
  const federationCfg = getFederationConfig();
  const isGlobalRoot = federationCfg?.hubType === "national" || federationCfg?.isHub === true;
  const globalId = buildGlobalId({ pageKey, subdomain, isGlobalRoot });

  // Build wiki_page metadata
  const wikiMeta = {
    page_key: pageKey,
    status,
    origin_hub_id: subdomain || "local",
    global_id: globalId,
  };
  if (parent_revision_global_id) wikiMeta.parent_revision_global_id = parent_revision_global_id;

  const newMetadata = { ...(extraMetadata || {}), wiki_page: wikiMeta };

  // Upsert local wiki page (by slug if provided, else pageKey)
  const identifier = slug || pageKey;
  try {
    const { data: existing } = await supabase
      .from("wiki_pages")
      .select("*")
      .eq("slug", identifier)
      .maybeSingle();

    if (existing) {
      // Merge existing metadata
      const mergedMeta = { ...(existing.metadata || {}), ...newMetadata };
      const { error } = await supabase
        .from("wiki_pages")
        .update({ title, content, metadata: mergedMeta, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) throw error;
      return { success: true, id: existing.id };
    }

    const { data: inserted, error: insertError } = await supabase
      .from("wiki_pages")
      .insert({ slug: identifier, title, content, author_id: authorId, metadata: newMetadata })
      .select("id")
      .single();
    if (insertError) throw insertError;
    return { success: true, id: inserted.id };
  } catch (err) {
    console.error("upsertLocalPage error", err.message || err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Archive local page if a direct parent adopted it (has parent_revision_global_id pointing to local.global_id)
 */
export async function archiveLocalPageIfAdoptedUpstream({ pageKey }) {
  const supabase = getSupabase();
  try {
    const { data: local } = await supabase
      .from("wiki_pages")
      .select("*")
      .eq("slug", pageKey)
      .maybeSingle();
    if (!local) return { success: false, reason: "local not found" };
    const localGlobalId = local?.metadata?.wiki_page?.global_id;
    if (!localGlobalId) return { success: false, reason: "no global id on local" };

    const parent = await getParentHubInfo();
    if (!parent || !parent.url) return { success: false, reason: "no parent" };

    // Query parent for page that has parent_revision_global_id == localGlobalId
    const parentClient = await createRemoteClientForUrl(parent.url);
    const { data: parentPage } = await parentClient
      .from("wiki_pages")
      .select("*")
      .filter("metadata->wiki_page->>parent_revision_global_id", "eq", localGlobalId)
      .limit(1)
      .maybeSingle();

    if (!parentPage) return { success: false, reason: "no parent adoption" };

    // Archive local
    const mergedMeta = { ...(local.metadata || {}) };
    mergedMeta.wiki_page = { ...(mergedMeta.wiki_page || {}), status: "archived" };
    const { error } = await supabase
      .from("wiki_pages")
      .update({ metadata: mergedMeta, updated_at: new Date().toISOString() })
      .eq("id", local.id);
    if (error) throw error;
    return { success: true, archived: true };
  } catch (err) {
    console.error("archiveLocalPageIfAdoptedUpstream error", err.message || err);
    return { success: false, error: err.message || String(err) };
  }
}

export async function proposeToParent({ pageKey, notifyParent = false, parentApiKey = null }) {
  // Mark as proposed upstream and optionally notify parent
  try {
    const supabase = getSupabase();
    const { data: local } = await supabase
      .from("wiki_pages")
      .select("*")
      .eq("slug", pageKey)
      .maybeSingle();
    if (!local) return { success: false, reason: "local not found" };
    const mergedMeta = { ...(local.metadata || {}) };
    mergedMeta.wiki_page = { ...(mergedMeta.wiki_page || {}), status: "proposed_upstream" };
    const { error } = await supabase
      .from("wiki_pages")
      .update({ metadata: mergedMeta, updated_at: new Date().toISOString() })
      .eq("id", local.id);
    if (error) throw error;
    // Attempt to notify parent: create a draft on parent instance that references this local version
    let forwarded = false;
    if (notifyParent) {
      const parent = await getParentHubInfo();
      if (parent?.url && parentApiKey) {
        try {
          const remoteClient = await createRemoteClientForUrl(parent.url, parentApiKey);
          const payload = {
            slug: local.slug,
            title: local.title,
            content: local.content,
            author_id: local.author_id || null,
            metadata: {
              wiki_page: {
                page_key: pageKey,
                status: "draft",
                parent_revision_global_id: local.metadata?.wiki_page?.global_id || null,
                origin_hub_id: local.metadata?.wiki_page?.origin_hub_id || null,
              },
            },
          };
          await remoteClient.from("wiki_pages").insert(payload);
          forwarded = true;
        } catch (err) {
          console.warn("notifyParent failed", err.message || err);
        }
      }
    }
    // Notifying parent may have happened above; return status and whether forwarded
    return { success: true, forwarded };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}

export function _buildGlobalId({ pageKey, subdomain, isGlobalRoot }) {
  return buildGlobalId({ pageKey, subdomain, isGlobalRoot });
}

export default {
  resolvePage,
  upsertLocalPage,
  archiveLocalPageIfAdoptedUpstream,
  proposeToParent,
};
