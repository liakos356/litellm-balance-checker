import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import { buildTutorialHtml } from './tutorial';

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
  updateCheckInterval: number;
  webviewTheme: string;
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
    updateCheckInterval: cfg.get<number>('updateCheckInterval', 24),
    webviewTheme: cfg.get<string>('webviewTheme', 'vscode'),
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

/** Get a human-readable relative time string (e.g., "2m ago", "1h ago"). */
function getRelativeTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
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

/** Build an SVG line chart for time-series spend data. */
function svgLineChart(
  dataPoints: { label: string; value: number }[],
  width = 360,
  height = 140,
): string {
  if (dataPoints.length < 2) return '';
  const maxVal = Math.max(...dataPoints.map(d => d.value), 1);
  const padding = { top: 10, right: 10, bottom: 24, left: 10 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const stepX = chartW / (dataPoints.length - 1);
  const points = dataPoints.map((d, i) => ({
    x: padding.left + i * stepX,
    y: padding.top + chartH - (d.value / maxVal) * chartH,
    label: d.label,
    value: d.value,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${padding.top + chartH} L ${points[0].x.toFixed(1)} ${padding.top + chartH} Z`;

  const tickStep = Math.max(1, Math.floor(dataPoints.length / 6));
  const xLabels = points.filter((_, i) => i % tickStep === 0 || i === dataPoints.length - 1)
    .map(p => `<text x="${p.x}" y="${height - 4}" font-size="9" fill="var(--vscode-foreground)" opacity=".5" text-anchor="middle">${escapeHtml(p.label)}</text>`)
    .join('\n    ');

  const dotCircles = points.map(p =>
    `<circle cx="${p.x}" cy="${p.y}" r="3" fill="var(--vscode-focusBorder)" stroke="var(--vscode-editor-background)" stroke-width="2" opacity="0"><title>${escapeHtml(p.label)}: ${usd(p.value, 4)}</title></circle>`
  ).join('\n    ');

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block;margin:8px 0">
    <defs>
      <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--vscode-focusBorder)" stop-opacity=".25"/>
        <stop offset="100%" stop-color="var(--vscode-focusBorder)" stop-opacity=".02"/>
      </linearGradient>
    </defs>
    <path d="${areaPath}" fill="url(#lineGrad)"/>
    <path d="${linePath}" fill="none" stroke="var(--vscode-focusBorder)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${dotCircles}
    ${xLabels}
  </svg>`;
}

/** Build an inline SVG sparkline (tiny trend). */
function svgSparkline(values: number[], width = 60, height = 20): string {
  if (values.length < 2) return '';
  const maxV = Math.max(...values, 1);
  const minV = Math.min(...values, 0);
  const range = maxV - minV || 1;
  const stepX = width / (values.length - 1);
  const pts = values.map((v, i) => `${(i * stepX).toFixed(0)},${(height - ((v - minV) / range) * height).toFixed(0)}`).join(' ');
  const color = values[values.length - 1] >= values[0] ? 'var(--vscode-editorGutter-addedForeground,#4ec9b0)' : 'var(--vscode-errorForeground,#f14c4c)';
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:inline-block;vertical-align:middle;margin:0 4px">
    <polyline fill="none" stroke="${color}" stroke-width="1.5" points="${pts}"/>
  </svg>`;
}

/** Build a set of CSS variable overrides for theme selection. */
function buildThemeOverrides(theme: string): string {
  if (theme === 'system' || theme === 'vscode') return '';
  if (theme === 'light') {
    return `
  body{--vscode-editor-background:#ffffff;--vscode-editor-foreground:#1e1e1e;--vscode-editorWidget-background:#f3f3f3;--vscode-widget-border:#d4d4d4;--vscode-panel-border:#e0e0e0;--vscode-focusBorder:#007acc;--vscode-input-background:#ffffff;--vscode-input-foreground:#1e1e1e;--vscode-input-border:#cecece;--vscode-list-hoverBackground:#e8e8e8;--vscode-badge-background:#c4c4c4;--vscode-badge-foreground:#333;--vscode-progressBar-background:#ccc;--vscode-button-background:#007acc;--vscode-button-foreground:#fff;--vscode-button-hoverBackground:#0062a3;--vscode-editorGutter-addedForeground:#1a7f37;--vscode-editorWarning-foreground:#9a6700;--vscode-errorForeground:#cf222e;--vscode-inputValidation-errorBackground:#ffebe9;--vscode-inputValidation-errorBorder:#cf222e}`;
  }
  if (theme === 'dark') {
    return `
  body{--vscode-editor-background:#1e1e1e;--vscode-editor-foreground:#d4d4d4;--vscode-editorWidget-background:#252526;--vscode-widget-border:#3c3c3c;--vscode-panel-border:#3c3c3c;--vscode-focusBorder:#4ec9b0;--vscode-input-background:#3c3c3c;--vscode-input-foreground:#d4d4d4;--vscode-input-border:#555;--vscode-list-hoverBackground:#2a2d2e;--vscode-badge-background:#4d4d4d;--vscode-badge-foreground:#fff;--vscode-progressBar-background:#4d4d4d;--vscode-button-background:#0e639c;--vscode-button-foreground:#fff;--vscode-button-hoverBackground:#1177bb;--vscode-editorGutter-addedForeground:#4ec9b0;--vscode-editorWarning-foreground:#e2b714;--vscode-errorForeground:#f14c4c;--vscode-inputValidation-errorBackground:#5a1d1d;--vscode-inputValidation-errorBorder:#be1100}`;
  }
  if (theme === 'hc') {
    return `
  body{--vscode-editor-background:#000;--vscode-editor-foreground:#fff;--vscode-editorWidget-background:#0a0a0a;--vscode-widget-border:#6fc3df;--vscode-panel-border:#6fc3df;--vscode-focusBorder:#f38518;--vscode-input-background:#000;--vscode-input-foreground:#fff;--vscode-input-border:#6fc3df;--vscode-list-hoverBackground:#0a0a0a;--vscode-badge-background:#fff;--vscode-badge-foreground:#000;--vscode-progressBar-background:#fff;--vscode-button-background:#fff;--vscode-button-foreground:#000;--vscode-button-hoverBackground:#ccc;--vscode-editorGutter-addedForeground:#1a7f37;--vscode-editorWarning-foreground:#e2b714;--vscode-errorForeground:#f14c4c;--vscode-inputValidation-errorBackground:#5a1d1d;--vscode-inputValidation-errorBorder:#be1100}`;
  }
  return '';
}

/** Build a loading spinner page with optional cancel button. */
function buildLoadingHtml(message: string, showCancel = true): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px 20px;color:var(--vscode-foreground);background:var(--vscode-editor-background);text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:40vh}
  .spinner{display:inline-block;width:28px;height:28px;border:3px solid var(--vscode-panel-border);border-top-color:var(--vscode-focusBorder);border-radius:50%;animation:spin .8s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  p{opacity:.6;margin-top:16px;font-size:.95em}
  .cancel-btn{margin-top:20px;padding:8px 24px;border:1px solid var(--vscode-panel-border);border-radius:6px;background:transparent;color:var(--vscode-foreground);cursor:pointer;font-size:.85em;font-family:inherit;transition:all .15s;opacity:.7}
  .cancel-btn:hover{opacity:1;background:var(--vscode-list-hoverBackground);border-color:var(--vscode-errorForeground);color:var(--vscode-errorForeground)}
  .skeleton{display:flex;flex-direction:column;gap:12px;width:100%;max-width:400px;margin-top:24px;opacity:.3}
  .skeleton-bar{height:16px;background:var(--vscode-panel-border);border-radius:4px;animation:pulse 1.5s ease-in-out infinite}
  .skeleton-bar:nth-child(2){width:80%;animation-delay:.2s}
  .skeleton-bar:nth-child(3){width:60%;animation-delay:.4s}
  .skeleton-bar:nth-child(4){height:80px;animation-delay:.6s}
  @keyframes pulse{0%,100%{opacity:.3}50%{opacity:.7}}
</style>
</head>
<body>
<div class="spinner"></div>
<p>${escapeHtml(message)}</p>
<div class="skeleton">
  <div class="skeleton-bar"></div>
  <div class="skeleton-bar"></div>
  <div class="skeleton-bar"></div>
  <div class="skeleton-bar" style="height:60px"></div>
</div>
${showCancel ? '<button class="cancel-btn" onclick="cancelLoad()">\u2715 Cancel</button>' : ''}
<script>
const vscode = acquireVsCodeApi();
window.cancelLoad = function() { vscode.postMessage({ type: 'cancel' }); };
</script>
</body>
</html>`;
}

/** Format a CSV row, handling commas and quotes. */
function csvCell(s: string | number | null | undefined): string {
  if (s == null) return '';
  const str = String(s);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/** Trigger a CSV download via the webview. */
function csvDownloadScript(filename: string, headers: string[], rows: string[][]): string {
  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\\n');
  return `
<script>
(function() {
  const csv = '${csvContent}';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '${filename}';
  a.click();
  URL.revokeObjectURL(url);
})();
</script>`;
}

/** Common CSS shared across all webview panels. */
const COMMON_CSS = `
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:16px;color:var(--vscode-foreground);background:var(--vscode-editor-background);margin:0}
  h2{margin-top:0;font-weight:600;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  h2 .title-actions{margin-left:auto;display:flex;gap:6px;align-items:center}
  h3{margin:20px 0 8px;font-weight:500;border-bottom:1px solid var(--vscode-panel-border);padding-bottom:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  h3 .card-actions{margin-left:auto;display:flex;gap:4px}
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
  th{font-weight:600;opacity:.8;position:sticky;top:0;background:var(--vscode-editor-background);z-index:1}
  .badge{display:inline-block;background:var(--vscode-badge-background);color:var(--vscode-badge-foreground);border-radius:4px;padding:1px 6px;font-size:.8em;font-weight:500}
  .badge-success{background:var(--vscode-editorGutter-addedForeground,#4ec9b0);color:#fff}
  .badge-warn{background:var(--vscode-editorWarning-foreground,#e2b714);color:#1e1e1e}
  .badge-error{background:var(--vscode-errorForeground,#f14c4c);color:#fff}
  .error-box{background:color-mix(in srgb,var(--vscode-inputValidation-errorBackground,#5a1d1d) 80%,transparent);border:1px solid var(--vscode-inputValidation-errorBorder,#be1100);border-radius:6px;padding:10px 14px;margin-bottom:10px;font-size:.85em;line-height:1.5}
  .footer{margin-top:20px;padding:12px;text-align:center;font-size:.72em;opacity:.5;border-top:1px solid var(--vscode-panel-border);background:var(--vscode-editorWidget-background);border-radius:0 0 8px 8px;display:flex;justify-content:center;gap:16px;flex-wrap:wrap}
  .bar-container{height:8px;background:color-mix(in srgb,var(--vscode-progressBar-background,#333) 60%,transparent);border-radius:4px;overflow:hidden;margin:8px 0}
  .bar-fill{height:100%;border-radius:4px;transition:width .8s cubic-bezier(.4,0,.2,1)}
  .bar-fill.green{background:linear-gradient(90deg,var(--vscode-editorGutter-addedForeground,#4ec9b0),#6dd8c0)}
  .bar-fill.yellow{background:linear-gradient(90deg,var(--vscode-editorWarning-foreground,#e2b714),#f0c929)}
  .bar-fill.red{background:linear-gradient(90deg,var(--vscode-errorForeground,#f14c4c),#f06060)}
  .chart-row{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;justify-content:center}
  .legend{font-size:.75em;margin-top:4px;display:flex;flex-wrap:wrap;gap:6px}
  .legend-item{display:inline-flex;align-items:center;margin-right:8px;white-space:nowrap;font-size:.82em;opacity:.85}
  .legend-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:middle;flex-shrink:0}
  .toolbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:14px;padding:10px 14px;background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-widget-border);border-radius:8px;position:sticky;top:0;z-index:10}
  .toolbar-btn{padding:5px 14px;border:1px solid var(--vscode-panel-border);border-radius:5px;background:transparent;color:var(--vscode-foreground);cursor:pointer;font-size:.82em;font-family:inherit;transition:all .15s ease;white-space:nowrap}
  .toolbar-btn:hover{background:var(--vscode-list-hoverBackground);border-color:var(--vscode-focusBorder)}
  .toolbar-btn.active{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border-color:var(--vscode-button-background);font-weight:500}
  .toolbar-btn.active:hover{background:var(--vscode-button-hoverBackground)}
  .toolbar-btn.primary{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border-color:var(--vscode-button-background)}
  .toolbar-btn.primary:hover{background:var(--vscode-button-hoverBackground)}
  .toolbar-sep{width:1px;height:24px;background:var(--vscode-panel-border);margin:0 6px;flex-shrink:0}
  .toolbar-label{font-size:.78em;opacity:.7;margin-right:2px}
  .toolbar-date{background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);border-radius:4px;padding:3px 8px;font-size:.82em;font-family:inherit}
  .summary-bar{display:flex;flex-wrap:wrap;gap:0;margin-bottom:14px;background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-widget-border);border-radius:8px;overflow:hidden}
  .summary-item{flex:1;min-width:100px;padding:10px 12px;text-align:center;border-right:1px solid var(--vscode-panel-border)}
  .summary-item:last-child{border-right:none}
  .summary-value{font-size:1.15em;font-weight:700;line-height:1.3}
  .summary-label{font-size:.7em;opacity:.65;text-transform:uppercase;letter-spacing:.04em;margin-top:2px}
  .trend-up{color:var(--vscode-errorForeground,#f14c4c)}
  .trend-down{color:var(--vscode-editorGutter-addedForeground,#4ec9b0)}
  .empty-state{padding:28px 16px;text-align:center;opacity:.5}
  .empty-state .empty-icon{font-size:2em;margin-bottom:10px;display:block;opacity:.6}
  .empty-state .empty-text{font-size:.88em;line-height:1.6}
  .table-wrap{overflow-x:auto;margin:0 -4px;padding:0 4px}
  .search-bar{display:flex;gap:8px;margin-bottom:12px;align-items:center}
  .search-input{flex:1;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);border-radius:5px;padding:6px 10px;font-size:.85em;font-family:inherit;outline:none;transition:border-color .15s}
  .search-input:focus{border-color:var(--vscode-focusBorder)}
  .search-input::placeholder{opacity:.45}
  .copy-btn{display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border:1px solid var(--vscode-panel-border);border-radius:4px;background:transparent;color:var(--vscode-foreground);cursor:pointer;font-size:.76em;font-family:inherit;transition:all .15s;opacity:.6}
  .copy-btn:hover{opacity:1;background:var(--vscode-list-hoverBackground);border-color:var(--vscode-focusBorder)}
  .copy-btn.copied{background:var(--vscode-editorGutter-addedForeground,#4ec9b0);color:#fff;border-color:var(--vscode-editorGutter-addedForeground,#4ec9b0);opacity:1}
  tbody tr{cursor:default;transition:background .12s}
  tbody tr:hover{background:var(--vscode-list-hoverBackground)}
  .copyable{display:inline-flex;align-items:center;gap:4px;cursor:pointer;padding:2px 4px;border-radius:3px;transition:background .12s}
  .copyable:hover{background:var(--vscode-list-hoverBackground)}
  .copyable .copy-icon{opacity:0;font-size:.7em;transition:opacity .12s}
  .copyable:hover .copy-icon{opacity:.5}
  .rel-time{font-size:.78em;opacity:.6;margin-left:4px;white-space:nowrap}
  .theme-btn{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border:1px solid var(--vscode-panel-border);border-radius:5px;background:transparent;color:var(--vscode-foreground);cursor:pointer;font-size:.78em;font-family:inherit;transition:all .15s;opacity:.7}
  .theme-btn:hover{opacity:1;background:var(--vscode-list-hoverBackground)}
  .theme-btn.active{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border-color:var(--vscode-button-background)}
  .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:8px 20px;border-radius:6px;font-size:.82em;background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-widget-border);box-shadow:0 4px 12px rgba(0,0,0,.15);opacity:0;transition:opacity .25s;z-index:100;pointer-events:none}
  .toast.show{opacity:1}
  .refresh-spin{display:inline-block;animation:spin .8s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
`;

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
  currentDuration?: string;
  customStart?: string;
  customEnd?: string;
  activeTheme?: string;
}): string {
  const { keyInfo, providerBudgets, globalReport, spendLogs, keyError, providerError, reportError, durationLabel, dateRange, currentDuration, customStart, customEnd, activeTheme } = data;

  // Aggregate from report
  let totalSpend = 0;
  let totalRequests = 0;
  let totalTokens = 0;
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
          totalTokens += (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0);
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

  // Line chart for daily spend trend
  const lineChart = dailyData.length >= 2 ? svgLineChart(dailyData.map(d => ({ label: d.label, value: d.spend })), 360, 120) : '';

  const providerChart = providerChartData.length > 0 ? svgHBarChart(providerChartData, providerChartData[0]?.value || 1, 320) : '';
  const modelDonut = modelChartData.length > 0 ? svgDonut(modelChartData, 140, 28) : '';

  // Sparkline for daily spend
  const spendSparkline = dailyData.length >= 2 ? svgSparkline(dailyData.map(d => d.spend)) : '';

  // Cost efficiency metrics
  const avgCostPerRequest = totalRequests > 0 ? effectiveTotalSpend / totalRequests : 0;
  const avgCostPerToken = totalTokens > 0 ? effectiveTotalSpend / totalTokens : 0;

  const theme = activeTheme || 'vscode';
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

<!-- Datepicker Toolbar -->
<div class="toolbar" id="toolbar">
  <button class="toolbar-btn${currentDuration === '1h' ? ' active' : ''}" data-dur="1h">1h</button>
  <button class="toolbar-btn${currentDuration === '24h' ? ' active' : ''}" data-dur="24h">24h</button>
  <button class="toolbar-btn${currentDuration === '7d' ? ' active' : ''}" data-dur="7d">7d</button>
  <button class="toolbar-btn${currentDuration === '30d' ? ' active' : ''}" data-dur="30d">30d</button>
  <div class="toolbar-sep"></div>
  <span class="toolbar-label">From:</span>
  <input type="date" class="toolbar-date" id="dateStart" value="${customStart || ''}">
  <span class="toolbar-label">To:</span>
  <input type="date" class="toolbar-date" id="dateEnd" value="${customEnd || ''}">
  <button class="toolbar-btn${currentDuration === 'custom' ? ' active' : ''}" id="applyCustom">Apply</button>
</div>

<!-- Toast notification -->
<div class="toast" id="toast"></div>

<!-- Summary bar -->
<div class="summary-bar">
  <div class="summary-item"><div class="summary-value">${usd(effectiveTotalSpend)}</div><div class="summary-label">Total Spend</div></div>
  <div class="summary-item"><div class="summary-value">${maxB != null && maxB > 0 ? usedPct.toFixed(1) + '%' : '\u2014'}</div><div class="summary-label">Used</div></div>
  <div class="summary-item"><div class="summary-value ${remaining != null && remaining <= 0 ? 'err' : remaining != null && maxB != null && remaining / maxB <= 0.2 ? 'warn' : 'ok'}">${remaining != null ? usd(remaining, 4) : '\u221E'}</div><div class="summary-label">Remaining</div></div>
  <div class="summary-item"><div class="summary-value">${totalRequests.toLocaleString()}</div><div class="summary-label">Requests${spendSparkline}</div></div>
  <div class="summary-item"><div class="summary-value">${providerCount}</div><div class="summary-label">Providers</div></div>
  <div class="summary-item"><div class="summary-value">${globalReport.length}</div><div class="summary-label">Days</div></div>
  <div class="summary-item"><div class="summary-value">${usd(avgCostPerRequest, 6)}</div><div class="summary-label">Cost/Req</div></div>
</div>

<!-- Key Info Card -->
<div class="card">
  <h3>\u{1F511} Key <span class="copy-btn" onclick="copyKey()" id="keyCopyBtn">\u{1F4CB} Copy</span></h3>
  <div style="font-size:.88em;margin-bottom:10px;word-break:break-all;font-family:monospace;opacity:.8">${escapeHtml(alias)}</div>
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
  <div class="table-wrap"><table>
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
    </tbody></table></div>` : '<div class="empty-state"><span class="empty-icon">\u2601\uFE0F</span><div class="empty-text">No provider budgets configured.</div></div>'}
</div>

<!-- Global Spend Report Card -->
<div class="card">
  <h3>\uD83C\uDF10 Daily Spend ${durationLabel ? '\\(' + durationLabel + '\\)' : ''} <span class="badge">${globalReport.length} days</span></h3>
  ${dateRange ? `<p style="font-size:.8em;opacity:.6;margin:4px 0 0">${escapeHtml(dateRange)}</p>` : ''}
  ${reportError ? `<div class="error-box">\u26A0 ${escapeHtml(reportError)}</div>` : ''}
  ${globalReport.length > 0 ? `
  <div class="chart-row" style="flex-direction:column;align-items:stretch">${lineChart}${dailyChart}</div>` : '<div class="empty-state"><span class="empty-icon">\uD83C\uDF10</span><div class="empty-text">No global spend data for the selected period.</div></div>'}
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

<!-- Cost Efficiency Card -->
${totalRequests > 0 ? `
<div class="card">
  <h3>\u2699\uFE0F Cost Efficiency</h3>
  <div class="grid">
    <div class="stat"><div class="stat-value">${usd(avgCostPerRequest, 6)}</div><div class="stat-label">Avg Cost / Request</div></div>
    <div class="stat"><div class="stat-value">${totalTokens > 0 ? usd(avgCostPerToken, 8) : '\u2014'}</div><div class="stat-label">Avg Cost / Token</div></div>
    <div class="stat"><div class="stat-value">${totalTokens.toLocaleString()}</div><div class="stat-label">Total Tokens</div></div>
    <div class="stat"><div class="stat-value">${totalRequests > 0 && totalTokens > 0 ? Math.round(totalTokens / totalRequests).toLocaleString() : '\u2014'}</div><div class="stat-label">Tokens / Request</div></div>
  </div>
</div>` : ''}

<!-- Recent Spend Logs Card -->
<div class="card">
  <h3>\uD83D\uDCDD Recent Spend Logs <span class="badge">${spendLogs.length}</span></h3>
  ${spendLogs.length > 0 ? `
  <div class="table-wrap"><table><thead><tr><th>Time</th><th>Model</th><th>Type</th><th>Spend</th><th>Tokens</th></tr></thead>
  <tbody>${spendLogs.map(l => {
    const ts = l.startTime ? new Date(l.startTime) : null;
    const rel = ts ? getRelativeTime(ts) : '';
    const costPerToken = (l.total_tokens ?? 0) > 0 ? ((l.spend ?? 0) / (l.total_tokens ?? 1)) : 0;
    return `<tr>
    <td>${ts ? ts.toLocaleString() : '\u2014'}${rel ? `<span class="rel-time">(${rel})</span>` : ''}</td>
    <td>${escapeHtml(l.model ?? '\u2014')}</td>
    <td><span class="badge">${escapeHtml(l.call_type ?? '\u2014')}</span></td>
    <td>${usd(l.spend, 6)}</td>
    <td>${(l.total_tokens ?? 0).toLocaleString()}${costPerToken > 0 ? `<span class="rel-time">(${usd(costPerToken, 8)}/tok)</span>` : ''}</td>
  </tr>`;
  }).join('')}</tbody></table></div>` : '<div class="empty-state"><span class="empty-icon">\uD83D\uDCDD</span><div class="empty-text">No recent spend logs found.</div></div>'}
</div>

<div class="footer">
  <span>CoreLLM \u00B7 Spend: ${usd(spend, 4)}</span>
  <span>${maxB != null && maxB > 0 ? `Used: ${usedPct.toFixed(1)}% \u00B7 Left: ${usd(remaining!, 4)}` : 'No budget set'}</span>
  <span>${providerCount} provider(s) \u00B7 ${globalReport.length} day(s)</span>
  <span>Cost/req: ${usd(avgCostPerRequest, 6)}</span>
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

  // Preset duration buttons
  document.querySelectorAll('[data-dur]').forEach(btn => {
    btn.addEventListener('click', () => {
      vscode.postMessage({ type: 'setDuration', duration: btn.dataset.dur });
    });
  });

  // Apply custom date range
  document.getElementById('applyCustom').addEventListener('click', () => {
    const start = document.getElementById('dateStart').value;
    const end = document.getElementById('dateEnd').value;
    if (!start || !end) return;
    vscode.postMessage({ type: 'setCustomDates', startDate: start, endDate: end });
  });

  document.getElementById('dateStart').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('applyCustom').click();
  });
  document.getElementById('dateEnd').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('applyCustom').click();
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

function buildSpendLogsHtml(logs: SpendLogEntry[], error: string | null, activeTheme?: string): string {
  const theme = activeTheme || 'vscode';
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
${error ? `<div class="error-box">\u26A0 ${escapeHtml(error)}</div>` : ''}
${logs.length > 0 ? `
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
<tbody>${logs.map((l, idx) => {
  const ts = l.startTime ? new Date(l.startTime) : null;
  const rel = ts ? getRelativeTime(ts) : '';
  const model = l.model ?? '';
  const callType = l.call_type ?? '';
  const cpt = (l.total_tokens ?? 0) > 0 ? ((l.spend ?? 0) / (l.total_tokens ?? 1)) : 0;
  return `<tr data-idx="${idx}" data-model="${escapeHtml(model)}" data-type="${escapeHtml(callType)}">
  <td>${ts ? ts.toLocaleString() : '\u2014'}${rel ? `<span class="rel-time">(${rel})</span>` : ''}</td>
  <td>${escapeHtml(model || '\u2014')}</td>
  <td><span class="badge">${escapeHtml(callType || '\u2014')}</span></td>
  <td>${usd(l.spend, 6)}</td>
  <td>${(l.total_tokens ?? 0).toLocaleString()}</td>
  <td>${cpt > 0 ? usd(cpt, 8) : '\u2014'}</td>
</tr>`;
}).join('')}</tbody></table></div>` : '<div class="empty-state"><span class="empty-icon">\uD83D\uDCDD</span><div class="empty-text">No spend logs found.</div></div>'}
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

function buildKeyListHtml(keys: KeyListItem[], error: string | null, activeTheme?: string): string {
  const theme = activeTheme || 'vscode';
  const themeOverride = buildThemeOverrides(theme);
  const totalSpend = keys.reduce((s, k) => s + (k.spend ?? 0), 0);
  const totalBudget = keys.reduce((s, k) => s + (k.max_budget ?? 0), 0);
  const keysWithBudget = keys.filter(k => k.max_budget != null && k.max_budget > 0).length;

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
${error ? `<div class="error-box">\u26A0 ${escapeHtml(error)}</div>` : ''}
${keys.length > 0 ? `
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
<tbody>${keys.map((k, idx) => {
  const s = k.spend ?? 0;
  const m = k.max_budget;
  const pp = m && m > 0 ? ((s / m) * 100) : 0;
  const pc = pp > 80 ? 'red' : pp > 50 ? 'yellow' : 'green';
  const alias2 = k.key_alias || k.key_name || '(unnamed)';
  const keyVal = k.key || '';
  const isOverBudget = m != null && m > 0 && s >= m;
  return `<tr data-idx="${idx}" data-alias="${escapeHtml(alias2.toLowerCase())}" data-user="${escapeHtml((k.user_id ?? '').toLowerCase())}" data-team="${escapeHtml((k.team_id ?? '').toLowerCase())}"${isOverBudget ? ' style="border-left:3px solid var(--vscode-errorForeground,#f14c4c)"' : ''}>
    <td><strong>${escapeHtml(alias2)}</strong>${isOverBudget ? ' <span class="badge badge-error">OVER</span>' : ''}${keyVal ? `<div class="key-name">${escapeHtml(keyVal.slice(0, 20))}${keyVal.length > 20 ? '\u2026' : ''}</div>` : ''}</td>
    <td>${usd(s, 4)}</td>
    <td>${usd(m)}</td>
    <td>${m && m > 0 ? pp.toFixed(1) + '%' : '\u2014'}${m && m > 0 ? `<div class="bar-container"><div class="bar-fill ${pc}" style="width:${Math.min(100, pp)}%"></div></div>` : ''}</td>
    <td>${k.user_id ? `<span class="badge">${escapeHtml(k.user_id)}</span>` : '\u2014'}</td>
    <td>${k.team_id ? `<span class="badge">${escapeHtml(k.team_id)}</span>` : '\u2014'}</td>
  </tr>`;
}).join('')}</tbody></table></div>` : '<div class="empty-state"><span class="empty-icon">\u{1F511}</span><div class="empty-text">No keys found.</div></div>'}
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

  // ── Display Cycling ──────────────────────────────────────────────────
  private displayCycleIndex = 0;
  private lastKeyInfo: KeyInfoResponse | null = null;

  constructor() {
    this.config = getConfig();
    this.activeTheme = this.config.webviewTheme;
    this.client = new CoreLLMApiClient(this.config);

    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.name = 'CoreLLM';
    this.statusBarItem.command = 'corellm.cycleDisplay';
    this.statusBarItem.tooltip = 'CoreLLM \u2014 Click to cycle display (spend / usage / budget)';
    this.statusBarItem.text = '$(graph) CoreLLM: \u2026';
    this.statusBarItem.backgroundColor = undefined;
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
      }),
      vscode.commands.registerCommand('corellm.showTutorial', () => this.openTutorial())
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

  // ── Theme state ──────────────────────────────────────────────────────────
  private activeTheme: string;

  private async openBudgetOverview(): Promise<void> {
    if (this.budgetOverviewPanel) { this.budgetOverviewPanel.reveal(vscode.ViewColumn.One); return; }
    this.budgetOverviewPanel = vscode.window.createWebviewPanel(
      'corellmBudgetOverview', 'CoreLLM Budget Overview', vscode.ViewColumn.One, { enableScripts: true }
    );
    this.budgetOverviewPanel.onDidDispose(() => { this.budgetOverviewPanel = undefined; });

    // Handle messages from the webview
    this.budgetOverviewPanel.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case 'setDuration':
          this.setReportDurationFromWebview(msg.duration);
          break;
        case 'setCustomDates':
          this.setCustomDatesFromWebview(msg.startDate, msg.endDate);
          break;
        case 'refresh':
          this.refreshBudgetOverview();
          break;
        case 'exportCsv':
          this.exportBudgetCsv();
          break;
        case 'setTheme':
          this.activeTheme = msg.theme;
          if (this.budgetOverviewPanel) this.refreshBudgetOverview();
          if (this.spendLogsPanel) this.refreshSpendLogsPanel();
          if (this.keyListPanel) this.refreshKeyListPanel();
          if (this.tutorialPanel) this.refreshTutorial();
          break;
        case 'cancel':
          this.budgetOverviewPanel?.dispose();
          break;
        case 'close':
          this.budgetOverviewPanel?.dispose();
          break;
      }
    });

    this.budgetOverviewPanel.webview.html = buildLoadingHtml('Loading Budget Overview\u2026', true);

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
    return buildBudgetOverviewHtml({
      ...data,
      durationLabel: durLabel,
      dateRange: `${dr.start} \u2013 ${dr.end}`,
      currentDuration: dur,
      customStart: this.config.reportCustomStart || dr.start,
      customEnd: this.config.reportCustomEnd || dr.end,
      activeTheme: this.activeTheme,
    });
  }

  /** Set report duration from webview message and refresh */
  private async setReportDurationFromWebview(duration: ReportDuration): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('corellm');
    await cfg.update('reportDuration', duration, vscode.ConfigurationTarget.Global);
    this.config = getConfig();
    this.client = new CoreLLMApiClient(this.config);
    if (this.budgetOverviewPanel) await this.refreshBudgetOverview();
  }

  /** Set custom date range from webview message and refresh */
  private async setCustomDatesFromWebview(startDate: string, endDate: string): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('corellm');
    await cfg.update('reportDuration', 'custom', vscode.ConfigurationTarget.Global);
    await cfg.update('reportCustomStart', startDate, vscode.ConfigurationTarget.Global);
    await cfg.update('reportCustomEnd', endDate, vscode.ConfigurationTarget.Global);
    this.config = getConfig();
    this.client = new CoreLLMApiClient(this.config);
    if (this.budgetOverviewPanel) await this.refreshBudgetOverview();
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
      'corellmSpendLogs', 'CoreLLM Spend Logs', vscode.ViewColumn.Beside, { enableScripts: true }
    );
    this.spendLogsPanel.onDidDispose(() => { this.spendLogsPanel = undefined; });
    this.spendLogsPanel.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case 'refresh':
          this.refreshSpendLogsPanel();
          break;
        case 'exportCsv':
          this.exportSpendLogsCsv();
          break;
        case 'setTheme':
          this.activeTheme = msg.theme;
          if (this.spendLogsPanel) this.refreshSpendLogsPanel();
          if (this.budgetOverviewPanel) this.refreshBudgetOverview();
          if (this.keyListPanel) this.refreshKeyListPanel();
          if (this.tutorialPanel) this.refreshTutorial();
          break;
        case 'close':
          this.spendLogsPanel?.dispose();
          break;
      }
    });
    this.spendLogsPanel.webview.html = buildLoadingHtml('Loading Spend Logs\u2026', true);

    let logs: SpendLogEntry[] = [];
    let error: string | null = null;
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Window, title: 'Fetching spend logs\u2026' },
      async () => { try { logs = await this.client.fetchSpendLogs(50); } catch (err) { error = String(err); } }
    );
    if (this.spendLogsPanel) this.spendLogsPanel.webview.html = buildSpendLogsHtml(logs, error, this.activeTheme);
  }

  private async refreshSpendLogsPanel(): Promise<void> {
    if (!this.spendLogsPanel) return;
    let logs: SpendLogEntry[] = [];
    let error: string | null = null;
    try { logs = await this.client.fetchSpendLogs(50); } catch (err) { error = String(err); }
    if (this.spendLogsPanel) this.spendLogsPanel.webview.html = buildSpendLogsHtml(logs, error, this.activeTheme);
  }

  // ── Key List ────────────────────────────────────────────────────────────

  private async openKeyList(): Promise<void> {
    if (this.keyListPanel) { this.keyListPanel.reveal(vscode.ViewColumn.Beside); return; }
    this.keyListPanel = vscode.window.createWebviewPanel(
      'corellmKeyList', 'CoreLLM Keys', vscode.ViewColumn.Beside, { enableScripts: true }
    );
    this.keyListPanel.onDidDispose(() => { this.keyListPanel = undefined; });
    this.keyListPanel.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case 'refresh':
          this.refreshKeyListPanel();
          break;
        case 'exportCsv':
          this.exportKeyListCsv();
          break;
        case 'setTheme':
          this.activeTheme = msg.theme;
          if (this.keyListPanel) this.refreshKeyListPanel();
          if (this.budgetOverviewPanel) this.refreshBudgetOverview();
          if (this.spendLogsPanel) this.refreshSpendLogsPanel();
          if (this.tutorialPanel) this.refreshTutorial();
          break;
        case 'close':
          this.keyListPanel?.dispose();
          break;
      }
    });
    this.keyListPanel.webview.html = buildLoadingHtml('Loading Keys\u2026', true);

    let keys: KeyListItem[] = [];
    let error: string | null = null;
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Window, title: 'Fetching keys\u2026' },
      async () => { try { const r = await this.client.fetchKeyList(); keys = r.keys ?? []; } catch (err) { error = String(err); } }
    );
    if (this.keyListPanel) this.keyListPanel.webview.html = buildKeyListHtml(keys, error, this.activeTheme);
  }

  private async refreshKeyListPanel(): Promise<void> {
    if (!this.keyListPanel) return;
    let keys: KeyListItem[] = [];
    let error: string | null = null;
    try { const r = await this.client.fetchKeyList(); keys = r.keys ?? []; } catch (err) { error = String(err); }
    if (this.keyListPanel) this.keyListPanel.webview.html = buildKeyListHtml(keys, error, this.activeTheme);
  }

  // ── Tutorial / Getting Started ──────────────────────────────────────────

  private openTutorial(): void {
    if (this.tutorialPanel) { this.tutorialPanel.reveal(vscode.ViewColumn.One); return; }
    this.tutorialPanel = vscode.window.createWebviewPanel(
      'corellmTutorial', 'CoreLLM Tutorial', vscode.ViewColumn.One, { enableScripts: true }
    );
    this.tutorialPanel.onDidDispose(() => { this.tutorialPanel = undefined; });
    this.tutorialPanel.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case 'setTheme':
          this.activeTheme = msg.theme;
          if (this.tutorialPanel) this.refreshTutorial();
          if (this.budgetOverviewPanel) this.refreshBudgetOverview();
          if (this.spendLogsPanel) this.refreshSpendLogsPanel();
          if (this.keyListPanel) this.refreshKeyListPanel();
          break;
        case 'openSettings':
          vscode.commands.executeCommand('workbench.action.openSettings', '@ext:litellm-tools.corellm');
          break;
        case 'openBudgetOverview':
          this.openBudgetOverview();
          break;
        case 'close':
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

  // ── Export CSV ──────────────────────────────────────────────────────────

  private async exportBudgetCsv(): Promise<void> {
    if (!this.budgetOverviewPanel) return;
    const data = await this.fetchBudgetData(this.config.reportDuration);
    const rows: string[][] = [];
    const headers = ['Metric', 'Value'];
    // Key info
    const alias = data.keyInfo?.key_alias || data.keyInfo?.key_name || data.keyInfo?.key || '';
    rows.push(['Key Alias', alias]);
    rows.push(['Total Spend', String(data.keyInfo?.spend ?? 0)]);
    rows.push(['Max Budget', String(data.keyInfo?.max_budget ?? 'unlimited')]);
    rows.push(['Remaining', data.keyInfo?.max_budget != null ? String(Math.max(0, data.keyInfo.max_budget - (data.keyInfo?.spend ?? 0))) : 'unlimited']);
    // Providers
    if (data.providerBudgets?.providers) {
      rows.push(['', '']);
      rows.push(['--- Providers ---', '']);
      for (const [name, p] of Object.entries(data.providerBudgets.providers)) {
        rows.push([name, `Spend: ${p.spend ?? 0}, Budget: ${p.budget_limit ?? 'unlimited'}, Period: ${p.time_period ?? ''}`]);
      }
    }
    // Daily spend
    if (data.globalReport.length > 0) {
      rows.push(['', '']);
      rows.push(['--- Daily Spend ---', '']);
      for (const day of data.globalReport) {
        const ds = day.teams?.reduce((s, t) => s + (t.spend ?? 0), 0) ?? 0;
        rows.push([day['group-by-day'] || '', String(ds)]);
      }
    }
    const csv = [headers.join(','), ...rows.map(r => r.map(c => csvCell(c)).join(','))].join('\n');
    const doc = await vscode.workspace.openTextDocument({ content: csv, language: 'csv' });
    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage('Budget overview exported as CSV.');
  }

  private async exportSpendLogsCsv(): Promise<void> {
    if (!this.spendLogsPanel) return;
    let logs: SpendLogEntry[] = [];
    try { logs = await this.client.fetchSpendLogs(50); } catch { /* ignore */ }
    if (logs.length === 0) { vscode.window.showWarningMessage('No spend logs to export.'); return; }
    const headers = ['Time', 'Model', 'Call Type', 'Spend', 'Tokens', 'Cost/Token'];
    const rows = logs.map(l => [
      l.startTime || '',
      l.model || '',
      l.call_type || '',
      String(l.spend ?? 0),
      String(l.total_tokens ?? 0),
      (l.total_tokens ?? 0) > 0 ? String((l.spend ?? 0) / (l.total_tokens ?? 1)) : '',
    ].map(c => csvCell(c)));
    const csv = [headers.join(','), ...rows.join('\n')].join('\n');
    const doc = await vscode.workspace.openTextDocument({ content: csv, language: 'csv' });
    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage('Spend logs exported as CSV.');
  }

  private async exportKeyListCsv(): Promise<void> {
    if (!this.keyListPanel) return;
    let keys: KeyListItem[] = [];
    try { const r = await this.client.fetchKeyList(); keys = r.keys ?? []; } catch { /* ignore */ }
    if (keys.length === 0) { vscode.window.showWarningMessage('No keys to export.'); return; }
    const headers = ['Alias', 'Key', 'Spend', 'Max Budget', 'Used %', 'User ID', 'Team ID'];
    const rows = keys.map(k => [
      k.key_alias || k.key_name || '',
      k.key || '',
      String(k.spend ?? 0),
      String(k.max_budget ?? ''),
      k.max_budget && k.max_budget > 0 ? String(((k.spend ?? 0) / k.max_budget) * 100) : '',
      k.user_id || '',
      k.team_id || '',
    ].map(c => csvCell(c)));
    const csv = [headers.join(','), ...rows.join('\n')].join('\n');
    const doc = await vscode.workspace.openTextDocument({ content: csv, language: 'csv' });
    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage('Key list exported as CSV.');
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

  /** Build an ASCII bar like [██████░░░░] for a given percentage (0-100). */
  private asciiBar(pct: number, width = 10): string {
    const filled = Math.round((pct / 100) * width);
    const empty = width - filled;
    return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
  }

  private computeDisplay(data: KeyInfoResponse, mode?: number): StatusBarDisplay {
    const spend = data.spend ?? 0;
    const maxBudget = data.max_budget ?? null;
    const m = mode ?? this.displayCycleIndex;
    let remaining: number | null = null;
    let usedPct = 0;

    if (maxBudget !== null && maxBudget > 0) {
      remaining = Math.max(0, maxBudget - spend);
      usedPct = (spend / maxBudget) * 100;
    }
    const pctRemaining = maxBudget !== null && maxBudget > 0 ? 100 - usedPct : 100;
    const prefix = 'CoreLLM';
    let text: string;
    let color: string | undefined;

    const hasBudget = maxBudget !== null && maxBudget > 0;

    switch (m) {
      case 0: // Remaining budget
        if (hasBudget) {
          text = `$(database) ${prefix}: $${remaining!.toFixed(2)} left`;
          if (pctRemaining <= this.config.budgetWarningThreshold) {
            color = new vscode.ThemeColor('statusBarItem.warningForeground')?.toString() || '#ffcc00';
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
            color = new vscode.ThemeColor('statusBarItem.warningForeground')?.toString() || '#ffcc00';
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
    const lines: string[] = ['**CoreLLM** \u2014 LiteLLM Balance Monitor', ''];
    const alias = data.key_alias || data.key_name || data.key || 'N/A';
    lines.push(`**\u{1F511} Key:** \`${alias}\``);
    const spend = data.spend ?? 0;
    const maxBudget = data.max_budget ?? null;

    if (maxBudget !== null && maxBudget > 0) {
      const remaining = Math.max(0, maxBudget - spend);
      const pct = ((spend / maxBudget) * 100);
      const bar = this.asciiBar(pct);
      lines.push(`**\uD83D\uDCB0 Spend:** $${spend.toFixed(4)}`);
      lines.push(`**\uD83C\uDFAF Max Budget:** $${maxBudget.toFixed(2)}`);
      lines.push(`**\uD83D\uDCE6 Remaining:** $${remaining.toFixed(4)}`);
      lines.push(`**\uD83D\uDCCA Usage:** ${pct.toFixed(1)}% ${bar}`);
      if (data.budget_duration) lines.push(`**\uD83D\uDD52 Budget Duration:** ${data.budget_duration}`);
    } else {
      lines.push(`**\uD83D\uDCB0 Spend:** $${spend.toFixed(4)}`);
      lines.push('**\uD83D\uDCB8 Max Budget:** Not set (unlimited)');
    }
    if (data.user_id) lines.push(`**\uD83D\uDC64 User ID:** \`${data.user_id}\``);
    if (data.team_id) lines.push(`**\uD83D\uDC65 Team ID:** \`${data.team_id}\``);
    if (data.models && data.models.length > 0) {
      const ml = data.models.slice(0, 5).join(', ');
      lines.push(`**\u{1F4CB} Models:** ${ml}${data.models.length > 5 ? ` +${data.models.length - 5} more` : ''}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('$(refresh) Click to cycle display');
    lines.push('$(organization) Budget Overview');
    lines.push(`$(calendar) Range: ${DURATION_LABELS[this.config.reportDuration]}`);
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
let updateTimer: NodeJS.Timeout | undefined;

// ─── Update Checker ─────────────────────────────────────────────────────────

const EXTENSION_ID = 'litellm-tools.corellm';
const GITHUB_REPO = 'core-innovation/litellm-balance-checker';
const CURRENT_VERSION = '0.5.0';
const LAST_NOTIFIED_KEY = 'corellm.lastNotifiedVersion';

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

async function checkForUpdates(context: vscode.ExtensionContext, showUpToDate = false): Promise<void> {
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
      // Only notify once per version
      const lastNotified = context.globalState.get<string>(LAST_NOTIFIED_KEY);
      if (lastNotified === latestTag) return;
      await context.globalState.update(LAST_NOTIFIED_KEY, latestTag);

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
    vscode.commands.registerCommand('corellm.checkForUpdates', () => checkForUpdates(context, true))
  );

  manager = new BalanceStatusBarManager();
  context.subscriptions.push(manager);
  manager.start();

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

  // Check for updates on startup (silent)
  setTimeout(() => checkForUpdates(context), 5000);

  // Periodic update checks
  const updateIntervalHours = getConfig().updateCheckInterval;
  const updateIntervalMs = Math.max(3600000, updateIntervalHours * 3600000);
  updateTimer = setInterval(() => checkForUpdates(context), updateIntervalMs);

  console.log('CoreLLM activated');
}

export function deactivate(): void {
  if (updateTimer) { clearInterval(updateTimer); updateTimer = undefined; }
  if (manager) { manager.dispose(); manager = undefined; }
  console.log('CoreLLM deactivated');
}
