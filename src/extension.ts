import * as vscode from 'vscode';

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

interface ExtensionConfig {
  apiKey: string;
  adminKey: string;
  endpoint: string;
  refreshInterval: number;
  showKeyAlias: boolean;
  showSpendLogs: boolean;
  budgetWarningThreshold: number;
  keyToQuery: string;
}

function getConfig(): ExtensionConfig {
  const cfg = vscode.workspace.getConfiguration('litellm-balance-checker');
  return {
    apiKey: cfg.get<string>('apiKey', ''),
    adminKey: cfg.get<string>('adminKey', ''),
    endpoint: cfg.get<string>('endpoint', 'http://core.llm').replace(/\/+$/, ''),
    refreshInterval: cfg.get<number>('refreshInterval', 60),
    showKeyAlias: cfg.get<boolean>('showKeyAlias', true),
    showSpendLogs: cfg.get<boolean>('showSpendLogs', false),
    budgetWarningThreshold: cfg.get<number>('budgetWarningThreshold', 20),
    keyToQuery: cfg.get<string>('keyToQuery', ''),
  };
}

// ─── API Client ──────────────────────────────────────────────────────────────

class LiteLLMApiClient {
  private config: ExtensionConfig;

  constructor(config: ExtensionConfig) {
    this.config = config;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const authKey = this.config.adminKey || this.config.apiKey;
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
    const res = await fetch(url.toString(), { method: 'GET', headers: this.getHeaders() });
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
  async fetchGlobalSpendReport(days = 7): Promise<GlobalSpendReportEntry[]> {
    const end = new Date();
    const start = new Date(Date.now() - days * 86400000);
    return this.apiGet<GlobalSpendReportEntry[]>('/global/spend/report', {
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
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

function buildBudgetOverviewHtml(data: {
  keyInfo: KeyInfoResponse | null;
  providerBudgets: ProviderBudgetResponse | null;
  globalReport: GlobalSpendReportEntry[];
  spendLogs: SpendLogEntry[];
  keyError: string | null;
  providerError: string | null;
  reportError: string | null;
}): string {
  const { keyInfo, providerBudgets, globalReport, spendLogs, keyError, providerError, reportError } = data;

  // Aggregate from report
  let totalSpend = 0;
  let totalRequests = 0;
  for (const day of globalReport) {
    for (const team of day.teams ?? []) {
      totalSpend += team.spend ?? 0;
      for (const k of team.keys ?? []) {
        for (const usage of Object.values(k.usage ?? {})) {
          totalRequests += usage.requests ?? 0;
        }
      }
    }
  }

  const providers = providerBudgets?.providers;
  const providerCount = providers ? Object.keys(providers).length : 0;
  const alias = keyInfo?.key_alias || keyInfo?.key_name || keyInfo?.key || '\u2014';
  const spend = keyInfo?.spend ?? 0;
  const maxB = keyInfo?.max_budget;
  const remaining = maxB != null ? Math.max(0, maxB - spend) : null;
  const usedPct = maxB != null && maxB > 0 ? ((spend / maxB) * 100) : 0;
  const barColor = usedPct > 80 ? 'red' : usedPct > 50 ? 'yellow' : 'green';

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
</style>
</head>
<body>
<h2>\u{1F4CA} LiteLLM Budget Overview</h2>
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
<div class="card">
  <h3>\u2601\uFE0F Provider Budgets ${providerCount > 0 ? `<span class="badge">${providerCount}</span>` : ''}</h3>
  ${providerError ? `<div class="error-box">\u26A0 ${escapeHtml(providerError)}</div>` : ''}
  ${providers && providerCount > 0 ? `
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
<div class="card">
  <h3>\uD83C\uDF10 Global Spend Report (7d) <span class="badge">${globalReport.length} days</span></h3>
  ${reportError ? `<div class="error-box">\u26A0 ${escapeHtml(reportError)}</div>` : ''}
  ${globalReport.length > 0 ? `
  <div class="grid" style="margin-bottom:12px">
    <div class="stat"><div class="stat-value">${usd(totalSpend)}</div><div class="stat-label">Total 7d Spend</div></div>
    <div class="stat"><div class="stat-value">${totalRequests.toLocaleString()}</div><div class="stat-label">Requests</div></div>
  </div>
  <table><thead><tr><th>Date</th><th>Teams</th><th>Spend</th></tr></thead>
  <tbody>${globalReport.map(d => {
    const tc = d.teams?.length ?? 0;
    const ds = d.teams?.reduce((s, t) => s + (t.spend ?? 0), 0) ?? 0;
    return `<tr><td>${d['group-by-day'] ?? '\u2014'}</td><td>${tc}</td><td>${usd(ds)}</td></tr>`;
  }).join('')}</tbody></table>` : '<p style="opacity:.6">No global spend data.</p>'}
</div>
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
<div class="footer">LiteLLM Balance Checker \u00B7 ${new Date().toLocaleString()}</div>
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
<h2>\uD83D\uDCDD LiteLLM Spend Logs</h2>
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
<div class="footer">Updated: ${new Date().toLocaleString()}</div>
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
<h2>\u{1F511} LiteLLM Keys</h2>
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
<div class="footer">Updated: ${new Date().toLocaleString()}</div>
</body>
</html>`;
}

// ─── Status Bar Manager ──────────────────────────────────────────────────────

class BalanceStatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private timer: NodeJS.Timeout | undefined;
  private client: LiteLLMApiClient;
  private config: ExtensionConfig;
  private disposables: vscode.Disposable[] = [];
  private budgetOverviewPanel: vscode.WebviewPanel | undefined;
  private spendLogsPanel: vscode.WebviewPanel | undefined;
  private keyListPanel: vscode.WebviewPanel | undefined;

  constructor() {
    this.config = getConfig();
    this.client = new LiteLLMApiClient(this.config);

    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.name = 'LiteLLM Balance';
    this.statusBarItem.command = 'litellm-balance-checker.refresh';
    this.statusBarItem.tooltip = 'LiteLLM Balance Checker \u2014 Click to refresh';
    this.statusBarItem.text = '$(coin) LiteLLM: ...';
    this.statusBarItem.show();
    this.disposables.push(this.statusBarItem);

    this.registerCommands();
    this.watchConfigChanges();
  }

  private registerCommands(): void {
    this.disposables.push(
      vscode.commands.registerCommand('litellm-balance-checker.refresh', () => {
        vscode.window.withProgress(
          { location: vscode.ProgressLocation.Window, title: 'Checking LiteLLM balance\u2026' },
          async () => { await this.refresh(); }
        );
      }),
      vscode.commands.registerCommand('litellm-balance-checker.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', '@ext:litellm-tools.litellm-balance-checker');
      }),
      vscode.commands.registerCommand('litellm-balance-checker.toggleAutoRefresh', () => {
        if (this.timer) { this.stopAutoRefresh(); vscode.window.showInformationMessage('LiteLLM auto-refresh disabled'); }
        else { this.startAutoRefresh(); vscode.window.showInformationMessage(`LiteLLM auto-refresh enabled (every ${this.config.refreshInterval}s)`); }
      }),
      vscode.commands.registerCommand('litellm-balance-checker.showBudgetOverview', () => this.openBudgetOverview()),
      vscode.commands.registerCommand('litellm-balance-checker.showSpendLogs', () => this.openSpendLogs()),
      vscode.commands.registerCommand('litellm-balance-checker.listKeys', () => this.openKeyList())
    );
  }

  private watchConfigChanges(): void {
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('litellm-balance-checker')) {
          this.config = getConfig();
          this.client = new LiteLLMApiClient(this.config);
          this.stopAutoRefresh();
          if (this.config.refreshInterval > 0) this.startAutoRefresh();
          this.refresh();
        }
      })
    );
  }

  // ── Budget Overview ──────────────────────────────────────────────────────

  private async openBudgetOverview(): Promise<void> {
    if (this.budgetOverviewPanel) { this.budgetOverviewPanel.reveal(vscode.ViewColumn.One); return; }
    this.budgetOverviewPanel = vscode.window.createWebviewPanel(
      'litellmBudgetOverview', 'LiteLLM Budget Overview', vscode.ViewColumn.One, { enableScripts: false }
    );
    this.budgetOverviewPanel.onDidDispose(() => { this.budgetOverviewPanel = undefined; });
    this.budgetOverviewPanel.webview.html = '<html><body style="padding:20px;text-align:center"><p>Loading\u2026</p></body></html>';

    let keyInfo: KeyInfoResponse | null = null;
    let providerBudgets: ProviderBudgetResponse | null = null;
    let globalReport: GlobalSpendReportEntry[] = [];
    let spendLogs: SpendLogEntry[] = [];
    let keyError: string | null = null;
    let providerError: string | null = null;
    let reportError: string | null = null;

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Window, title: 'Fetching LiteLLM budget data\u2026' },
      async () => {
        const results = await Promise.allSettled([
          this.client.fetchKeyInfo(),
          this.client.fetchProviderBudgets(),
          this.client.fetchGlobalSpendReport(7),
          this.client.fetchSpendLogs(10),
        ]);
        if (results[0].status === 'fulfilled') keyInfo = results[0].value;
        else keyError = (results[0].reason as Error)?.message ?? 'Unknown error';
        if (results[1].status === 'fulfilled') providerBudgets = results[1].value;
        else providerError = (results[1].reason as Error)?.message ?? 'Unknown error';
        if (results[2].status === 'fulfilled') globalReport = results[2].value;
        else reportError = (results[2].reason as Error)?.message ?? 'Unknown error';
        if (results[3].status === 'fulfilled') spendLogs = results[3].value;
      }
    );
    if (!this.budgetOverviewPanel) return;
    this.budgetOverviewPanel.webview.html = buildBudgetOverviewHtml({
      keyInfo, providerBudgets, globalReport, spendLogs, keyError, providerError, reportError,
    });
  }

  // ── Spend Logs ───────────────────────────────────────────────────────────

  private async openSpendLogs(): Promise<void> {
    if (this.spendLogsPanel) { this.spendLogsPanel.reveal(vscode.ViewColumn.Beside); return; }
    this.spendLogsPanel = vscode.window.createWebviewPanel(
      'litellmSpendLogs', 'LiteLLM Spend Logs', vscode.ViewColumn.Beside, { enableScripts: false }
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
      'litellmKeyList', 'LiteLLM Keys', vscode.ViewColumn.Beside, { enableScripts: false }
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

  private computeDisplay(data: KeyInfoResponse): StatusBarDisplay {
    const spend = data.spend ?? 0;
    const maxBudget = data.max_budget ?? null;
    const keyAlias = data.key_alias || data.key_name || '';
    let remaining: number | null = null;
    let pctRemaining = 100;

    if (maxBudget !== null && maxBudget > 0) {
      remaining = Math.max(0, maxBudget - spend);
      pctRemaining = 100 - (spend / maxBudget) * 100;
    }
    const prefix = this.config.showKeyAlias && keyAlias ? `${keyAlias}: ` : '';
    let text: string;
    let color: string | undefined;

    if (maxBudget !== null && maxBudget > 0) {
      text = `$(coin) ${prefix}$${remaining?.toFixed(2)} left`;
      if (pctRemaining <= this.config.budgetWarningThreshold) {
        color = new vscode.ThemeColor('statusBarItem.warningForeground')?.toString() || '#ffcc00';
      }
    } else {
      text = `$(coin) ${prefix}$${spend.toFixed(2)} spent`;
    }
    return { text, tooltip: this.buildTooltip(data), color };
  }

  private buildTooltip(data: KeyInfoResponse): string {
    const lines: string[] = ['**LiteLLM Balance Checker**', ''];
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
    lines.push('$(refresh) Click to refresh  |  $(organization) Full overview -> Ctrl+Shift+B');
    return lines.join('\n');
  }

  async refresh(): Promise<void> {
    try {
      const data = await this.client.fetchKeyInfo();
      const display = this.computeDisplay(data);
      this.statusBarItem.text = display.text;
      this.statusBarItem.tooltip = display.tooltip;
      this.statusBarItem.color = display.color ?? undefined;
      if (this.config.showSpendLogs) this.fetchAndAppendSpendLogs();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // If management endpoints are blocked, try to at least show models
      if (msg.includes('lacks management permissions')) {
        const models = await this.client.fetchModels();
        this.statusBarItem.text = '$(key) LiteLLM: LLM key (limited)';
        const modelList = models.length > 0 ? `\n\n**Accessible models:** ${models.slice(0, 6).join(', ')}${models.length > 6 ? ` +${models.length - 6}` : ''}` : '';
        this.statusBarItem.tooltip =
          `**LiteLLM Balance Checker**\n\n` +
          `⚠️ This key cannot access management endpoints.\n` +
          `To see balance/budget, set an admin key in the settings.\n` +
          `Or use "keyToQuery" with this key + adminKey as proxy master.` +
          modelList;
        this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
      } else {
        this.statusBarItem.text = '$(error) LiteLLM: Error';
        this.statusBarItem.tooltip = `LiteLLM Balance Checker \u2014 Error: ${msg}`;
        this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.errorForeground');
      }
      if (!this.timer) vscode.window.showWarningMessage(`LiteLLM Balance: ${msg}`);
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

export function activate(context: vscode.ExtensionContext): void {
  console.log('LiteLLM Balance Checker activating...');
  manager = new BalanceStatusBarManager();
  context.subscriptions.push(manager);

  const config = getConfig();
  if (!config.apiKey && !config.adminKey) {
    vscode.window.showInformationMessage(
      'LiteLLM Balance Checker: Configure your API key in settings to get started.',
      'Open Settings'
    ).then((sel) => {
      if (sel === 'Open Settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', '@ext:litellm-tools.litellm-balance-checker');
      }
    });
  }
  console.log('LiteLLM Balance Checker activated');
}

export function deactivate(): void {
  if (manager) { manager.dispose(); manager = undefined; }
  console.log('LiteLLM Balance Checker deactivated');
}
