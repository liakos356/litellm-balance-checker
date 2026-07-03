import {
  COMMON_CSS,
  buildThemeOverrides,
  buildLoadingHtml,
  escapeHtml,
  usd,
  getRelativeTime,
  svgLineChart,
  svgDonut,
} from "../helpers";
import {
  KeyInfoResponse,
  ProviderBudgetResponse,
  GlobalSpendReportEntry,
  SpendLogEntry,
  HealthResponse,
  ReadinessResponse,
  GlobalSpendProvidersResponse,
} from "../types";

interface UnifiedDashboardData {
  keyInfo: KeyInfoResponse | null;
  providerBudgets: ProviderBudgetResponse | null;
  globalReport: GlobalSpendReportEntry[];
  spendLogs: SpendLogEntry[];
  health: HealthResponse | null;
  readiness: ReadinessResponse | null;
  providerSpend: GlobalSpendProvidersResponse | null;
  keyError: string | null;
  providerError: string | null;
  reportError: string | null;
  healthError: string | null;
  readinessError: string | null;
  providerSpendError: string | null;
  activeTheme?: string;
  dateRange?: string;
  activeTab?: string;
}

export function buildUnifiedDashboardHtml(data: UnifiedDashboardData): string {
  const {
    keyInfo,
    providerBudgets,
    globalReport,
    spendLogs,
    health,
    readiness,
    providerSpend,
    keyError,
    providerError,
    reportError,
    healthError,
    readinessError,
    providerSpendError,
    activeTheme,
    dateRange,
    activeTab = "overview",
  } = data;

  const theme = activeTheme || "vscode";
  const themeOverride = buildThemeOverrides(theme);

  // Detect permission errors (non-admin user)
  const permErrors: string[] = [];
  for (const err of [providerError, reportError, healthError, readinessError, providerSpendError]) {
    if (err && (err.includes("lacks management permissions") || err.includes("403"))) {
      permErrors.push(err);
    }
  }
  const isPermissionsIssue = permErrors.length > 0;

  // Aggregate spend data
  let totalSpend = 0;
  let totalRequests = 0;
  let totalTokens = 0;
  const dailyData: { label: string; spend: number }[] = [];
  for (const day of globalReport) {
    const ds = day.teams?.reduce((s, t) => s + (t.spend ?? 0), 0) ?? 0;
    totalSpend += ds;
    const label = day["group-by-day"] ? day["group-by-day"].slice(5) : "?";
    dailyData.push({ label, spend: ds });
    for (const team of day.teams ?? []) {
      for (const k of team.keys ?? []) {
        for (const usage of Object.values(k.usage ?? {})) {
          totalRequests += usage.requests ?? 0;
          totalTokens += (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0);
        }
      }
    }
  }

  const effectiveTotalSpend =
    totalSpend > 0 ? totalSpend : (keyInfo?.spend ?? 0);
  const spend = keyInfo?.spend ?? 0;
  const maxB = keyInfo?.max_budget;
  const remaining = maxB != null ? Math.max(0, maxB - spend) : null;
  const usedPct = maxB != null && maxB > 0 ? (spend / maxB) * 100 : 0;
  const barColor = usedPct > 80 ? "red" : usedPct > 50 ? "yellow" : "green";

  const dailyChart =
    dailyData.length >= 2
      ? svgLineChart(
          dailyData.map((d) => ({ label: d.label, value: d.spend })),
          360,
          100,
        )
      : "";

  // Model usage from logs
  const modelMap = new Map<string, number>();
  for (const log of spendLogs) {
    const m = log.model || "unknown";
    modelMap.set(m, (modelMap.get(m) ?? 0) + (log.spend ?? 0));
  }
  const modelChartData = [...modelMap.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const modelDonut =
    modelChartData.length > 0 ? svgDonut(modelChartData, 120, 24) : "";

  // Health summary
  const healthyCount = health?.healthy_count ?? 0;
  const unhealthyCount = health?.unhealthy_count ?? 0;
  const proxyStatus = readiness?.status ?? "?";

  // Provider spend summary
  const providerList = providerSpend?.providers ?? [];
  const totalProviderSpend = providerList.reduce(
    (s, p) => s + (p.total_spend ?? 0),
    0,
  );

  // Forecast (simple linear)
  const forecastSpend =
    dailyData.length >= 2
      ? (dailyData.reduce((s, d) => s + d.spend, 0) / dailyData.length) * 30
      : 0;

  const alias =
    keyInfo?.key_alias || keyInfo?.key_name || keyInfo?.key || "\u2014";

  const tabs = [
    { id: "overview", label: "\u{1F4CA} Overview" },
    { id: "spend", label: "\u{1F4B0} Spend" },
    { id: "health", label: "\u{1F3E5} Health" },
    { id: "providers", label: "\u2601\uFE0F Providers" },
    { id: "models", label: "\u{1F916} Models" },
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${COMMON_CSS}${themeOverride}</style>
</head>
<body>
<h2>\u{1F3DB}\uFE0F CoreLLM Dashboard
  <span class="title-actions">
    <span class="theme-btn" id="themeBtn" title="Toggle theme">\u{1F3A8}</span>
    <button class="toolbar-btn" id="exportCsvBtn" title="Export as CSV">\u{1F4E5}</button>
    <button class="toolbar-btn primary" id="refreshBtn" title="Refresh all">\u{1F504} Refresh</button>
  </span>
</h2>

<!-- Tab bar -->
<div class="tab-bar" id="tabBar">
  ${tabs
    .map(
      (t) =>
        `<button class="tab-btn${t.id === activeTab ? " active" : ""}" data-tab="${t.id}">${t.label}</button>`,
    )
    .join("")}
</div>

<!-- Toast -->
<div class="toast" id="toast"></div>

<!-- Admin permissions banner -->
${isPermissionsIssue ? `<div class="admin-banner">\u26A0\uFE0F Limited view: some dashboard features require an admin/proxy master key. <span class="admin-banner-link" onclick="vscode.postMessage({type:'openSettings'})">Configure in settings</span></div>` : ""}

<!-- ========================= OVERVIEW TAB ========================= -->
<div class="tab-content${activeTab === "overview" ? " active" : ""}" id="tab-overview">

<!-- Summary bar -->
<div class="summary-bar">
  <div class="summary-item"><div class="summary-value">${usd(effectiveTotalSpend)}</div><div class="summary-label">Total Spend</div></div>
  <div class="summary-item"><div class="summary-value">${maxB != null && maxB > 0 ? usedPct.toFixed(1) + "%" : "\u2014"}</div><div class="summary-label">Used</div></div>
  <div class="summary-item"><div class="summary-value ${remaining != null && remaining <= 0 ? "err" : remaining != null && maxB != null && remaining / maxB <= 0.2 ? "warn" : "ok"}">${remaining != null ? usd(remaining, 4) : "\u221E"}</div><div class="summary-label">Remaining</div></div>
  <div class="summary-item"><div class="summary-value">${totalRequests.toLocaleString()}</div><div class="summary-label">Requests</div></div>
</div>

<!-- Key info -->
<div class="card">
  <h3>\u{1F511} Key: ${escapeHtml(alias)}</h3>
  ${keyError ? `<div class="error-box">\u26A0 ${escapeHtml(keyError)}</div>` : ""}
  <div class="grid">
    <div class="stat"><div class="stat-value">${usd(spend, 4)}</div><div class="stat-label">Spend</div></div>
    <div class="stat"><div class="stat-value">${usd(maxB)}</div><div class="stat-label">Budget</div></div>
    <div class="stat"><div class="stat-value ${remaining != null && remaining <= 0 ? "err" : "ok"}">${remaining != null ? usd(remaining, 4) : "\u221E"}</div><div class="stat-label">Remaining</div></div>
    <div class="stat"><div class="stat-value">${maxB != null && maxB > 0 ? usedPct.toFixed(1) + "%" : "\u2014"}</div><div class="stat-label">Used</div></div>
  </div>
  ${maxB != null && maxB > 0 ? `<div class="bar-container"><div class="bar-fill ${barColor}" style="width:${Math.min(100, usedPct)}%"></div></div>` : ""}
</div>

<!-- Forecast -->
${forecastSpend > 0
  ? `<div class="card">
  <h3>\u{1F52E} 30-Day Forecast</h3>
  <div class="grid">
    <div class="stat"><div class="stat-value">${usd(forecastSpend)}</div><div class="stat-label">Projected Spend</div></div>
    <div class="stat"><div class="stat-value ${maxB != null && forecastSpend > maxB ? "err" : "ok"}">${maxB != null && maxB > 0 ? ((forecastSpend / maxB) * 100).toFixed(1) + "% of budget" : "No budget"}</div><div class="stat-label">Budget Impact</div></div>
  </div>
</div>`
  : ""}

<!-- Spend trend -->
${
  dailyChart
    ? `<div class="card"><h3>\u{1F4C8} Spend Trend</h3>${dailyChart}</div>`
    : ""
}

<!-- Health quick view -->
<div class="card">
  <h3>\u{1F3E5} Health at a Glance</h3>
  <div class="grid">
    <div class="stat"><div class="stat-value ok">${healthyCount}</div><div class="stat-label">Healthy</div></div>
    <div class="stat"><div class="stat-value ${unhealthyCount > 0 ? "err" : "ok"}">${unhealthyCount}</div><div class="stat-label">Unhealthy</div></div>
    <div class="stat"><div class="stat-value">${readiness?.litellm_version ?? "\u2014"}</div><div class="stat-label">Version</div></div>
    <div class="stat"><div class="stat-value ${proxyStatus === "ok" ? "ok" : "warn"}">${proxyStatus}</div><div class="stat-label">Proxy</div></div>
  </div>
</div>
</div>

<!-- ========================= SPEND TAB ========================= -->
<div class="tab-content${activeTab === "spend" ? " active" : ""}" id="tab-spend">
<div class="summary-bar">
  <div class="summary-item"><div class="summary-value">${usd(effectiveTotalSpend)}</div><div class="summary-label">Total Spend</div></div>
  <div class="summary-item"><div class="summary-value">${totalTokens.toLocaleString()}</div><div class="summary-label">Tokens</div></div>
  <div class="summary-item"><div class="summary-value">${totalRequests.toLocaleString()}</div><div class="summary-label">Requests</div></div>
  <div class="summary-item"><div class="summary-value">${globalReport.length}</div><div class="summary-label">Days</div></div>
</div>
${
  dailyChart
    ? `<div class="card"><h3>\u{1F4C8} Daily Spend Trend</h3>${dailyChart}</div>`
    : ""
}
${
  spendLogs.length > 0
    ? `<div class="card">
  <h3>\u{1F4CB} Recent Spend</h3>
  <div class="table-wrap"><table><thead><tr><th>Time</th><th>Model</th><th>Type</th><th>Spend</th><th>Tokens</th></tr></thead>
  <tbody>${spendLogs
    .slice(0, 10)
    .map((l) => {
      const ts = l.startTime ? new Date(l.startTime) : null;
      const rel = ts ? getRelativeTime(ts) : "";
      return `<tr>
    <td>${ts ? ts.toLocaleString() : "\u2014"}${rel ? `<span class="rel-time">(${rel})</span>` : ""}</td>
    <td>${escapeHtml(l.model ?? "\u2014")}</td>
    <td><span class="badge">${escapeHtml(l.call_type ?? "\u2014")}</span></td>
    <td>${usd(l.spend, 6)}</td>
    <td>${(l.total_tokens ?? 0).toLocaleString()}</td>
  </tr>`;
    })
    .join("")}</tbody></table></div>
</div>`
    : ""
}
</div>

<!-- ========================= HEALTH TAB ========================= -->
<div class="tab-content${activeTab === "health" ? " active" : ""}" id="tab-health">
${healthError && !isPermissionsIssue ? `<div class="error-box">\u26A0 ${escapeHtml(healthError)}</div>` : ""}
${readinessError && !isPermissionsIssue ? `<div class="error-box">\u26A0 ${escapeHtml(readinessError)}</div>` : ""}

<div class="summary-bar">
  <div class="summary-item"><div class="summary-value ok">${healthyCount}</div><div class="summary-label">Healthy</div></div>
  <div class="summary-item"><div class="summary-value ${unhealthyCount > 0 ? "err" : "ok"}">${unhealthyCount}</div><div class="summary-label">Unhealthy</div></div>
  <div class="summary-item"><div class="summary-value ${proxyStatus === "ok" ? "ok" : "warn"}">${proxyStatus}</div><div class="summary-label">Proxy</div></div>
  <div class="summary-item"><div class="summary-value">${readiness?.litellm_version ?? "\u2014"}</div><div class="summary-label">Version</div></div>
</div>

${
  health
    ? `
<div class="card">
  <h3>\u{1F4E1} Model Endpoints</h3>
  <div class="health-grid">
    ${(health.healthy_endpoints ?? [])
      .map(
        (ep) => `
    <div class="health-card healthy">
      <div class="health-icon">\u2705</div>
      <div class="endpoint-name">${escapeHtml(ep.model || "unknown")}</div>
    </div>`,
      )
      .join("")}
    ${(health.unhealthy_endpoints ?? [])
      .map(
        (ep) => `
    <div class="health-card unhealthy">
      <div class="health-icon">\u274C</div>
      <div class="endpoint-name">${escapeHtml(ep.model || "unknown")}</div>
    </div>`,
      )
      .join("")}
  </div>
</div>`
    : '<div class="empty-state"><span class="empty-icon">\u{1F4E1}</span><div class="empty-text">No health data.</div></div>'
}

${
  readiness
    ? `<div class="card">
  <h3>\u{1F4E6} Readiness</h3>
  <div class="grid">
    <div class="stat"><div class="stat-value">${readiness.db ?? "\u2014"}</div><div class="stat-label">DB</div></div>
    <div class="stat"><div class="stat-value">${readiness.cache ?? "\u2014"}</div><div class="stat-label">Cache</div></div>
    <div class="stat"><div class="stat-value">${readiness.success_callbacks?.length ?? 0}</div><div class="stat-label">Callbacks</div></div>
  </div>
</div>`
    : ""
}
</div>

<!-- ========================= PROVIDERS TAB ========================= -->
<div class="tab-content${activeTab === "providers" ? " active" : ""}" id="tab-providers">
<div class="summary-bar">
  <div class="summary-item"><div class="summary-value">${usd(totalProviderSpend, 4)}</div><div class="summary-label">Provider Spend</div></div>
  <div class="summary-item"><div class="summary-value">${providerList.length}</div><div class="summary-label">Providers</div></div>
</div>
${providerSpendError && !isPermissionsIssue ? `<div class="error-box">\u26A0 ${escapeHtml(providerSpendError)}</div>` : ""}
${
  providerList.length > 0
    ? `
<div class="card">
  <div class="table-wrap"><table><thead><tr><th>Provider</th><th>Spend</th><th>Tokens</th><th>Requests</th></tr></thead>
  <tbody>${providerList
    .map(
      (p) => `<tr>
    <td><strong>${escapeHtml(p.provider || "unknown")}</strong></td>
    <td>${usd(p.total_spend, 4)}</td>
    <td>${(p.total_tokens ?? 0).toLocaleString()}</td>
    <td>${(p.count ?? 0).toLocaleString()}</td>
  </tr>`,
    )
    .join("")}</tbody></table></div>
</div>`
    : '<div class="empty-state"><span class="empty-icon">\u2601\uFE0F</span><div class="empty-text">No provider data.</div></div>'
}
</div>

<!-- ========================= MODELS TAB ========================= -->
<div class="tab-content${activeTab === "models" ? " active" : ""}" id="tab-models">
${
  modelChartData.length > 0
    ? `
<div class="card">
  <h3>\u{1F4CA} Model Spend Breakdown</h3>
  <div class="chart-row" style="align-items:center">
    ${modelDonut}
    <div class="legend">
      ${modelChartData
        .map((m, i) => {
          const colors = [
            "#4ec9b0", "#569cd6", "#ce9178", "#e2b714",
            "#c586c0", "#6a9955", "#f14c4c", "#dcdcaa",
          ];
          return `<div class="legend-item"><span class="legend-dot" style="background:${colors[i % colors.length]}"></span>${escapeHtml(m.label.length > 15 ? m.label.slice(0, 15) + ".." : m.label)} ${usd(m.value)}</div>`;
        })
        .join("")}
    </div>
  </div>
</div>`
    : '<div class="empty-state"><span class="empty-icon">\u{1F916}</span><div class="empty-text">No model usage data.</div></div>'
}
</div>

<div class="footer">
  <span>CoreLLM Dashboard</span>
  <span>Spend: ${usd(effectiveTotalSpend)}</span>
  <span>Health: ${healthyCount}/${healthyCount + unhealthyCount}</span>
  ${dateRange ? `<span>${escapeHtml(dateRange)}</span>` : ""}
</div>

<script>
(function() {
  const vscode = acquireVsCodeApi();
  const themes = ['vscode', 'light', 'dark', 'hc'];
  let currentThemeIdx = themes.indexOf('${theme}');
  if (currentThemeIdx < 0) currentThemeIdx = 0;

  function showToast(msg, duration) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timeout);
    t._timeout = setTimeout(() => t.classList.remove('show'), duration || 2000);
  }

  // Theme
  document.getElementById('themeBtn').addEventListener('click', function() {
    currentThemeIdx = (currentThemeIdx + 1) % themes.length;
    vscode.postMessage({ type: 'setTheme', theme: themes[currentThemeIdx] });
    showToast('Theme: ' + themes[currentThemeIdx]);
  });

  // Refresh
  document.getElementById('refreshBtn').addEventListener('click', function() {
    this.innerHTML = '<span class="refresh-spin">\u{1F504}</span> Refreshing\u2026';
    vscode.postMessage({ type: 'refresh' });
  });

  // Export
  document.getElementById('exportCsvBtn').addEventListener('click', function() {
    vscode.postMessage({ type: 'exportCsv' });
  });

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const tabId = this.dataset.tab;
      // Update active button
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      // Update active content
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      const content = document.getElementById('tab-' + tabId);
      if (content) content.classList.add('active');
      vscode.postMessage({ type: 'switchTab', tab: tabId });
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    if (e.key === 'r' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      document.getElementById('refreshBtn').click();
    }
    if (e.key === 'Escape') vscode.postMessage({ type: 'close' });
  });
})();
</script>
</body>
</html>`;
}

export function getLoadingHtml(message = "Loading Dashboard\u2026"): string {
  return buildLoadingHtml(message, true);
}
