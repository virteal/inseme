export function initMagistral(apiEndpoint) {
  const sidebar = `
        <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-400">Magistral Status</h2>
            <div class="grid grid-cols-2 gap-3 text-xs">
                <div class="space-y-1">
                    <div class="text-slate-500">Nodes</div>
                    <div id="status-nodes" class="text-sm font-mono text-slate-200">-</div>
                </div>
                <div class="space-y-1">
                    <div class="text-slate-500">Requests</div>
                    <div id="status-requests" class="text-sm font-mono text-slate-200">-</div>
                </div>
            </div>
             <button id="refresh-magistral-btn" class="mt-1 inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-800 transition-colors w-full justify-center">
                <span>Refresh Metrics</span>
            </button>
        </div>
    `;

  const nodesTab = `
        <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <div class="flex items-center justify-between">
                <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-400">Routing Map</h2>
                <div class="flex gap-2">
                    <button id="save-map-btn" class="text-[10px] text-sky-400 hover:text-sky-300">Save Map</button>
                    <button id="refresh-nodes-btn" class="text-[10px] text-slate-500 hover:text-slate-300">Refresh</button>
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left text-[11px]">
                    <thead class="text-slate-500 border-b border-slate-800">
                        <tr>
                            <th class="pb-2 font-medium">ID</th>
                            <th class="pb-2 font-medium">Tier</th>
                            <th class="pb-2 font-medium">Status</th>
                            <th class="pb-2 font-medium">Succ/Req</th>
                            <th class="pb-2 font-medium">Latency</th>
                            <th class="pb-2 font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="metrics-body" class="text-slate-300 divide-y divide-slate-800/50">
                        <tr><td colspan="6" class="py-2 text-center text-slate-600">Loading...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

    `;

  const logsTab = `
        <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <div class="flex items-center justify-between">
                <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-400">Traffic Logs</h2>
                <div class="flex gap-2 items-center">
                    <select id="log-node-filter" class="text-[10px] bg-slate-900 border border-slate-700 rounded px-1 py-0.5">
                        <option value="">All nodes</option>
                    </select>
                    <select id="log-status-filter" class="text-[10px] bg-slate-900 border border-slate-700 rounded px-1 py-0.5">
                        <option value="">All status</option>
                        <option value="200">200 OK</option>
                        <option value="error">Errors (!=200)</option>
                    </select>
                    <button id="clear-logs-btn" class="text-[10px] text-red-400 hover:text-red-300">Clear</button>
                    <button id="auto-refresh-logs-btn" class="text-[10px] text-emerald-500">Auto: ON</button>
                </div>
            </div>
            <div id="logs-container" class="overflow-x-auto max-h-80 overflow-y-auto border border-slate-800 rounded">
                <table class="w-full text-left text-[11px]">
                    <thead class="text-slate-500 border-b border-slate-800 sticky top-0 bg-slate-900">
                        <tr>
                            <th class="py-1 px-1 font-medium">Time</th>
                            <th class="py-1 px-1 font-medium">Node</th>
                            <th class="py-1 px-1 font-medium">Tier</th>
                            <th class="py-1 px-1 font-medium">Status</th>
                            <th class="py-1 px-1 font-medium">Latency</th>
                            <th class="py-1 px-1 font-medium">Tokens</th>
                        </tr>
                    </thead>
                    <tbody id="logs-body" class="text-slate-300 divide-y divide-slate-800/50"></tbody>
                </table>
            </div>
            <div id="log-detail" class="hidden mt-2 p-2 border border-slate-700 bg-black/60 rounded text-[10px] font-mono max-h-40 overflow-auto"></div>
            <div class="text-[9px] text-slate-500">Click a row to expand preview. Auto-pauses when scrolled up.</div>
        </div>
    `;

  const exploreTab = `
        <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-400">Model Explorer</h2>
            <div class="flex gap-2">
                <input type="text" id="explore-url" placeholder="Base URL (e.g. https://api.groq.com/openai/v1)" 
                       class="flex-1 bg-black/40 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300">
                <input type="password" id="explore-key" placeholder="API Key (opt.)" 
                       class="w-28 bg-black/40 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300">
                <button id="explore-probe-btn" class="bg-slate-700 text-slate-200 px-3 py-1 rounded text-xs hover:bg-slate-600">Probe</button>
            </div>
            <div id="explore-results" class="hidden mt-3">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs text-slate-400">Available Models</span>
                    <button onclick="window.saveMapFromExplore()" class="text-[10px] text-sky-400 hover:text-sky-300">💾 Save Current Map</button>
                </div>
                <table class="w-full text-left text-[11px]">
                    <thead class="text-slate-500 border-b border-slate-800">
                        <tr>
                            <th class="pb-1">Model ID</th>
                            <th class="pb-1">Tier</th>
                            <th class="pb-1">Action</th>
                        </tr>
                    </thead>
                    <tbody id="explore-body" class="text-slate-300 divide-y divide-slate-800/50"></tbody>
                </table>
            </div>
        </div>
    `;

  return {
    sidebar: sidebar,
    tabs: [
      { id: "nodes", label: "Nodes", content: nodesTab },
      { id: "explore", label: "Explore", content: exploreTab },
      { id: "logs", label: "Logs", content: logsTab },
    ],
    onLoad: () => setupMagistralLogic(apiEndpoint),
  };
}

function setupMagistralLogic(apiEndpoint) {
  const els = {
    metricsBody: document.getElementById("metrics-body"),
    logsBody: document.getElementById("logs-body"),
    refreshMetricsBtn: document.getElementById("refresh-magistral-btn"),
    refreshNodesBtn: document.getElementById("refresh-nodes-btn"),
    saveMapBtn: document.getElementById("save-map-btn"),
    clearLogsBtn: document.getElementById("clear-logs-btn"),
    autoRefreshLogsBtn: document.getElementById("auto-refresh-logs-btn"),
    statusNodes: document.getElementById("status-nodes"),
    statusRequests: document.getElementById("status-requests"),
    // Explore elements (primary discovery now)
    exploreUrl: document.getElementById("explore-url"),
    exploreKey: document.getElementById("explore-key"),
    exploreProbeBtn: document.getElementById("explore-probe-btn"),
    exploreResults: document.getElementById("explore-results"),
    exploreBody: document.getElementById("explore-body"),
    // Logs polish
    logNodeFilter: document.getElementById("log-node-filter"),
    logStatusFilter: document.getElementById("log-status-filter"),
    logsContainer: document.getElementById("logs-container"),
    logDetail: document.getElementById("log-detail"),
  };

  let autoRefreshTimer = null;
  let isAutoRefresh = true;

  // --- API Helpers ---
  async function apiFetch(path, options = {}) {
    const url = `${apiEndpoint}${path}`;
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  // --- Metrics ---
  async function loadMetrics() {
    try {
      const data = await apiFetch("/v1/magistral/metrics");
      const nodes = data.nodes || [];

      // Update Sidebar Status
      els.statusNodes.textContent = nodes.length;
      els.statusRequests.textContent = nodes.reduce((acc, n) => acc + (n.requests || 0), 0);

      // Render Table
      els.metricsBody.innerHTML = nodes
        .map((node) => {
          const isOk = node.status === "active";
          const statusClass = isOk ? "text-emerald-400" : "text-red-400";
          const pct = node.requests > 0 ? Math.round((node.successes / node.requests) * 100) : 0;

          return `
                    <tr class="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td class="py-2 font-mono text-slate-400">${node.id}</td>
                        <td class="py-2"><span class="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 border border-slate-700">${node.tier}</span></td>
                        <td class="py-2 ${statusClass}">${node.status}</td>
                        <td class="py-2 text-slate-400">${node.successes}/${node.requests} (${pct}%)</td>
                        <td class="py-2 font-mono text-slate-400">${node.avgLatencyMs}ms</td>
                        <td class="py-2">
                            ${
                              node.status === "disabled"
                                ? `<button class="text-[10px] text-emerald-400 hover:text-emerald-300" onclick="window.enableNode('${node.id}')">Enable</button>`
                                : `<button class="text-[10px] text-amber-400 hover:text-amber-300" onclick="window.disableNode('${node.id}')">Disable</button>`
                            }
                        </td>
                    </tr>
                `;
        })
        .join("");
    } catch (e) {
      console.error("Metrics Error:", e);
      els.metricsBody.innerHTML = `<tr><td colspan="6" class="py-2 text-center text-red-400">Error loading metrics: ${e.message}</td></tr>`;
    }
  }

  // --- Logs (polished: filters, expansion, freeze, more columns) ---
  let currentLogs = [];
  let isLogsPaused = false;
  let selectedLogId = null;

  async function loadLogs(applyFilters = true) {
    try {
      const data = await apiFetch("/v1/magistral/logs?n=100");
      currentLogs = data.logs || [];

      // Populate node filter options if not already
      if (els.logNodeFilter && els.logNodeFilter.options.length <= 1) {
        const nodes = new Set(currentLogs.map((l) => l.nodeId).filter(Boolean));
        nodes.forEach((n) => {
          const opt = document.createElement("option");
          opt.value = n;
          opt.textContent = n;
          els.logNodeFilter.appendChild(opt);
        });
      }

      let logs = currentLogs;

      if (applyFilters) {
        const nodeF = els.logNodeFilter ? els.logNodeFilter.value : "";
        const statusF = els.logStatusFilter ? els.logStatusFilter.value : "";

        logs = logs.filter((log) => {
          if (nodeF && log.nodeId !== nodeF) return false;
          if (statusF === "200" && log.status !== 200) return false;
          if (statusF === "error" && log.status === 200) return false;
          return true;
        });
      }

      if (logs.length === 0) {
        els.logsBody.innerHTML = `<tr><td colspan="6" class="py-2 text-center text-slate-600">No logs (try clearing filters)</td></tr>`;
        if (els.logDetail) els.logDetail.classList.add("hidden");
        return;
      }

      els.logsBody.innerHTML = logs
        .slice()
        .reverse() // newest first
        .map((log, idx) => {
          const date = new Date(log.ts || log.timestamp || Date.now()).toLocaleTimeString();
          const statusColor =
            log.status === 200
              ? "text-emerald-400"
              : log.status === 0
                ? "text-amber-400"
                : "text-red-400";
          const statusText =
            log.status === 200 ? "200" : log.error ? "ERR" : String(log.status || "?");
          const tier = log.tier || "-";
          const toks =
            (log.promptTokens || 0) + "/" + (log.completionTokens || (log.stream ? "stream" : "0"));
          const lat = log.latencyMs || log.latency || 0;
          const isStream = log.stream ? "⚡" : "";
          const rowId = `${log.id || idx}-${log.ts}`;

          return `
            <tr class="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors log-row" data-log-id="${rowId}">
              <td class="py-1 px-1 text-slate-500 font-mono text-[10px]">${date}</td>
              <td class="py-1 px-1 font-mono text-slate-300">${log.nodeId || "-"}</td>
              <td class="py-1 px-1"><span class="px-1 py-px text-[9px] rounded bg-slate-800">${tier}</span></td>
              <td class="py-1 px-1 ${statusColor}">${statusText} ${isStream}</td>
              <td class="py-1 px-1 font-mono text-slate-400">${lat}ms</td>
              <td class="py-1 px-1 font-mono text-slate-400 text-[10px]">${toks}</td>
            </tr>
          `;
        })
        .join("");

      // Wire row clicks for expansion
      els.logsBody.querySelectorAll(".log-row").forEach((row) => {
        row.addEventListener("click", () => {
          const logId = row.dataset.logId;
          showLogDetail(logId, logs);
          // highlight
          els.logsBody
            .querySelectorAll(".log-row")
            .forEach((r) => r.classList.remove("bg-slate-800"));
          row.classList.add("bg-slate-800");
        });
      });

      // Auto-scroll to bottom unless paused
      if (!isLogsPaused && els.logsContainer) {
        els.logsContainer.scrollTop = els.logsContainer.scrollHeight;
      }
    } catch (e) {
      console.error("Logs Error:", e);
      els.logsBody.innerHTML = `<tr><td colspan="6" class="py-2 text-center text-red-400">Error loading logs</td></tr>`;
    }
  }

  function showLogDetail(logId, logsList) {
    if (!els.logDetail) return;
    const log = logsList.find((l, i) => `${l.id || i}-${l.ts}` === logId) || {};
    selectedLogId = logId;

    const isErr = log.status !== 200;
    const preview = log.preview
      ? log.preview.slice(0, 300) + (log.preview.length > 300 ? "..." : "")
      : "(no preview captured)";
    const detailHtml = `
      <div class="flex justify-between mb-1">
        <span class="text-emerald-300">${log.nodeId} · ${log.tier || ""} · ${new Date(log.ts).toLocaleString()}</span>
        <button class="text-[10px] text-slate-400 hover:text-white" onclick="document.getElementById('log-detail').classList.add('hidden')">✕</button>
      </div>
      <div>Status: <span class="${isErr ? "text-red-400" : "text-emerald-400"}">${log.status}</span> ${log.stream ? " (stream)" : ""}</div>
      <div>Latency: ${log.latencyMs || 0}ms | Tokens: ${log.promptTokens || 0}/${log.completionTokens || 0}</div>
      ${log.error ? `<div class="text-red-400">Error: ${log.error}</div>` : ""}
      <div class="mt-1 text-slate-400">Preview:</div>
      <div class="whitespace-pre-wrap text-slate-200">${preview}</div>
      <details class="mt-1"><summary class="cursor-pointer text-slate-400">Raw entry</summary><pre class="text-[9px]">${JSON.stringify(log, null, 2)}</pre></details>
    `;
    els.logDetail.innerHTML = detailHtml;
    els.logDetail.classList.remove("hidden");
  }

  // Freeze detection
  function setupLogsFreeze() {
    if (!els.logsContainer) return;
    els.logsContainer.addEventListener("scroll", () => {
      const { scrollTop, scrollHeight, clientHeight } = els.logsContainer;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 10;
      if (!atBottom && !isLogsPaused) {
        isLogsPaused = true;
        if (els.autoRefreshLogsBtn) {
          els.autoRefreshLogsBtn.textContent = "Auto: PAUSED (scroll to bottom)";
          els.autoRefreshLogsBtn.className = "text-[10px] text-amber-400";
        }
      } else if (atBottom && isLogsPaused) {
        // user scrolled back to bottom -> resume
        isLogsPaused = false;
        if (els.autoRefreshLogsBtn) {
          els.autoRefreshLogsBtn.textContent = "Auto: ON";
          els.autoRefreshLogsBtn.className = "text-[10px] text-emerald-500";
        }
      }
    });
  }

  // --- Probe (Explore tab primary) ---
  async function probeProvider() {
    const urlEl = els.exploreUrl;
    const keyEl = els.exploreKey;
    const btn = els.exploreProbeBtn;
    const resultsContainer = els.exploreResults;
    const tbody = els.exploreBody;

    const baseUrl = urlEl?.value;
    const apiKey = keyEl?.value;

    if (!baseUrl) return alert("Base URL required");

    if (btn) {
      btn.textContent = "Probing...";
      btn.disabled = true;
    }

    try {
      const data = await apiFetch("/v1/magistral/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, apiKey }),
      });

      if (resultsContainer) resultsContainer.classList.remove("hidden");

      const models = data.data || [];
      tbody.innerHTML = models
        .map((m) => {
          const tier =
            m.id.includes("8b") || m.id.includes("7b") || m.id.includes("instant")
              ? "fast"
              : "strong";
          return `
            <tr class="border-b border-slate-800/50">
              <td class="py-1 font-mono text-emerald-300">${m.id}</td>
              <td class="py-1">
                <span class="px-1.5 py-0.5 text-[10px] rounded bg-slate-800">${tier}</span>
              </td>
              <td class="py-1">
                <button class="text-[10px] text-sky-400 hover:text-sky-300" 
                        onclick="window.addNodeFromExplore('${m.id}', '${tier}', '${baseUrl}')">
                  Add to Map
                </button>
              </td>
            </tr>`;
        })
        .join("");
    } catch (e) {
      alert("Probe failed: " + e.message);
    } finally {
      if (btn) {
        btn.textContent = "Probe";
        btn.disabled = false;
      }
    }
  }

  // Global helper for the new Explore UI
  window.addNodeFromExplore = async (modelId, tier, baseUrl) => {
    const cleanBase = baseUrl.replace(/\/+$/, "");
    const node = {
      id: modelId,
      url: cleanBase.endsWith("/chat/completions") ? cleanBase : `${cleanBase}/chat/completions`,
      model: modelId,
      tier,
      weight: 10,
    };

    try {
      await apiFetch("/v1/magistral/map/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(node),
      });
      alert(`✅ ${modelId} added to map`);
      // Refresh nodes view if available
      if (typeof loadMetrics === "function") loadMetrics();
    } catch (e) {
      alert("Failed to add: " + e.message);
    }
  };

  window.saveMapFromExplore = async () => {
    try {
      const res = await apiFetch("/v1/magistral/map/save", { method: "POST" });
      alert("Map saved to " + (res.path || "registry"));
    } catch (e) {
      alert("Save failed: " + e.message);
    }
  };

  // --- Global Actions (exposed for inline onclicks) ---
  window.enableNode = async (id) => {
    await apiFetch(`/v1/magistral/nodes/${id}/enable`, { method: "POST" });
    loadMetrics();
  };

  window.disableNode = async (id) => {
    await apiFetch(`/v1/magistral/nodes/${id}/disable`, { method: "POST" });
    loadMetrics();
  };

  window.addNode = async (modelId, baseUrl) => {
    const tier = modelId.includes("8b") || modelId.includes("7b") ? "fast" : "strong";
    const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
    const node = {
      id: modelId,
      url: cleanBaseUrl.endsWith("/chat/completions")
        ? cleanBaseUrl
        : `${cleanBaseUrl}/chat/completions`,
      model: modelId,
      tier: tier,
      weight: 10,
    };

    try {
      await apiFetch("/v1/magistral/map/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(node),
      });
      alert(`Node ${modelId} added!`);
      loadMetrics();
    } catch (e) {
      alert("Failed to add node: " + e.message);
    }
  };

  // --- Event Listeners ---
  if (els.refreshMetricsBtn) els.refreshMetricsBtn.addEventListener("click", loadMetrics);
  if (els.refreshNodesBtn) els.refreshNodesBtn.addEventListener("click", loadMetrics);

  if (els.exploreProbeBtn) {
    els.exploreProbeBtn.addEventListener("click", () => probeProvider());
  }

  if (els.saveMapBtn)
    els.saveMapBtn.addEventListener("click", async () => {
      try {
        await apiFetch("/v1/magistral/map/save", { method: "POST" });
        alert("Map saved successfully");
      } catch (e) {
        alert("Save failed: " + e.message);
      }
    });

  if (els.clearLogsBtn)
    els.clearLogsBtn.addEventListener("click", async () => {
      await apiFetch("/v1/magistral/logs", { method: "DELETE" });
      currentLogs = [];
      if (els.logDetail) els.logDetail.classList.add("hidden");
      isLogsPaused = false;
      loadLogs(false);
    });

  if (els.autoRefreshLogsBtn)
    els.autoRefreshLogsBtn.addEventListener("click", () => {
      isAutoRefresh = !isAutoRefresh;
      if (!isAutoRefresh) {
        isLogsPaused = true;
      } else {
        isLogsPaused = false;
      }
      els.autoRefreshLogsBtn.textContent = isAutoRefresh ? "Auto: ON" : "Auto: OFF";
      els.autoRefreshLogsBtn.className = isAutoRefresh
        ? "text-[10px] text-emerald-500"
        : "text-[10px] text-slate-500";
    });

  // Wire filter changes to reload logs (client-side re-filter on current data)
  if (els.logNodeFilter) els.logNodeFilter.addEventListener("change", () => loadLogs(true));
  if (els.logStatusFilter) els.logStatusFilter.addEventListener("change", () => loadLogs(true));

  // Auto Refresh Loop (respects isLogsPaused for the container scroll state)
  setInterval(() => {
    if (document.getElementById("nodes")?.classList.contains("active")) {
      loadMetrics();
    }
    const logsTabEl = document.getElementById("logs");
    if (logsTabEl?.classList.contains("active") && isAutoRefresh && !isLogsPaused) {
      loadLogs(true);
    }
  }, 2500);

  // Initial Load
  loadMetrics();
  // Kick an initial logs load (will also populate node filter)
  setTimeout(() => loadLogs(false), 300);

  setupLogsFreeze();
}
