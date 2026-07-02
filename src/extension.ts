import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';

// ─── Types ───────────────────────────────────────────────────────────────────

interface KeyInfoResponse {
  key?: string;
  key_alias?: string;
  key_name?: string;
  spend?: number;
  max_budget?: number | null;
  budget_duration?: string | null;
  budget_reset_at?: string | null;
  models?: string[];
  user_id?: string;
  team_id?: string;
  token?: string;
  [key: string]: unknown;
}

interface SpendLogEntry {
  request_id?: string;
  api_key?: string;
  model?: string;
  spend?: number;
  total_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  startTime?: string;
  endTime?: string;
  call_type?: string;
  [key: string]: unknown;
}

interface SpendLogsResponse {
  logs?: SpendLogEntry[];
  total?: number;
  page?: number;
  page_size?: number;
  [key: string]: unknown;
}

interface ProviderBudgetEntry {
  budget_limit?: number | null;
  time_period?: string | null;
  spend?: number;
  budget_reset_at?: string | null;
  [key: string]: unknown;
}

interface ProviderBudgetResponse {
  providers?: Record<string, ProviderBudgetEntry>;
  [key: string]: unknown;
}

interface GlobalSpendReportEntry {
  'group-by-day'?: string;
  teams?: Array<{
    team_name?: string;
    spend?: number;
    keys?: Array<{
      key?: string;
      usage?: Record<string, { cost?: number; input_tokens?: number; output_tokens?: number; requests?: number }>;
    }>;
  }>;
  [key: string]: unknown;
}

interface KeyListItem {
  key?: string;
  key_alias?: string;
  key_name?: string;
  spend?: number;
  max_budget?: number | null;
  user_id?: string;
  team_id?: string;
  models?: string[];
  [key: string]: unknown;
}

interface KeyListResponse {
  keys?: KeyListItem[];
  total_count?: number;
  [key: string]: unknown;
}

interface StatusBarDisplay {
  text: string;
  tooltip: string;
  color?: string;
}

// ─── Configuration ───────────────────────────────────────────────────────────

type ReportDuration = '1h' | '24h' | '7d' | '30d' | 'custom';

const DURATION_LABELS: Record<ReportDuration, string> = {
  '1h': 'Last hour',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  'custom': 'Custom range',
};

const DURATION_MS: Record<ReportDuration, number | null> = {
  '1h': 3600000,
  '24h': 86400000,
  '7d': 604800000,
  '30d': 2592000000,
  'custom': null,
};

interface ExtensionConfig {
  apiKey: string;
  adminKey: string;
  username: string;
  password: string;
  endpoint: string;
  refreshInterval: number;
  showKeyAlias: boolean;
  showSpendLogs: boolean;
  budgetWarningThreshold: number;
  keyToQuery: string;
  reportDuration: ReportDuration;
  reportCustomStart: string;
  reportCustomEnd: string;
}

function getConfig(): ExtensionConfig {
  const cfg = vscode.workspace.getConfiguration('corellm');
  return {
    apiKey: cfg.get<string>('apiKey', ''),
    adminKey: cfg.get<string>('adminKey', ''),
    username: cfg.get<string>('username', ''),
    password: cfg.get<string>('password', ''),
    endpoint: cfg.get<string>('endpoint', 'http://core.llm').replace(/\/+$/, ''),
    refreshInterval: cfg.get<number>('refreshInterval', 60),
    showKeyAlias: cfg.get<boolean>('showKeyAlias', true),
    showSpendLogs: cfg.get<boolean>('showSpendLogs', false),
    budgetWarningThreshold: cfg.get<number>('budgetWarningThreshold', 20),
    keyToQuery: cfg.get<string>('keyToQuery', ''),
    reportDuration: cfg.get<ReportDuration>('reportDuration', '7d'),
    reportCustomStart: cfg.get<string>('reportCustomStart', ''),
    reportCustomEnd: cfg.get<string>('reportCustomEnd', ''),
  };
}

function getDateRange(duration: ReportDuration, customStart: string, customEnd: string): { start: string; end: string } {
  const end = new Date();
  if (duration === 'custom') {
    return {
      start: customStart || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
      end: customEnd || end.toISOString().slice(0, 10),
    };
  }
  const ms = DURATION_MS[duration];
  if (ms) {
    return {
      start: new Date(Date.now() - ms).toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  }
  return {
    start: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

// ─── API Client ──────────────────────────────────────────────────────────────

class CoreLLMApiClient {
  private config: ExtensionConfig;
  private cachedJwtKey: string | undefined;
  private loginPromise: Promise<string | null> | undefined;

  constructor(config: ExtensionConfig) {
    this.config = config;
  }

  /**
   * Login with username/password and extract the embedded API key from JWT.
   * Falls back to apiKey/adminKey if login fails or not configured.
   */
  private async loginAndGetKey(): Promise<string | null> {
    if (this.cachedJwtKey) return this.cachedJwtKey;
    if (!this.config.username || !this.config.password) return null;

    if (!this.loginPromise) {
      this.loginPromise = (async () => {
        try {
          const url = `${this.config.endpoint}/login`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `username=${encodeURIComponent(this.config.username)}&password=${encodeURIComponent(this.config.password)}`,
            redirect: 'manual',
          });
          const setCookie = res.headers.get('set-cookie') || '';
          const jwtMatch = setCookie.match(/token=([^;]+)/);
          if (!jwtMatch) throw new Error('No token cookie returned');
          const jwt = jwtMatch[1];

          // Decode JWT payload to extract embedded sk- key
          const payloadB64 = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
          const jsonStr = atob(payloadB64);
          const payload = JSON.parse(jsonStr);
          const embeddedKey: string = payload.key || '';
          if (embeddedKey.startsWith('sk-')) {
            this.cachedJwtKey = embeddedKey;
            return embeddedKey;
          }
          throw new Error('No valid sk- key in JWT');
        } catch (err) {
          this.loginPromise = undefined; // allow retry next time
          throw err;
        }
      })();
    }
    return this.loginPromise;
  }

  private async resolveAuthKey(): Promise<string | null> {
    // Priority: 1) login-derived key  2) adminKey  3) apiKey
    if (this.config.username) {
      try {
        const key = await this.loginAndGetKey();
        if (key) return key;
      } catch { /* fall through */ }
    }
    return this.config.adminKey || this.config.apiKey || null;
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const authKey = await this.resolveAuthKey();
    if (authKey) {
      headers['Authorization'] = `Bearer ${authKey}`;
      headers['x-litellm-api-key'] = authKey;
    }
    return headers;
  }

  private async apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.config.endpoint}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v) url.searchParams.set(k, v);
      }
    }
    const res = await fetch(url.toString(), { method: 'GET', headers: await this.getHeaders() });
    if (!res.ok) {
      const text = await res.text();
      const snippet = text.slice(0, 300);
      // Detect 403 "key not allowed" — common for llm_api type keys
      if (res.status === 403 && snippet.includes('not allowed to call this route')) {
        throw new Error(
          `Your API key lacks management permissions (403 on ${path}). ` +
          `Use an admin/proxy master key in the "adminKey" setting.`
        );
      }
      throw new Error(`API ${res.status} on ${path}: ${snippet}`);
    }
    return res.json() as Promise<T>;
  }

  /** GET /key/info */
  async fetchKeyInfo(): Promise<KeyInfoResponse> {
    return this.apiGet<KeyInfoResponse>('/key/info',
      this.config.keyToQuery ? { key: this.config.keyToQuery } : undefined);
  }

  /** GET /spend/logs */
  async fetchSpendLogs(limit = 5): Promise<SpendLogEntry[]> {
    const params: Record<string, string> = { page_size: String(limit) };
    if (this.config.keyToQuery) params.api_key = this.config.keyToQuery;
    const data = await this.apiGet<SpendLogEntry[] | SpendLogsResponse>('/spend/logs', params);
    if (Array.isArray(data)) return data;
    if (data && Array.isArray((data as SpendLogsResponse).logs)) return (data as SpendLogsResponse).logs!;
    return [];
  }

  /** GET /provider/budgets — per-provider spend & budget limits */
  async fetchProviderBudgets(): Promise<ProviderBudgetResponse> {
    return this.apiGet<ProviderBudgetResponse>('/provider/budgets');
  }

  /** GET /global/spend/report — daily spend grouped by team */
  async fetchGlobalSpendReport(startDate: string, endDate: string): Promise<GlobalSpendReportEntry[]> {
    return this.apiGet<GlobalSpendReportEntry[]>('/global/spend/report', {
      start_date: startDate,
      end_date: endDate,
    });
  }

  /** GET /key/list — paginated list of keys with spend/budget */
  async fetchKeyList(page = 1, size = 50): Promise<KeyListResponse> {
    return this.apiGet<KeyListResponse>('/key/list', {
      page: String(page), size: String(size), return_full_object: 'true',
    });
  }

  /** GET /v1/models — list accessible models */
  async fetchModels(): Promise<string[]> {
    try {
      const data = await this.apiGet<{ data?: Array<{ id?: string }> }>('/v1/models');
      return data?.data?.map((m) => m.id ?? '').filter(Boolean) ?? [];
    } catch {
      return [];
    }
  }

  /** GET /user/daily/activity — daily spend/usage breakdown */
  async fetchUserDailyActivity(userId?: string): Promise<unknown> {
    return this.apiGet('/user/daily/activity', userId ? { user_id: userId } : undefined);
  }
}

// ─── Webview Helpers ─────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function usd(v: number | null | undefined, decimals = 2): string {
  if (v == null) return '\u2014';
  return `$${v.toFixed(decimals)}`;
}

// ─── Budget Overview Panel HTML ──────────────────────────────────────────────

// ─── Chart helpers ───────────────────────────────────────────────────────────

/** Build an SVG horizontal bar chart. Returns empty string if data is empty. */
function svgHBarChart(
  items: { label: string; value: number; color?: string }[],
  maxValue: number,
  width = 300,
  barHeight = 18,
  gap = 4,
): string {
  if (items.length === 0) return '';
  const m = maxValue > 0 ? maxValue : 1;
  const totalH = items.length * (barHeight + gap);
  const labelW = 80;
  const valW = 60;
  const barW = width - labelW - valW - 10;
  const colors = ['#4ec9b0', '#e2b714', '#f14c4c', '#569cd6', '#ce9178', '#6a9955', '#c586c0', '#dcdcaa'];

  const bars = items.map((it, i) => {
    const y = i * (barHeight + gap);
    const bw = (it.value / m) * barW;
    const c = it.color || colors[i % colors.length];
    return `<text x="0" y="${y + barHeight - 4}" font-size="11" fill="var(--vscode-foreground)">${escapeHtml(it.label.length > 10 ? it.label.slice(0, 10) + '..' : it.label)}</text>
      <rect x="${labelW}" y="${y}" width="${Math.max(2, bw)}" height="${barHeight}" rx="3" fill="${c}" opacity="0.85"/>
      <text x="${labelW + Math.max(2, bw) + 4}" y="${y + barHeight - 4}" font-size="10" fill="var(--vscode-foreground)">${usd(it.value, 4)}</text>`;
  }).join('\n    ');

  return `<svg width="${width}" height="${totalH}" viewBox="0 0 ${width} ${totalH}" style="display:block;margin:8px 0">${bars}</svg>`;
}

/** Build a simple SVG donut chart. Returns empty string if data is empty. */
function svgDonut(
  items: { label: string; value: number }[],
  size = 140,
  thickness = 28,
): string {
  if (items.length === 0) return '';
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total === 0) return '';
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2;
  const colors = ['#4ec9b0', '#569cd6', '#ce9178', '#e2b714', '#c586c0', '#6a9955', '#f14c4c', '#dcdcaa'];
  let angle = -90;
  const slices = items.slice(0, 8).map((it, i) => {
    const pct = it.value / total;
    const a = pct * 360;
    const start = angle;
    const end = angle + a;
    angle = end;
    const sr = ((start - 90) * Math.PI) / 180;
    const er = ((end - 90) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(sr);
    const y1 = cy + r * Math.sin(sr);
    const x2 = cx + r * Math.cos(er);
    const y2 = cy + r * Math.sin(er);
    const large = a > 180 ? 1 : 0;
    const color = colors[i % colors.length];
    return `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z" fill="${color}" opacity="0.85"/>
      <text x="${cx + (r * 0.55) * Math.cos(sr + (er - sr) / 2)}" y="${cy + (r * 0.55) * Math.sin(sr + (er - sr) / 2)}" font-size="9" fill="#fff" text-anchor="middle" dominant-baseline="central">${(pct * 100).toFixed(0)}%</text>`;
  }).join('\n    ');
  // center hole (donut)
  const holeR = r - thickness;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block;margin:8px auto">${slices}
    <circle cx="${cx}" cy="${cy}" r="${holeR}" fill="var(--vscode-editor-background)"/>
    <text x="${cx}" y="${cy - 4}" font-size="18" font-weight="700" fill="var(--vscode-foreground)" text-anchor="middle" dominant-baseline="central">${usd(total)}</text>
    <text x="${cx}" y="${cy + 14}" font-size="9" fill="var(--vscode-foreground)" opacity=".6" text-anchor="middle">total</text>
  </svg>`;
}

// ─── Budget Overview Panel HTML ──────────────────────────────────────────────

function buildBudgetOverviewHtml(data: {
  keyInfo: KeyInfoResponse | null;
  providerBudgets: ProviderBudgetResponse | null;
  globalReport: GlobalSpendReportEntry[];
  spendLogs: SpendLogEntry[];
  keyError: string | null;
  providerError: string | null;
  reportError: string | null;
  durationLabel?: string;
  dateRange?: string;
}): string {
  const { keyInfo, providerBudgets, globalReport, spendLogs, keyError, providerError, reportError, durationLabel, dateRange } = data;

  // Aggregate from report
  let totalSpend = 0;
  let totalRequests = 0;
  const dailyData: { label: string; spend: number }[] = [];
  for (const day of globalReport) {
    const ds = day.teams?.reduce((s, t) => s + (t.spend ?? 0), 0) ?? 0;
    totalSpend += ds;
    const label = day['group-by-day'] ? day['group-by-day'].slice(5) : '?';
    dailyData.push({ label, spend: ds });
    for (const team of day.teams ?? []) {
      for (const k of team.keys ?? []) {
        for (const usage of Object.values(k.usage ?? {})) {
          totalRequests += usage.requests ?? 0;
        }
      }
    }
  }
  // Fall back to keyInfo.spend if the global report has no data
  const effectiveTotalSpend = totalSpend > 0 ? totalSpend : (keyInfo?.spend ?? 0);
  const maxDailySpend = Math.max(...dailyData.map(d => d.spend), 1);

  // Provider data for charts
  const providers = providerBudgets?.providers;
  const providerCount = providers ? Object.keys(providers).length : 0;
  const providerChartData = providers
    ? Object.entries(providers)
        .map(([name, p]) => ({ label: name, value: p.spend ?? 0 }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8)
    : [];

  // Model usage from spend logs
  const modelMap = new Map<string, number>();
  for (const log of spendLogs) {
    const m = log.model || 'unknown';
    modelMap.set(m, (modelMap.get(m) ?? 0) + (log.spend ?? 0));
  }
  const modelChartData = [...modelMap.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const alias = keyInfo?.key_alias || keyInfo?.key_name || keyInfo?.key || '\u2014';
  const spend = keyInfo?.spend ?? 0;
  const maxB = keyInfo?.max_budget;
  const remaining = maxB != null ? Math.max(0, maxB - spend) : null;
  const usedPct = maxB != null && maxB > 0 ? ((spend / maxB) * 100) : 0;
  const barColor = usedPct > 80 ? 'red' : usedPct > 50 ? 'yellow' : 'green';

  const dailyChart = dailyData.length > 0 ? svgHBarChart(
    dailyData.map(d => ({ label: d.label, value: d.spend })),
    maxDailySpend, 320, 20, 4,
  ) : '';

  const providerChart = providerChartData.length > 0 ? svgHBarChart(providerChartData, providerChartData[0]?.value || 1, 320) : '';
  const modelDonut = modelChartData.length > 0 ? svgDonut(modelChartData, 140, 28) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:16px;color:var(--vscode-foreground);background:var(--vscode-editor-background)}
  h2{margin-top:0;font-weight:600}
  h3{margin:20px 0 8px;font-weight:500;border-bottom:1px solid var(--vscode-panel-border);padding-bottom:4px}
  .card{background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-widget-border);border-radius:8px;padding:12px 16px;margin-bottom:12px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
  .stat{text-align:center}
  .stat-value{font-size:1.6em;font-weight:700}
  .stat-label{font-size:.8em;opacity:.75;margin-top:2px}
  .warn{color:var(--vscode-editorWarning-foreground,#e2b714)}
  .err{color:var(--vscode-errorForeground,#f14c4c)}
  .ok{color:var(--vscode-editorGutter-addedForeground,#4ec9b0)}
  table{width:100%;border-collapse:collapse;font-size:.85em}
  th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--vscode-panel-border)}
  th{font-weight:600;opacity:.8}
  .badge{display:inline-block;background:var(--vscode-badge-background);color:var(--vscode-badge-foreground);border-radius:4px;padding:1px 6px;font-size:.8em}
  .error-box{background:var(--vscode-inputValidation-errorBackground,#5a1d1d);border:1px solid var(--vscode-inputValidation-errorBorder,#be1100);border-radius:4px;padding:8px 12px;margin-bottom:8px;font-size:.85em}
  .footer{margin-top:16px;text-align:center;font-size:.75em;opacity:.5}
  .bar-container{height:8px;background:var(--vscode-progressBar-background,#333);border-radius:4px;overflow:hidden;margin:8px 0}
  .bar-fill{height:100%;border-radius:4px;transition:width .5s}
  .bar-fill.green{background:var(--vscode-editorGutter-addedForeground,#4ec9b0)}
  .bar-fill.yellow{background:var(--vscode-editorWarning-foreground,#e2b714)}
  .bar-fill.red{background:var(--vscode-errorForeground,#f14c4c)}
  .chart-row{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;justify-content:center}
  .legend{font-size:.75em;margin-top:4px}
  .legend-item{display:inline-block;margin-right:12px;white-space:nowrap}
  .legend-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;vertical-align:middle}
</style>
</head>
<body>
<h2>\u{1F4CA} CoreLLM Budget Overview</h2>

<!-- Key Info Card -->
<div class="card">
  <h3>\u{1F511} Key: ${escapeHtml(alias)}</h3>
  <div class="grid">
    <div class="stat"><div class="stat-value ${maxB != null && remaining != null && remaining / maxB <= 0.2 ? 'warn' : ''}">${usd(spend, 4)}</div><div class="stat-label">Total Spend</div></div>
    <div class="stat"><div class="stat-value">${usd(maxB)}</div><div class="stat-label">Max Budget</div></div>
    <div class="stat"><div class="stat-value ${remaining != null && remaining <= 0 ? 'err' : remaining != null && maxB != null && remaining / maxB <= 0.2 ? 'warn' : 'ok'}">${remaining != null ? usd(remaining, 4) : '\u221E'}</div><div class="stat-label">Remaining</div></div>
    <div class="stat"><div class="stat-value">${maxB != null && maxB > 0 ? usedPct.toFixed(1) + '%' : '\u2014'}</div><div class="stat-label">Used</div></div>
  </div>
  ${maxB != null && maxB > 0 ? `<div class="bar-container"><div class="bar-fill ${barColor}" style="width:${Math.min(100, usedPct)}%"></div></div>` : ''}
  ${keyError ? `<div class="error-box">\u26A0 ${escapeHtml(keyError)}</div>` : ''}
</div>

<!-- Provider Budgets Card -->
<div class="card">
  <h3>\u2601\uFE0F Provider Budgets ${providerCount > 0 ? `<span class="badge">${providerCount}</span>` : ''}</h3>
  ${providerError ? `<div class="error-box">\u26A0 ${escapeHtml(providerError)}</div>` : ''}
  ${providers && providerCount > 0 ? `
  <div class="chart-row">${providerChart}</div>
  <table>
    <thead><tr><th>Provider</th><th>Spend</th><th>Budget Limit</th><th>Used</th><th>Period</th><th>Resets</th></tr></thead>
    <tbody>
    ${Object.entries(providers).map(([name, p]) => {
      const ps = p.spend ?? 0;
      const pl = p.budget_limit;
      const pp = pl && pl > 0 ? ((ps / pl) * 100) : 0;
      const pc = pp > 80 ? 'red' : pp > 50 ? 'yellow' : 'green';
      return `<tr>
        <td><strong>${escapeHtml(name)}</strong></td>
        <td>${usd(ps, 4)}</td>
        <td>${usd(pl)}</td>
        <td>${pl && pl > 0 ? pp.toFixed(1) + '%' : '\u2014'}${pl && pl > 0 ? `<div class="bar-container"><div class="bar-fill ${pc}" style="width:${Math.min(100, pp)}%"></div></div>` : ''}</td>
        <td>${p.time_period ?? '\u2014'}</td>
        <td>${p.budget_reset_at ? new Date(p.budget_reset_at).toLocaleDateString() : '\u2014'}</td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>` : '<p style="opacity:.6">No provider budgets configured.</p>'}
</div>

<!-- Global Spend Report Card -->
<div class="card">
  <h3>\uD83C\uDF10 Daily Spend ${durationLabel ? '\\(' + durationLabel + '\\)' : ''} <span class="badge">${globalReport.length} days</span></h3>
  ${dateRange ? `<p style="font-size:.8em;opacity:.6;margin:4px 0 0">${escapeHtml(dateRange)}</p>` : ''}
  ${reportError ? `<div class="error-box">\u26A0 ${escapeHtml(reportError)}</div>` : ''}
  ${globalReport.length > 0 ? `
  <div class="grid" style="margin-bottom:12px">
    <div class="stat"><div class="stat-value">${usd(effectiveTotalSpend)}</div><div class="stat-label">Total 7d Spend</div></div>
    <div class="stat"><div class="stat-value">${totalRequests.toLocaleString()}</div><div class="stat-label">Requests</div></div>
  </div>
  <div class="chart-row">${dailyChart}</div>` : '<p style="opacity:.6">No global spend data.</p>'}
</div>

<!-- Model Usage Card (from spend logs) -->
${modelChartData.length > 0 ? `
<div class="card">
  <h3>\u{1F4CA} Model Spend Breakdown</h3>
  <div class="chart-row" style="align-items:center">
    ${modelDonut}
    <div class="legend">
      ${modelChartData.map((m, i) => {
        const colors = ['#4ec9b0', '#569cd6', '#ce9178', '#e2b714', '#c586c0', '#6a9955', '#f14c4c', '#dcdcaa'];
        return `<div class="legend-item"><span class="legend-dot" style="background:${colors[i % colors.length]}"></span>${escapeHtml(m.label.length > 15 ? m.label.slice(0, 15) + '..' : m.label)} ${usd(m.value)}</div>`;
      }).join('')}
    </div>
  </div>
</div>` : ''}

<!-- Recent Spend Logs Card -->
<div class="card">
  <h3>\uD83D\uDCDD Recent Spend Logs <span class="badge">${spendLogs.length}</span></h3>
  ${spendLogs.length > 0 ? `
  <table><thead><tr><th>Time</th><th>Model</th><th>Type</th><th>Spend</th><th>Tokens</th></tr></thead>
  <tbody>${spendLogs.map(l => `<tr>
    <td>${l.startTime ? new Date(l.startTime).toLocaleString() : '\u2014'}</td>
    <td>${escapeHtml(l.model ?? '\u2014')}</td>
    <td><span class="badge">${escapeHtml(l.call_type ?? '\u2014')}</span></td>
    <td>${usd(l.spend, 6)}</td>
    <td>${(l.total_tokens ?? 0).toLocaleString()}</td>
  </tr>`).join('')}</tbody></table>` : '<p style="opacity:.6">No recent spend logs.</p>'}
</div>

<div class="footer">CoreLLM \u00B7 Total spend: ${usd(effectiveTotalSpend)} \u00B7 ${providerCount} provider(s) \u00B7 ${globalReport.length} day(s) \u00B7 ${new Date().toLocaleString()}</div>
</body>
</html>`;
}

// ─── Spend Logs Panel HTML ───────────────────────────────────────────────────

function buildSpendLogsHtml(logs: SpendLogEntry[], error: string | null): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:16px;color:var(--vscode-foreground);background:var(--vscode-editor-background)}
  h2{margin-top:0}
  table{width:100%;border-collapse:collapse;font-size:.85em}
  th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--vscode-panel-border)}
  th{font-weight:600;opacity:.8;position:sticky;top:0;background:var(--vscode-editor-background)}
  .badge{display:inline-block;background:var(--vscode-badge-background);color:var(--vscode-badge-foreground);border-radius:4px;padding:1px 6px;font-size:.8em}
  .error-box{background:var(--vscode-inputValidation-errorBackground);border:1px solid var(--vscode-inputValidation-errorBorder);border-radius:4px;padding:8px 12px;margin-bottom:8px;font-size:.85em}
  .summary{display:flex;gap:16px;margin-bottom:12px;flex-wrap:wrap}
  .summary-item{background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-widget-border);border-radius:6px;padding:8px 16px;text-align:center;flex:1;min-width:100px}
  .summary-value{font-size:1.3em;font-weight:700}
  .summary-label{font-size:.75em;opacity:.7}
  .footer{margin-top:16px;text-align:center;font-size:.75em;opacity:.5}
</style>
</head>
<body>
<h2>\uD83D\uDCDD CoreLLM Spend Logs</h2>
${error ? `<div class="error-box">\u26A0 ${escapeHtml(error)}</div>` : ''}
${logs.length > 0 ? `
<div class="summary">
  <div class="summary-item"><div class="summary-value">${logs.length}</div><div class="summary-label">Entries</div></div>
  <div class="summary-item"><div class="summary-value">${usd(logs.reduce((s, l) => s + (l.spend ?? 0), 0), 4)}</div><div class="summary-label">Total Spend</div></div>
  <div class="summary-item"><div class="summary-value">${logs.reduce((s, l) => s + (l.total_tokens ?? 0), 0).toLocaleString()}</div><div class="summary-label">Total Tokens</div></div>
</div>
<table><thead><tr><th>Time</th><th>Model</th><th>Type</th><th>Spend</th><th>Tokens</th></tr></thead>
<tbody>${logs.map(l => `<tr>
  <td>${l.startTime ? new Date(l.startTime).toLocaleString() : '\u2014'}</td>
  <td>${escapeHtml(l.model ?? '\u2014')}</td>
  <td><span class="badge">${escapeHtml(l.call_type ?? '\u2014')}</span></td>
  <td>${usd(l.spend, 6)}</td>
  <td>${(l.total_tokens ?? 0).toLocaleString()}</td>
</tr>`).join('')}</tbody></table>` : '<p>No spend logs found.</p>'}
<div class="footer">Total: ${usd(logs.reduce((s, l) => s + (l.spend ?? 0), 0), 4)} \u00B7 ${logs.length} entries \u00B7 ${logs.reduce((s, l) => s + (l.total_tokens ?? 0), 0).toLocaleString()} tokens \u00B7 ${new Date().toLocaleString()}</div>
</body>
</html>`;
}

// ─── Key List Panel HTML ─────────────────────────────────────────────────────

function buildKeyListHtml(keys: KeyListItem[], error: string | null): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:16px;color:var(--vscode-foreground);background:var(--vscode-editor-background)}
  h2{margin-top:0}
  table{width:100%;border-collapse:collapse;font-size:.85em}
  th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--vscode-panel-border)}
  th{font-weight:600;opacity:.8;position:sticky;top:0;background:var(--vscode-editor-background)}
  .badge{display:inline-block;background:var(--vscode-badge-background);color:var(--vscode-badge-foreground);border-radius:4px;padding:1px 6px;font-size:.8em}
  .error-box{background:var(--vscode-inputValidation-errorBackground);border:1px solid var(--vscode-inputValidation-errorBorder);border-radius:4px;padding:8px 12px;margin-bottom:8px;font-size:.85em}
  .bar-container{height:6px;background:var(--vscode-progressBar-background,#333);border-radius:3px;overflow:hidden;margin:4px 0}
  .bar-fill{height:100%;border-radius:3px}
  .bar-fill.green{background:var(--vscode-editorGutter-addedForeground,#4ec9b0)}
  .bar-fill.yellow{background:var(--vscode-editorWarning-foreground,#e2b714)}
  .bar-fill.red{background:var(--vscode-errorForeground,#f14c4c)}
  .footer{margin-top:16px;text-align:center;font-size:.75em;opacity:.5}
</style>
</head>
<body>
<h2>\u{1F511} CoreLLM Keys</h2>
${error ? `<div class="error-box">\u26A0 ${escapeHtml(error)}</div>` : ''}
${keys.length > 0 ? `<p>${keys.length} key(s) found.</p>
<table><thead><tr><th>Alias</th><th>Spend</th><th>Max Budget</th><th>Used</th><th>User</th><th>Team</th></tr></thead>
<tbody>${keys.map(k => {
  const s = k.spend ?? 0;
  const m = k.max_budget;
  const pp = m && m > 0 ? ((s / m) * 100) : 0;
  const pc = pp > 80 ? 'red' : pp > 50 ? 'yellow' : 'green';
  return `<tr>
    <td><strong>${escapeHtml(k.key_alias || k.key_name || '(unnamed)')}</strong></td>
    <td>${usd(s, 4)}</td>
    <td>${usd(m)}</td>
    <td>${m && m > 0 ? pp.toFixed(1) + '%' : '\u2014'}${m && m > 0 ? `<div class="bar-container"><div class="bar-fill ${pc}" style="width:${Math.min(100, pp)}%"></div></div>` : ''}</td>
    <td>${k.user_id ? `<span class="badge">${escapeHtml(k.user_id)}</span>` : '\u2014'}</td>
    <td>${k.team_id ? `<span class="badge">${escapeHtml(k.team_id)}</span>` : '\u2014'}</td>
  </tr>`;
}).join('')}</tbody></table>` : '<p>No keys found.</p>'}
<div class="footer">${keys.length} key(s) · Total spend: ${usd(keys.reduce((s, k) => s + (k.spend ?? 0), 0), 4)} · Total budget: ${usd(keys.reduce((s, k) => s + (k.max_budget ?? 0), 0))} · ${new Date().toLocaleString()}</div>
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

  // ── Display Cycling ──────────────────────────────────────────────────
  private displayCycleIndex = 0;
  private lastKeyInfo: KeyInfoResponse | null = null;

  constructor() {
    this.config = getConfig();
    this.client = new CoreLLMApiClient(this.config);

    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.name = 'CoreLLM';
    this.statusBarItem.command = 'corellm.cycleDisplay';
    this.statusBarItem.tooltip = 'CoreLLM \u2014 Click to cycle display info';
    this.statusBarItem.text = '$(coin) CoreLLM: ...';
    this.statusBarItem.show();
    this.disposables.push(this.statusBarItem);

    this.registerCommands();
    this.watchConfigChanges();
  }

  private registerCommands(): void {
    this.disposables.push(
      vscode.commands.registerCommand('corellm.refresh', () => {
        vscode.window.withProgress(
          { location: vscode.ProgressLocation.Window, title: 'Checking CoreLLM balance\u2026' },
          async () => { await this.refresh(); }
        );
      }),
      vscode.commands.registerCommand('corellm.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', '@ext:litellm-tools.corellm');
      }),
      vscode.commands.registerCommand('corellm.toggleAutoRefresh', () => {
        if (this.timer) { this.stopAutoRefresh(); vscode.window.showInformationMessage('CoreLLM auto-refresh disabled'); }
        else { this.startAutoRefresh(); vscode.window.showInformationMessage(`CoreLLM auto-refresh enabled (every ${this.config.refreshInterval}s)`); }
      }),
      vscode.commands.registerCommand('corellm.showBudgetOverview', () => this.openBudgetOverview()),
      vscode.commands.registerCommand('corellm.showSpendLogs', () => this.openSpendLogs()),
      vscode.commands.registerCommand('corellm.listKeys', () => this.openKeyList()),
      vscode.commands.registerCommand('corellm.setReportDuration', () => this.pickReportDuration()),
      vscode.commands.registerCommand('corellm.enableAutoRefresh', () => {
        this.startAutoRefresh();
        vscode.window.showInformationMessage(`CoreLLM auto-refresh enabled (every ${this.config.refreshInterval}s)`);
      }),
      vscode.commands.registerCommand('corellm.disableAutoRefresh', () => {
        this.stopAutoRefresh();
        vscode.window.showInformationMessage('CoreLLM auto-refresh disabled');
      }),
      vscode.commands.registerCommand('corellm.cycleDisplay', () => this.cycleDisplay()),
      vscode.commands.registerCommand('corellm.showAbout', () => {
        vscode.window.showInformationMessage(
          `CoreLLM v${CURRENT_VERSION} — Monitor LiteLLM API key balances and usage.`,
          'Open Settings'
        ).then((sel) => {
          if (sel === 'Open Settings') {
            vscode.commands.executeCommand('workbench.action.openSettings', '@ext:litellm-tools.corellm');
          }
        });
      })
    );
  }

  private watchConfigChanges(): void {
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('corellm')) {
          this.config = getConfig();
          this.client = new CoreLLMApiClient(this.config);
          this.stopAutoRefresh();
          if (this.config.refreshInterval > 0) this.startAutoRefresh();
          this.refresh();
        }
      })
    );
  }

  // ── Budget Overview ──────────────────────────────────────────────────────

  private async fetchBudgetData(duration: ReportDuration): Promise<{
    keyInfo: KeyInfoResponse | null; providerBudgets: ProviderBudgetResponse | null;
    globalReport: GlobalSpendReportEntry[]; spendLogs: SpendLogEntry[];
    keyError: string | null; providerError: string | null; reportError: string | null;
  }> {
    const dr = getDateRange(duration, this.config.reportCustomStart, this.config.reportCustomEnd);
    let keyInfo: KeyInfoResponse | null = null;
    let providerBudgets: ProviderBudgetResponse | null = null;
    let globalReport: GlobalSpendReportEntry[] = [];
    let spendLogs: SpendLogEntry[] = [];
    let keyError: string | null = null;
    let providerError: string | null = null;
    let reportError: string | null = null;

    const results = await Promise.allSettled([
      this.client.fetchKeyInfo(),
      this.client.fetchProviderBudgets(),
      this.client.fetchGlobalSpendReport(dr.start, dr.end),
      this.client.fetchSpendLogs(10),
    ]);
    if (results[0].status === 'fulfilled') keyInfo = results[0].value;
    else keyError = (results[0].reason as Error)?.message ?? 'Unknown error';
    // Fall back to /key/list if keyInfo has no spend and no keyToQuery is set
    if (keyInfo && !(keyInfo.spend ?? 0) && !this.config.keyToQuery) {
      try {
        const list = await this.client.fetchKeyList(1, 50);
        const firstWithSpend = (list.keys ?? []).find(k => (k.spend ?? 0) > 0);
        if (firstWithSpend) {
          keyInfo = {
            ...keyInfo,
            spend: firstWithSpend.spend,
            max_budget: firstWithSpend.max_budget,
            key_alias: firstWithSpend.key_alias || keyInfo.key_alias,
            key_name: firstWithSpend.key_name || keyInfo.key_name,
          };
        }
      } catch { /* fallback failed, keep original keyInfo */ }
    }
    if (results[1].status === 'fulfilled') providerBudgets = results[1].value;
    else providerError = (results[1].reason as Error)?.message ?? 'Unknown error';
    if (results[2].status === 'fulfilled') globalReport = results[2].value;
    else reportError = (results[2].reason as Error)?.message ?? 'Unknown error';
    if (results[3].status === 'fulfilled') spendLogs = results[3].value;
    return { keyInfo, providerBudgets, globalReport, spendLogs, keyError, providerError, reportError };
  }

  private async openBudgetOverview(): Promise<void> {
    if (this.budgetOverviewPanel) { this.budgetOverviewPanel.reveal(vscode.ViewColumn.One); return; }
    this.budgetOverviewPanel = vscode.window.createWebviewPanel(
      'corellmBudgetOverview', 'CoreLLM Budget Overview', vscode.ViewColumn.One, { enableScripts: false }
    );
    this.budgetOverviewPanel.onDidDispose(() => { this.budgetOverviewPanel = undefined; });
    this.budgetOverviewPanel.webview.html = '<html><body style="padding:20px;text-align:center"><p>Loading\u2026</p></body></html>';

    let data: {
      keyInfo: KeyInfoResponse | null; providerBudgets: ProviderBudgetResponse | null;
      globalReport: GlobalSpendReportEntry[]; spendLogs: SpendLogEntry[];
      keyError: string | null; providerError: string | null; reportError: string | null;
    };

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Window, title: 'Fetching CoreLLM budget data\u2026' },
      async () => { data = await this.fetchBudgetData(this.config.reportDuration); }
    );
    if (!this.budgetOverviewPanel) return;
    this.budgetOverviewPanel.webview.html = this.buildBudgetOverviewHtmlWithDuration(data!);
  }

  /** Re-render the budget overview panel (call when duration changes) */
  private async refreshBudgetOverview(): Promise<void> {
    if (!this.budgetOverviewPanel) return;
    const data = await this.fetchBudgetData(this.config.reportDuration);
    if (this.budgetOverviewPanel) {
      this.budgetOverviewPanel.webview.html = this.buildBudgetOverviewHtmlWithDuration(data);
    }
  }

  private buildBudgetOverviewHtmlWithDuration(data: {
    keyInfo: KeyInfoResponse | null; providerBudgets: ProviderBudgetResponse | null;
    globalReport: GlobalSpendReportEntry[]; spendLogs: SpendLogEntry[];
    keyError: string | null; providerError: string | null; reportError: string | null;
  }): string {
    const dur = this.config.reportDuration;
    const durLabel = DURATION_LABELS[dur] || dur;
    const dr = getDateRange(dur, this.config.reportCustomStart, this.config.reportCustomEnd);
    return buildBudgetOverviewHtml({ ...data, durationLabel: durLabel, dateRange: `${dr.start} \u2013 ${dr.end}` });
  }

  /** Show a QuickPick to change the report duration, then refresh */
  private async pickReportDuration(): Promise<void> {
    const pick = await vscode.window.showQuickPick(
      (Object.keys(DURATION_LABELS) as ReportDuration[]).map((k) => ({
        label: DURATION_LABELS[k],
        description: k === this.config.reportDuration ? 'current' : '',
        detail: k === 'custom' ? 'Set start/end dates in settings' : undefined,
        value: k,
      })),
      { placeHolder: 'Select report duration for Budget Overview' }
    );
    if (!pick) return;
    const cfg = vscode.workspace.getConfiguration('corellm');
    await cfg.update('reportDuration', pick.value, vscode.ConfigurationTarget.Global);
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
    if (this.spendLogsPanel) { this.spendLogsPanel.reveal(vscode.ViewColumn.Beside); return; }
    this.spendLogsPanel = vscode.window.createWebviewPanel(
      'corellmSpendLogs', 'CoreLLM Spend Logs', vscode.ViewColumn.Beside, { enableScripts: false }
    );
    this.spendLogsPanel.onDidDispose(() => { this.spendLogsPanel = undefined; });
    this.spendLogsPanel.webview.html = '<html><body style="padding:20px;text-align:center"><p>Loading\u2026</p></body></html>';

    let logs: SpendLogEntry[] = [];
    let error: string | null = null;
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Window, title: 'Fetching spend logs\u2026' },
      async () => { try { logs = await this.client.fetchSpendLogs(50); } catch (err) { error = String(err); } }
    );
    if (this.spendLogsPanel) this.spendLogsPanel.webview.html = buildSpendLogsHtml(logs, error);
  }

  // ── Key List ────────────────────────────────────────────────────────────

  private async openKeyList(): Promise<void> {
    if (this.keyListPanel) { this.keyListPanel.reveal(vscode.ViewColumn.Beside); return; }
    this.keyListPanel = vscode.window.createWebviewPanel(
      'corellmKeyList', 'CoreLLM Keys', vscode.ViewColumn.Beside, { enableScripts: false }
    );
    this.keyListPanel.onDidDispose(() => { this.keyListPanel = undefined; });
    this.keyListPanel.webview.html = '<html><body style="padding:20px;text-align:center"><p>Loading\u2026</p></body></html>';

    let keys: KeyListItem[] = [];
    let error: string | null = null;
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Window, title: 'Fetching keys\u2026' },
      async () => { try { const r = await this.client.fetchKeyList(); keys = r.keys ?? []; } catch (err) { error = String(err); } }
    );
    if (this.keyListPanel) this.keyListPanel.webview.html = buildKeyListHtml(keys, error);
  }

  // ── Status Bar ──────────────────────────────────────────────────────────

  private cycleDisplay(): void {
    if (!this.lastKeyInfo) {
      this.refresh();
      return;
    }
    this.displayCycleIndex = (this.displayCycleIndex + 1) % 4;
    const display = this.computeDisplay(this.lastKeyInfo, this.displayCycleIndex);
    this.statusBarItem.text = display.text;
    this.statusBarItem.tooltip = display.tooltip;
    this.statusBarItem.color = display.color ?? undefined;
  }

  private computeDisplay(data: KeyInfoResponse, mode?: number): StatusBarDisplay {
    const spend = data.spend ?? 0;
    const maxBudget = data.max_budget ?? null;
    const keyAlias = data.key_alias || data.key_name || '';
    const m = mode ?? this.displayCycleIndex;
    let remaining: number | null = null;
    let usedPct = 0;

    if (maxBudget !== null && maxBudget > 0) {
      remaining = Math.max(0, maxBudget - spend);
      usedPct = (spend / maxBudget) * 100;
    }
    const pctRemaining = maxBudget !== null && maxBudget > 0 ? 100 - usedPct : 100;
    const prefix = this.config.showKeyAlias && keyAlias ? `${keyAlias}: ` : '';
    let text: string;
    let color: string | undefined;

    const hasBudget = maxBudget !== null && maxBudget > 0;

    switch (m) {
      case 0: // Remaining budget
        if (hasBudget) {
          text = `$(coin) ${prefix}$${remaining!.toFixed(2)} left`;
          if (pctRemaining <= this.config.budgetWarningThreshold) {
            color = new vscode.ThemeColor('statusBarItem.warningForeground')?.toString() || '#ffcc00';
          }
        } else {
          text = `$(coin) ${prefix}$${spend.toFixed(2)} spent`;
        }
        break;
      case 1: // Usage percentage
        if (hasBudget) {
          text = `$(coin) ${prefix}${usedPct.toFixed(1)}% used`;
          if (pctRemaining <= this.config.budgetWarningThreshold) {
            color = new vscode.ThemeColor('statusBarItem.warningForeground')?.toString() || '#ffcc00';
          }
        } else {
          text = `$(coin) ${prefix}$${spend.toFixed(2)} spent`;
        }
        break;
      case 2: // Total spend (consumed)
        text = `$(coin) ${prefix}$${spend.toFixed(2)} spent`;
        break;
      case 3: // Budget total
        if (hasBudget) {
          text = `$(coin) ${prefix}$${maxBudget!.toFixed(2)} budget`;
        } else {
          text = `$(coin) ${prefix}unlimited`;
        }
        break;
      default:
        text = `$(coin) ${prefix}$${spend.toFixed(2)} spent`;
    }
    return { text, tooltip: this.buildTooltip(data), color };
  }

  private buildTooltip(data: KeyInfoResponse): string {
    const lines: string[] = ['**CoreLLM**', ''];
    const alias = data.key_alias || data.key_name || data.key || 'N/A';
    lines.push(`**Key:** \`${alias}\``);
    const spend = data.spend ?? 0;
    const maxBudget = data.max_budget ?? null;

    if (maxBudget !== null && maxBudget > 0) {
      const remaining = Math.max(0, maxBudget - spend);
      lines.push(`**Spend:** $${spend.toFixed(4)}`);
      lines.push(`**Max Budget:** $${maxBudget.toFixed(2)}`);
      lines.push(`**Remaining:** $${remaining.toFixed(4)}`);
      lines.push(`**Usage:** ${((spend / maxBudget) * 100).toFixed(1)}%`);
    } else {
      lines.push(`**Spend:** $${spend.toFixed(4)}`);
      lines.push('**Max Budget:** Not set (unlimited)');
    }
    if (data.budget_duration) lines.push(`**Budget Duration:** ${data.budget_duration}`);
    if (data.user_id) lines.push(`**User ID:** \`${data.user_id}\``);
    if (data.team_id) lines.push(`**Team ID:** \`${data.team_id}\``);
    if (data.models && data.models.length > 0) {
      const ml = data.models.slice(0, 5).join(', ');
      lines.push(`**Models:** ${ml}${data.models.length > 5 ? ` +${data.models.length - 5} more` : ''}`);
    }
    lines.push('');
    lines.push('$(refresh) Click to refresh');
    lines.push('$(organization) Budget Overview -> Ctrl+Shift+B');
    lines.push(`$(calendar) Duration: ${DURATION_LABELS[this.config.reportDuration]} \u2014 click "Set Report Duration" to change`);
    return lines.join('\n');
  }

  async refresh(): Promise<void> {
    try {
      let data = await this.client.fetchKeyInfo();
      // If keyInfo returned zero spend and no specific key is targeted,
      // fall back to /key/list to find the first key with actual spend
      if (!(data.spend ?? 0) && !this.config.keyToQuery) {
        try {
          const list = await this.client.fetchKeyList(1, 50);
          const firstWithSpend = (list.keys ?? []).find(k => (k.spend ?? 0) > 0);
          if (firstWithSpend) {
            data = {
              ...data,
              spend: firstWithSpend.spend,
              max_budget: firstWithSpend.max_budget,
              key_alias: firstWithSpend.key_alias || data.key_alias,
              key_name: firstWithSpend.key_name || data.key_name,
            };
          }
        } catch { /* fallback failed, keep original data */ }
      }
      this.lastKeyInfo = data;
      this.displayCycleIndex = 0;
      const display = this.computeDisplay(data, 0);
      this.statusBarItem.text = display.text;
      this.statusBarItem.tooltip = display.tooltip;
      this.statusBarItem.color = display.color ?? undefined;
      if (this.config.showSpendLogs) this.fetchAndAppendSpendLogs();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // If management endpoints are blocked, try to at least show models
      if (msg.includes('lacks management permissions')) {
        const models = await this.client.fetchModels();
        this.statusBarItem.text = '$(key) CoreLLM: LLM key (limited)';
        const modelList = models.length > 0 ? `\n\n**Accessible models:** ${models.slice(0, 6).join(', ')}${models.length > 6 ? ` +${models.length - 6}` : ''}` : '';
        this.statusBarItem.tooltip =
          `**CoreLLM**\n\n` +
          `⚠️ This key cannot access management endpoints.\n` +
          `To see balance/budget, set an admin key in the settings.\n` +
          `Or use "keyToQuery" with this key + adminKey as proxy master.` +
          modelList;
        this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
      } else {
        this.statusBarItem.text = '$(error) CoreLLM: Error';
        this.statusBarItem.tooltip = `CoreLLM \u2014 Error: ${msg}`;
        this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.errorForeground');
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
    } catch { /* silent */ }
  }

  private startAutoRefresh(): void {
    if (this.config.refreshInterval <= 0) return;
    this.timer = setInterval(() => this.refresh(), Math.max(5000, this.config.refreshInterval * 1000));
  }

  private stopAutoRefresh(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = undefined; }
  }

  start(): void { this.refresh(); if (this.config.refreshInterval > 0) this.startAutoRefresh(); }

  dispose(): void {
    this.stopAutoRefresh();
    this.disposables.forEach((d) => d.dispose());
  }
}

// ─── Activation ──────────────────────────────────────────────────────────────

let manager: BalanceStatusBarManager | undefined;

// ─── Update Checker ─────────────────────────────────────────────────────────

const EXTENSION_ID = 'litellm-tools.corellm';
const GITHUB_REPO = 'liakos356/litellm-balance-checker';
const CURRENT_VERSION = '0.2.0';

/** Try to fetch the latest tag from tags API (fallback when no releases exist). */
async function fetchLatestTagFromTags(): Promise<{ tag: string; vsixUrl: string } | null> {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/tags`, {
    headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'corellm-vscode' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const tags = await res.json() as Array<{ name: string }>;
  if (!tags || tags.length === 0) return null;
  // Find the newest tag matching v* or just the first one
  const versionTags = tags.filter(t => /^v?\d/.test(t.name)).sort((a, b) => {
    const va = a.name.replace(/^v/, '');
    const vb = b.name.replace(/^v/, '');
    return compareVersions(vb, va); // newest first
  });
  const best = versionTags[0] || tags[0];
  const tag = best.name.replace(/^v/, '');
  // Build raw download URL from tag ref — VSIX is tracked in the repo root
  const vsixUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/v${tag}/corellm-${tag}.vsix`;
  return { tag, vsixUrl };
}

async function checkForUpdates(showUpToDate = false): Promise<void> {
  try {
    // Try releases/latest first
    const releaseRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'corellm-vscode' },
      signal: AbortSignal.timeout(8000),
    });

    let latestTag: string | null = null;
    let vsixDownloadUrl: string | null = null;
    let releaseUrl: string | null = null;

    if (releaseRes.ok) {
      const data = await releaseRes.json() as {
        tag_name?: string; html_url?: string; name?: string;
        assets?: Array<{ name: string; browser_download_url: string }>;
      };
      const tag = (data.tag_name || data.name || '').replace(/^v/, '');
      if (tag) {
        latestTag = tag;
        releaseUrl = data.html_url || null;
        const vsixAsset = data.assets?.find((a) => a.name.endsWith('.vsix'));
        vsixDownloadUrl = vsixAsset?.browser_download_url || null;
      }
    }

    // Fall back to tags if no release found
    if (!latestTag) {
      const tagInfo = await fetchLatestTagFromTags();
      if (tagInfo) {
        latestTag = tagInfo.tag;
        vsixDownloadUrl = tagInfo.vsixUrl;
        releaseUrl = `https://github.com/${GITHUB_REPO}/tree/v${tagInfo.tag}`;
      }
    }

    if (!latestTag) {
      if (showUpToDate) {
        vscode.window.showInformationMessage('No releases or tags found in the repository.');
      }
      return;
    }

    if (compareVersions(latestTag, CURRENT_VERSION) > 0) {
      const hasVsix = !!vsixDownloadUrl;
      const actions = hasVsix ? ['Update & Reload', 'Download', 'Dismiss'] : ['Download', 'Dismiss'];
      const action = await vscode.window.showInformationMessage(
        `CoreLLM v${latestTag} available! (current: v${CURRENT_VERSION})`,
        ...actions
      );

      if (action === 'Update & Reload' && vsixDownloadUrl) {
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: 'Downloading update...' },
          async () => {
            const dl = await fetch(vsixDownloadUrl);
            if (!dl.ok) throw new Error('Download failed');
            const buf = Buffer.from(await dl.arrayBuffer());
            const tmpPath = `${os.tmpdir()}/corellm-${latestTag}.vsix`;
            fs.writeFileSync(tmpPath, buf);
            await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(tmpPath));
          }
        );
        const reload = await vscode.window.showInformationMessage(
          'Update installed! Reload now to apply.', 'Reload Now'
        );
        if (reload) vscode.commands.executeCommand('workbench.action.reloadWindow');
      } else if (action === 'Download' && releaseUrl) {
        vscode.env.openExternal(vscode.Uri.parse(releaseUrl));
      }
    } else if (showUpToDate) {
      vscode.window.showInformationMessage(`CoreLLM is up to date (v${CURRENT_VERSION}).`);
    }
  } catch {
    if (showUpToDate) {
      vscode.window.showInformationMessage(`Could not check for updates. Are you online?`);
    }
  }
}

/** Simple semver compare. Returns >0 if a>b, <0 if a<b, 0 if equal. */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

// ─── Activation ──────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): void {
  console.log('CoreLLM activating...');

  // Register update command
  context.subscriptions.push(
    vscode.commands.registerCommand('corellm.checkForUpdates', () => checkForUpdates(true))
  );

  manager = new BalanceStatusBarManager();
  context.subscriptions.push(manager);

  const config = getConfig();
  if (!config.apiKey && !config.adminKey && !config.username) {
    vscode.window.showInformationMessage(
      'CoreLLM: Configure your API key in settings to get started.',
      'Open Settings'
    ).then((sel) => {
      if (sel === 'Open Settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', '@ext:litellm-tools.corellm');
      }
    });
  }

  // Check for updates silently on startup (once per session)
  setTimeout(() => checkForUpdates(), 5000);

  console.log('CoreLLM activated');
}

export function deactivate(): void {
  if (manager) { manager.dispose(); manager = undefined; }
  console.log('CoreLLM deactivated');
}
