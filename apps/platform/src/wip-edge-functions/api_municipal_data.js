import { getSupabase } from "./lib/supabase.js";

export default async (request, context) => {
  const url = new URL(request.url);
  const path = url.pathname;

  const supabase = getSupabase();

  // Router
  if (path.endsWith("/api/municipal/pois")) {
    return handleGetPois(request, supabase);
  } else if (path.endsWith("/api/municipal/events")) {
    return handleGetEvents(request, supabase);
  }

  return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
};

async function handleGetPois(req, supabase) {
  const url = new URL(req.url);
  const category = url.searchParams.get("category");

  let query = supabase
    .from("municipal_poi")
    .select("id, name, category, subcategory, description, latitude, longitude, metadata");

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Transform to GeoJSON
  const geojson = {
    type: "FeatureCollection",
    features: data.map((item) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [item.longitude, item.latitude],
      },
      properties: {
        id: item.id,
        name: item.name,
        category: item.category,
        description: item.description,
        ...item.metadata,
      },
    })),
  };

  return new Response(JSON.stringify(geojson), {
    headers: { "Content-Type": "application/json" },
  });
}

async function handleGetEvents(req, supabase) {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "50");

  const { data, error } = await supabase
    .from("posts")
    .select("id, title, content, type, metadata, created_at") // Start/End date might be in metadata or cols if migration ran
    .eq("type", "event")
    .order("created_at", { ascending: false }) // Or order by event_date if available
    .limit(limit);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Map to simple JSON list (not necessarily GeoJSON unless we have point data)
  const events = data.map((post) => {
    // If we have geom, we could return GeoJSON.
    // For now assuming list format, but checking metadata for coords if we want map display
    return {
      id: post.id,
      title: post.title,
      description: post.content, // content might be HTML
      start_date: post.metadata?.event_start,
      end_date: post.metadata?.event_end,
      url: post.metadata?.source_url,
      location: post.metadata?.location, // if stored
    };
  });

  return new Response(JSON.stringify(events), {
    headers: { "Content-Type": "application/json" },
  });
}
