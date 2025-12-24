import {
  loadInstanceConfig,
  getConfig,
  getSupabase,
} from "../../common/config/instanceConfig.edge.js";

export default async (request, context) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/feed+json",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  // Expected: ["api", "feed", "TYPE", "OPTIONAL_ID"]
  const feedType = pathParts[2];
  const paramId = pathParts[3];

  const limit = parseInt(url.searchParams.get("limit") || "20");
  const cursor = url.searchParams.get("cursor"); // timestamp for pagination

  // Initialize Supabase
  await loadInstanceConfig();
  const supabase = getSupabase();

  // Instance Info (for metadata)
  const instanceName = getConfig("COMMUNITY_NAME", "Corte");
  const instanceUrl = url.origin;

  let items = [];
  let feedTitle = `${instanceName} Feed`;
  let feedDescription = `Updates from ${instanceName}`;
  let homePageUrl = instanceUrl;
  let feedUrl = request.url;

  try {
    if (feedType === "posts") {
      feedTitle = `${instanceName} - Posts`;
      let query = supabase
        .from("posts")
        .select("id, content, created_at, author:users(id, display_name), metadata")
        .eq("metadata->>federated", "true") // Strict Ascending Subsidiarity
        .order("created_at", { ascending: false })
        .limit(limit);

      if (cursor) query = query.lt("created_at", cursor);

      const { data, error } = await query;
      if (error) throw error;

      items = (data || []).map((post) => ({
        id: post.id,
        url: `${instanceUrl}/posts/${post.id}`,
        title: post.metadata?.title || "Post",
        content_html: post.content, // Assuming content is HTML or Markdown
        content_text: post.content,
        date_published: post.created_at,
        author: {
          name: post.author?.display_name || "Unknown",
          url: `${instanceUrl}/users/${post.author?.id}`,
        },
        _meta: {
          instance: instanceUrl,
          item_type: "post",
          tags: post.metadata?.tags || [],
        },
      }));
    } else if (feedType === "propositions") {
      feedTitle = `${instanceName} - Propositions`;
      let query = supabase
        .from("propositions")
        .select(
          "id, title, description, created_at, status, author:users(id, display_name), metadata"
        )
        .eq("status", "active") // Only active propositions?
        .eq("metadata->>federated", "true") // Strict Ascending Subsidiarity
        .order("created_at", { ascending: false })
        .limit(limit);

      if (cursor) query = query.lt("created_at", cursor);

      const { data, error } = await query;
      if (error) throw error;

      items = (data || []).map((prop) => ({
        id: prop.id,
        url: `${instanceUrl}/propositions/${prop.id}`,
        title: prop.title,
        content_html: `<p>${prop.description}</p>`,
        content_text: prop.description,
        date_published: prop.created_at,
        author: {
          name: prop.author?.display_name || "Unknown",
          url: `${instanceUrl}/users/${prop.author?.id}`,
        },
        _meta: {
          instance: instanceUrl,
          item_type: "proposition",
          status: prop.status,
        },
      }));
    } else if (feedType === "wiki") {
      feedTitle = `${instanceName} - Wiki Fédéré`;
      let query = supabase
        .from("wiki_pages")
        .select(
          "id, title, slug, summary, content, updated_at, author:users(id, display_name), metadata"
        )
        .eq("metadata->>federated", "true") // Strict Ascending Subsidiarity
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (cursor) query = query.lt("updated_at", cursor);

      const { data, error } = await query;
      if (error) throw error;

      items = (data || []).map((page) => ({
        id: page.id,
        url: `${instanceUrl}/wiki/${page.slug}`,
        title: page.title,
        content_html: page.summary
          ? `<p>${page.summary}</p>`
          : page.content?.substring(0, 500) + "...",
        content_text: page.content,
        date_published: page.updated_at,
        author: {
          name: page.author?.display_name || "Communauté",
          url: `${instanceUrl}/users/${page.author?.id}`,
        },
        _meta: {
          instance: instanceUrl,
          item_type: "wiki",
          slug: page.slug,
        },
      }));
    } else if (feedType === "activity" && paramId) {
      // User Activity Feed
      const userId = paramId;

      // Validate UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(userId)) {
        return new Response(JSON.stringify({ error: "Invalid user ID format" }), {
          status: 400,
          headers,
        });
      }

      // Check public_profile
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("display_name, public_profile")
        .eq("id", userId)
        .single();

      if (userError) {
        if (userError.code === "PGRST116") {
          return new Response(JSON.stringify({ error: "User not found" }), {
            status: 404,
            headers,
          });
        }
        throw userError;
      }

      if (!user) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers,
        });
      }

      if (user.public_profile === false) {
        return new Response(JSON.stringify({ error: "User profile is private" }), {
          status: 403,
          headers,
        });
      }

      feedTitle = `${user.display_name} - Activity on ${instanceName}`;

      // Fetch combined activity (posts, propositions, comments)
      // This is complex with Supabase simple queries.
      // For MVP, let's fetch posts by user.
      // Ideally we'd have an 'activity' view or table.
      // Let's just return posts for now as a proof of concept.

      let query = supabase
        .from("posts")
        .select("id, content, created_at, metadata")
        .eq("author_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (cursor) query = query.lt("created_at", cursor);

      const { data, error } = await query;
      if (error) throw error;

      // Fetch stats (simple count for now)
      const [
        { count: postCount, error: countError },
        { count: propCount, error: propError },
        { count: voteCount, error: voteError },
      ] = await Promise.all([
        supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", userId),
        supabase
          .from("propositions")
          .select("id", { count: "exact", head: true })
          .eq("author_id", userId),
        supabase.from("votes").select("id", { count: "exact", head: true }).eq("user_id", userId),
      ]);

      if (countError) console.error("Error fetching post count:", countError);
      if (propError) console.error("Error fetching prop count:", propError);
      if (voteError) console.error("Error fetching vote count:", voteError);

      items = (data || []).map((post) => ({
        id: post.id,
        url: `${instanceUrl}/posts/${post.id}`,
        title: post.metadata?.title || "Activity",
        content_html: post.content,
        content_text: post.content,
        date_published: post.created_at,
        author: {
          name: user.display_name,
          url: `${instanceUrl}/users/${userId}`,
        },
        _meta: {
          instance: instanceUrl,
          item_type: "post",
          group_id: post.metadata?.group_id,
        },
      }));

      // Add stats to the feed top-level extension
      // JSON Feed 1.1 allows custom fields starting with _
      // We'll add _stats object
      var feedStats = {
        posts: postCount || 0,
        propositions: propCount || 0,
        votes: voteCount || 0,
      };

      // TODO: Add propositions and comments to this stream
    } else if (feedType === "notifications" && paramId) {
      // Notifications are PRIVATE. This endpoint should probably require auth or a secret token.
      // For "Civic Inbox", if it's cross-instance, how do we auth?
      // Usually via a token generated on the home instance and stored on the remote instance?
      // Or just open if we assume "public notifications" (mentions in public posts)?
      // Let's assume public mentions for now, but this is sensitive.
      // User requested "Unified Civic Inbox".
      // Let's return empty for now or implement basic public mentions.
      items = [];
      feedDescription = "Notifications feed - Implementation pending auth design";
    } else {
      return new Response(JSON.stringify({ error: "Invalid feed type" }), { status: 400, headers });
    }

    const jsonFeed = {
      version: "https://jsonfeed.org/version/1.1",
      title: feedTitle,
      home_page_url: homePageUrl,
      feed_url: feedUrl,
      description: feedDescription,
      items: items,
      _stats: typeof feedStats !== "undefined" ? feedStats : undefined,
    };

    return new Response(JSON.stringify(jsonFeed), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};
