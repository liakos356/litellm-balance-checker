import * as vscode from "vscode";
import {
  COMMON_CSS,
  buildThemeOverrides,
  buildLoadingHtml,
  escapeHtml,
  usd,
  getRelativeTime,
  materialIcon,
} from "../helpers";
import {
  HealthResponse,
  KeyHealthResponse,
  ReadinessResponse,
  GlobalActivityExceptionsResponse,
} from "../types";

interface HealthDashboardData {
  health: HealthResponse | null;
  keyHealth: KeyHealthResponse | null;
  readiness: ReadinessResponse | null;
  exceptions: GlobalActivityExceptionsResponse | null;
  healthError: string | null;
  keyHealthError: string | null;
  readinessError: string | null;
  exceptionsError: string | null;
  activeTheme?: string;
}

export function buildHealthDashboardHtml(data: HealthDashboardData): string {
  const {
    health,
    keyHealth,
    readiness,
    exceptions,
    healthError,
    keyHealthError,
    readinessError,
    exceptionsError,
    activeTheme,
  } = data;

  const theme = activeTheme || "vscode";
  const themeOverride = buildThemeOverrides(theme);

  const healthyCount = health?.healthy_count ?? 0;
  const unhealthyCount = health?.unhealthy_count ?? 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${COMMON_CSS}${themeOverride}</style>
</head>
<body>
<h2>${materialIcon("health", 22)} CoreLLM Health Dashboard
  <span class="title-actions">
    <span class="theme-btn" id="themeBtn" title="Toggle theme">${materialIcon("palette", 18)}</span>
    <button class="toolbar-btn" id="exportCsvBtn" title="Export as CSV">${materialIcon("download", 16)}</button>
    <button class="toolbar-btn" id="exportPdfBtn" title="Save as PDF">${materialIcon("picture_as_pdf", 16)}</button>
    <button class="toolbar-btn primary" id="refreshBtn" title="Refresh">${materialIcon("refresh", 16)} Refresh</button>
  </span>
</h2>

<!-- Summary -->
<div class="summary-bar">
  <div class="summary-item">
    <div class="summary-value ok">${healthyCount}</div>
    <div class="summary-label">Healthy Endpoints</div>
  </div>
  <div class="summary-item">
    <div class="summary-value ${unhealthyCount > 0 ? "err" : "ok"}">${unhealthyCount}</div>
    <div class="summary-label">Unhealthy Endpoints</div>
  </div>
  <div class="summary-item">
    <div class="summary-value ${readiness?.status === "ok" ? "ok" : "warn"}">${readiness?.status ?? "\u2014"}</div>
    <div class="summary-label">Proxy Status</div>
  </div>
  <div class="summary-item">
    <div class="summary-value">${readiness?.litellm_version ?? "\u2014"}</div>
    <div class="summary-label">LiteLLM Version</div>
  </div>
</div>

<!-- Model Health -->
<div class="card">
  <h3>${materialIcon("health", 18)} Model Health
    <span class="badge ${unhealthyCount > 0 ? "badge-error" : "badge-success"}">${healthyCount}/${healthyCount + unhealthyCount}</span>
  </h3>
  ${healthError ? `<div class="error-box">${materialIcon("warning", 16)} ${escapeHtml(healthError)}</div>` : ""}
  ${
    health
      ? `
  <div class="health-grid">
    ${(health.healthy_endpoints ?? [])
      .map(
        (ep) => `
    <div class="health-card healthy">
      <div class="health-icon">${materialIcon("check_circle", 24)}</div>
      <div class="endpoint-name">${escapeHtml(ep.model || "unknown")}</div>
      <div style="font-size:.78em;opacity:.6;margin-top:4px">${escapeHtml(ep.api_base || "")}</div>
    </div>`,
      )
      .join("")}
    ${(health.unhealthy_endpoints ?? [])
      .map(
        (ep) => `
    <div class="health-card unhealthy">
      <div class="health-icon">${materialIcon("cancel", 24)}</div>
      <div class="endpoint-name">${escapeHtml(ep.model || "unknown")}</div>
      <div style="font-size:.78em;opacity:.6;margin-top:4px">${escapeHtml(ep.api_base || "")}</div>
    </div>`,
      )
      .join("")}
  </div>`
      : '<div class="empty-state"><span class="empty-icon">${materialIcon("health", 32)}</span><div class="empty-text">No model health data.</div></div>'
  }
</div>

<!-- Readiness -->
<div class="card">
  <h3>${materialIcon("storage", 18)} Proxy Readiness</h3>
  ${readinessError ? `<div class="error-box">${materialIcon("warning", 16)} ${escapeHtml(readinessError)}</div>` : ""}
  ${
    readiness
      ? `
  <div class="grid">
    <div class="stat"><div class="stat-value ${readiness.status === "ok" ? "ok" : "err"}">${readiness.status ?? "\u2014"}</div><div class="stat-label">Status</div></div>
    <div class="stat"><div class="stat-value">${readiness.db ?? "\u2014"}</div><div class="stat-label">Database</div></div>
    <div class="stat"><div class="stat-value">${readiness.cache ?? "\u2014"}</div><div class="stat-label">Cache</div></div>
    <div class="stat"><div class="stat-value">${readiness.litellm_version ?? "\u2014"}</div><div class="stat-label">Version</div></div>
  </div>
  ${
    readiness.success_callbacks && readiness.success_callbacks.length > 0
      ? `<p style="font-size:.82em;opacity:.65;margin-top:8px">Callbacks: ${readiness.success_callbacks.join(", ")}</p>`
      : ""
  }
  ${
    readiness.last_updated
      ? `<p style="font-size:.78em;opacity:.5;margin-top:4px">Last updated: ${new Date(readiness.last_updated).toLocaleString()}</p>`
      : ""
  }`
      : '<div class="empty-state"><span class="empty-icon">${materialIcon("storage", 32)}</span><div class="empty-text">No readiness data.</div></div>'
  }
</div>

<!-- Key Health -->
<div class="card">
  <h3>${materialIcon("build", 18)} Key Health</h3>
  ${keyHealthError ? `<div class="error-box">${materialIcon("warning", 16)} ${escapeHtml(keyHealthError)}</div>` : ""}
  ${
    keyHealth
      ? `<div class="grid">
    <div class="stat"><div class="stat-value ${keyHealth.health === "healthy" ? "ok" : "err"}">${keyHealth.health ?? "\u2014"}</div><div class="stat-label">Status</div></div>
    <div class="stat"><div class="stat-value">${usd(keyHealth.spend, 4)}</div><div class="stat-label">Spend</div></div>
    <div class="stat"><div class="stat-value">${usd(keyHealth.max_budget)}</div><div class="stat-label">Max Budget</div></div>
    <div class="stat"><div class="stat-value">${keyHealth.key_alias || keyHealth.key_name || "\u2014"}</div><div class="stat-label">Key Alias</div></div>
  </div>
  ${keyHealth.last_accessed ? `<p style="font-size:.82em;opacity:.65;margin-top:8px">Last accessed: ${new Date(keyHealth.last_accessed).toLocaleString()}</p>` : ""}`
      : '<div class="empty-state"><span class="empty-icon">${materialIcon("build", 32)}</span><div class="empty-text">No key health data.</div></div>'
  }
</div>

<!-- Activity Exceptions -->
<div class="card">
  <h3>${materialIcon("warning", 18)} Activity Exceptions</h3>
  ${exceptionsError ? `<div class="error-box">${materialIcon("warning", 16)} ${escapeHtml(exceptionsError)}</div>` : ""}
  ${
    exceptions?.exceptions && exceptions.exceptions.length > 0
      ? `
  <div class="table-wrap"><table><thead><tr><th>Model</th><th>Exception Type</th><th>Count</th><th>Spend</th></tr></thead>
  <tbody>${exceptions.exceptions
    .map(
      (e) => `<tr>
    <td><strong>${escapeHtml(e.model || "unknown")}</strong></td>
    <td><span class="badge badge-error">${escapeHtml(e.exception_type || "unknown")}</span></td>
    <td>${(e.count ?? 0).toLocaleString()}</td>
    <td>${usd(e.total_spend, 6)}</td>
  </tr>`,
    )
    .join("")}</tbody></table></div>`
      : '<div class="empty-state"><span class="empty-icon">${materialIcon("check_circle", 32)}</span><div class="empty-text">No exceptions detected.</div></div>'
  }
</div>

<div class="footer">
  <span>CoreLLM \u00B7 Health Dashboard</span>
  <span>${healthyCount} healthy / ${unhealthyCount} unhealthy</span>
  <span>Proxy: ${readiness?.status ?? "?"}</span>
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
  document.getElementById('exportPdfBtn').addEventListener('click', function() {
    window.print();
  });
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

export function getLoadingHtml(message = "Loading Health Dashboard\u2026"): string {
  return buildLoadingHtml(message, true);
}
