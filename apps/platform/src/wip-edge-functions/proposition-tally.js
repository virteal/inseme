import { getConfig, getSupabase } from "../../common/config/instanceConfig.edge.js";

export default async (request, context) => {
  // CORS params
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  // Parse URL: /api/tally/PROPOSITION_ID
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const propositionId = pathParts[pathParts.length - 1];

  if (!propositionId) {
    return new Response(JSON.stringify({ error: "Missing proposition ID" }), {
      status: 400,
      headers,
    });
  }

  const supabase = getSupabase();

  try {
    // 1. Fetch Proposition Tags
    const { data: propTags, error: tagError } = await supabase
      .from("proposition_tags")
      .select("tag_id")
      .eq("proposition_id", propositionId);

    if (tagError) throw tagError;
    const tagIds = propTags.map((t) => t.tag_id);

    // 2. Fetch Direct Votes
    const { data: directVotes, error: voteError } = await supabase
      .from("votes")
      .select("user_id, vote_value, metadata")
      .eq("proposition_id", propositionId);

    if (voteError) throw voteError;

    // 3. Fetch Relevant Delegations for these tags
    // We want delegations where tag_id IN tagIds
    const { data: delegations, error: delError } = await supabase
      .from("delegations")
      .select("delegator_id, delegate_id, tag_id")
      .in("tag_id", tagIds);

    if (delError) throw delError;

    // 4. Calculate Liquid Tally
    const finalVotes = new Map(); // userId -> { value, source: 'direct' | 'proxy', metadata }

    // First pass: Direct votes (Overrides everything)
    directVotes.forEach((v) => {
      finalVotes.set(v.user_id, { value: v.vote_value, source: "direct", metadata: v.metadata });
    });

    // Second pass: Delegations
    // For each delegation, if Delegator hasn't voted, apply Delegate's vote
    // Note: This needs to handle chains (transitivity) ideally, but for MVP 1-level depth:
    // Iterate delegations. If Delegate has a Direct Vote, apply to Delegator.

    // We need to know who the delegates voted for.
    const delegateVotes = new Map(); // delegateId -> { value, metadata }
    directVotes.forEach((v) => {
      delegateVotes.set(v.user_id, { value: v.vote_value, metadata: v.metadata });
    });

    delegations.forEach((d) => {
      // If Delegator already voted directly, skip (Sovereignty Override)
      if (finalVotes.has(d.delegator_id)) return;

      // If Delegate has voted directly...
      if (delegateVotes.has(d.delegate_id)) {
        const delegateVote = delegateVotes.get(d.delegate_id);
        // Apply vote
        finalVotes.set(d.delegator_id, {
          value: delegateVote.value,
          source: "proxy",
          delegate: d.delegate_id,
          metadata: delegateVote.metadata,
        });
      }
    });

    // 5. Aggregate results
    let approve = 0;
    let disapprove = 0;
    let neutral = 0;
    let falseChoice = 0;
    let proxyCount = 0;
    const refusalReasons = {};

    const normalizeVote = (val) => {
      if (val === true || val === "approve") return "approve";
      if (val === false || val === "disapprove") return "disapprove";
      if (val === null || val === "neutral" || val === "blank") return "neutral";
      if (val === "false_choice") return "false_choice";
      return "neutral";
    };

    finalVotes.forEach((vote) => {
      const type = normalizeVote(vote.value);
      if (type === "approve") approve++;
      else if (type === "disapprove") disapprove++;
      else if (type === "neutral") neutral++;
      else if (type === "false_choice") {
        falseChoice++;
        const reason = vote.metadata?.refusal_reason || "unspecified";
        refusalReasons[reason] = (refusalReasons[reason] || 0) + 1;
      }

      if (vote.source === "proxy") proxyCount++;
    });

    return new Response(
      JSON.stringify({
        approve,
        disapprove,
        neutral, // Sent as 'neutral' equivalent to blank
        blank: neutral, // Backwards compat
        falseChoice,
        refusalReasons,
        total: approve + disapprove + neutral + falseChoice,
        directCount: directVotes.length,
        proxyCount: proxyCount,
      }),
      { headers }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};
