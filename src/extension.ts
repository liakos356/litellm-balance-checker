import * as vscode from "vscode";
import * as os from "os";
import * as fs from "fs";
import { buildTutorialHtml, buildChangelogHtml } from "./tutorial";
import { getConfig, getDateRange } from "./config";
import { CoreLLMApiClient } from "./client";
import {
  resolveConfig,
  storeSecret,
  clearSecret,
  migrateFromSettings,
  CREDENTIAL_KEYS,
  SECRET_API_KEY,
  SECRET_ADMIN_KEY,
  SECRET_PASSWORD,
} from "./secrets";
import {
  COMMON_CSS,
  buildThemeOverrides,
  buildLoadingHtml,
  escapeHtml,
  usd,
  getRelativeTime,
  svgHBarChart,
  svgDonut,
  svgLineChart,
  svgSparkline,
  csvCell,
} from "./helpers";
import { buildHealthDashboardHtml, getLoadingHtml as healthLoading } from "./panels/healthDashboard";
import { buildProviderSpendHtml } from "./panels/providerSpend";
import { buildUserManagerHtml } from "./panels/userManager";
import { buildUnifiedDashboardHtml, getLoadingHtml as dashboardLoading } from "./panels/unifiedDashboard";
import {
  KeyInfoResponse,
  SpendLogEntry,
  SpendLogsResponse,
  ProviderBudgetEntry,
  ProviderBudgetResponse,
  GlobalSpendReportEntry,
  KeyListItem,
  KeyListResponse,
  GlobalSpendEntry,
  GlobalSpendKeysResponse,
  GlobalSpendModelEntry,
  GlobalSpendModelsResponse,
  GlobalSpendTeamEntry,
  GlobalSpendTeamsResponse,
  GlobalSpendProvidersResponse,
  TeamInfoResponse,
  TeamListResponse,
  ModelInfoEntry,
  ModelInfoResponse,
  SpendTagEntry,
  SpendTagsResponse,
  ActivityEntry,
  ActivityResponse,
  KeyHealthResponse,
  HealthEndpoint,
  HealthResponse,
  ReadinessResponse,
  UserInfoResponse,
  UserListResponse,
  GuardrailInfo,
  GuardrailsListResponse,
  ConfigYamlResponse,
  TokenCountResponse,
  CacheEntry,
  StatusBarDisplay,
  ReportDuration,
  DURATION_LABELS,
  DURATION_MS,
  ExtensionConfig,
} from "./types";

function buildBudgetOverviewHtml(data: {
  keyInfo: KeyInfoResponse | null;
  spendLogs: SpendLogEntry[];
  keyError: string | null;
  activeTheme?: string;
}): string {
  const { keyInfo, spendLogs, keyError, activeTheme } = data;

  const alias =
    keyInfo?.key_alias || keyInfo?.key_name || keyInfo?.key || "\u2014";
  const spend = keyInfo?.spend ?? 0;
  const maxB = keyInfo?.max_budget;
  const remaining = maxB != null ? Math.max(0, maxB - spend) : null;
  const usedPct = maxB != null && maxB > 0 ? (spend / maxB) * 100 : 0;
  const barColor = usedPct > 80 ? "red" : usedPct > 50 ? "yellow" : "green";

  const theme = activeTheme || "vscode";
  const themeOverride = buildThemeOverrides(theme);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${COMMON_CSS}${themeOverride}</style>
</head>
<body>
<h2>\u{1F4CA} CoreLLM Budget Overview
  <span class="title-actions">
    <span class="theme-btn" id="themeBtn" title="Toggle theme">\u{1F3A8} Theme</span>
    <button class="toolbar-btn" id="exportCsvBtn" title="Export data as CSV">\u{1F4E5} CSV</button>
    <button class="toolbar-btn primary" id="refreshBtn" title="Refresh all data">\u{1F504} Refresh</button>
  </span>
</h2>

<!-- Toast notification -->
<div class="toast" id="toast"></div>

<!-- Summary bar -->
<div class="summary-bar">
  <div class="summary-item"><div class="summary-value">${usd(spend, 4)}</div><div class="summary-label">Total Spend</div></div>
  <div class="summary-item"><div class="summary-value">${maxB != null && maxB > 0 ? usedPct.toFixed(1) + "%" : "\u2014"}</div><div class="summary-label">Used</div></div>
  <div class="summary-item"><div class="summary-value ${remaining != null && remaining <= 0 ? "err" : remaining != null && maxB != null && remaining / maxB <= 0.2 ? "warn" : "ok"}">${remaining != null ? usd(remaining, 4) : "\u221E"}</div><div class="summary-label">Remaining</div></div>
  <div class="summary-item"><div class="summary-value">${spendLogs.length}</div><div class="summary-label">Recent Logs</div></div>
</div>

<!-- Key Info Card -->
<div class="card">
  <h3>\u{1F511} Key <span class="copy-btn" onclick="copyKey()" id="keyCopyBtn">\u{1F4CB} Copy</span></h3>
  <div style="font-size:.88em;margin-bottom:10px;word-break:break-all;font-family:monospace;opacity:.8">${escapeHtml(alias)}</div>
  <div class="grid">
    <div class="stat"><div class="stat-value ${maxB != null && remaining != null && remaining / maxB <= 0.2 ? "warn" : ""}">${usd(spend, 4)}</div><div class="stat-label">Total Spend</div></div>
    <div class="stat"><div class="stat-value">${usd(maxB)}</div><div class="stat-label">Max Budget</div></div>
    <div class="stat"><div class="stat-value ${remaining != null && remaining <= 0 ? "err" : remaining != null && maxB != null && remaining / maxB <= 0.2 ? "warn" : "ok"}">${remaining != null ? usd(remaining, 4) : "\u221E"}</div><div class="stat-label">Remaining</div></div>
    <div class="stat"><div class="stat-value">${maxB != null && maxB > 0 ? usedPct.toFixed(1) + "%" : "\u2014"}</div><div class="stat-label">Used</div></div>
  </div>
  ${maxB != null && maxB > 0 ? `<div class="bar-container"><div class="bar-fill ${barColor}" style="width:${Math.min(100, usedPct)}%"></div></div>` : ""}
  ${keyError ? `<div class="error-box">\u26A0 ${escapeHtml(keyError)}</div>` : ""}
</div>

<!-- Recent Spend Logs Card -->
<div class="card">
  <h3>\uD83D\uDCDD Recent Spend Logs <span class="badge">${spendLogs.length}</span></h3>
  ${
    spendLogs.length > 0
      ? `
  <div class="table-wrap"><table><thead><tr><th>Time</th><th>Model</th><th>Type</th><th>Spend</th><th>Tokens</th></tr></thead>
  <tbody>${spendLogs
    .map((l) => {
      const ts = l.startTime ? new Date(l.startTime) : null;
      const rel = ts ? getRelativeTime(ts) : "";
      const costPerToken =
        (l.total_tokens ?? 0) > 0 ? (l.spend ?? 0) / (l.total_tokens ?? 1) : 0;
      return `<tr>
    <td>${ts ? ts.toLocaleString() : "\u2014"}${rel ? `<span class="rel-time">(${rel})</span>` : ""}</td>
    <td>${escapeHtml(l.model ?? "\u2014")}</td>
    <td><span class="badge">${escapeHtml(l.call_type ?? "\u2014")}</span></td>
    <td>${usd(l.spend, 6)}</td>
    <td>${(l.total_tokens ?? 0).toLocaleString()}${costPerToken > 0 ? `<span class="rel-time">(${usd(costPerToken, 8)}/tok)</span>` : ""}</td>
  </tr>`;
    })
    .join("")}</tbody></table></div>`
      : '<div class="empty-state"><span class="empty-icon">\uD83D\uDCDD</span><div class="empty-text">No recent spend logs found.</div></div>'
  }
</div>

<div class="footer">
  <span>CoreLLM \u00B7 Spend: ${usd(spend, 4)}</span>
  <span>${maxB != null && maxB > 0 ? `Used: ${usedPct.toFixed(1)}% \u00B7 Left: ${usd(remaining!, 4)}` : "No budget set"}</span>
  <span>${spendLogs.length} log(s)</span>
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

  // Theme toggle
  document.getElementById('themeBtn').addEventListener('click', function() {
    currentThemeIdx = (currentThemeIdx + 1) % themes.length;
    vscode.postMessage({ type: 'setTheme', theme: themes[currentThemeIdx] });
    showToast('Theme: ' + themes[currentThemeIdx]);
  });

  // Refresh button
  document.getElementById('refreshBtn').addEventListener('click', function() {
    this.innerHTML = '<span class="refresh-spin">\u{1F504}</span> Refreshing\u2026';
    vscode.postMessage({ type: 'refresh' });
  });

  // Export CSV
  document.getElementById('exportCsvBtn').addEventListener('click', function() {
    vscode.postMessage({ type: 'exportCsv' });
    showToast('Exporting data\u2026');
  });

  // Copy key to clipboard
  window.copyKey = function() {
    const alias = ${JSON.stringify(alias)};
    navigator.clipboard.writeText(alias).then(() => {
      const btn = document.getElementById('keyCopyBtn');
      btn.textContent = '\u2705 Copied!';
      btn.classList.add('copied');
      showToast('Key copied!');
      setTimeout(() => {
        btn.textContent = '\u{1F4CB} Copy';
        btn.classList.remove('copied');
      }, 2000);
    });
  };

  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    if (e.key === 'r' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      document.getElementById('refreshBtn').click();
    }

    if (e.key === 't' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
      e.preventDefault();
      document.getElementById('themeBtn').click();
    }

    if (e.key === 'Escape') {
      vscode.postMessage({ type: 'close' });
    }
  });
})();
</script>
</body>
</html>`;
}

// ─── Spend Logs Panel HTML ───────────────────────────────────────────────────

function buildSpendLogsHtml(
  logs: SpendLogEntry[],
  error: string | null,
  activeTheme?: string,
): string {
  const theme = activeTheme || "vscode";
  const themeOverride = buildThemeOverrides(theme);
  const totalSpend = logs.reduce((s, l) => s + (l.spend ?? 0), 0);
  const totalTokens = logs.reduce((s, l) => s + (l.total_tokens ?? 0), 0);
  const avgCostPerToken = totalTokens > 0 ? totalSpend / totalTokens : 0;
  const avgCostPerReq = logs.length > 0 ? totalSpend / logs.length : 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${COMMON_CSS}${themeOverride}</style>
</head>
<body>
<h2>\uD83D\uDCDD CoreLLM Spend Logs
  <span class="title-actions">
    <span class="theme-btn" id="themeBtn" title="Toggle theme">\u{1F3A8}</span>
    <button class="toolbar-btn" id="exportCsvBtn" title="Export as CSV">\u{1F4E5}</button>
    <button class="toolbar-btn primary" id="refreshBtn" title="Refresh">\u{1F504}</button>
  </span>
</h2>
${error ? `<div class="error-box">\u26A0 ${escapeHtml(error)}</div>` : ""}
${
  logs.length > 0
    ? `
<div class="summary">
  <div class="summary-item"><div class="summary-value">${logs.length}</div><div class="summary-label">Entries</div></div>
  <div class="summary-item"><div class="summary-value">${usd(totalSpend, 4)}</div><div class="summary-label">Total Spend</div></div>
  <div class="summary-item"><div class="summary-value">${totalTokens.toLocaleString()}</div><div class="summary-label">Total Tokens</div></div>
  <div class="summary-item"><div class="summary-value">${usd(avgCostPerReq, 6)}</div><div class="summary-label">Avg Cost/Req</div></div>
</div>
<div class="search-bar">
  <input type="text" class="search-input" id="spendSearch" placeholder="\u{1F50D} Filter by model, type, or key\u2026">
  <span class="match-count" id="matchCount">Showing ${logs.length}</span>
</div>
<div class="table-wrap"><table id="spendTable"><thead><tr><th>Time</th><th>Model</th><th>Type</th><th>Spend</th><th>Tokens</th><th>Cost/Tok</th></tr></thead>
<tbody>${logs
        .map((l, idx) => {
          const ts = l.startTime ? new Date(l.startTime) : null;
          const rel = ts ? getRelativeTime(ts) : "";
          const model = l.model ?? "";
          const callType = l.call_type ?? "";
          const cpt =
            (l.total_tokens ?? 0) > 0
              ? (l.spend ?? 0) / (l.total_tokens ?? 1)
              : 0;
          return `<tr data-idx="${idx}" data-model="${escapeHtml(model)}" data-type="${escapeHtml(callType)}">
  <td>${ts ? ts.toLocaleString() : "\u2014"}${rel ? `<span class="rel-time">(${rel})</span>` : ""}</td>
  <td>${escapeHtml(model || "\u2014")}</td>
  <td><span class="badge">${escapeHtml(callType || "\u2014")}</span></td>
  <td>${usd(l.spend, 6)}</td>
  <td>${(l.total_tokens ?? 0).toLocaleString()}</td>
  <td>${cpt > 0 ? usd(cpt, 8) : "\u2014"}</td>
</tr>`;
        })
        .join("")}</tbody></table></div>`
    : '<div class="empty-state"><span class="empty-icon">\uD83D\uDCDD</span><div class="empty-text">No spend logs found.</div></div>'
}

<div class="footer">
  <span>CoreLLM \u00B7 Spend: ${usd(totalSpend, 4)}</span>
  <span>${logs.length} entries</span>
  <span>${totalTokens.toLocaleString()} tokens</span>
  <span>Avg: ${usd(avgCostPerReq, 6)}/req</span>
</div>
<script>
(function() {
  const vscode = acquireVsCodeApi();
  const themes = ['vscode', 'light', 'dark', 'hc'];
  let currentThemeIdx = themes.indexOf('${theme}');
  if (currentThemeIdx < 0) currentThemeIdx = 0;

  document.getElementById('themeBtn').addEventListener('click', function() {
    currentThemeIdx = (currentThemeIdx + 1) % themes.length;
    vscode.postMessage({ type: 'setTheme', theme: themes[currentThemeIdx] });
  });
  document.getElementById('refreshBtn').addEventListener('click', function() {
    vscode.postMessage({ type: 'refresh' });
  });
  document.getElementById('exportCsvBtn').addEventListener('click', function() {
    vscode.postMessage({ type: 'exportCsv' });
  });

  const input = document.getElementById('spendSearch');
  const table = document.getElementById('spendTable');
  const matchCount = document.getElementById('matchCount');
  if (input && table) {
    input.addEventListener('input', function() {
      const q = this.value.toLowerCase().trim();
      const rows = table.querySelectorAll('tbody tr');
      let visible = 0;
      rows.forEach(row => {
        const txt = row.textContent.toLowerCase();
        const match = !q || txt.includes(q);
        row.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      matchCount.textContent = q ? 'Showing ' + visible + ' of ' + rows.length : 'Showing ' + rows.length;
    });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'r' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); document.getElementById('refreshBtn').click(); }
    if (e.key === 'Escape') { vscode.postMessage({ type: 'close' }); }
  });
})();
</script>
</body>
</html>`;
}

// ─── Key List Panel HTML ─────────────────────────────────────────────────────

function buildKeyListHtml(
  keys: KeyListItem[],
  error: string | null,
  activeTheme?: string,
): string {
  const theme = activeTheme || "vscode";
  const themeOverride = buildThemeOverrides(theme);
  const totalSpend = keys.reduce((s, k) => s + (k.spend ?? 0), 0);
  const totalBudget = keys.reduce((s, k) => s + (k.max_budget ?? 0), 0);
  const keysWithBudget = keys.filter(
    (k) => k.max_budget != null && k.max_budget > 0,
  ).length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${COMMON_CSS}
  tbody tr{cursor:pointer;transition:background .12s}
  tbody tr:hover{background:var(--vscode-list-hoverBackground)}
  .key-name{font-family:monospace;font-size:.82em;opacity:.65;margin-top:1px;word-break:break-all}
  .badge-warning{background:var(--vscode-editorWarning-foreground,#e2b714);color:#1e1e1e}
</style>${themeOverride}</head>
<body>
<h2>\u{1F511} CoreLLM Keys
  <span class="title-actions">
    <span class="theme-btn" id="themeBtn" title="Toggle theme">\u{1F3A8}</span>
    <button class="toolbar-btn" id="exportCsvBtn" title="Export as CSV">\u{1F4E5}</button>
    <button class="toolbar-btn primary" id="refreshBtn" title="Refresh">\u{1F504}</button>
  </span>
</h2>
${error ? `<div class="error-box">\u26A0 ${escapeHtml(error)}</div>` : ""}
${
  keys.length > 0
    ? `
<div class="summary">
  <div class="summary-item"><div class="summary-value">${keys.length}</div><div class="summary-label">Total Keys</div></div>
  <div class="summary-item"><div class="summary-value">${usd(totalSpend, 4)}</div><div class="summary-label">Total Spend</div></div>
  <div class="summary-item"><div class="summary-value">${usd(totalBudget)}</div><div class="summary-label">Total Budget</div></div>
  <div class="summary-item"><div class="summary-value">${keysWithBudget}</div><div class="summary-label">With Budget</div></div>
</div>
<div class="search-bar">
  <input type="text" class="search-input" id="keySearch" placeholder="\u{1F50D} Filter by alias, user, or team\u2026">
  <span class="match-count" id="matchCount">Showing ${keys.length}</span>
</div>
<div class="table-wrap"><table id="keyTable"><thead><tr><th>Alias</th><th>Spend</th><th>Max Budget</th><th>Used</th><th>User</th><th>Team</th></tr></thead>
<tbody>${keys
        .map((k, idx) => {
          const s = k.spend ?? 0;
          const m = k.max_budget;
          const pp = m && m > 0 ? (s / m) * 100 : 0;
          const pc = pp > 80 ? "red" : pp > 50 ? "yellow" : "green";
          const alias2 = k.key_alias || k.key_name || "(unnamed)";
          const keyVal = k.key || "";
          const isOverBudget = m != null && m > 0 && s >= m;
          return `<tr data-idx="${idx}" data-alias="${escapeHtml(alias2.toLowerCase())}" data-user="${escapeHtml((k.user_id ?? "").toLowerCase())}" data-team="${escapeHtml((k.team_id ?? "").toLowerCase())}"${isOverBudget ? ' style="border-left:3px solid var(--vscode-errorForeground,#f14c4c)"' : ""}>
    <td><strong>${escapeHtml(alias2)}</strong>${isOverBudget ? ' <span class="badge badge-error">OVER</span>' : ""}${keyVal ? `<div class="key-name">${escapeHtml(keyVal.slice(0, 20))}${keyVal.length > 20 ? "\u2026" : ""}</div>` : ""}</td>
    <td>${usd(s, 4)}</td>
    <td>${usd(m)}</td>
    <td>${m && m > 0 ? pp.toFixed(1) + "%" : "\u2014"}${m && m > 0 ? `<div class="bar-container"><div class="bar-fill ${pc}" style="width:${Math.min(100, pp)}%"></div></div>` : ""}</td>
    <td>${k.user_id ? `<span class="badge">${escapeHtml(k.user_id)}</span>` : "\u2014"}</td>
    <td>${k.team_id ? `<span class="badge">${escapeHtml(k.team_id)}</span>` : "\u2014"}</td>
  </tr>`;
        })
        .join("")}</tbody></table></div>`
    : '<div class="empty-state"><span class="empty-icon">\u{1F511}</span><div class="empty-text">No keys found.</div></div>'
}

<div class="footer">
  <span>CoreLLM \u00B7 ${keys.length} key(s)</span>
  <span>Spend: ${usd(totalSpend, 4)}</span>
  <span>Budget: ${usd(totalBudget)}</span>
  <span>${keysWithBudget} budgeted</span>
</div>
<script>
(function() {
  const vscode = acquireVsCodeApi();
  const themes = ['vscode', 'light', 'dark', 'hc'];
  let currentThemeIdx = themes.indexOf('${theme}');
  if (currentThemeIdx < 0) currentThemeIdx = 0;

  document.getElementById('themeBtn').addEventListener('click', function() {
    currentThemeIdx = (currentThemeIdx + 1) % themes.length;
    vscode.postMessage({ type: 'setTheme', theme: themes[currentThemeIdx] });
  });
  document.getElementById('refreshBtn').addEventListener('click', function() {
    vscode.postMessage({ type: 'refresh' });
  });
  document.getElementById('exportCsvBtn').addEventListener('click', function() {
    vscode.postMessage({ type: 'exportCsv' });
  });

  const input = document.getElementById('keySearch');
  const table = document.getElementById('keyTable');
  const matchCount = document.getElementById('matchCount');
  if (input && table) {
    input.addEventListener('input', function() {
      const q = this.value.toLowerCase().trim();
      const rows = table.querySelectorAll('tbody tr');
      let visible = 0;
      rows.forEach(row => {
        const alias = row.getAttribute('data-alias') || '';
        const user = row.getAttribute('data-user') || '';
        const team = row.getAttribute('data-team') || '';
        const txt = alias + ' ' + user + ' ' + team + ' ' + row.textContent.toLowerCase();
        const match = !q || txt.includes(q);
        row.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      matchCount.textContent = q ? 'Showing ' + visible + ' of ' + rows.length : 'Showing ' + rows.length;
    });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'r' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); document.getElementById('refreshBtn').click(); }
    if (e.key === 'Escape') { vscode.postMessage({ type: 'close' }); }
  });
})();
</script>
</body>
</html>`;
}

// ─── Global Spend Panel HTML ─────────────────────────────────────────────────

function buildGlobalSpendHtml(data: {
  keys: GlobalSpendEntry[];
  models: GlobalSpendModelEntry[];
  teams: GlobalSpendTeamEntry[];
  keyError: string | null;
  modelError: string | null;
  teamError: string | null;
  activeTheme?: string;
  dateRange?: string;
}): string {
  const {
    keys,
    models,
    teams,
    keyError,
    modelError,
    teamError,
    activeTheme,
    dateRange,
  } = data;
  const theme = activeTheme || "vscode";
  const themeOverride = buildThemeOverrides(theme);

  const totalKeySpend = keys.reduce((s, k) => s + (k.total_spend ?? 0), 0);
  const totalModelSpend = models.reduce((s, m) => s + (m.total_spend ?? 0), 0);
  const totalTeamSpend = teams.reduce((s, t) => s + (t.total_spend ?? 0), 0);

  const maxKeySpend = Math.max(...keys.map((k) => k.total_spend ?? 0), 1);
  const maxModelSpend = Math.max(...models.map((m) => m.total_spend ?? 0), 1);
  const maxTeamSpend = Math.max(...teams.map((t) => t.total_spend ?? 0), 1);

  const keyChart =
    keys.length > 0
      ? svgHBarChart(
          keys.slice(0, 15).map((k) => ({
            label:
              k.key_alias || k.key_name || k.api_key?.slice(0, 12) || "unknown",
            value: k.total_spend ?? 0,
          })),
          maxKeySpend,
          340,
          18,
          3,
        )
      : "";

  const modelChart =
    models.length > 0
      ? svgHBarChart(
          models.slice(0, 15).map((m) => ({
            label: m.model || "unknown",
            value: m.total_spend ?? 0,
          })),
          maxModelSpend,
          340,
          18,
          3,
        )
      : "";

  const teamChart =
    teams.length > 0
      ? svgHBarChart(
          teams.slice(0, 15).map((t) => ({
            label: t.team_name || t.team_id || "unknown",
            value: t.total_spend ?? 0,
          })),
          maxTeamSpend,
          340,
          18,
          3,
        )
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${COMMON_CSS}${themeOverride}</style>
</head>
<body>
<h2>\uD83C\uDF10 CoreLLM Global Spend
  <span class="title-actions">
    <span class="theme-btn" id="themeBtn" title="Toggle theme">\u{1F3A8}</span>
    <button class="toolbar-btn" id="exportCsvBtn" title="Export as CSV">\u{1F4E5}</button>
    <button class="toolbar-btn primary" id="refreshBtn" title="Refresh">\u{1F504}</button>
  </span>
</h2>
${dateRange ? `<p style="font-size:.82em;opacity:.6;margin:0 0 12px">${escapeHtml(dateRange)}</p>` : ""}

<div class="summary-bar">
  <div class="summary-item"><div class="summary-value">${usd(totalKeySpend, 4)}</div><div class="summary-label">Total Spend (Keys)</div></div>
  <div class="summary-item"><div class="summary-value">${keys.length}</div><div class="summary-label">Active Keys</div></div>
  <div class="summary-item"><div class="summary-value">${models.length}</div><div class="summary-label">Models Used</div></div>
  <div class="summary-item"><div class="summary-value">${teams.length}</div><div class="summary-label">Teams</div></div>
</div>

<!-- Spend by Key -->
<div class="card">
  <h3>\u{1F511} Spend by Key <span class="badge">${keys.length}</span></h3>
  ${keyError ? `<div class="error-box">\u26A0 ${escapeHtml(keyError)}</div>` : ""}
  ${keyChart || '<div class="empty-state"><span class="empty-icon">\u{1F511}</span><div class="empty-text">No key spend data available.</div></div>'}
  ${
    keys.length > 0
      ? `
  <div class="table-wrap"><table><thead><tr><th>Key</th><th>Spend</th><th>Tokens</th><th>Requests</th></tr></thead>
  <tbody>${keys
    .slice(0, 20)
    .map(
      (k) => `<tr>
    <td><strong>${escapeHtml(k.key_alias || k.key_name || k.api_key?.slice(0, 16) || "unknown")}</strong></td>
    <td>${usd(k.total_spend, 4)}</td>
    <td>${(k.total_tokens ?? 0).toLocaleString()}</td>
    <td>${(k.count ?? 0).toLocaleString()}</td>
  </tr>`,
    )
    .join("")}</tbody></table></div>`
      : ""
  }
</div>

<!-- Spend by Model -->
<div class="card">
  <h3>\u{1F4CA} Spend by Model <span class="badge">${models.length}</span></h3>
  ${modelError ? `<div class="error-box">\u26A0 ${escapeHtml(modelError)}</div>` : ""}
  ${modelChart || '<div class="empty-state"><span class="empty-icon">\u{1F4CA}</span><div class="empty-text">No model spend data available.</div></div>'}
  ${
    models.length > 0
      ? `
  <div class="table-wrap"><table><thead><tr><th>Model</th><th>Spend</th><th>Input Tokens</th><th>Output Tokens</th><th>Requests</th></tr></thead>
  <tbody>${models
    .slice(0, 20)
    .map(
      (m) => `<tr>
    <td><strong>${escapeHtml(m.model || "unknown")}</strong></td>
    <td>${usd(m.total_spend, 4)}</td>
    <td>${(m.input_tokens ?? 0).toLocaleString()}</td>
    <td>${(m.output_tokens ?? 0).toLocaleString()}</td>
    <td>${(m.count ?? 0).toLocaleString()}</td>
  </tr>`,
    )
    .join("")}</tbody></table></div>`
      : ""
  }
</div>

<!-- Spend by Team -->
<div class="card">
  <h3>\u{1F465} Spend by Team <span class="badge">${teams.length}</span></h3>
  ${teamError ? `<div class="error-box">\u26A0 ${escapeHtml(teamError)}</div>` : ""}
  ${teamChart || '<div class="empty-state"><span class="empty-icon">\u{1F465}</span><div class="empty-text">No team spend data available.</div></div>'}
  ${
    teams.length > 0
      ? `
  <div class="table-wrap"><table><thead><tr><th>Team</th><th>Spend</th><th>Tokens</th><th>Requests</th></tr></thead>
  <tbody>${teams
    .slice(0, 20)
    .map(
      (t) => `<tr>
    <td><strong>${escapeHtml(t.team_name || t.team_id || "unknown")}</strong></td>
    <td>${usd(t.total_spend, 4)}</td>
    <td>${(t.total_tokens ?? 0).toLocaleString()}</td>
    <td>${(t.count ?? 0).toLocaleString()}</td>
  </tr>`,
    )
    .join("")}</tbody></table></div>`
      : ""
  }
</div>

<div class="footer">
  <span>CoreLLM \u00B7 Global Spend</span>
  <span>Keys: ${keys.length} \u00B7 Models: ${models.length} \u00B7 Teams: ${teams.length}</span>
  <span>Total: ${usd(totalKeySpend, 4)}</span>
</div>
<script>
(function() {
  const vscode = acquireVsCodeApi();
  const themes = ['vscode', 'light', 'dark', 'hc'];
  let currentThemeIdx = themes.indexOf('${theme}');
  if (currentThemeIdx < 0) currentThemeIdx = 0;
  document.getElementById('themeBtn').addEventListener('click', function() {
    currentThemeIdx = (currentThemeIdx + 1) % themes.length;
    vscode.postMessage({ type: 'setTheme', theme: themes[currentThemeIdx] });
  });
  document.getElementById('refreshBtn').addEventListener('click', function() {
    vscode.postMessage({ type: 'refresh' });
  });
  document.getElementById('exportCsvBtn').addEventListener('click', function() {
    vscode.postMessage({ type: 'exportCsv' });
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') vscode.postMessage({ type: 'close' });
  });
})();
</script>
</body>
</html>`;
}

// ─── Teams Panel HTML ────────────────────────────────────────────────────────

function buildTeamsHtml(data: {
  teams: TeamInfoResponse[];
  globalTeamSpend: GlobalSpendTeamEntry[];
  error: string | null;
  spendError: string | null;
  activeTheme?: string;
}): string {
  const { teams, globalTeamSpend, error, spendError, activeTheme } = data;
  const theme = activeTheme || "vscode";
  const themeOverride = buildThemeOverrides(theme);
  const totalSpend = teams.reduce((s, t) => s + (t.spend ?? 0), 0);
  const totalBudget = teams.reduce((s, t) => s + (t.max_budget ?? 0), 0);

  const spendMap = new Map<string, number>();
  for (const gts of globalTeamSpend) {
    const key = gts.team_id || gts.team_name || "";
    spendMap.set(key, (spendMap.get(key) ?? 0) + (gts.total_spend ?? 0));
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${COMMON_CSS}${themeOverride}</style>
</head>
<body>
<h2>\u{1F465} CoreLLM Teams
  <span class="title-actions">
    <span class="theme-btn" id="themeBtn" title="Toggle theme">\u{1F3A8}</span>
    <button class="toolbar-btn" id="exportCsvBtn" title="Export as CSV">\u{1F4E5}</button>
    <button class="toolbar-btn primary" id="refreshBtn" title="Refresh">\u{1F504}</button>
  </span>
</h2>
${error ? `<div class="error-box">\u26A0 ${escapeHtml(error)}</div>` : ""}

<div class="summary-bar">
  <div class="summary-item"><div class="summary-value">${teams.length}</div><div class="summary-label">Teams</div></div>
  <div class="summary-item"><div class="summary-value">${usd(totalSpend, 4)}</div><div class="summary-label">Total Spend</div></div>
  <div class="summary-item"><div class="summary-value">${usd(totalBudget)}</div><div class="summary-label">Total Budget</div></div>
</div>

${
  teams.length > 0
    ? teams
        .map((team) => {
          const s = team.spend ?? 0;
          const mb = team.max_budget;
          const pct = mb && mb > 0 ? (s / mb) * 100 : 0;
          const barColor = pct > 80 ? "red" : pct > 50 ? "yellow" : "green";
          const gs = spendMap.get(team.team_id || "") ?? 0;
          return `<div class="card"${team.blocked ? ' style="border-left:3px solid var(--vscode-errorForeground,#f14c4c)"' : ""}>
    <h3>${escapeHtml(team.team_alias || team.team_name || team.team_id || "Unnamed Team")}
      ${team.blocked ? ' <span class="badge badge-error">BLOCKED</span>' : ""}
    </h3>
    <div class="grid">
      <div class="stat"><div class="stat-value">${usd(s, 4)}</div><div class="stat-label">Spend</div></div>
      <div class="stat"><div class="stat-value">${usd(mb)}</div><div class="stat-label">Max Budget</div></div>
      <div class="stat"><div class="stat-value ${mb && mb > 0 ? (pct > 80 ? "err" : pct > 50 ? "warn" : "ok") : ""}">${mb && mb > 0 ? (mb - s).toFixed(2) : "\u221E"}</div><div class="stat-label">Remaining</div></div>
      <div class="stat"><div class="stat-value">${mb && mb > 0 ? pct.toFixed(1) + "%" : "\u2014"}</div><div class="stat-label">Used</div></div>
    </div>
    ${mb && mb > 0 ? `<div class="bar-container"><div class="bar-fill ${barColor}" style="width:${Math.min(100, pct)}%"></div></div>` : ""}
    ${gs > 0 ? `<p style="font-size:.82em;opacity:.65;margin-top:4px">\uD83D\uDCCA Global spend (recent): ${usd(gs, 4)}</p>` : ""}
    ${team.models && team.models.length > 0 ? `<p style="font-size:.82em;opacity:.65;margin-top:4px">\u{1F4CB} Models: ${team.models.slice(0, 8).join(", ")}${team.models.length > 8 ? ` +${team.models.length - 8}` : ""}</p>` : ""}
    ${
      team.members_with_roles && team.members_with_roles.length > 0
        ? `<p style="font-size:.82em;opacity:.65;margin-top:2px">\u{1F465} Members: ${team.members_with_roles
            .map((m) => m.user_id)
            .filter(Boolean)
            .join(", ")}</p>`
        : ""
    }
  </div>`;
        })
        .join("\n")
    : '<div class="empty-state"><span class="empty-icon">\u{1F465}</span><div class="empty-text">No teams found.</div></div>'
}

<div class="footer">
  <span>CoreLLM \u00B7 ${teams.length} team(s)</span>
  <span>Spend: ${usd(totalSpend, 4)}</span>
  <span>Budget: ${usd(totalBudget)}</span>
</div>
<script>
(function() {
  const vscode = acquireVsCodeApi();
  const themes = ['vscode', 'light', 'dark', 'hc'];
  let currentThemeIdx = themes.indexOf('${theme}');
  if (currentThemeIdx < 0) currentThemeIdx = 0;
  document.getElementById('themeBtn').addEventListener('click', function() {
    currentThemeIdx = (currentThemeIdx + 1) % themes.length;
    vscode.postMessage({ type: 'setTheme', theme: themes[currentThemeIdx] });
  });
  document.getElementById('refreshBtn').addEventListener('click', function() {
    vscode.postMessage({ type: 'refresh' });
  });
  document.getElementById('exportCsvBtn').addEventListener('click', function() {
    vscode.postMessage({ type: 'exportCsv' });
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') vscode.postMessage({ type: 'close' });
  });
})();
</script>
</body>
</html>`;
}

// ─── Activity Panel HTML ─────────────────────────────────────────────────────

function buildActivityHtml(data: {
  activity: ActivityEntry[];
  error: string | null;
  activeTheme?: string;
}): string {
  const { activity, error, activeTheme } = data;
  const theme = activeTheme || "vscode";
  const themeOverride = buildThemeOverrides(theme);
  const totalSpend = activity.reduce((s, a) => s + (a.total_spend ?? 0), 0);
  const totalTokens = activity.reduce((s, a) => s + (a.total_tokens ?? 0), 0);
  const totalReqs = activity.reduce((s, a) => s + (a.count ?? 0), 0);

  // Daily aggregation
  const dayMap = new Map<
    string,
    { spend: number; tokens: number; count: number }
  >();
  for (const a of activity) {
    const day = a.day || a.hour?.slice(0, 10) || "unknown";
    const existing = dayMap.get(day) || { spend: 0, tokens: 0, count: 0 };
    existing.spend += a.total_spend ?? 0;
    existing.tokens += a.total_tokens ?? 0;
    existing.count += a.count ?? 0;
    dayMap.set(day, existing);
  }

  const dailyData = [...dayMap.entries()]
    .map(([label, v]) => ({ label, value: v.spend }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const lineChart =
    dailyData.length >= 2 ? svgLineChart(dailyData, 380, 120) : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${COMMON_CSS}${themeOverride}</style>
</head>
<body>
<h2>\u{1F4DD} CoreLLM Activity
  <span class="title-actions">
    <span class="theme-btn" id="themeBtn" title="Toggle theme">\u{1F3A8}</span>
    <button class="toolbar-btn" id="exportCsvBtn" title="Export as CSV">\u{1F4E5}</button>
    <button class="toolbar-btn primary" id="refreshBtn" title="Refresh">\u{1F504}</button>
  </span>
</h2>
${error ? `<div class="error-box">\u26A0 ${escapeHtml(error)}</div>` : ""}

<div class="summary-bar">
  <div class="summary-item"><div class="summary-value">${usd(totalSpend, 4)}</div><div class="summary-label">Total Spend</div></div>
  <div class="summary-item"><div class="summary-value">${totalReqs.toLocaleString()}</div><div class="summary-label">Requests</div></div>
  <div class="summary-item"><div class="summary-value">${totalTokens.toLocaleString()}</div><div class="summary-label">Tokens</div></div>
  <div class="summary-item"><div class="summary-value">${activity.length}</div><div class="summary-label">Entries</div></div>
</div>

${
  lineChart
    ? `<div class="card">
  <h3>\uD83D\uDCC8 Activity Trend</h3>
  <div class="chart-row" style="flex-direction:column;align-items:stretch">${lineChart}</div>
</div>`
    : ""
}

<div class="card">
  <h3>\u{1F4CB} Recent Activity</h3>
  ${
    activity.length > 0
      ? `
  <div class="table-wrap"><table><thead><tr><th>Date</th><th>Spend</th><th>Tokens</th><th>Requests</th></tr></thead>
  <tbody>${activity
    .slice(0, 50)
    .map((a) => {
      const dateStr = a.day || a.hour || "";
      const d = dateStr ? new Date(dateStr) : null;
      return `<tr>
      <td>${d ? d.toLocaleDateString() : escapeHtml(dateStr)}${a.hour ? ' <span class="rel-time">' + a.hour.slice(11, 16) + "</span>" : ""}</td>
      <td>${usd(a.total_spend, 6)}</td>
      <td>${(a.total_tokens ?? 0).toLocaleString()}</td>
      <td>${(a.count ?? 0).toLocaleString()}</td>
    </tr>`;
    })
    .join("")}</tbody></table></div>`
      : '<div class="empty-state"><span class="empty-icon">\u{1F4DD}</span><div class="empty-text">No activity data available.</div></div>'
  }
</div>

<div class="footer">
  <span>CoreLLM \u00B7 Activity</span>
  <span>Spend: ${usd(totalSpend, 4)}</span>
  <span>${totalReqs.toLocaleString()} requests</span>
</div>
<script>
(function() {
  const vscode = acquireVsCodeApi();
  const themes = ['vscode', 'light', 'dark', 'hc'];
  let currentThemeIdx = themes.indexOf('${theme}');
  if (currentThemeIdx < 0) currentThemeIdx = 0;
  document.getElementById('themeBtn').addEventListener('click', function() {
    currentThemeIdx = (currentThemeIdx + 1) % themes.length;
    vscode.postMessage({ type: 'setTheme', theme: themes[currentThemeIdx] });
  });
  document.getElementById('refreshBtn').addEventListener('click', function() {
    vscode.postMessage({ type: 'refresh' });
  });
  document.getElementById('exportCsvBtn').addEventListener('click', function() {
    vscode.postMessage({ type: 'exportCsv' });
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') vscode.postMessage({ type: 'close' });
  });
})();
</script>
</body>
</html>`;
}

// ─── Spend by Tags Panel HTML ────────────────────────────────────────────────

function buildSpendTagsHtml(data: {
  tags: SpendTagEntry[];
  error: string | null;
  activeTheme?: string;
}): string {
  const { tags, error, activeTheme } = data;
  const theme = activeTheme || "vscode";
  const themeOverride = buildThemeOverrides(theme);
  const totalSpend = tags.reduce((s, t) => s + (t.total_spend ?? 0), 0);
  const maxVal = Math.max(...tags.map((t) => t.total_spend ?? 0), 1);
  const chartData =
    tags.length > 0
      ? svgHBarChart(
          tags.slice(0, 15).map((t) => ({
            label: t.tag_name || "unknown",
            value: t.total_spend ?? 0,
          })),
          maxVal,
          340,
          18,
          3,
        )
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${COMMON_CSS}${themeOverride}</style>
</head>
<body>
<h2>\u{1F3F7} CoreLLM Spend by Tags
  <span class="title-actions">
    <span class="theme-btn" id="themeBtn" title="Toggle theme">\u{1F3A8}</span>
    <button class="toolbar-btn" id="exportCsvBtn" title="Export as CSV">\u{1F4E5}</button>
    <button class="toolbar-btn primary" id="refreshBtn" title="Refresh">\u{1F504}</button>
  </span>
</h2>
${error ? `<div class="error-box">\u26A0 ${escapeHtml(error)}</div>` : ""}

<div class="summary-bar">
  <div class="summary-item"><div class="summary-value">${tags.length}</div><div class="summary-label">Tags</div></div>
  <div class="summary-item"><div class="summary-value">${usd(totalSpend, 4)}</div><div class="summary-label">Total Spend</div></div>
</div>

<div class="card">
  <h3>\u{1F3F7} Tag Breakdown</h3>
  ${chartData || '<div class="empty-state"><span class="empty-icon">\u{1F3F7}</span><div class="empty-text">No tag spend data available.</div></div>'}
  ${
    tags.length > 0
      ? `
  <div class="table-wrap"><table><thead><tr><th>Tag</th><th>Spend</th><th>Tokens</th><th>Requests</th></tr></thead>
  <tbody>${tags
    .map(
      (t) => `<tr>
    <td><span class="badge">${escapeHtml(t.tag_name || "unknown")}</span></td>
    <td>${usd(t.total_spend, 4)}</td>
    <td>${(t.total_tokens ?? 0).toLocaleString()}</td>
    <td>${(t.count ?? 0).toLocaleString()}</td>
  </tr>`,
    )
    .join("")}</tbody></table></div>`
      : ""
  }
</div>

<div class="footer">
  <span>CoreLLM \u00B7 ${tags.length} tag(s)</span>
  <span>Total: ${usd(totalSpend, 4)}</span>
</div>
<script>
(function() {
  const vscode = acquireVsCodeApi();
  const themes = ['vscode', 'light', 'dark', 'hc'];
  let currentThemeIdx = themes.indexOf('${theme}');
  if (currentThemeIdx < 0) currentThemeIdx = 0;
  document.getElementById('themeBtn').addEventListener('click', function() {
    currentThemeIdx = (currentThemeIdx + 1) % themes.length;
    vscode.postMessage({ type: 'setTheme', theme: themes[currentThemeIdx] });
  });
  document.getElementById('refreshBtn').addEventListener('click', function() {
    vscode.postMessage({ type: 'refresh' });
  });
  document.getElementById('exportCsvBtn').addEventListener('click', function() {
    vscode.postMessage({ type: 'exportCsv' });
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') vscode.postMessage({ type: 'close' });
  });
})();
</script>
</body>
</html>`;
}

// ─── Model Info Panel HTML ───────────────────────────────────────────────────

function buildModelInfoHtml(data: {
  models: ModelInfoEntry[];
  error: string | null;
  activeTheme?: string;
}): string {
  const { models, error, activeTheme } = data;
  const theme = activeTheme || "vscode";
  const themeOverride = buildThemeOverrides(theme);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${COMMON_CSS}${themeOverride}</style>
</head>
<body>
<h2>\u{1F4CA} CoreLLM Model Info
  <span class="title-actions">
    <span class="theme-btn" id="themeBtn" title="Toggle theme">\u{1F3A8}</span>
    <button class="toolbar-btn" id="exportCsvBtn" title="Export as CSV">\u{1F4E5}</button>
    <button class="toolbar-btn primary" id="refreshBtn" title="Refresh">\u{1F504}</button>
  </span>
</h2>
${error ? `<div class="error-box">\u26A0 ${escapeHtml(error)}</div>` : ""}

<div class="summary-bar">
  <div class="summary-item"><div class="summary-value">${models.length}</div><div class="summary-label">Models</div></div>
</div>

<div class="card">
  <h3>\u{1F4CA} Model Catalog</h3>
  ${
    models.length > 0
      ? `
  <div class="search-bar">
    <input type="text" class="search-input" id="modelSearch" placeholder="\u{1F50D} Filter models\u2026">
    <span class="match-count" id="matchCount">Showing ${models.length}</span>
  </div>
  <div class="table-wrap"><table id="modelTable"><thead><tr><th>Model</th><th>Provider</th><th>Mode</th><th>Input $/tok</th><th>Output $/tok</th><th>Max Tokens</th><th>Fn Calls</th><th>Vision</th></tr></thead>
  <tbody>${models
    .map((m, idx) => {
      const info = m.model_info || {};
      return `<tr data-idx="${idx}" data-name="${escapeHtml((m.model_name || m.id || "").toLowerCase())}" data-provider="${escapeHtml((info.litellm_provider || "").toLowerCase())}">
      <td><strong>${escapeHtml(m.model_name || m.id || "unknown")}</strong></td>
      <td>${info.litellm_provider ? `<span class="badge">${escapeHtml(info.litellm_provider)}</span>` : "\u2014"}</td>
      <td>${info.mode ? `<span class="badge">${escapeHtml(info.mode)}</span>` : "\u2014"}</td>
      <td>${info.input_cost_per_token != null ? "$" + info.input_cost_per_token.toExponential(2) : "\u2014"}</td>
      <td>${info.output_cost_per_token != null ? "$" + info.output_cost_per_token.toExponential(2) : "\u2014"}</td>
      <td>${info.max_tokens ? info.max_tokens.toLocaleString() : "\u2014"}</td>
      <td>${info.supports_function_calling ? "\u2705" : "\u274C"}</td>
      <td>${info.supports_vision ? "\u2705" : "\u274C"}</td>
    </tr>`;
    })
    .join("")}</tbody></table></div>`
      : '<div class="empty-state"><span class="empty-icon">\u{1F4CA}</span><div class="empty-text">No model info available.</div></div>'
  }
</div>

<div class="footer">
  <span>CoreLLM \u00B7 ${models.length} model(s)</span>
</div>
<script>
(function() {
  const vscode = acquireVsCodeApi();
  const themes = ['vscode', 'light', 'dark', 'hc'];
  let currentThemeIdx = themes.indexOf('${theme}');
  if (currentThemeIdx < 0) currentThemeIdx = 0;
  document.getElementById('themeBtn').addEventListener('click', function() {
    currentThemeIdx = (currentThemeIdx + 1) % themes.length;
    vscode.postMessage({ type: 'setTheme', theme: themes[currentThemeIdx] });
  });
  document.getElementById('refreshBtn').addEventListener('click', function() {
    vscode.postMessage({ type: 'refresh' });
  });
  document.getElementById('exportCsvBtn').addEventListener('click', function() {
    vscode.postMessage({ type: 'exportCsv' });
  });

  const input = document.getElementById('modelSearch');
  const table = document.getElementById('modelTable');
  const matchCount = document.getElementById('matchCount');
  if (input && table) {
    input.addEventListener('input', function() {
      const q = this.value.toLowerCase().trim();
      const rows = table.querySelectorAll('tbody tr');
      let visible = 0;
      rows.forEach(row => {
        const name = row.getAttribute('data-name') || '';
        const provider = row.getAttribute('data-provider') || '';
        const txt = name + ' ' + provider + ' ' + row.textContent.toLowerCase();
        const match = !q || txt.includes(q);
        row.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      matchCount.textContent = q ? 'Showing ' + visible + ' of ' + rows.length : 'Showing ' + rows.length;
    });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') vscode.postMessage({ type: 'close' });
  });
})();
</script>
</body>
</html>`;
}

// ─── Key Health Panel HTML ───────────────────────────────────────────────────

function buildKeyHealthHtml(data: {
  health: KeyHealthResponse[];
  error: string | null;
  activeTheme?: string;
}): string {
  const { health, error, activeTheme } = data;
  const theme = activeTheme || "vscode";
  const themeOverride = buildThemeOverrides(theme);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${COMMON_CSS}${themeOverride}</style>
</head>
<body>
<h2>\u{1F3AF} CoreLLM Key Health
  <span class="title-actions">
    <span class="theme-btn" id="themeBtn" title="Toggle theme">\u{1F3A8}</span>
    <button class="toolbar-btn primary" id="refreshBtn" title="Refresh">\u{1F504}</button>
  </span>
</h2>
${error ? `<div class="error-box">\u26A0 ${escapeHtml(error)}</div>` : ""}

${
  health.length > 0
    ? health
        .map((k) => {
          const isHealthy = k.health === "healthy";
          return `<div class="card">
    <h3>${escapeHtml(k.key_alias || k.key_name || k.key?.slice(0, 20) || "Unknown Key")}
      <span class="badge ${isHealthy ? "badge-success" : "badge-error"}">${escapeHtml(k.health || "unknown")}</span>
    </h3>
    <div class="grid">
      <div class="stat"><div class="stat-value">${usd(k.spend, 4)}</div><div class="stat-label">Spend</div></div>
      <div class="stat"><div class="stat-value">${usd(k.max_budget)}</div><div class="stat-label">Max Budget</div></div>
    </div>
    ${k.last_accessed ? `<p style="font-size:.82em;opacity:.65;margin-top:4px">\u{1F4C5} Last accessed: ${new Date(k.last_accessed).toLocaleString()}</p>` : ""}
    ${k.models && k.models.length > 0 ? `<p style="font-size:.82em;opacity:.65">\u{1F4CB} Models: ${k.models.join(", ")}</p>` : ""}
  </div>`;
        })
        .join("\n")
    : '<div class="empty-state"><span class="empty-icon">\u{1F3AF}</span><div class="empty-text">No key health data available.</div></div>'
}

<div class="footer">
  <span>CoreLLM \u00B7 Key Health</span>
  <span>${health.length} key(s)</span>
</div>
<script>
(function() {
  const vscode = acquireVsCodeApi();
  const themes = ['vscode', 'light', 'dark', 'hc'];
  let currentThemeIdx = themes.indexOf('${theme}');
  if (currentThemeIdx < 0) currentThemeIdx = 0;
  document.getElementById('themeBtn').addEventListener('click', function() {
    currentThemeIdx = (currentThemeIdx + 1) % themes.length;
    vscode.postMessage({ type: 'setTheme', theme: themes[currentThemeIdx] });
  });
  document.getElementById('refreshBtn').addEventListener('click', function() {
    vscode.postMessage({ type: 'refresh' });
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') vscode.postMessage({ type: 'close' });
  });
})();
</script>
</body>
</html>`;
}

// ─── Status Bar Manager ──────────────────────────────────────────────────────

class BalanceStatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private timer: NodeJS.Timeout | undefined;
  private client: CoreLLMApiClient;
  private config: ExtensionConfig;
  private disposables: vscode.Disposable[] = [];
  private budgetOverviewPanel: vscode.WebviewPanel | undefined;
  private spendLogsPanel: vscode.WebviewPanel | undefined;
  private keyListPanel: vscode.WebviewPanel | undefined;
  private tutorialPanel: vscode.WebviewPanel | undefined;
  private changelogPanel: vscode.WebviewPanel | undefined;
  private globalSpendPanel: vscode.WebviewPanel | undefined;
  private teamsPanel: vscode.WebviewPanel | undefined;
  private activityPanel: vscode.WebviewPanel | undefined;
  private modelInfoPanel: vscode.WebviewPanel | undefined;
  private spendTagsPanel: vscode.WebviewPanel | undefined;
  private keyHealthPanel: vscode.WebviewPanel | undefined;
  private healthDashboardPanel: vscode.WebviewPanel | undefined;
  private providerSpendPanel: vscode.WebviewPanel | undefined;
  private userManagerPanel: vscode.WebviewPanel | undefined;
  private unifiedDashboardPanel: vscode.WebviewPanel | undefined;

  // ── Display Cycling ──────────────────────────────────────────────────
  private displayCycleIndex = 0;
  private lastKeyInfo: KeyInfoResponse | null = null;
  private secrets: vscode.SecretStorage;

  constructor(secrets: vscode.SecretStorage, initialConfig?: ExtensionConfig) {
    this.secrets = secrets;
    this.config = initialConfig ?? getConfig();
    this.activeTheme = this.config.webviewTheme;
    this.client = new CoreLLMApiClient(this.config);

    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );
    this.statusBarItem.name = "CoreLLM";
    this.statusBarItem.command = "corellm.cycleDisplay";
    this.statusBarItem.tooltip =
      "CoreLLM \u2014 Click to cycle display (spend / usage / budget)";
    this.statusBarItem.text = "$(graph) CoreLLM: \u2026";
    this.statusBarItem.backgroundColor = undefined;
    this.statusBarItem.show();
    this.disposables.push(this.statusBarItem);

    this.registerCommands();
    this.watchConfigChanges();
  }

  private registerCommands(): void {
    this.disposables.push(
      vscode.commands.registerCommand("corellm.refresh", () => {
        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Window,
            title: "Checking CoreLLM balance\u2026",
          },
          async () => {
            await this.refresh();
          },
        );
      }),
      vscode.commands.registerCommand("corellm.openSettings", () => {
        vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "@ext:litellm-tools.corellm",
        );
      }),
      vscode.commands.registerCommand("corellm.toggleAutoRefresh", () => {
        if (this.timer) {
          this.stopAutoRefresh();
          vscode.window.showInformationMessage("CoreLLM auto-refresh disabled");
        } else {
          this.startAutoRefresh();
          vscode.window.showInformationMessage(
            `CoreLLM auto-refresh enabled (every ${this.config.refreshInterval}s)`,
          );
        }
      }),
      vscode.commands.registerCommand("corellm.showBudgetOverview", () =>
        this.openBudgetOverview(),
      ),
      vscode.commands.registerCommand("corellm.showSpendLogs", () =>
        this.openSpendLogs(),
      ),
      vscode.commands.registerCommand("corellm.listKeys", () =>
        this.openKeyList(),
      ),
      vscode.commands.registerCommand("corellm.setReportDuration", () =>
        this.pickReportDuration(),
      ),
      vscode.commands.registerCommand("corellm.enableAutoRefresh", () => {
        this.startAutoRefresh();
        vscode.window.showInformationMessage(
          `CoreLLM auto-refresh enabled (every ${this.config.refreshInterval}s)`,
        );
      }),
      vscode.commands.registerCommand("corellm.disableAutoRefresh", () => {
        this.stopAutoRefresh();
        vscode.window.showInformationMessage("CoreLLM auto-refresh disabled");
      }),
      vscode.commands.registerCommand("corellm.cycleDisplay", () =>
        this.cycleDisplay(),
      ),
      vscode.commands.registerCommand("corellm.showAbout", () => {
        vscode.window
          .showInformationMessage(
            `CoreLLM v${CURRENT_VERSION} — Monitor LiteLLM API key balances and usage.`,
            "Open Settings",
          )
          .then((sel) => {
            if (sel === "Open Settings") {
              vscode.commands.executeCommand(
                "workbench.action.openSettings",
                "@ext:litellm-tools.corellm",
              );
            }
          });
      }),
      vscode.commands.registerCommand("corellm.showTutorial", () =>
        this.openTutorial(),
      ),
      vscode.commands.registerCommand("corellm.showChangelog", () =>
        this.openChangelog(),
      ),
      vscode.commands.registerCommand("corellm.showGlobalSpend", () =>
        this.openGlobalSpend(),
      ),
      vscode.commands.registerCommand("corellm.showTeams", () =>
        this.openTeams(),
      ),
      vscode.commands.registerCommand("corellm.showActivity", () =>
        this.openActivity(),
      ),
      vscode.commands.registerCommand("corellm.showModelInfo", () =>
        this.openModelInfo(),
      ),
      vscode.commands.registerCommand("corellm.showSpendByTags", () =>
        this.openSpendTags(),
      ),
      vscode.commands.registerCommand("corellm.showKeyHealth", () =>
        this.openKeyHealth(),
      ),
      vscode.commands.registerCommand("corellm.showHealthDashboard", () =>
        this.openHealthDashboard(),
      ),
      vscode.commands.registerCommand("corellm.showProviderSpend", () =>
        this.openProviderSpend(),
      ),
      vscode.commands.registerCommand("corellm.showUserManager", () =>
        this.openUserManager(),
      ),
      vscode.commands.registerCommand("corellm.showUnifiedDashboard", () =>
        this.openUnifiedDashboard(),
      ),

      // ── Credential Management (SecretStorage) ──────────────────────
      vscode.commands.registerCommand("corellm.setApiKey", async () => {
        const value = await vscode.window.showInputBox({
          prompt: "Enter your LiteLLM API key",
          password: true,
          placeHolder: "sk-...",
          ignoreFocusOut: true,
        });
        if (value !== undefined) {
          await storeSecret(this.secrets, SECRET_API_KEY, value);
          this.config = await resolveConfig(this.secrets);
          this.client = new CoreLLMApiClient(this.config);
          vscode.window.showInformationMessage(
            "CoreLLM: API key saved securely (OS keychain).",
          );
          this.refresh();
        }
      }),
      vscode.commands.registerCommand("corellm.setAdminKey", async () => {
        const value = await vscode.window.showInputBox({
          prompt: "Enter your LiteLLM admin/proxy master key",
          password: true,
          placeHolder: "sk-...",
          ignoreFocusOut: true,
        });
        if (value !== undefined) {
          await storeSecret(this.secrets, SECRET_ADMIN_KEY, value);
          this.config = await resolveConfig(this.secrets);
          this.client = new CoreLLMApiClient(this.config);
          vscode.window.showInformationMessage(
            "CoreLLM: Admin key saved securely (OS keychain).",
          );
          this.refresh();
        }
      }),
      vscode.commands.registerCommand("corellm.setPassword", async () => {
        const value = await vscode.window.showInputBox({
          prompt: "Enter your LiteLLM UI password",
          password: true,
          placeHolder: "password",
          ignoreFocusOut: true,
        });
        if (value !== undefined) {
          await storeSecret(this.secrets, SECRET_PASSWORD, value);
          this.config = await resolveConfig(this.secrets);
          this.client = new CoreLLMApiClient(this.config);
          vscode.window.showInformationMessage(
            "CoreLLM: Password saved securely (OS keychain).",
          );
          this.refresh();
        }
      }),
      vscode.commands.registerCommand("corellm.clearCredentials", async () => {
        const confirm = await vscode.window.showWarningMessage(
          "Are you sure you want to clear all stored CoreLLM credentials from the OS keychain?",
          { modal: true },
          "Yes, clear all",
        );
        if (confirm === "Yes, clear all") {
          for (const key of CREDENTIAL_KEYS) {
            await clearSecret(this.secrets, key);
          }
          this.config = await resolveConfig(this.secrets);
          this.client = new CoreLLMApiClient(this.config);
          vscode.window.showInformationMessage(
            "CoreLLM: All stored credentials cleared.",
          );
          this.refresh();
        }
      }),
    );
  }

  private watchConfigChanges(): void {
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration("corellm")) {
          this.config = await resolveConfig(this.secrets);
          this.client = new CoreLLMApiClient(this.config);
          this.setInitialDisplayMode();
          this.stopAutoRefresh();
          if (this.config.refreshInterval > 0) this.startAutoRefresh();
          this.refresh();
        }
      }),
    );
  }

  // ── Budget Overview ──────────────────────────────────────────────────────

  private async fetchBudgetData(): Promise<{
    keyInfo: KeyInfoResponse | null;
    spendLogs: SpendLogEntry[];
    keyError: string | null;
  }> {
    let keyInfo: KeyInfoResponse | null = null;
    let spendLogs: SpendLogEntry[] = [];
    let keyError: string | null = null;

    try {
      keyInfo = await this.client.fetchKeyInfo();
    } catch (err) {
      keyError = (err as Error)?.message ?? "Unknown error";
    }

    try {
      spendLogs = await this.client.fetchSpendLogs(10);
    } catch {
      /* silent */
    }

    return { keyInfo, spendLogs, keyError };
  }

  // ── Theme state ──────────────────────────────────────────────────────────
  private activeTheme: string;

  private async openBudgetOverview(): Promise<void> {
    if (this.budgetOverviewPanel) {
      this.budgetOverviewPanel.reveal(vscode.ViewColumn.One);
      return;
    }

    this.budgetOverviewPanel = vscode.window.createWebviewPanel(
      "corellmBudgetOverview",
      "CoreLLM Budget Overview",
      vscode.ViewColumn.One,
      { enableScripts: true },
    );
    this.budgetOverviewPanel.onDidDispose(() => {
      this.budgetOverviewPanel = undefined;
    });

    // Handle messages from the webview
    this.budgetOverviewPanel.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case "refresh":
          this.refreshBudgetOverview();
          break;
        case "exportCsv":
          this.exportBudgetCsv();
          break;
        case "setTheme":
          this.activeTheme = msg.theme;
          if (this.budgetOverviewPanel) this.refreshBudgetOverview();
          if (this.spendLogsPanel) this.refreshSpendLogsPanel();
          if (this.keyListPanel) this.refreshKeyListPanel();
          if (this.tutorialPanel) this.refreshTutorial();
          if (this.changelogPanel) this.refreshChangelog();
          break;
        case "openSettings":
          vscode.commands.executeCommand("workbench.action.openSettings", "@ext:litellm-tools.corellm");
          break;
        case "cancel":
        case "close":
          this.budgetOverviewPanel?.dispose();
          break;
      }
    });

    this.budgetOverviewPanel.webview.html = buildLoadingHtml(
      "Loading Budget Overview\u2026",
      true,
    );

    let data: {
      keyInfo: KeyInfoResponse | null;
      spendLogs: SpendLogEntry[];
      keyError: string | null;
    };

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: "Fetching CoreLLM budget data\u2026",
      },
      async () => {
        data = await this.fetchBudgetData();
      },
    );
    if (!this.budgetOverviewPanel) return;
    this.budgetOverviewPanel.webview.html =
      this.buildBudgetOverviewHtmlWithDuration(data!);
  }

  /** Re-render the budget overview panel */
  private async refreshBudgetOverview(): Promise<void> {
    if (!this.budgetOverviewPanel) return;
    const data = await this.fetchBudgetData();
    if (this.budgetOverviewPanel) {
      this.budgetOverviewPanel.webview.html =
        this.buildBudgetOverviewHtmlWithDuration(data);
    }
  }

  private buildBudgetOverviewHtmlWithDuration(data: {
    keyInfo: KeyInfoResponse | null;
    spendLogs: SpendLogEntry[];
    keyError: string | null;
  }): string {
    return buildBudgetOverviewHtml({
      ...data,
      activeTheme: this.activeTheme,
    });
  }

  /** Set report duration from webview message and refresh */
  private async setReportDurationFromWebview(
    duration: ReportDuration,
  ): Promise<void> {
    const cfg = vscode.workspace.getConfiguration("corellm");
    await cfg.update(
      "reportDuration",
      duration,
      vscode.ConfigurationTarget.Global,
    );
    this.config = getConfig();
    this.client = new CoreLLMApiClient(this.config);
    if (this.budgetOverviewPanel) await this.refreshBudgetOverview();
  }

  /** Set custom date range from webview message and refresh */
  private async setCustomDatesFromWebview(
    startDate: string,
    endDate: string,
  ): Promise<void> {
    const cfg = vscode.workspace.getConfiguration("corellm");
    await cfg.update(
      "reportDuration",
      "custom",
      vscode.ConfigurationTarget.Global,
    );
    await cfg.update(
      "reportCustomStart",
      startDate,
      vscode.ConfigurationTarget.Global,
    );
    await cfg.update(
      "reportCustomEnd",
      endDate,
      vscode.ConfigurationTarget.Global,
    );
    this.config = getConfig();
    this.client = new CoreLLMApiClient(this.config);
    if (this.budgetOverviewPanel) await this.refreshBudgetOverview();
  }

  /** Show a QuickPick to change the report duration, then refresh */
  private async pickReportDuration(): Promise<void> {
    const pick = await vscode.window.showQuickPick(
      (Object.keys(DURATION_LABELS) as ReportDuration[]).map((k) => ({
        label: DURATION_LABELS[k],
        description: k === this.config.reportDuration ? "current" : "",
        detail: k === "custom" ? "Set start/end dates in settings" : undefined,
        value: k,
      })),
      { placeHolder: "Select report duration for Budget Overview" },
    );
    if (!pick) return;
    const cfg = vscode.workspace.getConfiguration("corellm");
    await cfg.update(
      "reportDuration",
      pick.value,
      vscode.ConfigurationTarget.Global,
    );
    this.config = getConfig();
    this.client = new CoreLLMApiClient(this.config);
    if (this.budgetOverviewPanel) {
      await this.refreshBudgetOverview();
    } else {
      await this.openBudgetOverview();
    }
  }

  // ── Spend Logs ───────────────────────────────────────────────────────────

  private async openSpendLogs(): Promise<void> {
    if (this.spendLogsPanel) {
      this.spendLogsPanel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    this.spendLogsPanel = vscode.window.createWebviewPanel(
      "corellmSpendLogs",
      "CoreLLM Spend Logs",
      vscode.ViewColumn.Beside,
      { enableScripts: true },
    );
    this.spendLogsPanel.onDidDispose(() => {
      this.spendLogsPanel = undefined;
    });
    this.spendLogsPanel.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case "refresh":
          this.refreshSpendLogsPanel();
          break;
        case "exportCsv":
          this.exportSpendLogsCsv();
          break;
        case "setTheme":
          this.activeTheme = msg.theme;
          if (this.spendLogsPanel) this.refreshSpendLogsPanel();
          if (this.budgetOverviewPanel) this.refreshBudgetOverview();
          if (this.keyListPanel) this.refreshKeyListPanel();
          if (this.tutorialPanel) this.refreshTutorial();
          if (this.changelogPanel) this.refreshChangelog();
          break;
        case "cancel":
        case "close":
          this.spendLogsPanel?.dispose();
          break;
      }
    });
    this.spendLogsPanel.webview.html = buildLoadingHtml(
      "Loading Spend Logs\u2026",
      true,
    );

    let logs: SpendLogEntry[] = [];
    let error: string | null = null;
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: "Fetching spend logs\u2026",
      },
      async () => {
        try {
          logs = await this.client.fetchSpendLogs(50);
        } catch (err) {
          error = String(err);
        }
      },
    );
    if (this.spendLogsPanel)
      this.spendLogsPanel.webview.html = buildSpendLogsHtml(
        logs,
        error,
        this.activeTheme,
      );
  }

  private async refreshSpendLogsPanel(): Promise<void> {
    if (!this.spendLogsPanel) return;
    let logs: SpendLogEntry[] = [];
    let error: string | null = null;
    try {
      logs = await this.client.fetchSpendLogs(50);
    } catch (err) {
      error = String(err);
    }

    if (this.spendLogsPanel)
      this.spendLogsPanel.webview.html = buildSpendLogsHtml(
        logs,
        error,
        this.activeTheme,
      );
  }

  // ── Key List ────────────────────────────────────────────────────────────

  private async openKeyList(): Promise<void> {
    if (this.keyListPanel) {
      this.keyListPanel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    this.keyListPanel = vscode.window.createWebviewPanel(
      "corellmKeyList",
      "CoreLLM Keys",
      vscode.ViewColumn.Beside,
      { enableScripts: true },
    );
    this.keyListPanel.onDidDispose(() => {
      this.keyListPanel = undefined;
    });
    this.keyListPanel.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case "refresh":
          this.refreshKeyListPanel();
          break;
        case "exportCsv":
          this.exportKeyListCsv();
          break;
        case "setTheme":
          this.activeTheme = msg.theme;
          if (this.keyListPanel) this.refreshKeyListPanel();
          if (this.budgetOverviewPanel) this.refreshBudgetOverview();
          if (this.spendLogsPanel) this.refreshSpendLogsPanel();
          if (this.tutorialPanel) this.refreshTutorial();
          if (this.changelogPanel) this.refreshChangelog();
          break;
        case "cancel":
        case "close":
          this.keyListPanel?.dispose();
          break;
      }
    });
    this.keyListPanel.webview.html = buildLoadingHtml(
      "Loading Keys\u2026",
      true,
    );

    let keys: KeyListItem[] = [];
    let error: string | null = null;
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: "Fetching keys\u2026",
      },
      async () => {
        try {
          const r = await this.client.fetchKeyList();
          keys = r.keys ?? [];
        } catch (err) {
          error = String(err);
        }
      },
    );
    if (this.keyListPanel)
      this.keyListPanel.webview.html = buildKeyListHtml(
        keys,
        error,
        this.activeTheme,
      );
  }

  private async refreshKeyListPanel(): Promise<void> {
    if (!this.keyListPanel) return;
    let keys: KeyListItem[] = [];
    let error: string | null = null;
    try {
      const r = await this.client.fetchKeyList();
      keys = r.keys ?? [];
    } catch (err) {
      error = String(err);
    }

    if (this.keyListPanel)
      this.keyListPanel.webview.html = buildKeyListHtml(
        keys,
        error,
        this.activeTheme,
      );
  }

  // ── Tutorial / Getting Started ──────────────────────────────────────────

  private openTutorial(): void {
    if (this.tutorialPanel) {
      this.tutorialPanel.reveal(vscode.ViewColumn.One);
      return;
    }

    this.tutorialPanel = vscode.window.createWebviewPanel(
      "corellmTutorial",
      "CoreLLM Tutorial",
      vscode.ViewColumn.One,
      { enableScripts: true },
    );
    this.tutorialPanel.onDidDispose(() => {
      this.tutorialPanel = undefined;
    });
    this.tutorialPanel.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case "setTheme":
          this.activeTheme = msg.theme;
          if (this.tutorialPanel) this.refreshTutorial();
          if (this.budgetOverviewPanel) this.refreshBudgetOverview();
          if (this.spendLogsPanel) this.refreshSpendLogsPanel();
          if (this.keyListPanel) this.refreshKeyListPanel();
          break;
        case "openSettings":
          vscode.commands.executeCommand(
            "workbench.action.openSettings",
            "@ext:litellm-tools.corellm",
          );
          break;
        case "openBudgetOverview":
          this.openBudgetOverview();
          break;
        case "close":
          this.tutorialPanel?.dispose();
          break;
      }
    });
    this.refreshTutorial();
  }

  private refreshTutorial(): void {
    if (!this.tutorialPanel) return;
    this.tutorialPanel.webview.html = buildTutorialHtml(this.activeTheme);
  }

  // ── Changelog / What's New ──────────────────────────────────────────────

  public openChangelog(): void {
    if (this.changelogPanel) {
      this.changelogPanel.reveal(vscode.ViewColumn.One);
      return;
    }

    this.changelogPanel = vscode.window.createWebviewPanel(
      "corellmChangelog",
      "CoreLLM Changelog",
      vscode.ViewColumn.One,
      { enableScripts: true },
    );
    this.changelogPanel.onDidDispose(() => {
      this.changelogPanel = undefined;
    });
    this.changelogPanel.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case "setTheme":
          this.activeTheme = msg.theme;
          if (this.changelogPanel) this.refreshChangelog();
          if (this.budgetOverviewPanel) this.refreshBudgetOverview();
          if (this.spendLogsPanel) this.refreshSpendLogsPanel();
          if (this.keyListPanel) this.refreshKeyListPanel();
          if (this.tutorialPanel) this.refreshTutorial();
          break;
        case "openTutorial":
          this.openTutorial();
          break;
        case "close":
          this.changelogPanel?.dispose();
          break;
      }
    });
    this.refreshChangelog();
  }

  private refreshChangelog(): void {
    if (!this.changelogPanel) return;
    this.changelogPanel.webview.html = buildChangelogHtml(this.activeTheme);
  }

  // ── Global Spend Panel ──────────────────────────────────────────────────

  private async openGlobalSpend(): Promise<void> {
    if (this.globalSpendPanel) {
      this.globalSpendPanel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    this.globalSpendPanel = vscode.window.createWebviewPanel(
      "corellmGlobalSpend",
      "CoreLLM Global Spend",
      vscode.ViewColumn.Beside,
      { enableScripts: true },
    );
    this.globalSpendPanel.onDidDispose(() => {
      this.globalSpendPanel = undefined;
    });
    this.globalSpendPanel.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case "refresh":
          this.refreshGlobalSpend();
          break;
        case "exportCsv":
          this.exportGlobalSpendCsv();
          break;
        case "setTheme":
          this.activeTheme = msg.theme;
          this.refreshAllPanels();
          break;
        case "cancel":
        case "close":
          this.globalSpendPanel?.dispose();
          break;
      }
    });
    this.globalSpendPanel.webview.html = buildLoadingHtml(
      "Loading Global Spend\u2026",
      true,
    );
    await this.refreshGlobalSpend();
  }

  private async refreshGlobalSpend(): Promise<void> {
    if (!this.globalSpendPanel) return;
    const dr = getDateRange(
      this.config.reportDuration,
      this.config.reportCustomStart,
      this.config.reportCustomEnd,
    );
    let keys: GlobalSpendEntry[] = [];
    let models: GlobalSpendModelEntry[] = [];
    let teams: GlobalSpendTeamEntry[] = [];
    let keyError: string | null = null;
    let modelError: string | null = null;
    let teamError: string | null = null;

    const results = await Promise.allSettled([
      this.client.fetchGlobalSpendKeys(dr.start, dr.end),
      this.client.fetchGlobalSpendModels(dr.start, dr.end),
      this.client.fetchGlobalSpendTeams(dr.start, dr.end),
    ]);
    if (results[0].status === "fulfilled") keys = results[0].value.keys ?? [];
    else keyError = (results[0].reason as Error)?.message ?? "Unknown error";
    if (results[1].status === "fulfilled")
      models = results[1].value.models ?? [];
    else modelError = (results[1].reason as Error)?.message ?? "Unknown error";
    if (results[2].status === "fulfilled") teams = results[2].value.teams ?? [];
    else teamError = (results[2].reason as Error)?.message ?? "Unknown error";

    if (this.globalSpendPanel) {
      this.globalSpendPanel.webview.html = buildGlobalSpendHtml({
        keys,
        models,
        teams,
        keyError,
        modelError,
        teamError,
        activeTheme: this.activeTheme,
        dateRange: `${dr.start} \u2013 ${dr.end}`,
      });
    }
  }

  private async exportGlobalSpendCsv(): Promise<void> {
    if (!this.globalSpendPanel) return;
    const dr = getDateRange(
      this.config.reportDuration,
      this.config.reportCustomStart,
      this.config.reportCustomEnd,
    );
    let keys: GlobalSpendEntry[] = [];
    let models: GlobalSpendModelEntry[] = [];
    let teams: GlobalSpendTeamEntry[] = [];
    try {
      const r = await Promise.allSettled([
        this.client.fetchGlobalSpendKeys(dr.start, dr.end),
        this.client.fetchGlobalSpendModels(dr.start, dr.end),
        this.client.fetchGlobalSpendTeams(dr.start, dr.end),
      ]);
      if (r[0].status === "fulfilled") keys = r[0].value.keys ?? [];
      if (r[1].status === "fulfilled") models = r[1].value.models ?? [];
      if (r[2].status === "fulfilled") teams = r[2].value.teams ?? [];
    } catch {
      /* ignore */
    }

    const rows: string[][] = [];
    rows.push(["--- Spend by Key ---", ""]);
    keys.forEach((k) =>
      rows.push([
        k.key_alias || k.api_key || "",
        String(k.total_spend ?? 0),
        String(k.total_tokens ?? 0),
        String(k.count ?? 0),
      ]),
    );
    rows.push(["", ""]);
    rows.push(["--- Spend by Model ---", ""]);
    models.forEach((m) =>
      rows.push([
        m.model || "",
        String(m.total_spend ?? 0),
        String(m.input_tokens ?? 0),
        String(m.output_tokens ?? 0),
        String(m.count ?? 0),
      ]),
    );
    rows.push(["", ""]);
    rows.push(["--- Spend by Team ---", ""]);
    teams.forEach((t) =>
      rows.push([
        t.team_name || t.team_id || "",
        String(t.total_spend ?? 0),
        String(t.total_tokens ?? 0),
        String(t.count ?? 0),
      ]),
    );
    const csv = [
      "Key/Model/Team,Spend,Tokens,Count",
      ...rows.map((r) => r.map((c) => csvCell(c)).join(",")),
    ].join("\n");
    const doc = await vscode.workspace.openTextDocument({
      content: csv,
      language: "csv",
    });
    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage("Global spend exported as CSV.");
  }

  // ── Teams Panel ─────────────────────────────────────────────────────────

  private async openTeams(): Promise<void> {
    if (this.teamsPanel) {
      this.teamsPanel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    this.teamsPanel = vscode.window.createWebviewPanel(
      "corellmTeams",
      "CoreLLM Teams",
      vscode.ViewColumn.Beside,
      { enableScripts: true },
    );
    this.teamsPanel.onDidDispose(() => {
      this.teamsPanel = undefined;
    });
    this.teamsPanel.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case "refresh":
          this.refreshTeamsPanel();
          break;
        case "exportCsv":
          this.exportTeamsCsv();
          break;
        case "setTheme":
          this.activeTheme = msg.theme;
          this.refreshAllPanels();
          break;
        case "cancel":
        case "close":
          this.teamsPanel?.dispose();
          break;
      }
    });
    this.teamsPanel.webview.html = buildLoadingHtml(
      "Loading Teams\u2026",
      true,
    );
    await this.refreshTeamsPanel();
  }

  private async refreshTeamsPanel(): Promise<void> {
    if (!this.teamsPanel) return;
    let teams: TeamInfoResponse[] = [];
    let globalTeamSpend: GlobalSpendTeamEntry[] = [];
    let error: string | null = null;
    let spendError: string | null = null;
    try {
      const r = await this.client.fetchTeamList();
      teams = r.teams ?? [];
    } catch (err) {
      error = String(err);
    }

    try {
      const dr = getDateRange(
        this.config.reportDuration,
        this.config.reportCustomStart,
        this.config.reportCustomEnd,
      );
      const r = await this.client.fetchGlobalSpendTeams(dr.start, dr.end);
      globalTeamSpend = r.teams ?? [];
    } catch (err) {
      spendError = String(err);
    }

    if (this.teamsPanel) {
      this.teamsPanel.webview.html = buildTeamsHtml({
        teams,
        globalTeamSpend,
        error,
        spendError,
        activeTheme: this.activeTheme,
      });
    }
  }

  private async exportTeamsCsv(): Promise<void> {
    if (!this.teamsPanel) return;
    let teams: TeamInfoResponse[] = [];
    try {
      const r = await this.client.fetchTeamList();
      teams = r.teams ?? [];
    } catch {
      /* ignore */
    }

    const headers = ["Team", "Spend", "Max Budget", "Used %", "Blocked"];
    const rows = teams.map((t) =>
      [
        t.team_alias || t.team_name || t.team_id || "",
        String(t.spend ?? 0),
        String(t.max_budget ?? ""),
        t.max_budget && t.max_budget > 0
          ? String(((t.spend ?? 0) / t.max_budget) * 100)
          : "",
        String(t.blocked ?? false),
      ].map((c) => csvCell(c)),
    );
    const csv = [headers.join(","), ...rows.join("\n")].join("\n");
    const doc = await vscode.workspace.openTextDocument({
      content: csv,
      language: "csv",
    });
    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage("Teams exported as CSV.");
  }

  // ── Activity Panel ──────────────────────────────────────────────────────

  private async openActivity(): Promise<void> {
    if (this.activityPanel) {
      this.activityPanel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    this.activityPanel = vscode.window.createWebviewPanel(
      "corellmActivity",
      "CoreLLM Activity",
      vscode.ViewColumn.Beside,
      { enableScripts: true },
    );
    this.activityPanel.onDidDispose(() => {
      this.activityPanel = undefined;
    });
    this.activityPanel.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case "refresh":
          this.refreshActivityPanel();
          break;
        case "exportCsv":
          this.exportActivityCsv();
          break;
        case "setTheme":
          this.activeTheme = msg.theme;
          this.refreshAllPanels();
          break;
        case "cancel":
        case "close":
          this.activityPanel?.dispose();
          break;
      }
    });
    this.activityPanel.webview.html = buildLoadingHtml(
      "Loading Activity\u2026",
      true,
    );
    await this.refreshActivityPanel();
  }

  private async refreshActivityPanel(): Promise<void> {
    if (!this.activityPanel) return;
    const dr = getDateRange(
      this.config.reportDuration,
      this.config.reportCustomStart,
      this.config.reportCustomEnd,
    );
    let activity: ActivityEntry[] = [];
    let error: string | null = null;
    try {
      const r = await this.client.fetchGlobalActivity(dr.start, dr.end);
      activity = r.data ?? [];
    } catch (err) {
      error = String(err);
    }

    if (this.activityPanel) {
      this.activityPanel.webview.html = buildActivityHtml({
        activity,
        error,
        activeTheme: this.activeTheme,
      });
    }
  }

  private async exportActivityCsv(): Promise<void> {
    if (!this.activityPanel) return;
    let activity: ActivityEntry[] = [];
    try {
      const dr = getDateRange(
        this.config.reportDuration,
        this.config.reportCustomStart,
        this.config.reportCustomEnd,
      );
      const r = await this.client.fetchGlobalActivity(dr.start, dr.end);
      activity = r.data ?? [];
    } catch {
      /* ignore */
    }

    if (activity.length === 0) {
      vscode.window.showWarningMessage("No activity data to export.");
      return;
    }

    const headers = ["Date", "Spend", "Tokens", "Requests"];
    const rows = activity.map((a) =>
      [
        a.day || a.hour || "",
        String(a.total_spend ?? 0),
        String(a.total_tokens ?? 0),
        String(a.count ?? 0),
      ].map((c) => csvCell(c)),
    );
    const csv = [headers.join(","), ...rows.join("\n")].join("\n");
    const doc = await vscode.workspace.openTextDocument({
      content: csv,
      language: "csv",
    });
    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage("Activity exported as CSV.");
  }

  // ── Model Info Panel ────────────────────────────────────────────────────

  private async openModelInfo(): Promise<void> {
    if (this.modelInfoPanel) {
      this.modelInfoPanel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    this.modelInfoPanel = vscode.window.createWebviewPanel(
      "corellmModelInfo",
      "CoreLLM Model Info",
      vscode.ViewColumn.Beside,
      { enableScripts: true },
    );
    this.modelInfoPanel.onDidDispose(() => {
      this.modelInfoPanel = undefined;
    });
    this.modelInfoPanel.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case "refresh":
          this.refreshModelInfoPanel();
          break;
        case "exportCsv":
          this.exportModelInfoCsv();
          break;
        case "setTheme":
          this.activeTheme = msg.theme;
          this.refreshAllPanels();
          break;
        case "cancel":
        case "close":
          this.modelInfoPanel?.dispose();
          break;
      }
    });
    this.modelInfoPanel.webview.html = buildLoadingHtml(
      "Loading Model Info\u2026",
      true,
    );
    await this.refreshModelInfoPanel();
  }

  private async refreshModelInfoPanel(): Promise<void> {
    if (!this.modelInfoPanel) return;
    let models: ModelInfoEntry[] = [];
    let error: string | null = null;
    try {
      // Try /model/info first, fall back to /v1/models
      const r = await this.client.fetchModelInfo();
      models = r.data ?? [];
      if (models.length === 0) {
        const simpleModels = await this.client.fetchModels();
        models = simpleModels.map((id) => ({ id, model_name: id }));
      }
    } catch (err) {
      error = String(err);
      try {
        const simpleModels = await this.client.fetchModels();
        models = simpleModels.map((id) => ({ id, model_name: id }));
        error = null;
      } catch {
        /* give up */
      }
    }

    if (this.modelInfoPanel) {
      this.modelInfoPanel.webview.html = buildModelInfoHtml({
        models,
        error,
        activeTheme: this.activeTheme,
      });
    }
  }

  private async exportModelInfoCsv(): Promise<void> {
    if (!this.modelInfoPanel) return;
    let models: ModelInfoEntry[] = [];
    try {
      const r = await this.client.fetchModelInfo();
      models = r.data ?? [];
    } catch {
      /* ignore */
    }

    const headers = [
      "Model",
      "Provider",
      "Mode",
      "Input Cost/Token",
      "Output Cost/Token",
      "Max Tokens",
      "Fn Calls",
      "Vision",
    ];
    const rows = models.map((m) => {
      const info = m.model_info || {};
      return [
        m.model_name || m.id || "",
        info.litellm_provider || "",
        info.mode || "",
        String(info.input_cost_per_token ?? ""),
        String(info.output_cost_per_token ?? ""),
        String(info.max_tokens ?? ""),
        String(!!info.supports_function_calling),
        String(!!info.supports_vision),
      ].map((c) => csvCell(c));
    });
    const csv = [headers.join(","), ...rows.join("\n")].join("\n");
    const doc = await vscode.workspace.openTextDocument({
      content: csv,
      language: "csv",
    });
    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage("Model info exported as CSV.");
  }

  // ── Spend by Tags Panel ────────────────────────────────────────────────

  private async openSpendTags(): Promise<void> {
    if (this.spendTagsPanel) {
      this.spendTagsPanel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    this.spendTagsPanel = vscode.window.createWebviewPanel(
      "corellmSpendTags",
      "CoreLLM Spend by Tags",
      vscode.ViewColumn.Beside,
      { enableScripts: true },
    );
    this.spendTagsPanel.onDidDispose(() => {
      this.spendTagsPanel = undefined;
    });
    this.spendTagsPanel.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case "refresh":
          this.refreshSpendTagsPanel();
          break;
        case "exportCsv":
          this.exportSpendTagsCsv();
          break;
        case "setTheme":
          this.activeTheme = msg.theme;
          this.refreshAllPanels();
          break;
        case "cancel":
        case "close":
          this.spendTagsPanel?.dispose();
          break;
      }
    });
    this.spendTagsPanel.webview.html = buildLoadingHtml(
      "Loading Spend by Tags\u2026",
      true,
    );
    await this.refreshSpendTagsPanel();
  }

  private async refreshSpendTagsPanel(): Promise<void> {
    if (!this.spendTagsPanel) return;
    const dr = getDateRange(
      this.config.reportDuration,
      this.config.reportCustomStart,
      this.config.reportCustomEnd,
    );
    let tags: SpendTagEntry[] = [];
    let error: string | null = null;
    try {
      const r = await this.client.fetchSpendTags(dr.start, dr.end);
      tags = r.tags ?? [];
    } catch (err) {
      error = String(err);
    }

    if (this.spendTagsPanel) {
      this.spendTagsPanel.webview.html = buildSpendTagsHtml({
        tags,
        error,
        activeTheme: this.activeTheme,
      });
    }
  }

  private async exportSpendTagsCsv(): Promise<void> {
    if (!this.spendTagsPanel) return;
    let tags: SpendTagEntry[] = [];
    try {
      const dr = getDateRange(
        this.config.reportDuration,
        this.config.reportCustomStart,
        this.config.reportCustomEnd,
      );
      const r = await this.client.fetchSpendTags(dr.start, dr.end);
      tags = r.tags ?? [];
    } catch {
      /* ignore */
    }

    if (tags.length === 0) {
      vscode.window.showWarningMessage("No tag data to export.");
      return;
    }

    const headers = ["Tag", "Spend", "Tokens", "Requests"];
    const rows = tags.map((t) =>
      [
        t.tag_name || "",
        String(t.total_spend ?? 0),
        String(t.total_tokens ?? 0),
        String(t.count ?? 0),
      ].map((c) => csvCell(c)),
    );
    const csv = [headers.join(","), ...rows.join("\n")].join("\n");
    const doc = await vscode.workspace.openTextDocument({
      content: csv,
      language: "csv",
    });
    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage("Tag spend exported as CSV.");
  }

  // ── Key Health Panel ────────────────────────────────────────────────────

  private async openKeyHealth(): Promise<void> {
    if (this.keyHealthPanel) {
      this.keyHealthPanel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    this.keyHealthPanel = vscode.window.createWebviewPanel(
      "corellmKeyHealth",
      "CoreLLM Key Health",
      vscode.ViewColumn.Beside,
      { enableScripts: true },
    );
    this.keyHealthPanel.onDidDispose(() => {
      this.keyHealthPanel = undefined;
    });
    this.keyHealthPanel.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case "refresh":
          this.refreshKeyHealthPanel();
          break;
        case "setTheme":
          this.activeTheme = msg.theme;
          this.refreshAllPanels();
          break;
        case "cancel":
        case "close":
          this.keyHealthPanel?.dispose();
          break;
      }
    });
    this.keyHealthPanel.webview.html = buildLoadingHtml(
      "Loading Key Health\u2026",
      true,
    );
    await this.refreshKeyHealthPanel();
  }

  private async refreshKeyHealthPanel(): Promise<void> {
    if (!this.keyHealthPanel) return;
    let healthResult: KeyHealthResponse;
    let error: string | null = null;
    try {
      healthResult = await this.client.fetchKeyHealth();
    } catch (err) {
      error = String(err);
      healthResult = {} as KeyHealthResponse;
    }

    const health: KeyHealthResponse[] = healthResult?.key
      ? [healthResult]
      : (healthResult as unknown as KeyHealthResponse[]);
    if (this.keyHealthPanel) {
      this.keyHealthPanel.webview.html = buildKeyHealthHtml({
        health: Array.isArray(healthResult) ? healthResult : health,
        error,
        activeTheme: this.activeTheme,
      });
    }
  }

  /** Refresh all open webview panels */
  private refreshAllPanels(): void {
    if (this.budgetOverviewPanel) this.refreshBudgetOverview();
    if (this.spendLogsPanel) this.refreshSpendLogsPanel();
    if (this.keyListPanel) this.refreshKeyListPanel();
    if (this.tutorialPanel) this.refreshTutorial();
    if (this.changelogPanel) this.refreshChangelog();
    if (this.globalSpendPanel) this.refreshGlobalSpend();
    if (this.teamsPanel) this.refreshTeamsPanel();
    if (this.activityPanel) this.refreshActivityPanel();
    if (this.modelInfoPanel) this.refreshModelInfoPanel();
    if (this.spendTagsPanel) this.refreshSpendTagsPanel();
    if (this.keyHealthPanel) this.refreshKeyHealthPanel();
    if (this.healthDashboardPanel) this.refreshHealthDashboardPanel();
    if (this.providerSpendPanel) this.refreshProviderSpendPanel();
    if (this.userManagerPanel) this.refreshUserManagerPanel();
    if (this.unifiedDashboardPanel) this.refreshUnifiedDashboard();
  }

  // ── Health Dashboard Panel ──────────────────────────────────────────────

  private async openHealthDashboard(): Promise<void> {
    if (this.healthDashboardPanel) {
      this.healthDashboardPanel.reveal(vscode.ViewColumn.Beside);
      return;
    }
    this.healthDashboardPanel = vscode.window.createWebviewPanel(
      "corellmHealthDashboard",
      "CoreLLM Health Dashboard",
      vscode.ViewColumn.Beside,
      { enableScripts: true },
    );
    this.healthDashboardPanel.onDidDispose(() => { this.healthDashboardPanel = undefined; });
    this.healthDashboardPanel.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case "refresh": this.refreshHealthDashboardPanel(); break;
        case "setTheme": this.activeTheme = msg.theme; this.refreshAllPanels(); break;
        case "cancel": case "close": this.healthDashboardPanel?.dispose(); break;
      }
    });
    this.healthDashboardPanel.webview.html = healthLoading("Loading Health Dashboard\u2026");
    await this.refreshHealthDashboardPanel();
  }

  private async refreshHealthDashboardPanel(): Promise<void> {
    if (!this.healthDashboardPanel) return;
    let health: HealthResponse | null = null;
    let keyHealth: KeyHealthResponse | null = null;
    let readiness: ReadinessResponse | null = null;
    let exceptions = null;
    let healthError: string | null = null;
    let keyHealthError: string | null = null;
    let readinessError: string | null = null;
    let exceptionsError: string | null = null;
    try { health = await this.client.fetchHealth(); } catch (e) { healthError = String(e); }
    try { keyHealth = await this.client.fetchKeyHealth(); } catch (e) { keyHealthError = String(e); }
    try { readiness = await this.client.fetchReadiness(); } catch (e) { readinessError = String(e); }
    try {
      const dr = getDateRange(this.config.reportDuration, this.config.reportCustomStart, this.config.reportCustomEnd);
      exceptions = await this.client.fetchGlobalActivityExceptions(dr.start, dr.end);
    } catch (e) { exceptionsError = String(e); }
    if (this.healthDashboardPanel) {
      this.healthDashboardPanel.webview.html = buildHealthDashboardHtml({
        health, keyHealth, readiness, exceptions,
        healthError, keyHealthError, readinessError, exceptionsError,
        activeTheme: this.activeTheme,
      });
    }
  }

  // ── Provider Spend Panel ────────────────────────────────────────────────

  private async openProviderSpend(): Promise<void> {
    if (this.providerSpendPanel) {
      this.providerSpendPanel.reveal(vscode.ViewColumn.Beside);
      return;
    }
    this.providerSpendPanel = vscode.window.createWebviewPanel(
      "corellmProviderSpend",
      "CoreLLM Provider Spend",
      vscode.ViewColumn.Beside,
      { enableScripts: true },
    );
    this.providerSpendPanel.onDidDispose(() => { this.providerSpendPanel = undefined; });
    this.providerSpendPanel.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case "refresh": this.refreshProviderSpendPanel(); break;
        case "exportCsv": this.exportProviderSpendCsv(); break;
        case "setTheme": this.activeTheme = msg.theme; this.refreshAllPanels(); break;
        case "cancel": case "close": this.providerSpendPanel?.dispose(); break;
      }
    });
    this.providerSpendPanel.webview.html = buildLoadingHtml("Loading Provider Spend\u2026", true);
    await this.refreshProviderSpendPanel();
  }

  private async refreshProviderSpendPanel(): Promise<void> {
    if (!this.providerSpendPanel) return;
    const dr = getDateRange(this.config.reportDuration, this.config.reportCustomStart, this.config.reportCustomEnd);
    let providers: GlobalSpendProvidersResponse | null = null;
    let error: string | null = null;
    try { providers = await this.client.fetchGlobalSpendProviders(dr.start, dr.end); } catch (e) { error = String(e); }
    if (this.providerSpendPanel) {
      this.providerSpendPanel.webview.html = buildProviderSpendHtml({
        providers, error, activeTheme: this.activeTheme,
        dateRange: `${dr.start} \u2013 ${dr.end}`,
      });
    }
  }

  private async exportProviderSpendCsv(): Promise<void> {
    const dr = getDateRange(this.config.reportDuration, this.config.reportCustomStart, this.config.reportCustomEnd);
    let providers: GlobalSpendProvidersResponse | null = null;
    try { providers = await this.client.fetchGlobalSpendProviders(dr.start, dr.end); } catch { /* ignore */ }
    const list = providers?.providers ?? [];
    const headers = ["Provider", "Spend", "Tokens", "Requests"];
    const rows = list.map((p) => [p.provider || "", String(p.total_spend ?? 0), String(p.total_tokens ?? 0), String(p.count ?? 0)].map((c) => csvCell(c)));
    const csv = [headers.join(","), ...rows.join("\n")].join("\n");
    const doc = await vscode.workspace.openTextDocument({ content: csv, language: "csv" });
    await vscode.window.showTextDocument(doc);
  }

  // ── User Manager Panel ──────────────────────────────────────────────────

  private async openUserManager(): Promise<void> {
    if (this.userManagerPanel) {
      this.userManagerPanel.reveal(vscode.ViewColumn.Beside);
      return;
    }
    this.userManagerPanel = vscode.window.createWebviewPanel(
      "corellmUserManager",
      "CoreLLM User Manager",
      vscode.ViewColumn.Beside,
      { enableScripts: true },
    );
    this.userManagerPanel.onDidDispose(() => { this.userManagerPanel = undefined; });
    this.userManagerPanel.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case "refresh": this.refreshUserManagerPanel(); break;
        case "exportCsv": this.exportUserManagerCsv(); break;
        case "setTheme": this.activeTheme = msg.theme; this.refreshAllPanels(); break;
        case "cancel": case "close": this.userManagerPanel?.dispose(); break;
      }
    });
    this.userManagerPanel.webview.html = buildLoadingHtml("Loading Users\u2026", true);
    await this.refreshUserManagerPanel();
  }

  private async refreshUserManagerPanel(): Promise<void> {
    if (!this.userManagerPanel) return;
    let users: UserInfoResponse[] = [];
    let error: string | null = null;
    try { const r = await this.client.fetchUserList(); users = r.users ?? []; } catch (e) { error = String(e); }
    if (this.userManagerPanel) {
      this.userManagerPanel.webview.html = buildUserManagerHtml({ users, error, activeTheme: this.activeTheme });
    }
  }

  private async exportUserManagerCsv(): Promise<void> {
    let users: UserInfoResponse[] = [];
    try { const r = await this.client.fetchUserList(); users = r.users ?? []; } catch { /* ignore */ }
    const headers = ["User", "Email", "Spend", "Max Budget", "Teams"];
    const rows = users.map((u) => [
      u.user_alias || u.user_id || "", u.user_email || "", String(u.spend ?? 0),
      String(u.max_budget ?? ""), (u.teams ?? []).join("; "),
    ].map((c) => csvCell(c)));
    const csv = [headers.join(","), ...rows.join("\n")].join("\n");
    const doc = await vscode.workspace.openTextDocument({ content: csv, language: "csv" });
    await vscode.window.showTextDocument(doc);
  }

  // ── Unified Dashboard Panel ─────────────────────────────────────────────

  private async openUnifiedDashboard(): Promise<void> {
    if (this.unifiedDashboardPanel) {
      this.unifiedDashboardPanel.reveal(vscode.ViewColumn.One);
      return;
    }
    this.unifiedDashboardPanel = vscode.window.createWebviewPanel(
      "corellmUnifiedDashboard",
      "CoreLLM Dashboard",
      vscode.ViewColumn.One,
      { enableScripts: true },
    );
    this.unifiedDashboardPanel.onDidDispose(() => { this.unifiedDashboardPanel = undefined; });
    this.unifiedDashboardPanel.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case "refresh": this.refreshUnifiedDashboard(); break;
        case "exportCsv": this.exportUnifiedDashboardCsv(); break;
        case "setTheme": this.activeTheme = msg.theme; this.refreshAllPanels(); break;
        case "switchTab": this.unifiedActiveTab = msg.tab; break;
        case "openSettings":
          vscode.commands.executeCommand("workbench.action.openSettings", "@ext:litellm-tools.corellm");
          break;
        case "cancel": case "close": this.unifiedDashboardPanel?.dispose(); break;
      }
    });
    this.unifiedDashboardPanel.webview.html = dashboardLoading("Loading Dashboard\u2026");
    await this.refreshUnifiedDashboard();
  }

  private unifiedActiveTab = "overview";

  private async refreshUnifiedDashboard(): Promise<void> {
    if (!this.unifiedDashboardPanel) return;
    const dr = getDateRange(this.config.reportDuration, this.config.reportCustomStart, this.config.reportCustomEnd);
    let keyInfo: KeyInfoResponse | null = null;
    let providerBudgets: ProviderBudgetResponse | null = null;
    let globalReport: GlobalSpendReportEntry[] = [];
    let spendLogs: SpendLogEntry[] = [];
    let health: HealthResponse | null = null;
    let readiness: ReadinessResponse | null = null;
    let providerSpend: GlobalSpendProvidersResponse | null = null;
    let keyError: string | null = null;
    let providerError: string | null = null;
    let reportError: string | null = null;
    let healthError: string | null = null;
    let readinessError: string | null = null;
    let providerSpendError: string | null = null;

    const results = await Promise.allSettled([
      this.client.fetchKeyInfo(),
      this.client.fetchProviderBudgets(),
      this.client.fetchGlobalSpendReport(dr.start, dr.end),
      this.client.fetchSpendLogs(10),
      this.client.fetchHealth(),
      this.client.fetchReadiness(),
      this.client.fetchGlobalSpendProviders(dr.start, dr.end),
    ]);
    if (results[0].status === "fulfilled") keyInfo = results[0].value; else keyError = (results[0].reason as Error)?.message ?? "Unknown error";
    // Fall back to /key/list if keyInfo has no spend and no keyToQuery is set
    if (keyInfo && !(keyInfo.spend ?? 0) && !this.config.keyToQuery) {
      try {
        const list = await this.client.fetchKeyList(1, 50);
        const firstWithSpend = (list.keys ?? []).find((k) => (k.spend ?? 0) > 0);
        if (firstWithSpend) {
          keyInfo = {
            ...keyInfo,
            spend: firstWithSpend.spend,
            max_budget: firstWithSpend.max_budget,
            key_alias: firstWithSpend.key_alias || keyInfo.key_alias,
            key_name: firstWithSpend.key_name || keyInfo.key_name,
          };
        }
      } catch {
        /* fallback failed, keep original keyInfo */
      }
    }
    if (results[1].status === "fulfilled") providerBudgets = results[1].value; else providerError = (results[1].reason as Error)?.message ?? "Unknown error";
    if (results[2].status === "fulfilled") globalReport = results[2].value; else reportError = (results[2].reason as Error)?.message ?? "Unknown error";
    if (results[3].status === "fulfilled") spendLogs = results[3].value;
    if (results[4].status === "fulfilled") health = results[4].value; else healthError = (results[4].reason as Error)?.message ?? "Unknown error";
    if (results[5].status === "fulfilled") readiness = results[5].value; else readinessError = (results[5].reason as Error)?.message ?? "Unknown error";
    if (results[6].status === "fulfilled") providerSpend = results[6].value; else providerSpendError = (results[6].reason as Error)?.message ?? "Unknown error";

    if (this.unifiedDashboardPanel) {
      this.unifiedDashboardPanel.webview.html = buildUnifiedDashboardHtml({
        keyInfo, providerBudgets, globalReport, spendLogs, health, readiness, providerSpend,
        keyError, providerError, reportError, healthError, readinessError, providerSpendError,
        activeTheme: this.activeTheme,
        dateRange: `${dr.start} \u2013 ${dr.end}`,
        activeTab: this.unifiedActiveTab,
      });
    }
  }

  private async exportUnifiedDashboardCsv(): Promise<void> {
    const dr = getDateRange(this.config.reportDuration, this.config.reportCustomStart, this.config.reportCustomEnd);
    let report: GlobalSpendReportEntry[] = [];
    try { report = await this.client.fetchGlobalSpendReport(dr.start, dr.end); } catch { /* ignore */ }
    const rows: string[][] = [["Date", "Spend"]];
    for (const day of report) {
      const ds = day.teams?.reduce((s, t) => s + (t.spend ?? 0), 0) ?? 0;
      rows.push([day["group-by-day"] || "", String(ds)]);
    }
    const csv = rows.map((r) => r.map((c) => csvCell(c)).join(",")).join("\n");
    const doc = await vscode.workspace.openTextDocument({ content: csv, language: "csv" });
    await vscode.window.showTextDocument(doc);
  }

  // ── Spend Alert Check ───────────────────────────────────────────────────

  private checkSpendAlerts(logs: SpendLogEntry[]): void {
    const threshold = this.config.spendAlertThreshold;
    if (threshold <= 0 || logs.length === 0) return;
    for (const log of logs) {
      const spend = log.spend ?? 0;
      if (spend >= threshold) {
        const model = log.model || "unknown";
        const ts = log.startTime
          ? new Date(log.startTime).toLocaleString()
          : "recently";
        vscode.window
          .showWarningMessage(
            `CoreLLM: High spend alert \u2014 $${spend.toFixed(4)} on ${model} (${ts})`,
            "View Spend Logs",
          )
          .then((sel) => {
            if (sel === "View Spend Logs") this.openSpendLogs();
          });
        break; // One alert per refresh cycle
      }
    }
  }

  // ── Export CSV ──────────────────────────────────────────────────────────

  private async exportBudgetCsv(): Promise<void> {
    if (!this.budgetOverviewPanel) return;
    const data = await this.fetchBudgetData();
    const rows: string[][] = [];
    const headers = ["Metric", "Value"];
    const alias =
      data.keyInfo?.key_alias ||
      data.keyInfo?.key_name ||
      data.keyInfo?.key ||
      "";
    rows.push(["Key Alias", alias]);
    rows.push(["Total Spend", String(data.keyInfo?.spend ?? 0)]);
    rows.push(["Max Budget", String(data.keyInfo?.max_budget ?? "unlimited")]);
    rows.push([
      "Remaining",
      data.keyInfo?.max_budget != null
        ? String(
            Math.max(0, data.keyInfo.max_budget - (data.keyInfo?.spend ?? 0)),
          )
        : "unlimited",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((r) => r.map((c) => csvCell(c)).join(",")),
    ].join("\n");
    const doc = await vscode.workspace.openTextDocument({
      content: csv,
      language: "csv",
    });
    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage("Budget overview exported as CSV.");
  }

  private async exportSpendLogsCsv(): Promise<void> {
    if (!this.spendLogsPanel) return;
    let logs: SpendLogEntry[] = [];
    try {
      logs = await this.client.fetchSpendLogs(50);
    } catch {
      /* ignore */
    }

    if (logs.length === 0) {
      vscode.window.showWarningMessage("No spend logs to export.");
      return;
    }

    const headers = [
      "Time",
      "Model",
      "Call Type",
      "Spend",
      "Tokens",
      "Cost/Token",
    ];
    const rows = logs.map((l) =>
      [
        l.startTime || "",
        l.model || "",
        l.call_type || "",
        String(l.spend ?? 0),
        String(l.total_tokens ?? 0),
        (l.total_tokens ?? 0) > 0
          ? String((l.spend ?? 0) / (l.total_tokens ?? 1))
          : "",
      ].map((c) => csvCell(c)),
    );
    const csv = [headers.join(","), ...rows.join("\n")].join("\n");
    const doc = await vscode.workspace.openTextDocument({
      content: csv,
      language: "csv",
    });
    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage("Spend logs exported as CSV.");
  }

  private async exportKeyListCsv(): Promise<void> {
    if (!this.keyListPanel) return;
    let keys: KeyListItem[] = [];
    try {
      const r = await this.client.fetchKeyList();
      keys = r.keys ?? [];
    } catch {
      /* ignore */
    }

    if (keys.length === 0) {
      vscode.window.showWarningMessage("No keys to export.");
      return;
    }

    const headers = [
      "Alias",
      "Key",
      "Spend",
      "Max Budget",
      "Used %",
      "User ID",
      "Team ID",
    ];
    const rows = keys.map((k) =>
      [
        k.key_alias || k.key_name || "",
        k.key || "",
        String(k.spend ?? 0),
        String(k.max_budget ?? ""),
        k.max_budget && k.max_budget > 0
          ? String(((k.spend ?? 0) / k.max_budget) * 100)
          : "",
        k.user_id || "",
        k.team_id || "",
      ].map((c) => csvCell(c)),
    );
    const csv = [headers.join(","), ...rows.join("\n")].join("\n");
    const doc = await vscode.workspace.openTextDocument({
      content: csv,
      language: "csv",
    });
    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage("Key list exported as CSV.");
  }

  // ── Status Bar ──────────────────────────────────────────────────────────

  private cycleDisplay(): void {
    if (!this.lastKeyInfo) {
      this.refresh();
      return;
    }

    this.displayCycleIndex = (this.displayCycleIndex + 1) % 4;
    const display = this.computeDisplay(
      this.lastKeyInfo,
      this.displayCycleIndex,
    );
    this.statusBarItem.text = display.text;
    this.statusBarItem.tooltip = display.tooltip;
    this.statusBarItem.color = display.color ?? undefined;
  }

  /** Called on activation to set the initial display mode from settings. */
  private setInitialDisplayMode(): void {
    const mode = this.config.statusBarDisplayMode;
    if (mode === "cycle") {
      this.displayCycleIndex = 0;
    } else {
      const modeMap: Record<string, number> = {
        remaining: 0,
        "usage-bar": 1,
        spend: 2,
        budget: 3,
      };
      this.displayCycleIndex = modeMap[mode] ?? 0;
    }
  }

  /** Build an ASCII bar like [██████░░░░] for a given percentage (0-100). */
  private asciiBar(pct: number, width = 10): string {
    const filled = Math.round((pct / 100) * width);
    const empty = width - filled;
    return "[" + "█".repeat(filled) + "░".repeat(empty) + "]";
  }

  private computeDisplay(
    data: KeyInfoResponse,
    mode?: number,
  ): StatusBarDisplay {
    const spend = data.spend ?? 0;
    const maxBudget = data.max_budget ?? null;
    const m = mode ?? this.displayCycleIndex;
    let remaining: number | null = null;
    let usedPct = 0;

    if (maxBudget !== null && maxBudget > 0) {
      remaining = Math.max(0, maxBudget - spend);
      usedPct = (spend / maxBudget) * 100;
    }

    const pctRemaining =
      maxBudget !== null && maxBudget > 0 ? 100 - usedPct : 100;
    const prefix = "CoreLLM";
    let text: string;
    let color: string | undefined;

    const hasBudget = maxBudget !== null && maxBudget > 0;

    switch (m) {
      case 0: // Remaining budget
        if (hasBudget) {
          text = `$(database) ${prefix}: $${remaining!.toFixed(2)} left`;
          if (pctRemaining <= this.config.budgetWarningThreshold) {
            color =
              new vscode.ThemeColor(
                "statusBarItem.warningForeground",
              )?.toString() || "#ffcc00";
          }
        } else {
          text = `$(graph) ${prefix}: $${spend.toFixed(2)} spent`;
        }

        break;
      case 1: // Usage percentage with ASCII bar
        if (hasBudget) {
          const bar = this.asciiBar(usedPct);
          text = `$(graph) ${prefix}: ${bar} ${usedPct.toFixed(1)}%`;
          if (pctRemaining <= this.config.budgetWarningThreshold) {
            color =
              new vscode.ThemeColor(
                "statusBarItem.warningForeground",
              )?.toString() || "#ffcc00";
          }
        } else {
          text = `$(graph) ${prefix}: $${spend.toFixed(2)} spent`;
        }

        break;
      case 2: // Total spend (consumed)
        text = `$(graph) ${prefix}: $${spend.toFixed(2)} spent`;
        break;
      case 3: // Budget total
        if (hasBudget) {
          text = `$(chip) ${prefix}: $${maxBudget!.toFixed(2)} budget`;
        } else {
          text = `$(chip) ${prefix}: unlimited`;
        }

        break;
      default:
        text = `$(graph) ${prefix}: $${spend.toFixed(2)} spent`;
    }

    return { text, tooltip: this.buildTooltip(data), color };
  }

  private buildTooltip(data: KeyInfoResponse): string {
    const lines: string[] = ["**CoreLLM** \u2014 LiteLLM Balance Monitor", ""];
    const alias = data.key_alias || data.key_name || data.key || "N/A";
    lines.push(`**\u{1F511} Key:** \`${alias}\``);
    const spend = data.spend ?? 0;
    const maxBudget = data.max_budget ?? null;

    if (maxBudget !== null && maxBudget > 0) {
      const remaining = Math.max(0, maxBudget - spend);
      const pct = (spend / maxBudget) * 100;
      const bar = this.asciiBar(pct);
      lines.push(`**\uD83D\uDCB0 Spend:** $${spend.toFixed(4)}`);
      lines.push(`**\uD83C\uDFAF Max Budget:** $${maxBudget.toFixed(2)}`);
      lines.push(`**\uD83D\uDCE6 Remaining:** $${remaining.toFixed(4)}`);
      lines.push(`**\uD83D\uDCCA Usage:** ${pct.toFixed(1)}% ${bar}`);
      if (data.budget_duration)
        lines.push(`**\uD83D\uDD52 Budget Duration:** ${data.budget_duration}`);
    } else {
      lines.push(`**\uD83D\uDCB0 Spend:** $${spend.toFixed(4)}`);
      lines.push("**\uD83D\uDCB8 Max Budget:** Not set (unlimited)");
    }

    if (data.user_id)
      lines.push(`**\uD83D\uDC64 User ID:** \`${data.user_id}\``);
    if (data.team_id)
      lines.push(`**\uD83D\uDC65 Team ID:** \`${data.team_id}\``);
    if (data.models && data.models.length > 0) {
      const ml = data.models.slice(0, 5).join(", ");
      lines.push(
        `**\u{1F4CB} Models:** ${ml}${data.models.length > 5 ? ` +${data.models.length - 5} more` : ""}`,
      );
    }

    lines.push("");
    lines.push("---");
    lines.push("$(refresh) Click to cycle display");
    lines.push("$(organization) Budget Overview");
    lines.push(
      `$(calendar) Range: ${DURATION_LABELS[this.config.reportDuration]}`,
    );
    return lines.join("\n");
  }

  async refresh(): Promise<void> {
    try {
      let data = await this.client.fetchKeyInfo();
      // If keyInfo returned zero spend and no specific key is targeted,
      // fall back to /key/list to find the first key with actual spend
      if (!(data.spend ?? 0) && !this.config.keyToQuery) {
        try {
          const list = await this.client.fetchKeyList(1, 50);
          const firstWithSpend = (list.keys ?? []).find(
            (k) => (k.spend ?? 0) > 0,
          );
          if (firstWithSpend) {
            data = {
              ...data,
              spend: firstWithSpend.spend,
              max_budget: firstWithSpend.max_budget,
              key_alias: firstWithSpend.key_alias || data.key_alias,
              key_name: firstWithSpend.key_name || data.key_name,
            };
          }
        } catch {
          /* fallback failed, keep original data */
        }
      }

      this.lastKeyInfo = data;
      this.setInitialDisplayMode();
      const display = this.computeDisplay(data, this.displayCycleIndex);
      this.statusBarItem.text = display.text;
      this.statusBarItem.tooltip = display.tooltip;
      this.statusBarItem.color = display.color ?? undefined;

      // Append additional info based on settings
      if (this.config.showSpendLogs) await this.fetchAndAppendSpendLogs();
      if (this.config.showGlobalSpend) await this.appendGlobalSpendInfo();
      if (this.config.showTeamSpend) await this.appendTeamSpendInfo();

      // Check spend alerts
      if (this.config.spendAlertThreshold > 0) {
        try {
          const logs = await this.client.fetchSpendLogs(5);
          this.checkSpendAlerts(logs);
        } catch {
          /* silent */
        }
      }

      // Auto-refresh activity panels if open and enabled
      if (this.config.enableActivityMonitoring) {
        if (this.activityPanel) this.refreshActivityPanel();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // If management endpoints are blocked, try to at least show models
      if (msg.includes("lacks management permissions")) {
        const models = await this.client.fetchModels();
        this.statusBarItem.text = "$(key) CoreLLM: LLM key (limited)";
        const modelList =
          models.length > 0
            ? `\n\n**Accessible models:** ${models.slice(0, 6).join(", ")}${models.length > 6 ? ` +${models.length - 6}` : ""}`
            : "";
        this.statusBarItem.tooltip =
          `**CoreLLM**\n\n` +
          `⚠️ This key cannot access management endpoints.\n` +
          `To see balance/budget, set an admin key in the settings.\n` +
          `Or use "keyToQuery" with this key + adminKey as proxy master.` +
          modelList;
        this.statusBarItem.color = new vscode.ThemeColor(
          "statusBarItem.warningForeground",
        );
      } else {
        this.statusBarItem.text = "$(error) CoreLLM: Error";
        this.statusBarItem.tooltip = `CoreLLM \u2014 Error: ${msg}`;
        this.statusBarItem.color = new vscode.ThemeColor(
          "statusBarItem.errorForeground",
        );
      }

      if (!this.timer) vscode.window.showWarningMessage(`CoreLLM: ${msg}`);
    }
  }

  private async fetchAndAppendSpendLogs(): Promise<void> {
    try {
      const logs = await this.client.fetchSpendLogs(3);
      if (logs.length > 0) {
        const recentTotal = logs.reduce((s, l) => s + (l.spend || 0), 0);
        this.statusBarItem.text += ` | recent: $${recentTotal.toFixed(4)}`;
      }
    } catch {
      /* silent */
    }
  }

  private async appendGlobalSpendInfo(): Promise<void> {
    try {
      const dr = getDateRange(
        this.config.reportDuration,
        this.config.reportCustomStart,
        this.config.reportCustomEnd,
      );
      const [keysData] = await Promise.allSettled([
        this.client.fetchGlobalSpendKeys(dr.start, dr.end),
      ]);
      if (keysData.status === "fulfilled" && keysData.value.keys) {
        const total = keysData.value.keys.reduce(
          (s, k) => s + (k.total_spend ?? 0),
          0,
        );
        this.statusBarItem.text += ` | global: $${total.toFixed(2)}`;
      }
    } catch {
      /* silent */
    }
  }

  private async appendTeamSpendInfo(): Promise<void> {
    try {
      const dr = getDateRange(
        this.config.reportDuration,
        this.config.reportCustomStart,
        this.config.reportCustomEnd,
      );
      const [teamsData] = await Promise.allSettled([
        this.client.fetchGlobalSpendTeams(dr.start, dr.end),
      ]);
      if (teamsData.status === "fulfilled" && teamsData.value.teams) {
        const total = teamsData.value.teams.reduce(
          (s, t) => s + (t.total_spend ?? 0),
          0,
        );
        this.statusBarItem.text += ` | teams: $${total.toFixed(2)}`;
      }
    } catch {
      /* silent */
    }
  }

  private startAutoRefresh(): void {
    if (this.config.refreshInterval <= 0) return;
    this.timer = setInterval(
      () => this.refresh(),
      Math.max(5000, this.config.refreshInterval * 1000),
    );
  }

  private stopAutoRefresh(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  start(): void {
    this.setInitialDisplayMode();
    this.refresh();
    if (this.config.refreshInterval > 0) this.startAutoRefresh();
  }

  dispose(): void {
    this.stopAutoRefresh();
    this.disposables.forEach((d) => d.dispose());
  }
}

// ─── Activation ──────────────────────────────────────────────────────────────

let manager: BalanceStatusBarManager | undefined;
let updateTimer: NodeJS.Timeout | undefined;

// ─── Update Checker ─────────────────────────────────────────────────────────

const EXTENSION_ID = "litellm-tools.corellm";
const GITHUB_REPO = "core-innovation/litellm-balance-checker";
const CURRENT_VERSION = "0.8.4";
const LAST_NOTIFIED_KEY = "corellm.lastNotifiedVersion";
const LAST_SEEN_VERSION_KEY = "corellm.lastSeenVersion";

/** Create a fetch signal that aborts after ms milliseconds.
 *  Avoids AbortSignal.timeout() which may not be available in VS Code's bundled Node. */
function createTimeoutSignal(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

/** Check if a GitHub API response indicates rate limiting. */
function isRateLimited(status: number, body: string): boolean {
  if (status !== 403 && status !== 429) return false;
  return /rate limit|too many requests/i.test(body);
}

/** Try to fetch the latest tag from tags API (fallback when no releases exist). */
async function fetchLatestTagFromTags(): Promise<{
  tag: string;
  releaseUrl: string;
} | null> {
  const { signal, clear } = createTimeoutSignal(8000);
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/tags`, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "corellm-vscode",
    },
    signal,
  });
  clear();
  if (!res.ok) return null;
  const tags = (await res.json()) as Array<{ name: string }>;
  if (!tags || tags.length === 0) return null;
  // Find the newest tag matching v* or just the first one
  const versionTags = tags
    .filter((t) => /^v?\d/.test(t.name))
    .sort((a, b) => {
      const va = a.name.replace(/^v/, "");
      const vb = b.name.replace(/^v/, "");
      return compareVersions(vb, va); // newest first
    });
  const best = versionTags[0] || tags[0];
  const tag = best.name.replace(/^v/, "");
  const releaseUrl = `https://github.com/${GITHUB_REPO}/releases/tag/v${tag}`;
  return { tag, releaseUrl };
}

async function checkForUpdates(
  context: vscode.ExtensionContext,
  showUpToDate = false,
): Promise<void> {
  try {
    // Try releases/latest first
    const { signal, clear } = createTimeoutSignal(8000);
    const releaseRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "corellm-vscode",
        },
        signal,
      },
    );
    clear();

    // Handle GitHub API errors gracefully
    if (!releaseRes.ok) {
      const bodyText = await releaseRes.text().catch(() => "");
      const rateLimited = isRateLimited(releaseRes.status, bodyText);

      if (rateLimited) {
        console.warn(`CoreLLM update check: GitHub API rate limited (${releaseRes.status})`);
        if (showUpToDate) {
          vscode.window.showWarningMessage(
            "Could not check for updates: GitHub API rate limit reached. Try again later.",
          );
        }
        return;
      }

      // Non-rate-limit error (404, etc.) — fall through to tags fallback
      console.log(
        `CoreLLM update check: releases/latest returned ${releaseRes.status}, falling back to tags`,
      );
    }

    let latestTag: string | null = null;
    let vsixDownloadUrl: string | null = null;
    let releaseUrl: string | null = null;

    if (releaseRes.ok) {
      const data = (await releaseRes.json()) as {
        tag_name?: string;
        html_url?: string;
        name?: string;
        assets?: Array<{ name: string; browser_download_url: string }>;
      };
      const tag = (data.tag_name || data.name || "").replace(/^v/, "");
      if (tag) {
        latestTag = tag;
        releaseUrl = data.html_url || null;
        const vsixAsset = data.assets?.find((a) => a.name.endsWith(".vsix"));
        vsixDownloadUrl = vsixAsset?.browser_download_url || null;
      }
    }

    // Always check tags too — git tags may be newer than the latest GitHub Release
    const tagInfo = await fetchLatestTagFromTags();
    if (tagInfo) {
      // If no release was found, or the latest tag is newer than the release, use the tag
      if (!latestTag || compareVersions(tagInfo.tag, latestTag) > 0) {
        latestTag = tagInfo.tag;
        releaseUrl = tagInfo.releaseUrl;
        // No direct VSIX download URL from tags — user will be directed to releases page
        vsixDownloadUrl = null;
      }
    }

    if (!latestTag) {
      console.log("CoreLLM update check: no releases or tags found");
      if (showUpToDate) {
        vscode.window.showInformationMessage(
          "Could not find any releases or version tags for CoreLLM.",
        );
      }
      return;
    }

    console.log(
      `CoreLLM update check: latest=${latestTag}, current=${CURRENT_VERSION}, result=${compareVersions(latestTag, CURRENT_VERSION) > 0 ? "update available" : "up to date"}`,
    );

    if (compareVersions(latestTag, CURRENT_VERSION) > 0) {
      // Only notify once per version
      const lastNotified = context.globalState.get<string>(LAST_NOTIFIED_KEY);
      if (lastNotified === latestTag) return;
      await context.globalState.update(LAST_NOTIFIED_KEY, latestTag);

      const releaseDisplayUrl = releaseUrl || `https://github.com/${GITHUB_REPO}/releases`;

      // User-facing version string with "v" prefix
      const latestDisplay = `v${latestTag}`;
      const currentDisplay = `v${CURRENT_VERSION}`;

      if (vsixDownloadUrl) {
        // Full flow: download VSIX directly and install
        const actions = ["Update & Reload", "Open Releases Page", "Dismiss"] as const;
        const action = await vscode.window.showInformationMessage(
          `CoreLLM ${latestDisplay} available! (current: ${currentDisplay})`,
          ...actions,
        );

        if (action === "Update & Reload") {
          let downloadFailed = false;
          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: `Downloading CoreLLM ${latestDisplay}...`,
            },
            async () => {
              try {
                const dl = await fetch(vsixDownloadUrl!);
                if (!dl.ok) throw new Error(`Download failed (HTTP ${dl.status})`);
                const buf = Buffer.from(await dl.arrayBuffer());
                const tmpPath = `${os.tmpdir()}/corellm-${latestTag}.vsix`;
                fs.writeFileSync(tmpPath, buf);
                await vscode.commands.executeCommand(
                  "workbench.extensions.installExtension",
                  vscode.Uri.file(tmpPath),
                );
              } catch (err) {
                downloadFailed = true;
                throw err;
              }
            },
          );

          if (downloadFailed) {
            vscode.window.showErrorMessage(
              `Failed to download CoreLLM ${latestDisplay}. Check your connection or download manually from the releases page.`,
              "Open Releases Page",
            ).then((sel) => {
              if (sel) vscode.env.openExternal(vscode.Uri.parse(releaseDisplayUrl));
            });
          } else {
            const reload = await vscode.window.showInformationMessage(
              `CoreLLM ${latestDisplay} installed! Reload now to apply.`,
              "Reload Now",
            );
            if (reload) {
              vscode.commands.executeCommand("workbench.action.reloadWindow");
            }
          }
        } else if (action === "Open Releases Page") {
          vscode.env.openExternal(vscode.Uri.parse(releaseDisplayUrl));
        }
      } else {
        // No direct VSIX download — open releases page
        const actions = ["Open Releases Page", "Dismiss"] as const;
        const action = await vscode.window.showInformationMessage(
          `CoreLLM ${latestDisplay} available! (current: ${currentDisplay})`,
          ...actions,
        );
        if (action === "Open Releases Page") {
          vscode.env.openExternal(vscode.Uri.parse(releaseDisplayUrl));
        }
      }
    } else if (showUpToDate) {
      vscode.window.showInformationMessage(
        `CoreLLM is up to date (v${CURRENT_VERSION}).`,
      );
    }
  } catch (err) {
    console.error("CoreLLM update check failed:", err);
    if (showUpToDate) {
      const msg = err instanceof Error ? err.message : String(err);
      // Try to detect network vs other errors
      if (/fetch|network|connect|dns|econnrefused|enotfound|timeout/i.test(msg)) {
        vscode.window.showWarningMessage(
          "Could not check for updates — you may be offline.",
        );
      } else {
        vscode.window.showWarningMessage(
          `Update check failed: ${msg}`,
        );
      }
    }
  }
}

/** Simple semver compare. Returns >0 if a>b, <0 if a<b, 0 if equal.
 *  Handles non-numeric segments gracefully (e.g. "1.0.0-beta" → NaN segments treated as 0). */
function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((s) => parseInt(s, 10) || 0);
  const pb = b.split(".").map((s) => parseInt(s, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na - nb;
  }

  return 0;
}

// ─── Activation ──────────────────────────────────────────────────────────────

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  try {
    console.log("CoreLLM activating...");

  // Register update command
  context.subscriptions.push(
    vscode.commands.registerCommand("corellm.checkForUpdates", () =>
      checkForUpdates(context, true),
    ),
  );

  // Migrate credentials from settings.json to SecretStorage (OS keychain)
  const migrated = await migrateFromSettings(context.secrets);
  if (migrated) {
    console.log("CoreLLM: Migrated credentials to OS keychain");
  }

  // Resolve config merging settings + SecretStorage
  const initialConfig = await resolveConfig(context.secrets);

  manager = new BalanceStatusBarManager(context.secrets, initialConfig);
  context.subscriptions.push(manager);
  manager.start();

  const config = getConfig();
  if (!config.apiKey && !config.adminKey && !config.username) {
    vscode.window
      .showInformationMessage(
        "CoreLLM: Configure your API key in settings to get started.",
        "Open Settings",
      )
      .then((sel) => {
        if (sel === "Open Settings") {
          vscode.commands.executeCommand(
            "workbench.action.openSettings",
            "@ext:litellm-tools.corellm",
          );
        }
      });
  }

  // Auto-show changelog on version upgrade
  const lastSeen = context.globalState.get<string>(LAST_SEEN_VERSION_KEY);
  if (lastSeen !== CURRENT_VERSION) {
    setTimeout(() => {
      if (lastSeen) {
        // Upgrade detected — show what's new
        manager?.openChangelog();
      }

      // Update the last seen version
      context.globalState.update(LAST_SEEN_VERSION_KEY, CURRENT_VERSION);
    }, 1500);
  } else {
    // Ensure version is stored for fresh installs
    context.globalState.update(LAST_SEEN_VERSION_KEY, CURRENT_VERSION);
  }

  // Check for updates on startup (silent)
  setTimeout(() => checkForUpdates(context), 5000);

  // Periodic update checks
  const updateIntervalHours = getConfig().updateCheckInterval;
  const updateIntervalMs = Math.max(3600000, updateIntervalHours * 3600000);
  updateTimer = setInterval(() => checkForUpdates(context), updateIntervalMs);

  console.log("CoreLLM activated");
  } catch (err) {
    console.error("CoreLLM activation failed:", err);
    vscode.window.showErrorMessage(
      `CoreLLM failed to activate: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function deactivate(): void {
  if (updateTimer) {
    clearInterval(updateTimer);
    updateTimer = undefined;
  }

  if (manager) {
    manager.dispose();
    manager = undefined;
  }

  console.log("CoreLLM deactivated");
}
