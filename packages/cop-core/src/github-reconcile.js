/**
 * Gap detection vs webhook history (Inseme #29).
 * Webhook delivery is not the permanent archive — reconcile periodically.
 *
 * This module is pure: inject GitHub list function for tests / live clients.
 */

/**
 * @param {object} options
 * @param {string[]} options.repositories allowlisted repos
 * @param {(repo: string) => Promise<Array<{ id: string, type: string, created_at: string }>>} options.listRecentEvents
 *   GitHub-like events (or commits/issues summary)
 * @param {Array<{ delivery_id: string, repository_name: string, event_name: string, received_at: string }>} options.knownDeliveries
 * @param {number} [options.lookbackHours=72]
 */
export async function reconcileGithubObservation(options) {
  const repos = options.repositories || [];
  const known = options.knownDeliveries || [];
  const lookbackMs = (options.lookbackHours ?? 72) * 3600 * 1000;
  const since = Date.now() - lookbackMs;

  const knownKeys = new Set(
    known.map((d) => `${d.repository_name}|${d.event_name}|${d.delivery_id}`)
  );

  const gaps = [];
  const observed = [];

  for (const repo of repos) {
    const remote = await options.listRecentEvents(repo);
    for (const ev of remote) {
      const ts = Date.parse(ev.created_at || "") || 0;
      if (ts && ts < since) continue;
      observed.push({ repository: repo, ...ev });
      // Without delivery id from GitHub Events API, use synthetic key
      const key = `${repo}|${ev.type}|${ev.id}`;
      const matched = [...knownKeys].some(
        (k) => k.startsWith(`${repo}|`) && k.includes(String(ev.id))
      );
      if (!matched && !known.some((d) => d.repository_name === repo && d.delivery_id === ev.id)) {
        gaps.push({
          repository: repo,
          remote_id: ev.id,
          remote_type: ev.type,
          created_at: ev.created_at,
          hint: "Possible missed webhook; fetch via GitHub API and backfill delivery+event",
        });
      }
      void key;
    }
  }

  return {
    schema: "cop.github-reconcile.v1",
    generated_at: new Date().toISOString(),
    repositories: repos,
    remote_observed: observed.length,
    known_deliveries: known.length,
    gaps,
    ok: gaps.length === 0,
  };
}
