import { COMMON_CSS, buildThemeOverrides, escapeHtml, usd, materialIcon } from "../helpers";
import { GlobalSpendProvidersResponse } from "../types";
import { svgHBarChart, svgDonut } from "../helpers";

interface ProviderSpendData {
  providers: GlobalSpendProvidersResponse | null;
  error: string | null;
  activeTheme?: string;
  dateRange?: string;
}

export function buildProviderSpendHtml(data: ProviderSpendData): string {
  const { providers, error, activeTheme, dateRange } = data;
  const theme = activeTheme || "vscode";
  const themeOverride = buildThemeOverrides(theme);

  const providerList = providers?.providers ?? [];
  const totalSpend = providerList.reduce(
    (s, p) => s + (p.total_spend ?? 0),
    0,
  );
  const totalTokens = providerList.reduce(
    (s, p) => s + (p.total_tokens ?? 0),
    0,
  );
  const maxSpend = Math.max(
    ...providerList.map((p) => p.total_spend ?? 0),
    1,
  );

  const barChart =
    providerList.length > 0
      ? svgHBarChart(
          providerList.slice(0, 15).map((p) => ({
            label: p.provider || "unknown",
            value: p.total_spend ?? 0,
          })),
          maxSpend,
          340,
          18,
          3,
        )
      : "";

  const donutChart =
    providerList.length > 0
      ? svgDonut(
          providerList.slice(0, 8).map((p) => ({
            label: p.provider || "unknown",
            value: p.total_spend ?? 0,
          })),
          160,
          32,
        )
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${COMMON_CSS}${themeOverride}
  .provider-card{border-left: 4px solid var(--vscode-focusBorder);margin-bottom:8px}
</style>
</head>
<body>
<h2>${materialIcon("cloud", 22)} CoreLLM Provider Spend
  <span class="title-actions">
    <span class="theme-btn" id="themeBtn" title="Toggle theme">${materialIcon("palette", 18)}</span>
    <button class="toolbar-btn" id="exportCsvBtn" title="Export as CSV">${materialIcon("download", 16)} CSV</button>
    <button class="toolbar-btn" id="exportPdfBtn" title="Save as PDF">${materialIcon("picture_as_pdf", 16)} PDF</button>
    <button class="toolbar-btn primary" id="refreshBtn" title="Refresh">${materialIcon("refresh", 16)} Refresh</button>
  </span>
</h2>
${dateRange ? `<p style="font-size:.82em;opacity:.6;margin:0 0 12px">${escapeHtml(dateRange)}</p>` : ""}

${error ? `<div class="error-box">${materialIcon("warning", 16)} ${escapeHtml(error)}</div>` : ""}

<div class="summary-bar">
  <div class="summary-item"><div class="summary-value">${usd(totalSpend, 4)}</div><div class="summary-label">Total Spend</div></div>
  <div class="summary-item"><div class="summary-value">${totalTokens.toLocaleString()}</div><div class="summary-label">Total Tokens</div></div>
  <div class="summary-item"><div class="summary-value">${providerList.length}</div><div class="summary-label">Providers</div></div>
  <div class="summary-item"><div class="summary-value">${totalSpend > 0 ? usd(totalSpend / (providerList.length || 1), 4) : "\u2014"}</div><div class="summary-label">Avg / Provider</div></div>
</div>

${
  providerList.length > 0
    ? `
<div class="card">
  <h3>${materialIcon("bar_chart", 18)} Spend by Provider</h3>
  <div class="chart-row" style="align-items:center">
    ${donutChart}
    <div style="flex:1;min-width:300px">${barChart}</div>
  </div>
</div>

<div class="card">
  <h3>${materialIcon("preview", 18)} Provider Details</h3>
  <div class="table-wrap"><table><thead><tr><th>Provider</th><th>Spend</th><th>Tokens</th><th>Requests</th><th>Cost/Token</th></tr></thead>
  <tbody>${providerList
    .map((p) => {
      const costPerToken =
        (p.total_tokens ?? 0) > 0
          ? (p.total_spend ?? 0) / (p.total_tokens ?? 1)
          : 0;
      const pct = totalSpend > 0 ? ((p.total_spend ?? 0) / totalSpend) * 100 : 0;
      return `<tr>
    <td><strong>${escapeHtml(p.provider || "unknown")}</strong> <span class="rel-time">(${pct.toFixed(1)}%)</span></td>
    <td>${usd(p.total_spend, 4)}</td>
    <td>${(p.total_tokens ?? 0).toLocaleString()}</td>
    <td>${(p.count ?? 0).toLocaleString()}</td>
    <td>${costPerToken > 0 ? usd(costPerToken, 8) : "\u2014"}</td>
  </tr>`;
    })
    .join("")}</tbody></table></div>
</div>`
    : '<div class="empty-state"><span class="empty-icon">${materialIcon("cloud", 32)}</span><div class="empty-text">No provider spend data available for this period.</div></div>'
}

<div class="footer">
  <span>CoreLLM \u00B7 Provider Spend</span>
  <span>${providerList.length} provider(s)</span>
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
  document.getElementById('exportPdfBtn').addEventListener('click', function() {
    window.print();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') vscode.postMessage({ type: 'close' });
  });
})();
</script>
</body>
</html>`;
}
