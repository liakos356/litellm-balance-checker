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
  startTime?: string;
  endTime?: string;
  [key: string]: unknown;
}

interface StatusBarDisplay {
  text: string;
  tooltip: string;
  color?: string;
  icon?: string;
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

    // Use adminKey if provided, otherwise fall back to apiKey
    const authKey = this.config.adminKey || this.config.apiKey;
    if (authKey) {
      headers['Authorization'] = `Bearer ${authKey}`;
      // Also set the x-litellm-api-key header which some LiteLLM versions use
      headers['x-litellm-api-key'] = authKey;
    }

    return headers;
  }

  async fetchKeyInfo(): Promise<KeyInfoResponse> {
    const url = new URL(`${this.config.endpoint}/key/info`);

    // If a specific keyToQuery is set, pass it as query param
    // Otherwise the API will return info for the key used in the Authorization header
    if (this.config.keyToQuery) {
      url.searchParams.set('key', this.config.keyToQuery);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API error ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = await response.json();
    return data as KeyInfoResponse;
  }

  async fetchSpendLogs(limit: number = 5): Promise<SpendLogEntry[]> {
    const url = new URL(`${this.config.endpoint}/spend/logs`);
    url.searchParams.set('page_size', String(limit));

    if (this.config.keyToQuery) {
      url.searchParams.set('api_key', this.config.keyToQuery);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? (data as SpendLogEntry[]) : [];
  }
}

// ─── Status Bar Manager ──────────────────────────────────────────────────────

class BalanceStatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private timer: NodeJS.Timeout | undefined;
  private client: LiteLLMApiClient;
  private config: ExtensionConfig;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.config = getConfig();
    this.client = new LiteLLMApiClient(this.config);

    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.name = 'LiteLLM Balance';
    this.statusBarItem.command = 'litellm-balance-checker.refresh';
    this.statusBarItem.tooltip = 'LiteLLM Balance Checker — Click to refresh';
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
          { location: vscode.ProgressLocation.Window, title: 'Checking LiteLLM balance...' },
          async () => {
            await this.refresh();
          }
        );
      })
    );

    this.disposables.push(
      vscode.commands.registerCommand('litellm-balance-checker.openSettings', () => {
        vscode.commands.executeCommand(
          'workbench.action.openSettings',
          '@ext:litellm-tools.litellm-balance-checker'
        );
      })
    );

    this.disposables.push(
      vscode.commands.registerCommand('litellm-balance-checker.toggleAutoRefresh', () => {
        if (this.timer) {
          this.stopAutoRefresh();
          vscode.window.showInformationMessage('LiteLLM auto-refresh disabled');
        } else {
          this.startAutoRefresh();
          vscode.window.showInformationMessage(
            `LiteLLM auto-refresh enabled (every ${this.config.refreshInterval}s)`
          );
        }
      })
    );
  }

  private watchConfigChanges(): void {
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('litellm-balance-checker')) {
          this.config = getConfig();
          this.client = new LiteLLMApiClient(this.config);

          // Restart auto-refresh with new interval
          this.stopAutoRefresh();
          if (this.config.refreshInterval > 0) {
            this.startAutoRefresh();
          }

          // Immediately refresh with new config
          this.refresh();
        }
      })
    );
  }

  private computeDisplay(data: KeyInfoResponse): StatusBarDisplay {
    const spend = data.spend ?? 0;
    const maxBudget = data.max_budget ?? null;
    const keyAlias = data.key_alias || data.key_name || '';

    let remaining: number | null = null;
    let pctUsed = 0;
    let pctRemaining = 100;

    if (maxBudget !== null && maxBudget > 0) {
      remaining = Math.max(0, maxBudget - spend);
      pctUsed = (spend / maxBudget) * 100;
      pctRemaining = 100 - pctUsed;
    }

    // Format the display
    const prefix = this.config.showKeyAlias && keyAlias
      ? `${keyAlias}: `
      : '';

    let text: string;
    let color: string | undefined;

    if (maxBudget !== null && maxBudget > 0) {
      text = `$(coin) ${prefix}$${remaining?.toFixed(2)} left of $${maxBudget.toFixed(2)}`;
      const threshold = this.config.budgetWarningThreshold;
      if (pctRemaining <= threshold) {
        color = new vscode.ThemeColor('statusBarItem.warningForeground')?.toString() || '#ffcc00';
      } else {
        color = undefined;
      }
    } else {
      // No max budget set — show spend only
      text = `$(coin) ${prefix}$${spend.toFixed(2)} spent`;
    }

    const tooltip = this.buildTooltip(data);

    return { text, tooltip, color };
  }

  private buildTooltip(data: KeyInfoResponse): string {
    const lines: string[] = ['**LiteLLM Balance Checker**', ''];

    const alias = data.key_alias || data.key_name || data.key || 'N/A';
    lines.push(`**Key:** \`${alias}\``);

    const spend = data.spend ?? 0;
    const maxBudget = data.max_budget ?? null;

    if (maxBudget !== null && maxBudget > 0) {
      const remaining = Math.max(0, maxBudget - spend);
      const pct = ((spend / maxBudget) * 100).toFixed(1);
      lines.push(`**Spend:** $${spend.toFixed(4)}`);
      lines.push(`**Max Budget:** $${maxBudget.toFixed(2)}`);
      lines.push(`**Remaining:** $${remaining.toFixed(4)}`);
      lines.push(`**Usage:** ${pct}%`);
    } else {
      lines.push(`**Spend:** $${spend.toFixed(4)}`);
      lines.push('**Max Budget:** Not set (unlimited)');
    }

    if (data.budget_duration) {
      lines.push(`**Budget Duration:** ${data.budget_duration}`);
    }
    if (data.user_id) {
      lines.push(`**User ID:** \`${data.user_id}\``);
    }
    if (data.team_id) {
      lines.push(`**Team ID:** \`${data.team_id}\``);
    }
    if (data.models && data.models.length > 0) {
      const modelList = data.models.slice(0, 5).join(', ');
      lines.push(`**Models:** ${modelList}${data.models.length > 5 ? ` +${data.models.length - 5} more` : ''}`);
    }

    lines.push('');
    lines.push('$(refresh) Click to refresh');

    return lines.join('\n');
  }

  async refresh(): Promise<void> {
    try {
      const data = await this.client.fetchKeyInfo();
      const display = this.computeDisplay(data);
      this.statusBarItem.text = display.text;
      this.statusBarItem.tooltip = display.tooltip;

      if (display.color) {
        this.statusBarItem.color = display.color;
      } else {
        this.statusBarItem.color = undefined;
      }

      // Also show recent spend if configured
      if (this.config.showSpendLogs) {
        this.fetchAndAppendSpendLogs();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.statusBarItem.text = '$(error) LiteLLM: Error';
      this.statusBarItem.tooltip = `LiteLLM Balance Checker — Error: ${msg}`;
      this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.errorForeground');

      if (!this.timer) {
        // Only show popup on manual refresh, not auto-refresh
        vscode.window.showWarningMessage(`LiteLLM Balance: ${msg}`);
      }
    }
  }

  private async fetchAndAppendSpendLogs(): Promise<void> {
    try {
      const logs = await this.client.fetchSpendLogs(3);
      if (logs.length > 0) {
        const recentTotal = logs.reduce((sum, log) => sum + (log.spend || 0), 0);
        this.statusBarItem.text += ` | recent: $${recentTotal.toFixed(4)}`;
      }
    } catch {
      // Silently ignore spend logs errors
    }
  }

  private startAutoRefresh(): void {
    if (this.config.refreshInterval <= 0) {return;}
    const ms = Math.max(5000, this.config.refreshInterval * 1000);
    this.timer = setInterval(() => {
      this.refresh();
    }, ms);
  }

  private stopAutoRefresh(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  start(): void {
    // Initial fetch
    this.refresh();

    // Start periodic refresh
    if (this.config.refreshInterval > 0) {
      this.startAutoRefresh();
    }
  }

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

  // Show activation notification on first run
  const config = getConfig();
  if (!config.apiKey && !config.adminKey) {
    vscode.window.showInformationMessage(
      'LiteLLM Balance Checker: Configure your API key in settings to get started.',
      'Open Settings'
    ).then((selection) => {
      if (selection === 'Open Settings') {
        vscode.commands.executeCommand(
          'workbench.action.openSettings',
          '@ext:litellm-tools.litellm-balance-checker'
        );
      }
    });
  }

  console.log('LiteLLM Balance Checker activated');
}

export function deactivate(): void {
  if (manager) {
    manager.dispose();
    manager = undefined;
  }
  console.log('LiteLLM Balance Checker deactivated');
}
